"""
Orbital Guardian API — FastAPI application entry point.

Endpoints:
  GET /health               — Health check
  GET /satellites           — Fetch live TLE data from Celestrak
  GET /propagate            — Propagate a satellite's orbit (SGP4)
  GET /collision-check      — Check collision risk between two satellites
  GET /maneuver-recommend   — Get AI maneuver recommendation
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .tle_fetcher import fetch_tle_data, fetch_tle_by_catnr
from .propagator import propagate_satellite, get_current_position
from .collision_detector import calculate_closest_approach
from .maneuver_engine import recommend_maneuver


# --------------------------------------------------------------------------- #
# App setup
# --------------------------------------------------------------------------- #

app = FastAPI(
    title="Orbital Guardian API",
    description=(
        "AI-Powered Space Debris Collision Prediction & Avoidance System. "
        "Provides real-time satellite tracking, orbital propagation, collision "
        "detection, and AI-driven maneuver recommendations."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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


@app.get("/satellites")
def get_satellites(
    group: str = Query(default="active", description="Celestrak satellite group"),
    limit: int = Query(default=1000, ge=1, le=6000, description="Max satellites to return"),
) -> list[dict]:
    """
    Fetch satellite TLE data and compute current positions.
    """
    try:
        tle_list = fetch_tle_data(group=group)
        tle_list = tle_list[:limit]
        
        results = []
        for sat in tle_list:
            pos = get_current_position(sat["line1"], sat["line2"])
            if pos:
                results.append({
                    "name": sat["name"],
                    "line1": sat["line1"],
                    "line2": sat["line2"],
                    "lat": pos["lat"],
                    "lon": pos["lon"],
                    "alt_km": pos["alt_km"]
                })
        return results
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Satellite fetch failed: {exc}") from exc


@app.get("/propagate")
def propagate(
    line1: str = Query(..., description="TLE line 1"),
    line2: str = Query(..., description="TLE line 2"),
    hours: int = Query(default=24, ge=1, le=168, description="Hours ahead to propagate"),
    step_minutes: int = Query(default=10, ge=1, le=60, description="Step size in minutes"),
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
        positions = propagate_satellite(line1, line2, hours_ahead=hours, step_minutes=step_minutes)
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
        pos_a = propagate_satellite(line1_a, line2_a, hours_ahead=hours)
        pos_b = propagate_satellite(line1_b, line2_b, hours_ahead=hours)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Propagation failed: {exc}") from exc

    return calculate_closest_approach(pos_a, pos_b)


@app.get("/asset-scan")
def asset_scan(
    catnr: int = Query(..., description="NORAD catalog number of the asset to monitor"),
    hours: int = Query(default=24, ge=1, le=168, description="Scan window in hours"),
) -> dict:
    """
    Scan a primary asset against the entire fleet for collision risks.
    """
    primary = fetch_tle_by_catnr(catnr)
    if not primary:
        raise HTTPException(status_code=404, detail="Primary asset not found.")

    all_satellites = fetch_tle_data()
    # Remove primary from candidates
    candidates = [s for s in all_satellites if s["line1"] != primary["line1"]]
    
    try:
        primary_pos = propagate_satellite(primary["line1"], primary["line2"], hours_ahead=hours)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to propagate primary asset: {exc}")
    risks = []
    # For a hackathon demo, we limit the comparison to a reasonable number to avoid long waits,
    # or we can do a broad-phase filter. Here we'll do the top 500 candidates.
    for sat in candidates[:500]:
        try:
            sat_pos = propagate_satellite(sat["line1"], sat["line2"], hours_ahead=hours)
        except Exception:
            continue
            
        result = calculate_closest_approach(primary_pos, sat_pos)
        if result["risk_level"] != "SAFE":
            risks.append({
                "target_name": sat["name"],
                "min_distance_km": result["min_distance_km"],
                "risk_level": result["risk_level"],
                "closest_event": result["closest_event"]
            })
    
    return {
        "asset": primary["name"],
        "scan_count": len(candidates[:500]),
        "risks": sorted(risks, key=lambda x: x["min_distance_km"] or 999999)
    }


@app.get("/maneuver-recommend")
def maneuver_recommend(
    line1: str = Query(..., description="Threatened satellite – TLE line 1"),
    line2: str = Query(..., description="Threatened satellite – TLE line 2"),
    threat_direction_x: float = Query(default=1.0, description="Threat direction X component"),
    threat_direction_y: float = Query(default=0.0, description="Threat direction Y component"),
    threat_direction_z: float = Query(default=0.0, description="Threat direction Z component"),
    threat_distance_km: float = Query(..., ge=0.0, description="Distance to threat object in km"),
) -> dict:
    """
    Get an AI-generated avoidance maneuver recommendation.

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
        recommendation = recommend_maneuver(line1, line2, threat_direction, threat_distance_km)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Maneuver computation failed: {exc}") from exc

    return recommendation