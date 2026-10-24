"""Strict TLE boundary validation and descriptive (not uncertainty) metadata."""
import math
import json
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
                freshness='future' if age < 0 else 'stale' if age > 7 else 'recent',
                inclination_deg=round(math.degrees(sat.inclo), 4), eccentricity=sat.ecco,
                mean_motion_rev_day=round(sat.no_kozai*1440/(2*math.pi), 8),
                period_minutes=round(2*math.pi/sat.no_kozai, 3))

# CelesTrak GP JSON omits these redundant OMM fields. Only these defaults are
# implied by that provider; explicit incompatible values must never be accepted.
OMM_DEFAULTS = {'CENTER_NAME': 'EARTH', 'REF_FRAME': 'TEME',
                'TIME_SYSTEM': 'UTC', 'MEAN_ELEMENT_THEORY': 'SGP4'}


def normalize_omm(record):
    """Validate CelesTrak's OMM-compatible JSON without a TLE round trip."""
    if not isinstance(record, dict):
        raise ValueError('OMM record must be an object.')
    # Reject invalid JSON numbers even in optional provider fields.
    json.dumps(record, allow_nan=False)
    result = dict(record)
    for key, expected in OMM_DEFAULTS.items():
        if result.get(key, expected) != expected:
            raise ValueError(f'Unsupported OMM {key}.')
        result[key] = expected
    identifier = str(result.get('NORAD_CAT_ID', ''))
    if not identifier.isascii() or not identifier.isdigit() or not 1 <= int(identifier) <= 999999999:
        raise ValueError('Catalogue ID must be a positive integer of at most nine digits.')
    result['NORAD_CAT_ID'] = int(identifier)
    try:
        if not isinstance(result['EPOCH'], str) or 'T' not in result['EPOCH'] or len(result['EPOCH']) < 19:
            raise ValueError('OMM epoch must include a date and time.')
        epoch = datetime.fromisoformat(result['EPOCH'].replace('Z', '+00:00'))
        # Omitted offset means UTC only because TIME_SYSTEM is validated above.
        if epoch.tzinfo is None:
            epoch = epoch.replace(tzinfo=timezone.utc)
        epoch = epoch.astimezone(timezone.utc)
        if not 1957 <= epoch.year <= 9999:
            raise ValueError('Unsupported OMM epoch.')
        result['EPOCH'] = epoch.isoformat()
        for key in ('MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE',
                    'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT'):
            if isinstance(result[key], bool):
                raise ValueError('Boolean orbital parameter.')
            result[key] = float(result[key])
            if not math.isfinite(result[key]):
                raise ValueError('Non-finite OMM parameter.')
    except (KeyError, TypeError, OverflowError) as exc:
        raise ValueError('Missing or invalid required OMM field.') from exc
    if not (0 < result['MEAN_MOTION'] <= 20 and 0 <= result['ECCENTRICITY'] < 1
            and 0 <= result['INCLINATION'] <= 180
            and all(0 <= result[k] < 360 for k in ('RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY'))):
        raise ValueError('OMM elements outside supported Earth-orbit range.')
    if isinstance(result.get('EPHEMERIS_TYPE'), bool) or result.get('EPHEMERIS_TYPE', 0) not in (0, '0'):
        raise ValueError('Only GP SGP4 ephemeris type 0 is supported.')
    for key in ('ELEMENT_SET_NO', 'REV_AT_EPOCH'):
        value = str(result.get(key, 0))
        if not value.isascii() or not value.isdigit() or len(value) > 9:
            raise ValueError(f'Invalid OMM {key}.')
        result[key] = int(value)
    if result.get('CLASSIFICATION_TYPE', 'U') not in ('U', 'C', 'S'):
        raise ValueError('Invalid security classification marker.')
    for key in ('OBJECT_NAME', 'OBJECT_ID'):
        if result.get(key) is not None and (not isinstance(result[key], str) or len(result[key]) > 256):
            raise ValueError(f'Invalid OMM {key}.')
    result['OBJECT_ID'] = result.get('OBJECT_ID') or ''
    return result


class OmmSatellite:
    """Keep the canonical ID independent of sgp4 2.23's Alpha-5 identity tag.

    That tag has no dynamical role. A fixed internal tag 0 is used only above
    339999; the full provider ID remains the public identity everywhere.
    """
    def __init__(self, satellite, identifier):
        self._satellite = satellite
        self.satnum = identifier

    def __getattr__(self, name):
        return getattr(self._satellite, name)


@lru_cache(maxsize=20000)
def _omm_satellite(serialized):
    from sgp4 import omm
    fields = normalize_omm(json.loads(serialized))
    identifier = fields['NORAD_CAT_ID']
    fields['NORAD_CAT_ID'] = identifier if identifier <= 339999 else 0
    fields['EPOCH'] = datetime.fromisoformat(fields['EPOCH']).replace(tzinfo=None).isoformat(timespec='microseconds')
    fields.setdefault('CLASSIFICATION_TYPE', 'U')  # security marking, NOT object type
    fields.setdefault('OBJECT_ID', '')
    fields.setdefault('ELEMENT_SET_NO', 0)
    fields.setdefault('REV_AT_EPOCH', 0)
    fields.setdefault('EPHEMERIS_TYPE', 0)
    satellite = Satrec()
    omm.initialize(satellite, fields)  # WGS72, official sgp4 unit conversions
    return OmmSatellite(satellite, identifier)


def satellite_from_elements(line1=None, line2=None, omm=None):
    if omm is None:
        if not isinstance(line1, str) or not isinstance(line2, str):
            raise ValueError('Supply either OMM JSON or both TLE lines.')
        return validated_satellite(line1, line2)
    if line1 or line2:
        raise ValueError('Supply OMM or TLE, not both.')
    fields = normalize_omm(json.loads(omm) if isinstance(omm, str) else omm)
    return _omm_satellite(json.dumps(fields, sort_keys=True, allow_nan=False))


def record_args(record):
    return {'omm': record['omm']} if record.get('omm') is not None else {'line1': record['line1'], 'line2': record['line2']}


def record_metadata(record, at=None):
    if record.get('omm') is None:
        return element_metadata(record['line1'], record['line2'], at)
    fields = normalize_omm(record['omm'])
    sat = satellite_from_elements(omm=fields)
    epoch = datetime.fromisoformat(fields['EPOCH'])
    age = ((at or datetime.now(timezone.utc)) - epoch).total_seconds() / 86400
    return dict(norad_id=fields['NORAD_CAT_ID'], epoch=epoch.isoformat(), epoch_age_days=round(age, 3),
                freshness='future' if age < 0 else 'stale' if age > 7 else 'recent',
                inclination_deg=fields['INCLINATION'], eccentricity=fields['ECCENTRICITY'],
                mean_motion_rev_day=fields['MEAN_MOTION'], period_minutes=2*math.pi/sat.no_kozai)
