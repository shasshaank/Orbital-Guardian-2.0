"""Offline TestClient/SGP4 serialization observations, no socket or provider I/O.
Run ORBITAL_OFFLINE=1 backend/.venv/bin/python -m backend.scripts.benchmark_api --output PATH
"""
import argparse
import hashlib
import json
import os
import platform
import time
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import app


def main():
    if os.getenv('ORBITAL_OFFLINE') != '1':
        raise SystemExit('Set ORBITAL_OFFLINE=1; this benchmark must not retrieve provider data.')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    fixture = Path('backend/data/tle_cache.json').read_bytes()
    records = json.loads(fixture)[:2]
    client = TestClient(app)
    report = dict(python=platform.python_version(), platform=platform.platform(), repeats=1,
        scope='Single offline TestClient observations including propagation and JSON; no network/GPU/RSS claim',
        fixture_sha256=hashlib.sha256(fixture).hexdigest(), catalogue=[], pairs=[])
    for limit in (100,1000,6000):
        t = time.perf_counter()
        response = client.get('/catalog',params={'limit':limit})
        elapsed = time.perf_counter()-t
        response.raise_for_status()
        metadata = response.json()['metadata']
        report['catalogue'].append(dict(limit=limit, seconds=elapsed, json_bytes=len(response.content),
            returned=metadata['returned_count'], failed=metadata['propagation_failed'],
            cache_note='First request includes offline validation; later requests reuse parsed cache'))
    params = {f'line{i}_{key}':record[f'line{i}'] for key,record in zip('ab',records) for i in (1,2)}
    for hours in (1,24,168):
        results = []
        for include in (True,False):
            t = time.perf_counter()
            response = client.get('/collision-check',params={**params,'hours':hours,'step_minutes':1,
                'start_time':'2026-06-20T00:00:00Z','include_paths':str(include).lower()})
            elapsed = time.perf_counter()-t
            response.raise_for_status()
            result = response.json()
            results.append((include,result))
            report['pairs'].append(dict(hours=hours, step_minutes=1, include_paths=include,
                seconds=elapsed, json_bytes=len(response.content), sample_count=result['sample_count'],
                minimum_km=result['min_distance_km']))
        assert results[0][1]['closest_event'] == results[1][1]['closest_event']
    Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__ == '__main__': main()
