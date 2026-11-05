"""Explicit, separately cached SATCAT acquisition; never run by catalogue requests.

Run with ``python -m backend.app.metadata_refresh --help``. Operators must review
source terms for their use before enabling retrieval. No credentials are used.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import time

import requests

from .catalog_provider import GROUPS, ProviderError
from .object_metadata import MAX_BYTES, MAX_RECORDS, parse_snapshot, _load
from .tle_fetcher import _file_lock, _persist, _read_json

INTERVAL_SECONDS = 12 * 3600


def fetch_satcat(group):
    """One verified HTTPS attempt, no redirects or HTTP-error retries."""
    if group not in GROUPS:
        raise ValueError('Unsupported SATCAT group.')
    url = 'https://celestrak.org/satcat/records.php'
    try:
        response = requests.get(url, params={'GROUP': group, 'FORMAT': 'JSON'},
                                stream=True, timeout=(3, 15), allow_redirects=False,
                                headers={'User-Agent': 'OrbitalGuardian/2.0 (SATCAT research import)'})
        try:
            if response.status_code != 200:
                from email.utils import parsedate_to_datetime
                delay = INTERVAL_SECONDS
                retry = response.headers.get('Retry-After', '')
                try:
                    delay = max(delay, int(retry))
                except ValueError:
                    try:
                        delay = max(delay, int((parsedate_to_datetime(retry) - datetime.now(timezone.utc)).total_seconds()))
                    except (ValueError, TypeError, OverflowError):
                        pass
                raise ProviderError('SATCAT HTTP failure; refresh paused.', status=response.status_code,
                                    retry_after=delay, blocked=True)
            chunks, size, deadline = [], 0, time.monotonic() + 30
            for chunk in response.iter_content(chunk_size=65536):
                size += len(chunk)
                if size > MAX_BYTES or time.monotonic() > deadline:
                    raise ProviderError('SATCAT size/time budget exceeded.')
                chunks.append(chunk)
            raw = b''.join(chunks)
            records = json.loads(raw)
            if not isinstance(records, list) or not 1 <= len(records) <= MAX_RECORDS:
                raise ValueError('SATCAT must contain a bounded nonempty record list.')
            document = dict(schema_version=1, sources=[dict(provider='celestrak_satcat',
                            source_url=f'{url}?GROUP={group}&FORMAT=JSON',
                            retrieved_at=datetime.now(timezone.utc).isoformat(),
                            content_sha256=hashlib.sha256(raw).hexdigest(), records=records)])
            encoded = json.dumps(document, allow_nan=False).encode()
            parse_snapshot(encoded)  # Reject the entire update before persistence.
            return document
        finally:
            response.close()
    except requests.RequestException as exc:
        # Do not expose proxy URLs, environment secrets or transport exceptions.
        raise ProviderError('SATCAT verified HTTPS transport failed.') from exc


def refresh(directory, group='active', terms_reviewed=False, offline=False):
    """Return sanitized status; keep valid snapshots on every failed update.

    flock coordinates CLI processes sharing this directory. Corrupt status and
    unwritable coordination fail closed. No force-refresh switch bypasses policy.
    """
    if group not in GROUPS:
        raise ValueError('Unsupported SATCAT group.')
    if not terms_reviewed:
        raise ValueError('Review acquisition and redistribution terms before retrieval.')
    directory = Path(directory).resolve()
    repository = Path(__file__).resolve().parents[2]
    if directory == repository or repository in directory.parents:
        raise ValueError('Real metadata must be stored outside the repository/build context.')
    path, status_path = directory / f'{group}.json', directory / f'{group}.status.json'
    if offline:
        return {'status': 'offline', 'error': 'No metadata request attempted.'}
    try:
        with _file_lock(path):
            now = datetime.now(timezone.utc)
            status = _read_json(status_path)
            if status is None and status_path.exists():
                return {'status': 'blocked', 'error': 'Invalid refresh status; operator review required.'}
            status = status or {}
            if not isinstance(status, dict):
                return {'status': 'blocked', 'error': 'Invalid refresh status; operator review required.'}
            try:
                waiting = status.get('next_refresh_at') and now < datetime.fromisoformat(status['next_refresh_at'])
            except (ValueError, TypeError):
                return {'status': 'blocked', 'error': 'Invalid refresh status; operator review required.'}
            if status.get('blocked') or waiting:
                return status
            # Persist reservation BEFORE network: failed writes/crashes cannot
            # produce repeated downloads from independent CLI invocations.
            status = dict(status='pending', last_attempt_at=now.isoformat(),
                          next_refresh_at=(now + timedelta(seconds=INTERVAL_SECONDS)).isoformat())
            _persist(status_path, status)
            try:
                document = fetch_satcat(group)
                # Validate here too so alternate transports cannot bypass boundary.
                parse_snapshot(json.dumps(document, allow_nan=False).encode())
                _persist(path, document)
                _load.cache_clear()
                status.update(status='loaded', last_successful_refresh=document['sources'][0]['retrieved_at'])
            except (ProviderError, ValueError, KeyError, TypeError, OSError) as error:
                status.update(status='failed', error='SATCAT refresh failed; previous validated import retained.',
                              http_status=getattr(error, 'status', None), blocked=getattr(error, 'blocked', False),
                              next_refresh_at=(now + timedelta(seconds=max(INTERVAL_SECONDS, getattr(error, 'retry_after', 0)))).isoformat())
            _persist(status_path, status)
            return status
    except OSError:
        return {'status': 'blocked', 'error': 'Metadata cache is not writable; refresh cannot safely continue.'}


def main():
    import os
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', required=True, help='Writable directory outside the repository/build context')
    parser.add_argument('--group', choices=GROUPS, default='active')
    parser.add_argument('--terms-reviewed', action='store_true', help='Confirm review of terms applicable to your acquisition and use; this flag grants no rights')
    args = parser.parse_args()
    try:
        status = refresh(args.cache_dir, args.group, args.terms_reviewed, os.getenv('ORBITAL_OFFLINE') == '1')
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(status, sort_keys=True))
    return 0 if status['status'] in ('loaded', 'offline') else 1


if __name__ == '__main__':
    raise SystemExit(main())
