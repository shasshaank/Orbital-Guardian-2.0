"""Validated public catalog ingestion with per-group TTL and isolated runtime cache."""
import json
import logging
import os
import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Optional
import requests
from dotenv import load_dotenv
from .orbital_data import element_metadata

load_dotenv(Path(__file__).resolve().parent.parent / '.env')
DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
CACHE_FILE = DATA_DIR / 'tle_cache.json'  # read-only legacy fixture
FALLBACK_FILE = DATA_DIR / 'satellites_fallback.json'
RUNTIME_DIR = Path(os.getenv('ORBITAL_CACHE_DIR', str(DATA_DIR / 'runtime')))
BASE_URL = os.getenv('CELESTRAK_BASE_URL', 'https://celestrak.org/NORAD/elements/gp.php')
TTL_SECONDS = 900
_memory = {}
_lock = Lock()
logger = logging.getLogger(__name__)


def validate_records(records):
    accepted, seen, rejected, duplicates = [], set(), 0, 0
    if not isinstance(records, list):
        raise ValueError('Catalog must be an array.')
    for record in records:
        try:
            line1, line2 = record['line1'], record['line2']
            metadata = element_metadata(line1, line2)
            key = metadata['norad_id']
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
    records = []
    name = None
    i = 0
    while i < len(lines):
        if lines[i].startswith('1 ') and i+1 < len(lines) and lines[i+1].startswith('2 '):
            records.append(dict(name=name or lines[i][2:7], line1=lines[i], line2=lines[i+1]))
            name = None; i += 2
        else:
            name = lines[i]; i += 1
    return validate_records(records)


def _read_cache(path, legacy=False):
    try:
        raw = json.loads(path.read_text())
        records = raw if legacy else raw['records']
        valid, rejected, duplicates = validate_records(records)
        if valid:
            return dict(records=valid, retrieved_at=None if legacy else raw.get('retrieved_at'),
                        source='Celestrak legacy cache' if legacy else raw.get('source', 'Celestrak'),
                        rejected_records=rejected, duplicate_records=duplicates)
    except (OSError, ValueError, KeyError, TypeError):
        pass
    return None


def _persist(path, payload):
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=RUNTIME_DIR, delete=False) as file:
            temp_name = file.name
            json.dump(payload, file, allow_nan=False)
        os.replace(temp_name, path)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)


def get_catalog(group='active'):
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,40}', group):
        raise ValueError('Invalid catalog group.')
    with _lock:
        now = time.monotonic()
        if group in _memory and now < _memory[group][0]:
            return _memory[group][1]
        path = RUNTIME_DIR / f'{group}.json'
        disk = _read_cache(path)
        if disk and disk['retrieved_at']:
            try:
                age = (datetime.now(timezone.utc)-datetime.fromisoformat(disk['retrieved_at'])).total_seconds()
                if 0 <= age < TTL_SECONDS:
                    payload = dict(disk, mode='cache', group=group, last_error=None)
                    _memory[group] = (now + TTL_SECONDS-age, payload)
                    return payload
            except (ValueError, TypeError):
                pass
        error = None
        if os.getenv('ORBITAL_OFFLINE', '0') != '1':
            try:
                if not BASE_URL.startswith('https://'):
                    raise ValueError('Catalog source must use HTTPS.')
                response = requests.get(BASE_URL, params={'GROUP': group, 'FORMAT': 'tle'},
                                        timeout=(3, 8), headers={'User-Agent': 'OrbitalGuardian/2.0'})
                response.raise_for_status()
                records, rejected, duplicates = parse_tle(response.text)
                if not records:
                    raise ValueError('Source returned no valid TLE records.')
                payload = dict(records=records, source='Celestrak', mode='live', group=group,
                               retrieved_at=datetime.now(timezone.utc).isoformat(),
                               rejected_records=rejected, duplicate_records=duplicates, last_error=None)
                try:
                    _persist(path, payload)
                except OSError:
                    payload['last_error'] = 'Runtime cache could not be persisted.'
                _memory[group] = (now+TTL_SECONDS, payload)
                return payload
            except (requests.RequestException, ValueError):
                error = 'Live catalog request failed; using validated local data if available.'
                logger.warning('Catalog retrieval failed for group %s', group)
        else:
            error = 'Offline mode: no live source request attempted.'
        # Legacy records are known to be from active, never substitute for another group.
        fallback = disk or (_read_cache(CACHE_FILE, True) if group == 'active' else None)
        if not fallback and group == 'active':
            fallback = _read_cache(FALLBACK_FILE, True)
        payload = dict(fallback or dict(records=[], source='unavailable', retrieved_at=None,
                                       rejected_records=0, duplicate_records=0),
                       mode='offline' if os.getenv('ORBITAL_OFFLINE') == '1' else 'fallback',
                       group=group, last_error=error)
        _memory[group] = (now+60, payload)  # short failure backoff, no request storm
        return payload


def fetch_tle_data(group='active', fmt='tle'):
    return get_catalog(group)['records']


def fetch_tle_by_catnr(catnr: int) -> Optional[dict]:
    return next((s for s in fetch_tle_data() if element_metadata(s['line1'], s['line2'])['norad_id'] == catnr), None)
