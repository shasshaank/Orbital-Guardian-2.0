"""
Orbital Guardian API — FastAPI application entry point.

Endpoints:
  GET /health               — Health check
  GET /satellites           — Fetch live TLE data from Celestrak
  GET /propagate            — Propagate a satellite's orbit (SGP4)
  GET /collision-check      — Check collision risk between two satellites
  GET /maneuver-recommend   — Get unvalidated maneuver candidates
"""

from fastapi import FastAPI, HTTPException, Query
from datetime import datetime, timezone
import os
import math
import time
from .orbital_data import element_metadata, validated_satellite
from .propagator import utc_time
from fastapi.middleware.cors import CORSMiddleware

from .tle_fetcher import fetch_tle_data, fetch_tle_by_catnr, get_catalog
from .propagator import propagate_satellite, get_current_position
from .collision_detector import calculate_closest_approach
from .maneuver_engine import recommend_maneuver


# --------------------------------------------------------------------------- #
# App setup
# --------------------------------------------------------------------------- #

app = FastAPI(
    title="Orbital Guardian API",
    description=(
        "Public-TLE Orbital Analysis Research Workspace. "
        "Provides public-TLE snapshots, orbital propagation, collision "
        "screening, and unvalidated heuristic maneuver candidates."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@app.get("/health")
def health_check() -> dict:
    """
    Health check endpoint.

    Returns:
        Simple status dict confirming the API is alive.
    """
    return {"status": "ok", "service": "Orbital Guardian API"}


def catalog_response(group, limit):
    started = time.perf_counter()
    catalog = get_catalog(group)
    at = datetime.now(timezone.utc)
    objects, failed = [], 0
    for sat in catalog['records'][:limit]:
        pos = get_current_position(sat['line1'], sat['line2'], at=at)
        if pos is None:
            failed += 1
            continue
        objects.append({**sat, **element_metadata(sat['line1'], sat['line2'], at),
                        **pos, 'source': catalog['source'], 'retrieved_at': catalog['retrieved_at']})
    metadata = {k: v for k, v in catalog.items() if k != 'records'}
    metadata.update(catalog_count=len(catalog['records']), returned_count=len(objects),
                    propagation_failed=failed, state_time=at.isoformat(), limit=limit,
                    stale_count=sum(x['freshness'] != 'recent' for x in objects),
                    processing_ms=round((time.perf_counter()-started)*1000, 2),
                    freshness_policy='Element age >7 days is stale; not an accuracy guarantee.')
    return {'objects': objects, 'metadata': metadata}


@app.get('/catalog')
def catalog(group: str = Query('active', pattern=r'^[a-zA-Z0-9_-]{1,40}$'),
            limit: int = Query(1000, ge=1, le=6000)):
    """Additive envelope endpoint with source and failure metadata."""
    return catalog_response(group, limit)


@app.get('/satellites')
def get_satellites(group: str = Query('active', pattern=r'^[a-zA-Z0-9_-]{1,40}$'),
                   limit: int = Query(1000, ge=1, le=6000)):
    """Legacy list shape preserved; records gain provenance fields."""
    return catalog_response(group, limit)['objects']


@app.get("/propagate")
def propagate(
    line1: str = Query(..., description="TLE line 1"),
    line2: str = Query(..., description="TLE line 2"),
    hours: int = Query(default=24, ge=1, le=168, description="Hours ahead to propagate"),
    step_minutes: int = Query(default=10, ge=1, le=60, description="Step size in minutes"),
    start_time: datetime | None = Query(default=None),
) -> list[dict]:
    """
    Propagate a satellite's orbit using SGP4.

    Args:
        line1:        TLE line 1.
        line2:        TLE line 2.
        hours:        Propagation horizon in hours.
        step_minutes: Time step between samples in minutes.

    Returns:
        List of position/velocity records with timestamps.
    """
    try:
        positions = propagate_satellite(line1, line2, hours_ahead=hours, step_minutes=step_minutes, start_time=start_time)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Propagation failed: {exc}") from exc

    if not positions:
        raise HTTPException(status_code=422, detail="SGP4 propagation returned no data; check TLE validity.")

    return positions


@app.get("/collision-check")
def check_collision(
    line1_a: str = Query(..., description="Satellite A – TLE line 1"),
    line2_a: str = Query(..., description="Satellite A – TLE line 2"),
    line1_b: str = Query(..., description="Satellite B – TLE line 1"),
    line2_b: str = Query(..., description="Satellite B – TLE line 2"),
    hours: int = Query(default=24, ge=1, le=168, description="Hours ahead to propagate"),
    start_time: datetime | None = Query(default=None),
    step_minutes: int = Query(default=1, ge=1, le=10),
) -> dict:
    """
    Check collision risk between two satellites over a given time window.

    Args:
        line1_a / line2_a: TLE lines for satellite A.
        line1_b / line2_b: TLE lines for satellite B.
        hours:             Propagation horizon in hours.

    Returns:
        Dict with min_distance_km, risk_level, and closest_event details.
    """
    try:
        start = utc_time(start_time)
        a = validated_satellite(line1_a, line2_a)
        b = validated_satellite(line1_b, line2_b)
        if a.satnum == b.satnum:
            raise ValueError("Select two distinct catalog objects.")
        pos_a = propagate_satellite(line1_a, line2_a, hours_ahead=hours, step_minutes=step_minutes, start_time=start)
        pos_b = propagate_satellite(line1_b, line2_b, hours_ahead=hours, step_minutes=step_minutes, start_time=start)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Propagation failed: {exc}") from exc

    result = calculate_closest_approach(pos_a, pos_b)
    result.update(start_time=start.isoformat(), hours=hours, step_minutes=step_minutes,
                  elements_a=element_metadata(line1_a, line2_a, start),
                  elements_b=element_metadata(line1_b, line2_b, start))
    return result


@app.get("/asset-scan")
def asset_scan(
    catnr: int = Query(..., ge=1, description="NORAD catalog number of the asset to monitor"),
    hours: int = Query(default=24, ge=1, le=168, description="Scan window in hours"),
) -> dict:
    """
    Screen a primary asset against at most 500 active-catalogue candidates.
    """
    started = time.perf_counter()
    start = datetime.now(timezone.utc)
    primary = fetch_tle_by_catnr(catnr)
    if not primary:
        raise HTTPException(status_code=404, detail="Primary asset not found.")

    all_satellites = fetch_tle_data()
    # Remove primary from candidates
    candidates = [s for s in all_satellites if s["line1"][2:7] != primary["line1"][2:7]]
    
    try:
        primary_pos = propagate_satellite(primary["line1"], primary["line2"], hours_ahead=hours, start_time=start, step_minutes=1)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to propagate primary asset: {exc}")
    risks = []
    failed = 0
    # For a hackathon demo, we limit the comparison to a reasonable number to avoid long waits,
    # or we can do a broad-phase filter. Here we'll do the top 500 candidates.
    for sat in candidates[:500]:
        try:
            sat_pos = propagate_satellite(sat["line1"], sat["line2"], hours_ahead=hours, start_time=start, step_minutes=1)
        except Exception:
            failed += 1
            continue
            
        result = calculate_closest_approach(primary_pos, sat_pos)
        if result["risk_level"] != "SAFE":
            risks.append({
                "target_name": sat["name"],
                "norad_id": element_metadata(sat["line1"], sat["line2"])["norad_id"],
                "min_distance_km": result["min_distance_km"],
                "risk_level": result["risk_level"],
                "closest_event": result["closest_event"]
            })
    
    return {
        "asset": primary["name"],
        "scan_count": len(candidates[:500])-failed,
        "attempted_count": len(candidates[:500]),
        "failed_count": failed,
        "candidate_count": len(candidates),
        "truncated": len(candidates)>500,
        "step_minutes": 1,
        "start_time": start.isoformat(),
        "processing_ms": round((time.perf_counter()-started)*1000, 2),
        "method": "sampled separation; first 500 catalog candidates only",
        "asset_elements": element_metadata(primary["line1"], primary["line2"], start),
        "risks": sorted(risks, key=lambda x: x["min_distance_km"] if x["min_distance_km"] is not None else 999999)
    }


@app.get("/maneuver-recommend")
def maneuver_recommend(
    line1: str = Query(..., description="Threatened satellite – TLE line 1"),
    line2: str = Query(..., description="Threatened satellite – TLE line 2"),
    threat_direction_x: float = Query(default=1.0, description="Threat direction X component"),
    threat_direction_y: float = Query(default=0.0, description="Threat direction Y component"),
    threat_direction_z: float = Query(default=0.0, description="Threat direction Z component"),
    threat_distance_km: float = Query(..., ge=0.0, description="Distance to threat object in km"),
    event_time: datetime | None = Query(default=None),
) -> dict:
    """
    Get illustrative, unvalidated maneuver candidates.

    Args:
        line1 / line2:         TLE data for the threatened satellite.
        threat_direction_x/y/z: Unit-vector (need not be normalised) pointing toward the threat.
        threat_distance_km:    Current closest-approach distance in km.

    Returns:
        ManeuverRecommendation dict with burn parameters and explanation.
    """
    threat_direction = {
        "x": threat_direction_x,
        "y": threat_direction_y,
        "z": threat_direction_z,
    }
    try:
        validated_satellite(line1, line2)
        if not all(math.isfinite(v) for v in [*threat_direction.values(), threat_distance_km]):
            raise ValueError("Threat inputs must be finite.")
        recommendation = recommend_maneuver(line1, line2, threat_direction, threat_distance_km, event_time=event_time)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Maneuver computation failed: {exc}") from exc

    return recommendation