"""
Collision Detection Engine for Orbital Guardian.

Provides pairwise closest-approach analysis and fleet-wide collision scanning.
"""

import numpy as np


# Risk-level distance thresholds (km)
THRESHOLD_CRITICAL_KM = 10.0
THRESHOLD_WARNING_KM = 50.0


def calculate_closest_approach(
    positions_a: list[dict],
    positions_b: list[dict],
    threshold_km: float = THRESHOLD_CRITICAL_KM,
    include_paths: bool = True,
) -> dict:
    """
    Find the minimum separation distance between two propagated position series.

    The two series must be time-aligned (same timestamps / same step size).

    Args:
        positions_a:   Propagated positions for satellite A.
        positions_b:   Propagated positions for satellite B.
        threshold_km:  Distance below which an event is considered CRITICAL.

    Returns:
        Dict with keys:
            - min_distance_km  (float)
            - risk_level       ("CRITICAL" | "WARNING" | "SAFE")
            - closest_event    (dict with time, distance_km, position_a, position_b)
                               or None if no positions are available.
    """
    if not positions_a or not positions_b:
        return {
            "min_distance_km": None,
            "risk_level": "UNKNOWN",
            "closest_event": None,
            "method": "sampled separation",
        }

    if len(positions_a) != len(positions_b) or any(a["time"] != b["time"] for a, b in zip(positions_a, positions_b)):
        raise ValueError("State series must have identical timestamps; incomplete grids cannot be screened.")

    if any(p.get('frame', 'TEME') != 'TEME' for p in [*positions_a, *positions_b]):
        raise ValueError('Screening requires both state series in TEME kilometres.')
    if not np.isfinite(threshold_km) or threshold_km < 0:
        raise ValueError("Threshold must be finite and nonnegative.")
    # Named axes are deliberate: dictionary insertion order is not a frame.
    def vectors(states, field):
        values = np.array([[p[field][k] for k in 'xyz'] for p in states], dtype=float)
        if not np.all(np.isfinite(values)):
            raise ValueError("Non-finite state cannot be screened.")
        return values

    delta = vectors(positions_a, 'position_km') - vectors(positions_b, 'position_km')
    relative_velocity = vectors(positions_a, 'velocity_km_s') - vectors(positions_b, 'velocity_km_s')
    distances = np.linalg.norm(delta, axis=1)
    if not np.all(np.isfinite(distances)):
        raise ValueError("State separation overflowed the supported numeric range.")
    index = int(np.argmin(distances))  # preserves first sample on ties
    minimum = float(distances[index])
    pa, pb = positions_a[index], positions_b[index]
    result = {
        "min_distance_km": round(minimum, 6),
        "risk_level": _classify_risk(minimum, threshold_km),
        "closest_event": {
            "time": pa["time"], "distance_km": round(minimum, 6),
            "relative_velocity_km_s": float(np.linalg.norm(relative_velocity[index])),
            "position_a": pa["position_km"], "position_b": pb["position_km"],
            "location_a": {k: pa[k] for k in ('lat', 'lon', 'alt_km')},
            "location_b": {k: pb[k] for k in ('lat', 'lon', 'alt_km')},
        },
        "method": "sampled separation; not continuous TCA",
        "probability_of_collision": None,
        "sample_count": len(positions_a),
        "frame": "TEME",
    }
    if include_paths:
        result.update(path_a=positions_a, path_b=positions_b)
    else:
        # Full precision separation series keeps the plot without duplicated states.
        result['separation_km'] = distances.tolist()
    return result


def scan_for_collisions(
    satellites: list[dict],
    propagated_positions: list[list[dict]],
    hours_ahead: int = 24,
    threshold_km: float = THRESHOLD_WARNING_KM,
) -> list[dict]:
    """
    Scan a list of satellites pairwise and return all collision risk events.

    Args:
        satellites:           List of satellite dicts (name, line1, line2).
        propagated_positions: Pre-propagated positions for each satellite (same order).
        hours_ahead:          Propagation horizon in hours (informational only here).
        threshold_km:         Minimum separation to flag a pair as a risk.

    Returns:
        List of risk event dicts, each containing:
            - satellite_a  (name)
            - satellite_b  (name)
            - min_distance_km
            - risk_level
            - closest_event
        Only pairs with risk_level != "SAFE" are included.
    """
    risks: list[dict] = []
    n = len(satellites)

    for i in range(n):
        for j in range(i + 1, n):
            result = calculate_closest_approach(
                propagated_positions[i],
                propagated_positions[j],
                threshold_km=THRESHOLD_CRITICAL_KM,
            )
            if result["risk_level"] != "SAFE":
                risks.append(
                    {
                        "satellite_a": satellites[i]["name"],
                        "satellite_b": satellites[j]["name"],
                        **result,
                    }
                )

    # Sort by distance ascending (most critical first)
    risks.sort(key=lambda r: r["min_distance_km"] if r["min_distance_km"] is not None else float("inf"))
    return risks


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _classify_risk(distance_km: float, threshold_km: float = THRESHOLD_CRITICAL_KM) -> str:
    """
    Classify a closest-approach distance into a risk level string.

    Args:
        distance_km:   Closest approach distance in km.
        threshold_km:  Critical threshold in km.

    Returns:
        "CRITICAL", "WARNING", or "SAFE".
    """
    if distance_km < threshold_km:
        return "CRITICAL"
    if distance_km < THRESHOLD_WARNING_KM:
        return "WARNING"
    return "SAFE"


