"""Opt-in real HTTPS ingestion + API contract check; never part of offline CI.

Run from the repository root with ORBITAL_CACHE_DIR set to an isolated, reusable
runtime directory. Do not clear that directory just to force another download.
"""
import argparse
import json
import os
import platform
import time
from datetime import datetime, timezone
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.tle_fetcher import get_catalog
from backend.app.catalog_provider import GROUPS


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--group', choices=GROUPS, default='stations')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if not os.getenv('ORBITAL_CACHE_DIR') or os.getenv('ORBITAL_OFFLINE') == '1':
        parser.error('Set ORBITAL_CACHE_DIR to a reusable isolated cache and ORBITAL_OFFLINE=0.')
    started = time.perf_counter()
    first = get_catalog(args.group)
    elapsed = time.perf_counter()-started
    started = time.perf_counter()
    warm = get_catalog(args.group)
    warm_elapsed = time.perf_counter()-started
    client = TestClient(app)
    response = client.get('/catalog', params={'group': args.group, 'limit': 1000}, headers={'Origin': 'http://localhost:3000'})
    envelope = response.json()
    objects = envelope.get('objects', [])
    forecast = None
    if objects and objects[0].get('omm'):
        selected = objects[0]
        forecast = client.get('/propagate', params={'omm': json.dumps(selected['omm']), 'hours': 1,
                                                   'start_time': selected['time']})
    evidence = dict(checked_at=datetime.now(timezone.utc).isoformat(), python=platform.python_version(),
                    platform=platform.platform(), group=args.group,
                    first_metadata={k: v for k, v in first.items() if k != 'records'},
                    first_seconds=round(elapsed, 4), warm_seconds=round(warm_elapsed, 4), warm_mode=warm['mode'],
                    api_status=response.status_code, metadata=envelope.get('metadata'),
                    cors_localhost=response.headers.get('access-control-allow-origin'),
                    sample_objects=[{k: o.get(k) for k in ('name', 'norad_id', 'epoch', 'freshness', 'retrieved_at', 'element_format')} for o in objects[:3]],
                    ids_above_99999=sum(r['omm']['NORAD_CAT_ID'] > 99999 for r in first['records'] if r.get('omm')),
                    forecast_status=forecast.status_code if forecast is not None else None,
                    forecast_samples=len(forecast.json()) if forecast is not None and forecast.status_code == 200 else None)
    success = first['mode'] in ('live', 'cache') and first['cache_status'] == 'fresh' and bool(objects) and forecast is not None and forecast.status_code == 200
    evidence['success'] = success
    serialized = json.dumps(evidence, indent=2, allow_nan=False)+'\n'
    print(serialized)
    if args.output:
        args.output.write_text(serialized)
    return 0 if success else 1


if __name__ == '__main__':
    raise SystemExit(main())
