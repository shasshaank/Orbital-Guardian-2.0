"""Strict TLE boundary validation and descriptive (not uncertainty) metadata."""
import math
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from sgp4.api import Satrec
from sgp4.io import verify_checksum, twoline2rv
from sgp4.earth_gravity import wgs72


@lru_cache(maxsize=20000)
def validated_satellite(line1: str, line2: str) -> Satrec:
    if len(line1) != 69 or len(line2) != 69:
        raise ValueError('TLE lines must contain exactly 69 characters.')
    if not line1.startswith('1 ') or not line2.startswith('2 ') or line1[2:7] != line2[2:7]:
        raise ValueError('TLE line numbers or catalog identifiers do not match.')
    if not line1[-1].isdigit() or not line2[-1].isdigit():
        raise ValueError('TLE checksums are required.')
    verify_checksum(line1, line2)
    # The Python parser checks fixed-column format more strictly than the C++ parser.
    twoline2rv(line1, line2, wgs72)
    sat = Satrec.twoline2rv(line1, line2)
    values = (sat.ecco, sat.inclo, sat.nodeo, sat.argpo, sat.mo, sat.no_kozai, sat.bstar)
    if not all(math.isfinite(v) for v in values):
        raise ValueError('Orbital elements must be finite.')
    if not 0 <= sat.ecco < 1 or not 0 <= sat.inclo <= math.pi or sat.no_kozai <= 0:
        raise ValueError('Orbital elements are outside the supported range.')
    return sat


def element_metadata(line1: str, line2: str, at=None) -> dict:
    sat = validated_satellite(line1, line2)
    year = int(line1[18:20]); year += 2000 if year < 57 else 1900
    epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=float(line1[20:32])-1)
    age = ((at or datetime.now(timezone.utc)) - epoch).total_seconds()/86400
    return dict(norad_id=sat.satnum, epoch=epoch.isoformat(), epoch_age_days=round(age, 3),
                freshness='future' if age < -1 else 'stale' if age > 7 else 'recent',
                inclination_deg=round(math.degrees(sat.inclo), 4), eccentricity=sat.ecco,
                mean_motion_rev_day=round(sat.no_kozai*1440/(2*math.pi), 8),
                period_minutes=round(2*math.pi/sat.no_kozai, 3))