def refine_closest_approach(result, positions_a, positions_b, evaluate_a, evaluate_b,
                            tolerance_seconds=0.1):
    """Refine candidate intervals using fresh, same-epoch TEME states.

    Candidate intervals include sampled local minima and relative linear-motion
    minima inside each interval (even when both endpoints are far apart).
    Golden-section search assumes a unimodal candidate bracket. This is a
    numerical estimate, not a conservative guarantee for arbitrary dynamics.
    """
    from datetime import datetime, timedelta
    if not positions_a or len(positions_a) != len(positions_b):
        raise ValueError('Refinement requires complete aligned states.')
    times = [datetime.fromisoformat(p['time']) for p in positions_a]
    if any(t.utcoffset() is None for t in times):
        raise ValueError('Refinement timestamps must be timezone aware.')
    offsets = [(t-times[0]).total_seconds() for t in times]
    if any(b <= a for a, b in zip(offsets, offsets[1:])):
        raise ValueError('Refinement timestamps must strictly increase.')
    r = np.array([[b['position_km'][k]-a['position_km'][k] for k in 'xyz']
                  for a, b in zip(positions_a, positions_b)])
    v = np.array([[b["velocity_km_s"][k]-a["velocity_km_s"][k] for k in "xyz"] for a, b in zip(positions_a, positions_b)])
    d2 = np.sum(r*r, axis=1)
    brackets = set()
    for i in range(len(times)-1):
        delta = r[i+1]-r[i]
        denom = float(delta@delta)
        fraction = -float(r[i]@delta)/denom if denom > 0 else -1
        if 0 < fraction < 1 or (r[i]@v[i] < 0 and r[i+1]@v[i+1] > 0):
            brackets.add((offsets[i], offsets[i+1]))
    for i in range(1, len(times)-1):
        if d2[i] <= d2[i-1] and d2[i] <= d2[i+1] and (d2[i] < d2[i-1] or d2[i] < d2[i+1]):
            brackets.add((offsets[i-1], offsets[i+1]))
    best = result['closest_event']
    best_distance = float(np.sqrt(np.min(d2)))
    evaluations = 0
    def evaluate(seconds):
        nonlocal best, best_distance, evaluations
        at = times[0]+timedelta(seconds=seconds)
        a, b = evaluate_a(at), evaluate_b(at)
        if a['time'] != b['time'] or datetime.fromisoformat(a['time']) != at:
            raise ValueError('Refined states must use the requested shared epoch.')
        candidate = calculate_closest_approach([a], [b], include_paths=False)
        distance = float(np.linalg.norm([b['position_km'][k]-a['position_km'][k] for k in 'xyz']))
        evaluations += 1
        if distance < best_distance:
            best_distance, best = distance, candidate['closest_event']
        return distance*distance
    ratio = (5**0.5-1)/2
    for left, right in sorted(brackets):
        c, d = right-ratio*(right-left), left+ratio*(right-left)
        fc, fd = evaluate(c), evaluate(d)
        while right-left > tolerance_seconds:
            if fc <= fd:
                right, d, fd = d, c, fc
                c = right-ratio*(right-left); fc = evaluate(c)
            else:
                left, c, fc = c, d, fd
                d = left+ratio*(right-left); fd = evaluate(d)
        evaluate((left+right)/2)
    result.update(minimum_sampled_separation_km=result['min_distance_km'],
                  sampled_closest_event=result['closest_event'],
                  min_distance_km=round(best_distance, 6), closest_event=best,
                  risk_level=_classify_risk(best_distance),
                  method='coarse samples plus relative-motion candidate brackets and SGP4 golden-section refinement',
                  refinement=dict(time_resolution_seconds=tolerance_seconds,
                                  candidate_intervals=len(brackets), evaluations=evaluations,
                                  exhaustive=False),
                  thresholds_km=dict(critical=10, warning=50))
    return result
