"""CelesTrak GP transport. No credentials, TLE conversion or cache policy here."""
import json
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit
import requests

MAX_BYTES = 32 * 1024 * 1024
GROUPS = ('active', 'stations', 'visual', 'last-30-days', 'analyst',
          'fengyun-1c-debris', 'iridium-33-debris', 'cosmos-2251-debris')


class ProviderError(ValueError):
    def __init__(self, message, status=None, retry_after=7200, blocked=False):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after
        self.blocked = blocked


def validate_url(url):
    parts = urlsplit(url)
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError('Provider URL must be HTTPS without credentials, query or fragment.')
    return url


def _reject_nonfinite(value):
    raise ValueError(f'Invalid JSON numeric constant: {value}')


def fetch_json(url, group):
    """At most two transport attempts; never immediately retry an HTTP error.

    TLS verification remains Requests' default. Redirects are rejected so a
    configured HTTPS source cannot downgrade or forward credentials elsewhere.
    """
    validate_url(url)
    for attempt in range(2):
        try:
            response = requests.get(url, params={'GROUP': group, 'FORMAT': 'JSON'},
                                    timeout=(3, 15), stream=True, allow_redirects=False,
                                    headers={'User-Agent': 'OrbitalGuardian/2.0 (public GP research workspace)'})
            break
        except requests.exceptions.SSLError as exc:
            raise ProviderError('CelesTrak TLS verification failed; no insecure retry attempted.') from exc
        except (requests.ConnectionError, requests.Timeout) as exc:
            if attempt:
                raise ProviderError('CelesTrak connection/timeout failure after two bounded attempts.') from exc
            time.sleep(0.5)
        except requests.RequestException as exc:
            raise ProviderError('CelesTrak transport failed.') from exc
    try:
        if response.status_code != 200:
            delay = 7200
            retry = response.headers.get('Retry-After')
            if retry:
                try:
                    delay = max(delay, int(retry))
                except ValueError:
                    try:
                        delay = max(delay, int((parsedate_to_datetime(retry)-datetime.now(timezone.utc)).total_seconds()))
                    except (ValueError, TypeError, OverflowError):
                        pass
            raise ProviderError(f'CelesTrak returned HTTP {response.status_code}; refresh paused.',
                                status=response.status_code, retry_after=delay,
                                blocked=response.status_code in (301, 302, 303, 307, 308, 403, 404))
        chunks, size = [], 0
        deadline = time.monotonic() + 30
        for chunk in response.iter_content(chunk_size=65536):
            size += len(chunk)
            if size > MAX_BYTES or time.monotonic() > deadline:
                raise ProviderError('CelesTrak response exceeded the size/time budget.')
            chunks.append(chunk)
        try:
            records = json.loads(b''.join(chunks), parse_constant=_reject_nonfinite)
        except (ValueError, UnicodeError) as exc:
            raise ProviderError('CelesTrak returned unreadable JSON; valid snapshot retained.') from exc
        if not isinstance(records, list) or not 1 <= len(records) <= 50000:
            raise ProviderError('CelesTrak response must contain 1–50,000 GP records.')
        return records
    except requests.RequestException as exc:
        raise ProviderError('CelesTrak response transfer failed; valid snapshot retained.') from exc
    finally:
        response.close()
