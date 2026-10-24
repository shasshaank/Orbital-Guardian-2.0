"""Illustrative maneuver geometry, not optimization or validated flight guidance.

The legacy distance-to-delta-v mapping is retained for demonstration. Unsupported
confidence, fuel and post-burn separation fields remain present but null.
"""
import math
import numpy as np
from .propagator import get_current_position


def recommend_maneuver(satellite_line1, satellite_line2, threat_direction, threat_distance_km, event_time=None, omm=None):
    if not math.isfinite(threat_distance_km) or threat_distance_km < 0:
        raise ValueError('Distance must be finite and non-negative.')
    state = get_current_position(satellite_line1, satellite_line2, at=event_time, **({"omm": omm} if omm else {}))
    if state is None:
        raise ValueError('No valid state available for a maneuver candidate.')
    vel = np.array([state['velocity_km_s'][k] for k in 'xyz'])
    threat = np.array([threat_direction[k] for k in 'xyz'], dtype=float)
    if not np.all(np.isfinite(threat)):
        raise ValueError('Threat direction must be finite.')
    norm = np.linalg.norm(threat)
    # Zero separation gives no unique direction; explicitly disclose the arbitrary fallback.
    degenerate = norm < 1e-9
    threat = threat/norm if not degenerate else np.array([0., 0., 1.])
    cross = np.cross(vel, threat)
    cross_norm = np.linalg.norm(cross)
    burn = cross/cross_norm if cross_norm > 1e-9 else -threat
    pos = np.array([state['position_km'][k] for k in 'xyz'])
    radial = pos/np.linalg.norm(pos)
    dv = _compute_delta_v(threat_distance_km)

    def candidate(name, direction, delta_v):
        return dict(maneuver_type=name, burn_direction={k:round(float(v),6) for k,v in zip('xyz',direction)},
                    delta_v_m_s=round(delta_v,4), estimated_fuel_cost_percent=None,
                    confidence_score=None, time_to_execute='Not evaluated', new_miss_distance_km=None,
                    risk_level='UNVALIDATED', explanation='Distance-scaled heuristic; no post-burn propagation or spacecraft constraints evaluated.')
    assumptions = [
        'Distance-scaled delta-v heuristic, not an optimized burn.',
        'No spacecraft mass, propulsion, execution window or operational constraints.',
        'No post-burn trajectory, fuel consumption, confidence or collision probability computed.',
        'TEME direction is perpendicular to velocity and supplied threat, not necessarily the orbital-plane normal.',
        'Geometry is evaluated at the supplied event time; this is not a proposed execution epoch or flight command.'
    ]
    if degenerate: assumptions.append('Zero threat vector: arbitrary +Z reference used; direction is underdetermined.')
    return dict(primary=candidate('Perpendicular geometry candidate',burn,dv),
                tradeoffs=[candidate('Higher delta-v candidate',burn,dv*3.5), candidate('Radial candidate',radial,dv*1.5)],
                status='unvalidated_candidate',frame='TEME',state_time=state['time'], assumptions=assumptions)


def _compute_delta_v(distance):
    if distance < 1: return 5.0
    if distance < 5: return 3+(5-distance)*0.4
    if distance < 10: return 2+(10-distance)*0.2
    if distance < 50: return 0.5+(50-distance)/40*1.5
    return max(0.05,0.5*math.exp(-distance/200))
