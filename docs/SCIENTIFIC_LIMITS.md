# Models and numerical limits

## States and coordinates

SGP4 uses WGS72 dynamics and produces TEME position in kilometres and velocity in kilometres per second. The globe converts states to WGS84 geodetic coordinates using an approximate GMST rotation, with UTC standing in for UT1 and no polar motion. This display conversion is separate from the TEME distance calculation.

Element epoch describes the fitted mean orbit. Retrieval time records acquisition. State time is the prediction timestamp. None is a sensor observation timestamp. A recent epoch is not an uncertainty estimate; old bundled elements are unsuitable for current operational decisions.

Native OMM fields retain precision and full numeric IDs through 999,999,999. The SGP4 wrapper keeps public identity separate from its limited internal tag. Vallado reference tests and full-ID trajectory comparisons cover numerical compatibility, not every orbital regime.

## Close approaches

Both objects are propagated on one UTC grid. Screening checks every aligned sample and returns the first minimum on a tie. Positions and velocities must be finite; missing or incompatible states fail explicitly. The distance kernel is checked against scalar Euclidean distances and seven analytic encounter cases, including between-sample crossings.

The API retains the coarse sampled minimum and reports a separate refined closest-approach estimate. Relative linear-motion minima inside each interval, closing-to-opening relative velocity, and sampled local minima create candidate brackets. Each bracket is searched independently using fresh SGP4 states at shared UTC epochs and golden-section minimization to a 0.1-second time bracket. Window endpoints remain candidates. Multiple candidate minima are retained during the search; the best is reported. Candidate discovery and unimodal bracket minimization are heuristic, not conservative interval bounds for arbitrary dynamics. A 0.1-second bracket is numerical resolution, not TCA accuracy. One-minute sampling can miss an encounter, so a result above the thresholds does not prove safety. The 10 km and 50 km bands are descriptive screening thresholds. There is no conservative geometric exclusion stage or exhaustive continuous safety guarantee. A representative independent orbital encounter corpus is still needed to establish candidate-discovery coverage.

Asset scans attempt at most the first 500 non-primary active-group candidates. Successful, failed, attempted and skipped counts are explicit. A truncated scan does not cover the whole population. Aborting a browser request prevents stale UI updates; it does not cancel server CPU work.

Collision probability is unavailable because covariance, size assumptions, encounter geometry and a validated probability method are absent. Maneuver candidates are unvalidated direction/impulse heuristics. They do not propagate a post-burn orbit, re-screen the result, or establish fuel requirements, confidence or operational suitability.

## Globe

Category glyphs are original instanced geometry: green payload body/panels, red debris, coral rocket body and neutral unknown. Shared metadata rules govern the globe, legend, catalogue and inspector. Size is exaggerated. Instanced two-triangle billboards blend category silhouettes toward smaller dots continuously with distance and density. Visual transforms never enter analytical calculations.

The selected object alone advances with the forecast timeline; other markers remain at the catalogue snapshot. The Earth uses attributed surface imagery and illustrative moving clouds; it is not current weather. Neither the illustration nor the rendered globe is observational imagery.

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

The vectorized kernel uses more temporary array memory (about 2.02 MB Python-tracked peak in that workload, excluding input/RSS). Compact responses reduce serialization and browser allocation; both full trajectories are still propagated in backend memory. CPU glyph preparation at 100/1,000/6,000 objects does not establish GPU frame time or picking performance.

A browser harness is available through `npm run benchmark:browser` in `frontend`. It measures the production glyph geometry, synthetic instance placement, GPU queries when available, and picking costs. It excludes React/API/labels, and rejects hidden/occluded runs as performance evidence. Open `http://127.0.0.1:3001/benchmarks/browser.html` while the harness is running. It uses 10 warmup and 60 measured frames at each population size; JSON export records a manual run.

## Numerical regression references

`backend/tests/fixtures/vallado_regimes.json` retains the exact elements and published TEME vectors from `SGP4-VER.TLE` / `tcppver.out` distributed with sgp4 2.23: 6251 (LEO), 28057 (polar), 8195 (eccentric Molniya), and 24208 (GEO). Checks at epoch and +120, +720, +1440 minutes allow 0.00002 km per position component and 0.00000002 km/s per velocity component. These compare against published output, not against a second call to the production wrapper. The established reference is described in the [SGP4 package documentation](https://pypi.org/project/sgp4/).

WGS84 forward reconstruction independently checks the inverse geodetic solve within 0.000001 km. Renderer tests check degrees, east/west sign, polar flattening, the 6378.137 km scene radius, and dateline continuity. Scene axes are +X at 0° longitude, +Y north, and −Z at 90° east. Each trajectory sample uses its own GMST rotation; the Earth texture remains fixed. This Earth-fixed trajectory at altitude generally does not close. An inertial path would retain TEME axes; a ground track would project every sample onto the surface. Neither is currently rendered.

Regression encounters include a crossing at +25 seconds whose 60-second grid misses the under-10-km band, both endpoint minima, several independent local minima, and failed refinement. Satellite states use WGS72 SGP4 dynamics; display conversion uses WGS84, UTC approximates UT1, and polar motion is omitted. Numerical agreement does not validate stale elements or supply measurement uncertainty.
