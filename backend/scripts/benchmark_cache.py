"""Warm parsed-cache microbenchmark; requires an existing valid runtime snapshot.

Never downloads data. Measures get_catalog only, excluding API propagation,
HTTP serialization, rendering and cold disk validation.
"""
import argparse
import json
import platform
import statistics
import time
from unittest.mock import patch
from backend.app import tle_fetcher
from backend.app.catalog_provider import GROUPS


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--group', choices=GROUPS, default='active')
    args = parser.parse_args()
    samples = []
    with patch.object(tle_fetcher, 'fetch_json', side_effect=RuntimeError('Benchmark never retrieves provider data.')):
        snapshot = tle_fetcher.get_catalog(args.group)
        if snapshot['mode'] != 'cache' or snapshot['cache_status'] != 'fresh':
            parser.error('An existing fresh downloaded cache is required. No provider request was sent.')
        for _ in range(5):
            started = time.perf_counter()
            snapshot = tle_fetcher.get_catalog(args.group)
            samples.append(time.perf_counter()-started)
    print(json.dumps(dict(snapshot_id=snapshot['snapshot_id'], records=len(snapshot['records']),
                          python=platform.python_version(), platform=platform.platform(),
                          seconds=samples, median_seconds=statistics.median(samples),
                          scope='get_catalog only; five warm serial reads; no provider network'), indent=2))


if __name__ == '__main__':
    main()
