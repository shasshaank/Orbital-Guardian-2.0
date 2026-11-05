"""Optional local SATCAT evidence; never infer type from orbital elements.

No network access or bundled metadata. Operators supply independently obtained
snapshots after reviewing the source's terms. Invalid imports fail to unknown.
"""
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import json
import os
import re
import stat as file_stat
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit


MAX_BYTES = 16 * 1024 * 1024
MAX_RECORDS = 100000
PROVIDERS = {
    'celestrak_satcat': {
        'label': 'CelesTrak SATCAT', 'host': 'celestrak.org',
        'types': {'PAY': 'payload', 'R/B': 'rocket_body', 'DEB': 'debris', 'UNK': 'unknown'},
        'terms_url': 'https://celestrak.org/usage-policy.php',
    },
    'space_track_satcat': {
        'label': 'Space-Track SATCAT', 'host': 'www.space-track.org',
        'types': {'PAYLOAD': 'payload', 'ROCKET BODY': 'rocket_body', 'DEBRIS': 'debris', 'UNKNOWN': 'unknown'},
        'terms_url': 'https://www.space-track.org/documentation',
    },
}


def catalog_id(value):
    text = str(value)
    if not text.isascii() or not text.isdigit() or not 1 <= len(text) <= 9 or not 1 <= int(text) <= 999999999:
        raise ValueError('Invalid metadata catalogue ID.')
    return int(text)


def public_url(value, host):
    if not isinstance(value, str) or len(value) > 1000:
        raise ValueError('Invalid metadata source URL.')
    url = urlsplit(value)
    # Never expose authenticated URLs/tokens in public provenance. CelesTrak's
    # documented public SATCAT selectors are the only supported query fields.
    if (url.scheme != 'https' or url.netloc != host or url.fragment or
            url.path not in ({'/satcat/records.php', '/pub/satcat.csv'} if host == 'celestrak.org' else
                             {'/basicspacedata/query/class/satcat/format/json'}) or
            any(key.upper() not in {'CATNR', 'INTDES', 'GROUP', 'NAME', 'SPECIAL',
                                   'FORMAT', 'PAYLOADS', 'ONORBIT', 'ACTIVE', 'MAX'}
                for key, _ in parse_qsl(url.query, keep_blank_values=True))):
        raise ValueError('Metadata source URL must be public HTTPS without credentials.')
    return value


def parse_snapshot(raw):
    """Validate whole import before exposing any classifications."""
    if len(raw) > MAX_BYTES:
        raise ValueError('Metadata snapshot exceeds size limit.')
    document = json.loads(raw)
    if not isinstance(document, dict) or type(document.get('schema_version')) is not int or document['schema_version'] != 1:
        raise ValueError('Unsupported metadata schema.')
    sources = document.get('sources')
    if not isinstance(sources, list) or not 1 <= len(sources) <= 8:
        raise ValueError('Expected one to eight metadata sources.')
    index, total, retrieval_times = {}, 0, []
    snapshot_id = hashlib.sha256(raw).hexdigest()
    for source in sources:
        if not isinstance(source, dict) or source.get('provider') not in PROVIDERS:
            raise ValueError('Unsupported metadata provider.')
        provider = PROVIDERS[source['provider']]
        source_url = public_url(source.get('source_url'), provider['host'])
        retrieved = datetime.fromisoformat(source['retrieved_at'].replace('Z', '+00:00'))
        if retrieved.utcoffset() is None or retrieved > datetime.now(timezone.utc):
            raise ValueError('Metadata retrieval must be a past, timezone-aware timestamp.')
        retrieval_times.append(retrieved)
        digest = source.get('content_sha256')
        if digest is not None and (not isinstance(digest, str) or not re.fullmatch('[0-9a-f]{64}', digest)):
            raise ValueError('Invalid metadata content digest.')
        records = source.get('records')
        if not isinstance(records, list):
            raise ValueError('Metadata records must be a list.')
        total += len(records)
        if total > MAX_RECORDS:
            raise ValueError('Too many metadata records.')
        for record in records:
            if not isinstance(record, dict):
                raise ValueError('Metadata record must be an object.')
            identifier = catalog_id(record.get('NORAD_CAT_ID'))
            original = record.get('OBJECT_TYPE')
            if original is not None and (not isinstance(original, str) or len(original) > 128):
                raise ValueError('Invalid metadata object type.')
            evidence = dict(norad_id=identifier, source=provider['label'],
                            provider=source['provider'], source_url=source_url,
                            terms_url=provider['terms_url'],
                            retrieved_at=retrieved.astimezone(timezone.utc).isoformat(),
                            original_type=original,
                            category=provider['types'].get(original, 'unknown'))
            if digest:
                evidence['content_sha256'] = digest
            index.setdefault(identifier, []).append(evidence)
    return index, dict(status='loaded', snapshot_id=snapshot_id,
                       record_count=total, object_count=len(index), source_count=len(sources),
                       oldest_retrieved_at=min(retrieval_times).astimezone(timezone.utc).isoformat())


@lru_cache(maxsize=4)
def _load(path, signature):
    with open(path, 'rb') as handle:
        raw = handle.read(MAX_BYTES + 1)
    return parse_snapshot(raw)


def load_metadata():
    path = os.getenv('ORBITAL_METADATA_FILE')
    if not path:
        return {}, {'status': 'not_configured'}
    try:
        stat = Path(path).stat()
        if not file_stat.S_ISREG(stat.st_mode) or stat.st_size > MAX_BYTES:
            raise ValueError('Metadata snapshot exceeds size limit.')
        index, cached = _load(path, (stat.st_ino, stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size))
        metadata = dict(cached)
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(metadata['oldest_retrieved_at'])).total_seconds()
        metadata.update(age_seconds=round(age, 3), is_stale=age >= 86400,
                        freshness_policy='Oldest source retrieval older than 24 hours is historical; no accuracy guarantee.')
        # Optional CLI status is advisory only; it never changes provenance or
        # makes a failed update look like a newly retrieved snapshot.
        status_path = Path(path).with_suffix('.status.json')
        if status_path.exists():
            try:
                with status_path.open('rb') as handle:
                    status = json.loads(handle.read(8193))
                if not isinstance(status, dict) or status.get('status') not in ('loaded', 'pending'):
                    metadata['refresh_error'] = 'Metadata refresh failed or paused; retained historical evidence is shown.'
            except (OSError, ValueError):
                metadata['refresh_error'] = 'Metadata refresh status unavailable; retained evidence is shown.'
        return index, metadata
    except (OSError, ValueError, KeyError, TypeError, AttributeError, OverflowError, RecursionError):
        # Paths, raw data and potentially sensitive error contents stay private.
        return {}, {'status': 'unavailable', 'error': 'Local classification metadata could not be validated.'}


def classification_for(identifier, index, metadata):
    identifier = catalog_id(identifier)
    evidence = index.get(identifier, [])
    categories = {entry['category'] for entry in evidence}
    status = ('unavailable' if metadata['status'] == 'unavailable' else 'missing')
    category = 'unknown'
    if evidence:
        # No source or newest-snapshot precedence: all evidence must agree.
        status = 'conflict' if len(categories) > 1 else 'unknown'
        if len(categories) == 1 and 'unknown' not in categories:
            category, status = next(iter(categories)), 'confirmed'
    return dict(norad_id=identifier, category=category, status=status,
                source='; '.join(sorted({entry['source'] for entry in evidence})) or None,
                snapshot_id=metadata.get('snapshot_id'), evidence=evidence)
