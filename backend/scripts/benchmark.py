"""Run from repository root: backend/.venv/bin/python -m backend.scripts.benchmark."""
import json
import platform
import statistics
import time
from datetime import datetime, timezone
from pathlib import Path
from backend.app.propagator import propagate_satellite
from backend.app.collision_detector import calculate_closest_approach
from backend.app.main import catalog_response

records=json.loads(Path('backend/data/tle_cache.json').read_text())[:100]
start=datetime(2026,6,20,tzinfo=timezone.utc)
results={'python':platform.python_version(),'platform':platform.platform(),'objects':len(records),'start_time':start.isoformat()}
for step in (10,1):
    timings=[]
    for _ in range(3):
        t=time.perf_counter()
        paths=[propagate_satellite(s['line1'],s['line2'],24,step,start) for s in records]
        elapsed=time.perf_counter()-t;timings.append(elapsed)
    t=time.perf_counter()
    for path in paths[1:]:calculate_closest_approach(paths[0],path)
    results[f'24h_step_{step}min']={'samples_per_object':len(paths[0]),'propagation_seconds':timings,
                                 'median_seconds':statistics.median(timings),'99_pair_checks_seconds':time.perf_counter()-t}
for label in ['cold_catalog','warm_catalog']:
    t=time.perf_counter();catalog=catalog_response('active',1000)
    results[label]={'seconds':time.perf_counter()-t,'returned':len(catalog['objects']),'mode':catalog['metadata']['mode']}
print(json.dumps(results,indent=2))
