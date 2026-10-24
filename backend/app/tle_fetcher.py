"""Validated GP ingestion with per-provider/group caches and explicit fallback.

The historical module/function names remain for backend import compatibility.
Runtime coordination uses flock on the supported Linux/macOS single-host model;
multiple replicas without a shared filesystem are not coordinated.
"""
import fcntl
import hashlib
import json
import logging
import os
import tempfile
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Optional
from dotenv import load_dotenv
from .orbital_data import element_metadata, normalize_omm, record_metadata, record_args
from .propagator import get_current_position
from .catalog_provider import fetch_json, GROUPS, ProviderError, validate_url

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
CACHE_FILE = DATA_DIR / 'tle_cache.json'  # read-only legacy fixture
FALLBACK_FILE = DATA_DIR / 'satellites_fallback.json'
RUNTIME_DIR = Path(os.getenv('ORBITAL_CACHE_DIR', str(DATA_DIR / 'runtime')))
BASE_URL = os.getenv('CELESTRAK_BASE_URL', 'https://celestrak.org/NORAD/elements/gp.php')
TTL_SECONDS = max(7200, int(os.getenv('ORBITAL_REFRESH_SECONDS', '7200')))
_memory = {}
_lock = Lock()
logger = logging.getLogger(__name__)


def validate_records(records):
    """Legacy fixture/TLE cache boundary; never repair invalid lines."""
    accepted, seen, rejected, duplicates = [], set(), 0, 0
    if not isinstance(records, list):
        raise ValueError('Catalog must be an array.')
    for record in records:
        try:
            line1, line2 = record['line1'], record['line2']
            key = element_metadata(line1, line2)['norad_id']
            if key in seen:
                duplicates += 1
                continue
            seen.add(key)
            accepted.append(dict(name=str(record.get('name') or key).removeprefix('0 ').strip(),
                                 line1=line1, line2=line2))
        except (ValueError, KeyError, TypeError, IndexError, OverflowError):
            rejected += 1
    return accepted, rejected, duplicates


def parse_tle(text):
    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    records, name, i = [], None, 0
    while i < len(lines):
        if lines[i].startswith('1 ') and i+1 < len(lines) and lines[i+1].startswith('2 '):
            records.append(dict(name=name or lines[i][2:7], line1=lines[i], line2=lines[i+1]))
            name = None
            i += 2
        else:
            name = lines[i]
            i += 1
    return validate_records(records)


def validate_omm_records(raw):
    """Newest epoch wins; equal epochs use canonical JSON as stable tiebreaker."""
    chosen, rejected, duplicates = {}, 0, 0
    for record in raw:
        try:
            fields = normalize_omm(record)
            key = fields['NORAD_CAT_ID']
            candidate = {'name': str(fields.get('OBJECT_NAME') or key).strip(), 'omm': fields}
            if key in chosen:
                duplicates += 1
                rank = lambda r: (r['omm']['EPOCH'], json.dumps(r['omm'], sort_keys=True, allow_nan=False))
                if rank(candidate) <= rank(chosen[key]):
                    continue
            chosen[key] = candidate
        except (ValueError, KeyError, TypeError, IndexError, OverflowError):
            rejected += 1
    return [chosen[key] for key in sorted(chosen)], rejected, duplicates


def _read_json(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError, UnicodeError):
        return None


def _persist(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as file:
            temp_name = file.name
            json.dump(payload, file, allow_nan=False)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp_name, path)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)


def _paths(group):
    namespace = hashlib.sha256((BASE_URL + '|JSON').encode()).hexdigest()[:16]
    parent = RUNTIME_DIR / namespace
    return parent / f'{group}.json', parent / f'{group}.status.json'


