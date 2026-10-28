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
