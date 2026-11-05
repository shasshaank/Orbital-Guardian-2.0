# Models and numerical limits

## States and coordinates

SGP4 uses WGS72 dynamics and produces TEME position in kilometres and velocity in kilometres per second. The globe converts states to WGS84 geodetic coordinates using an approximate GMST rotation, with UTC standing in for UT1 and no polar motion. This display conversion is separate from the TEME distance calculation.

Element epoch describes the fitted mean orbit. Retrieval time records acquisition. State time is the prediction timestamp. None is a sensor observation timestamp. A recent epoch is not an uncertainty estimate; old bundled elements are unsuitable for current operational decisions.

Native OMM fields retain precision and full numeric IDs through 999,999,999. The SGP4 wrapper keeps public identity separate from its limited internal tag. Vallado reference tests and full-ID trajectory comparisons cover numerical compatibility, not every orbital regime.

## Close approaches

Both objects are propagated on one UTC grid. Screening checks every aligned sample and returns the first minimum on a tie. Positions and velocities must be finite; missing or incompatible states fail explicitly. The distance kernel is checked against scalar Euclidean distances and seven analytic encounter cases, including between-sample crossings.

The reported closest event is a **sampled minimum**. One-minute sampling can miss an encounter, so a result above the thresholds does not prove safety. The 10 km and 50 km bands are descriptive screening thresholds. There is no continuous TCA refinement or conservative geometric exclusion stage. A representative independent orbital encounter corpus is still needed before introducing adaptive refinement.

Asset scans attempt at most the first 500 non-primary active-group candidates. Successful, failed, attempted and skipped counts are explicit. A truncated scan does not cover the whole population. Aborting a browser request prevents stale UI updates; it does not cancel server CPU work.

Collision probability is unavailable because covariance, size assumptions, encounter geometry and a validated probability method are absent. Maneuver candidates are unvalidated direction/impulse heuristics. They do not propagate a post-burn orbit, re-screen the result, or establish fuel requirements, confidence or operational suitability.

## Globe

Category glyphs are original instanced geometry: green payload body/panels, red debris, amber rocket body and neutral unknown. Shared metadata rules govern the globe, legend, catalogue and inspector. Size is exaggerated. At distance, or above 2,000 loaded visible objects, geometry is simplified. Visual transforms never enter analytical calculations.

The selected object alone advances with the forecast timeline; other markers remain at the catalogue snapshot. The Earth map is schematic. Neither the illustration nor the rendered globe is observational imagery.

## Reproducible benchmarks

Run from the repository root:

```bash
ORBITAL_OFFLINE=1 backend/.venv/bin/python -m backend.scripts.benchmark_screening --output /tmp/screening.json
ORBITAL_OFFLINE=1 backend/.venv/bin/python -m backend.scripts.benchmark_api --output /tmp/api.json
node frontend/scripts/benchmark-glyphs.cjs /tmp/glyphs.json
```

The retained 28 October measurements used Python 3.11.15 / macOS ARM64 and Node 22.11.0. Raw data includes environment, fixture hashes and repetitions in the three `benchmark-*-2026-10-28.json` files in this directory.

| Workload | Previous | Current implementation | Scope |
| --- | ---: | ---: | --- |
| 10,081-state distance kernel | 77.98 ms | 27.25 ms | Median of five calls; synthetic input; excludes propagation/HTTP |
| 168 h pair response | 7,347,838 B | 187,264 B | Full vs compact JSON; every separation sample retained |
| Same pair elapsed | 475.95 ms | 273.52 ms | One sequential TestClient observation; not a latency distribution |

The vectorized kernel uses more temporary array memory (about 2.02 MB Python-tracked peak in that workload, excluding input/RSS). Compact responses reduce serialization and browser allocation; both full trajectories are still propagated in backend memory. CPU glyph preparation at 100/1,000/6,000 objects does not establish GPU frame time or picking performance. Do not repeat the expensive 500-candidate maximum-horizon scan without a concrete reason.

A browser harness is available through `npm run benchmark:browser` in `frontend`. It measures the production glyph geometry, synthetic instance placement, GPU queries when available, and picking costs. It excludes React/API/labels, and rejects hidden/occluded runs as performance evidence. See [release checks](RELEASE_READINESS.md) for reproduction and current acceptance limits.