@contextmanager
def _file_lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.with_suffix('.lock').open('a') as file:
        fcntl.flock(file, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(file, fcntl.LOCK_UN)


def _read_snapshot(path, group):
    try:
        stat = path.stat()
    except OSError:
        return None
    stamp = (stat.st_mtime_ns, stat.st_size, stat.st_ino)
    cache_key = ('disk', str(path))
    cached = _memory.get(cache_key)
    if cached and cached[0] == stamp:
        return cached[1]
    raw = _read_json(path)
    try:
        if raw['provider_url'] != BASE_URL or raw['group'] != group or raw['format'] != 'OMM JSON':
            return None
        records, rejected, duplicates = validate_omm_records([r['omm'] for r in raw['records']])
        retrieved = datetime.fromisoformat(raw['retrieved_at'])
        if not records or rejected or duplicates or retrieved.utcoffset() is None or retrieved > datetime.now(timezone.utc):
            return None
        result = dict(raw, records=records)
        _memory[cache_key] = (stamp, result)
        return result
    except (ValueError, TypeError, KeyError, OverflowError):
        return None


def _bundled(group):
    if group != 'active':
        return None
    cache_key = ('bundled', str(CACHE_FILE), str(FALLBACK_FILE))
    if cache_key in _memory:
        return _memory[cache_key]
    for path in (CACHE_FILE, FALLBACK_FILE):
        try:
            raw = _read_json(path)
            records, rejected, duplicates = validate_records(raw)
            if records:
                payload = dict(records=records, source='Bundled legacy CelesTrak elements', provider='CelesTrak',
                            group=group, format='TLE', retrieved_at=None, last_successful_refresh=None,
                            snapshot_id=hashlib.sha256(json.dumps(records, sort_keys=True).encode()).hexdigest(),
                            received_count=len(raw), accepted_count=len(records), rejected_records=rejected,
                            duplicate_records=duplicates, validation_propagation_failed=0)
                _memory[cache_key] = payload
                return payload
        except (ValueError, TypeError):
            pass
    return None


def _view(snapshot, status, now, mode=None, offline=False):
    data = dict(snapshot or dict(records=[], source='unavailable', provider='CelesTrak', retrieved_at=None,
                                snapshot_id=None, received_count=0, accepted_count=0,
                                rejected_records=0, duplicate_records=0, validation_propagation_failed=0))
    retrieved = data['retrieved_at']
    age = max(0, (now-datetime.fromisoformat(retrieved)).total_seconds()) if retrieved else None
    bundled = bool(snapshot and not retrieved)
    stale = age is None or age >= TTL_SECONDS
    data.update(mode=mode or ('offline' if offline else 'unavailable' if not snapshot else
                             'fallback' if bundled else 'cache'),
                cache_status='bundled' if bundled else 'unavailable' if not snapshot else 'stale' if stale else 'fresh',
                cache_age_seconds=round(age, 3) if age is not None else None,
                is_stale=stale, offline=offline, refresh_interval_seconds=TTL_SECONDS,
                last_successful_refresh=retrieved, **status)
    return data


def _catalog_locked(group, offline):
    now = datetime.now(timezone.utc)
    path, status_path = _paths(group)
    # Reload disk after the cross-process lock: another worker may have refreshed.
    disk = _read_snapshot(path, group)
    memory = _memory.get((BASE_URL, group))
    snapshots = [item for item in (disk, memory) if item]
    snapshot = max(snapshots, key=lambda item: item['retrieved_at']) if snapshots else None
    status = _read_json(status_path) or _status_memory.get((BASE_URL, group), {})
    if not isinstance(status, dict):
        status = {}
    if offline:
        return _view(_bundled(group) or snapshot, {'last_error': 'Offline mode: no provider request attempted.'}, now, offline=True)
    if snapshot:
        age = (now-datetime.fromisoformat(snapshot['retrieved_at'])).total_seconds()
        if 0 <= age < TTL_SECONDS:
            return _view(snapshot, status, now)
    try:
        waiting = bool(status.get('next_refresh_at') and now < datetime.fromisoformat(status['next_refresh_at']))
    except (ValueError, TypeError):
        # Corrupt cooldown metadata must not provoke a fresh provider request.
        status = {'last_error': 'Invalid runtime refresh status; operator review required.', 'refresh_blocked': True}
        waiting = True
    if status.get('refresh_blocked') or waiting:
        return _view(snapshot or _bundled(group), status, now)
    status = dict(last_attempt_at=now.isoformat(), last_error=None, refresh_blocked=False)
    try:
        raw = fetch_json(BASE_URL, group)
        records, rejected, duplicates = validate_omm_records(raw)
        if rejected or not records:
            status.update(last_rejected_records=rejected, last_received_count=len(raw))
            raise ProviderError(f'GP validation rejected {rejected} of {len(raw)} records; previous snapshot retained.')
        # Establish propagation compatibility before replacing the valid snapshot.
        failed = sum(get_current_position(**record_args(r), at=now) is None for r in records)
        if failed == len(records):
            raise ProviderError('All GP records failed current-epoch propagation; previous snapshot retained.')
        retrieved = datetime.now(timezone.utc).isoformat()
        snapshot = dict(records=records, source='CelesTrak GP', provider='CelesTrak', provider_url=BASE_URL,
                        group=group, format='OMM JSON', retrieved_at=retrieved,
                        snapshot_id=hashlib.sha256((retrieved+json.dumps(records, sort_keys=True)).encode()).hexdigest(),
                        received_count=len(raw), accepted_count=len(records), rejected_records=rejected,
                        duplicate_records=duplicates, validation_propagation_failed=failed)
        _memory[(BASE_URL, group)] = snapshot
        try:
            _persist(path, snapshot)
        except OSError:
            status['last_error'] = 'Validated retrieval succeeded, but runtime snapshot could not be persisted.'
        status['next_refresh_at'] = (datetime.fromisoformat(retrieved)+timedelta(seconds=TTL_SECONDS)).isoformat()
        mode = 'live'  # Only the request that actually retrieved data gets this legacy enum.
    except (ProviderError, ValueError) as exc:
        status.update(last_error=str(exc), http_status=getattr(exc, 'status', None),
                      refresh_blocked=getattr(exc, 'blocked', False),
                      next_refresh_at=(now+timedelta(seconds=max(TTL_SECONDS, getattr(exc, 'retry_after', 0)))).isoformat())
        logger.warning('Catalog refresh failed for group %s: %s', group, str(exc))
        snapshot = snapshot or _bundled(group)
        mode = None
    try:
        _persist(status_path, status)
    except OSError:
        # Preserve cooldown in-process even on a read-only runtime filesystem.
        status['last_error'] = (status.get('last_error') or '') + ' Refresh status could not be persisted.'
    _status_memory[(BASE_URL, group)] = status
    return _view(snapshot, status, datetime.now(timezone.utc), mode=mode)


_status_memory = {}


def get_catalog(group='active'):
    if group not in GROUPS:
        raise ValueError('Unsupported catalog group.')
    validate_url(BASE_URL)
    offline = os.getenv('ORBITAL_OFFLINE', '0') == '1'
    with _lock:
        if offline:
            return _catalog_locked(group, True)
        path, _ = _paths(group)
        try:
            with _file_lock(path):
                return _catalog_locked(group, False)
        except OSError:
            # Do not fetch if coordination cannot be established: avoid request storms.
            return _view(_memory.get((BASE_URL, group)) or _bundled(group),
                         {'last_error': 'Runtime cache directory is not writable; provider refresh not attempted.'},
                         datetime.now(timezone.utc))


def fetch_tle_data(group='active', fmt='tle'):
    """Compatibility import: records may now contain native OMM, not TLE lines."""
    return get_catalog(group)['records']


def fetch_tle_by_catnr(catnr: int) -> Optional[dict]:
    return next((s for s in fetch_tle_data() if record_metadata(s)['norad_id'] == catnr), None)
