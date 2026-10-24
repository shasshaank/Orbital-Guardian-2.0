"""SGP4 TEME states and approximate Earth-fixed WGS84 coordinates.

UTC approximates UT1; polar motion is omitted. Not precision ITRF geodesy.
"""
import math
from datetime import datetime, timedelta, timezone
from typing import Optional
from sgp4.api import jday, SGP4_ERRORS
from sgp4.propagation import gstime
from .orbital_data import satellite_from_elements


def utc_time(value=None):
    value = value or datetime.now(timezone.utc)
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('Timestamp must include a UTC offset.')
    return value.astimezone(timezone.utc)


def state_at(satellite, at):
    at = utc_time(at)
    jd, fr = jday(at.year, at.month, at.day, at.hour, at.minute, at.second+at.microsecond/1e6)
    error, position, velocity = satellite.sgp4(jd, fr)
    if error or not all(math.isfinite(v) for v in (*position, *velocity)):
        raise ValueError(f'SGP4 state unavailable: {SGP4_ERRORS.get(error, "non-finite state")}')
    lat, lon, altitude = _teme_to_geodetic(*position, at)
    return dict(time=at.isoformat(), position_km=dict(zip('xyz', position)),
                velocity_km_s=dict(zip('xyz', velocity)), lat=lat, lon=lon, alt_km=altitude,
                frame='TEME', geodetic_model='WGS84; GMST; UTC≈UT1; polar motion omitted')


def propagate_satellite(line1=None, line2=None, hours_ahead=24, step_minutes=10, start_time=None, omm=None):
    if not 1 <= hours_ahead <= 168 or not 1 <= step_minutes <= 60:
        raise ValueError('Unsupported propagation window or step.')
    sat = satellite_from_elements(line1, line2, omm)
    start = utc_time(start_time)
    # Include the endpoint and preserve every timestamp; never silently drop a state.
    minutes = list(range(0, int(hours_ahead*60)+1, step_minutes))
    if minutes[-1] != hours_ahead*60:
        minutes.append(hours_ahead*60)
    return [state_at(sat, start+timedelta(minutes=m)) for m in minutes]


def get_current_position(line1=None, line2=None, at=None, omm=None) -> Optional[dict]:
    try:
        return state_at(satellite_from_elements(line1, line2, omm), utc_time(at))
    except ValueError:
        return None


def _teme_to_geodetic(x_km, y_km, z_km, at):
    at = utc_time(at)
    jd, fr = jday(at.year, at.month, at.day, at.hour, at.minute, at.second+at.microsecond/1e6)
    theta = gstime(jd+fr)
    x = math.cos(theta)*x_km + math.sin(theta)*y_km
    y = -math.sin(theta)*x_km + math.cos(theta)*y_km
    p = math.hypot(x, y)
    a, f = 6378.137, 1/298.257223563
    e2 = f*(2-f)
    if p < 1e-10:
        return math.copysign(90, z_km), 0.0, abs(z_km)-a*(1-f)
    lat = math.atan2(z_km, p*(1-e2))
    for _ in range(8):
        n = a/math.sqrt(1-e2*math.sin(lat)**2)
        lat = math.atan2(z_km+e2*n*math.sin(lat), p)
    n = a/math.sqrt(1-e2*math.sin(lat)**2)
    altitude = p/math.cos(lat)-n
    return math.degrees(lat), math.degrees(math.atan2(y, x)), altitude
