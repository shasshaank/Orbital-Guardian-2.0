"""Offline sampled-kernel benchmark. Run from repo root; no provider/scan calls."""
import argparse
import hashlib
import json
import platform
import statistics
import time
import tracemalloc
from datetime import datetime, timedelta, timezone
from pathlib import Path
from backend.app.collision_detector import calculate_closest_approach


def fixture(count):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    a, b = [], []
    for i in range(count):
        state = dict(time=(start + timedelta(minutes=i)).isoformat(),
                     position_km=dict(x=7000., y=float(i), z=0.),
                     velocity_km_s=dict(x=0., y=1., z=0.), lat=0., lon=0., alt_km=622.)
        a.append(state)
        b.append({**state, 'position_km': dict(x=7001., y=float(i)-30.5, z=2.)})
    return a, b


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    report = dict(python=platform.python_version(), platform=platform.platform(),
                  scope='Synthetic aligned TEME kernel only; excludes SGP4, HTTP, GPU and provider work',
                  repeats=5, results=[])
    for count in (61, 1441, 10081):
        a, b = fixture(count)
        timings = []
        for _ in range(5):
            t = time.perf_counter()
            result = calculate_closest_approach(a, b)
            timings.append(time.perf_counter()-t)
        tracemalloc.start()
        calculate_closest_approach(a, b)
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        full = len(json.dumps(result).encode())
        compact = calculate_closest_approach(a, b, include_paths=False)
        report['results'].append(dict(samples=count, horizon_hours=(count-1)/60, step_minutes=1,
            dataset_sha256=hashlib.sha256(json.dumps([a,b],sort_keys=True).encode()).hexdigest(),
            seconds=timings, median_seconds=statistics.median(timings), python_peak_bytes=peak,
            full_json_bytes=full, compact_json_bytes=len(json.dumps(compact).encode()),
            min_distance_km=result['min_distance_km']))
    Path(args.output).write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
