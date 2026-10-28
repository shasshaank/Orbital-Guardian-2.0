# Phases 4–6 implementation checkpoint — 28 October 2026

Tested working tree based on **17be30c1f795a60d93e29da16a7640b615aa7823**, branch `orbital-guardian-research-workspace`. Changes are uncommitted; this is not hosted CI evidence. No deployment, push, merge, production changes, provider download, dependency upgrades or infrastructure additions.

## Phase 4: globe and shared visual semantics

- Original code-built green body/solar-panel payload glyph, red tetrahedral debris, amber cylindrical rocket body, neutral octahedral unknown. At most four category instanced meshes, shared geometry/material per batch, demand rendering. Far view (camera radius ≥6 Earth radii) or a category batch over 2,000 objects uses four-triangle symbols. Colors retain category meaning. No object lights or continuous animation.
- Explicit frontend classification contract: `classification: {category, status: "confirmed", source, norad_id}`. Only recognized categories with nonempty source and exact numeric ID match are accepted. Conflicting, missing, malformed or unsupported classifications render unknown. **This is a rendering contract, not a metadata provider or Phase 3 implementation. Current API records have no confirmed classifications and all remain unknown.** Never use names, active membership or OMM security markings to infer type or operational status.
- Catalogue, inspector and legend use the same semantics. Category filter is explicitly scoped to globe; table search/freshness/pagination retain the loaded subset. Globe selection synchronizes inspector and forecast; selected ring/label and violet comparison ring add emphasis without changing category color. Clicks completing a >4-pixel drag are ignored; Earth blocks picking through its surface.
- Marker/path/grid switches, camera/reset and timeline retained. Status distinguishes unavailable selected state, filtered selection, hidden marker layer, behind-Earth, outside-frustum and in-view selection. Enabled-marker count is separate from loaded/source counts. Catalogue still requests at most 1,000 source records; failed states reduce returned count.
- Original schematic continent texture is generated in code; WGS84 display shape and directional shading retained. Approximate geography is labeled. The old unlicensed Earth images are no longer loaded by the globe but remain in the repository, with unresolved provenance. No project/asset licence was invented.
- Symbols deliberately exaggerated and simplified; rendering transforms never alter API state or analysis inputs. Coordinates remain WGS84/approximate GMST display, separate from TEME screening.

## Phase 5: sampled science correctness

- Closest sampled event uses named xyz position **and velocity** axes. Previous relative-speed calculation depended on dictionary insertion order. Every supplied velocity is now checked for finite values, rather than only the winning sample. Nonfinite separations are rejected.
- NumPy evaluates every aligned sample; first tie wins, existing 10/50 km bands retained. No broad-phase exclusions, adaptive refinement, continuous-TCA or collision-probability claim. Legacy full-state response remains the default.
- Original seven-case analytic linear-motion corpus includes between-sample crossing, offset miss, both endpoint minima, constant separation, coincidence and subsample near miss. Tests independently solve finite-interval continuous minima and compare a dense 0.01-second grid. A seeded 2,000-state scalar `math.dist` reference checks every vectorized separation and winning event. These validate the distance kernel and expose sampling limits; **they are not an independent real-orbit encounter corpus**. Existing Vallado TEME position/velocity tests remain.
- Shared UTC grids, UTC validation, WGS72 SGP4 dynamics, WGS84/GMST approximation and missing-state failures retained. Maneuvers remain unvalidated heuristics with no fabricated miss-distance, confidence or fuel claims. Continuous refinement awaits a representative independent orbital encounter corpus.

## Phase 6: measured performance

Reproduction from repository root, offline:

```bash
ORBITAL_OFFLINE=1 backend/.venv/bin/python -m backend.scripts.benchmark_screening --output /tmp/screening.json
ORBITAL_OFFLINE=1 backend/.venv/bin/python -m backend.scripts.benchmark_api --output /tmp/api.json
node frontend/scripts/benchmark-glyphs.cjs /tmp/glyphs.json
```

Python 3.11.15, macOS 26.5.2 ARM64; Node 22.11.0. Raw evidence: `benchmark-screening-2026-10-28.json`, `benchmark-api-2026-10-28.json`, `benchmark-glyphs-2026-10-28.json`. Dataset hashes and raw repetitions are recorded. No maximum-horizon 500-candidate scan was repeated.

| Sampled-kernel workload (1-minute grid) | Before median | After median | After Python allocation peak |
|---|---:|---:|---:|
| 61 states / 1 h | 0.463 ms | 0.186 ms | 9,336 B |
| 1,441 states / 24 h | 10.830 ms | 3.595 ms | 289,928 B |
| 10,081 states / 168 h | 77.977 ms | 27.251 ms | 2,021,256 B |

Five calls per size, identical synthetic hashes; excludes input construction, propagation, HTTP and GPU. Previous Python allocation peaks were ~1.6 KB: the faster kernel trades temporary array memory for time. `tracemalloc` is not RSS or a complete native-memory measurement. Baseline evidence's illustrative compact sizes are not measurements; final compact sizes are measured separately.

`/collision-check?include_paths=false` returns full-precision `separation_km` at every original grid sample plus the unchanged closest event and scientific metadata. The workbench requests this mode and plots it; legacy clients still receive `path_a/path_b` by default. No decimation or loss of screening samples. Both trajectories are still propagated in backend memory; this is primarily a serialization/wire/frontend allocation improvement.

| Pair API, retained first two bundled TLEs, fixed 2026-06-20 UTC | Full JSON | Compact JSON | Full / compact elapsed |
|---|---:|---:|---:|
| 1 h, 61 samples | 45,807 B | 2,272 B | 5.65 / 3.52 ms |
| 24 h, 1,441 samples | 1,051,309 B | 27,564 B | 65.66 / 36.55 ms |
| 168 h, 10,081 samples | 7,347,838 B | 187,264 B | 475.95 / 273.52 ms |

Single sequential offline TestClient observations including SGP4 and JSON, not socket latency, throughput or statistical claims. Closest-event equality asserted for each full/compact pair. TestClient catalogue requests for 100/1,000/6,000 examined records returned 99/996/5,866 successful states with explicit failures, in 1.127/0.090/0.501 s. First request includes offline validation; later requests reuse cache. Counts are time-dependent because bundled epochs are stale.

CPU preparation of four mixed glyph categories (five observations each): median 3.43/4.53/5.83 ms for 100/1,000/6,000 objects; matrix storage 6.4/64/384 KB. Full-detail geometry 1,800/18,000/108,000 triangles; simplified 400/4,000/24,000. This measures geometry, matrix writes and bounding spheres, **not GPU frame time, React commits or raycasting**. Native Chrome showed 996 real propagated markers; no 6,000-object GPU acceptance claim.

Existing single shared catalogue request, parsed-cache reuse, caps and cancellation protections remain. Scan response now explicitly reports `skipped_count`; `successful + failed = attempted`, `attempted + skipped = candidates`. Browser abort still does not stop server CPU work.

## Verification and remaining acceptance

Full offline backend suite: 47 passing. Frontend: 21 passing, lint and production build pass. Final bundle identifiers are recorded in VERIFICATION.md. Known HTTPX/punycode/Browserslist notices remain; geometry tests also expose Three's existing CommonJS-build deprecation warning. No dependencies changed.

Native Google Chrome, localhost production build + offline backend: desktop shaded schematic Earth, neutral glyphs, path, selected ISS label/inspector, reset/zoom and category filter; mobile 390×844 and tablet 820×1180 screenshots show readable flowing legend/layers/timeline; accessibility Increment advances the mobile forecast by two minutes. Current offline page displayed 996 / 15,830 source objects, all stale, with explicit offline notice. Screenshots remain conversation-only. Servers require sandbox escalation for localhost binding. Brave untouched.

Still open: complete drag/pick/touch and keyboard/focus matrix, forced WebGL failure/reduced-motion browser checks, full slow-request browser completion/cancellation, sustained GPU profiling at thousands of markers, source-less CSP/blank-reload diagnosis, exact pushed-SHA CI, security/dependency/licensing and Docker release gates. Existing automated cancellation regressions pass. Phase 3 metadata is still required before confirmed category data can be shown. **No-go for deployment** pending these gates; Phases 4–6 have implementation and scoped evidence, not blanket release acceptance.
