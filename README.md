# Orbital Guardian 2.0

An independent public orbital-element research workspace built with React, Three.js and FastAPI. Explore a catalogue, inspect predicted trajectories, compare sampled separations and examine explicitly unvalidated manoeuvre candidates.

The original project records an **8th-place finish among 389+ teams at the IIT Hyderabad Technical Showcase (March 2026)**. This iteration preserves its SGP4/FastAPI foundation while improving data validation, scientific transparency and analytical usability.

## What is implemented

- Native CelesTrak OMM-compatible JSON ingestion, 6-/9-digit catalogue IDs, validated legacy TLE input, deterministic deduplication, bounded verified HTTPS and atomic per-group caching.
- Explicit provider retrieval, fresh/stale cache, bundled/offline and unavailable states; separate retrieval/element/prediction times, freshness policy and propagation failures.
- Interactive Earth-fixed globe with instanced markers, shared catalogue selection, layer controls and a discrete two-hour forecast scrubber.
- Searchable, sortable and filterable catalogue; selected-object element details.
- Pair screening on a shared UTC grid with relative speed, sampled-separation plot and reproducible inputs.
- Primary-asset screening against the first 500 active-catalogue candidates, with attempted/successful/failed counts.
- Heuristic manoeuvre candidates with no fabricated confidence, fuel consumption or post-burn separation.
- Scientific reference tests, API/input regressions, frontend interaction tests and GitHub Actions configuration.

## Run locally

Use Python **3.11** (the pinned NumPy version is not intended for Python 3.13) and Node **22** with npm. Run from the repository root:

```bash
python3.11 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements-dev.txt
cd frontend
npm ci
cd ..
```

Terminal 1 — deterministic offline demonstration using validated bundled elements:

```bash
ORBITAL_OFFLINE=1 backend/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
cd frontend
HOST=127.0.0.1 PORT=3000 BROWSER=none npm start
```

Open http://localhost:3000. API documentation: http://localhost:8000/docs.

For live retrieval, omit `ORBITAL_OFFLINE=1`. Optional configuration is documented in `backend/.env.example`; copy it to `backend/.env` to customize. The backend loads this file. The frontend defaults to `http://localhost:8000`; set `REACT_APP_API_URL` in `frontend/.env` before building to use another API. No credentials are needed for public CelesTrak data. Provider downloads are on demand and at least two hours apart; browser refresh reuses the cache. See [data schema, refresh/failure policy and integration commands](docs/DATA_PIPELINE.md). Space-Track is not implemented.

The bundled catalogue contains **June 2026 elements**; it is intentionally reported as stale at current dates. Retrieval time is unknown. Invalid legacy fallback records are rejected, not repaired or relabeled live. Freshness uses a visible seven-day heuristic, not an accuracy guarantee.

## Verify

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
ORBITAL_OFFLINE=1 backend/.venv/bin/python -m backend.scripts.benchmark
cd frontend
npm run lint
CI=true npm run test:ci
CI=true GENERATE_SOURCEMAP=false npm run build
```

`GENERATE_SOURCEMAP=false` avoids an existing third-party MediaPipe missing-source-map warning during CRA builds. No TypeScript/type-check command exists. See [verification evidence](docs/VERIFICATION.md) for actual results and unverified browser behavior.

## Architecture

```mermaid
flowchart LR
  C[CelesTrak GP OMM-compatible JSON] --> V[Strict elements / epoch / ID validation]
  F[Read-only legacy TLE catalogue / checksum validation] --> V
  V --> R[Per-group TTL / atomic runtime cache]
  R --> API[FastAPI REST API]
  API --> P[SGP4 / shared UTC grid / TEME km and km/s]
  P --> G[GMST Earth rotation / WGS84 display coordinates]
  P --> S[Sampled separation and relative velocity]
  P --> M[Heuristic candidate geometry]
  G --> UI[React shared catalogue state]
  S --> UI
  M --> UI
  UI --> E[R3F Earth / instanced markers / forecast paths]
  UI --> A[Catalogue / inspector / analysis / source status]
```

`frontend/src/index.js` mounts `App.jsx`. `backend/app/main.py` owns the REST routes. `orbital_data.py` validates native OMM and TLE elements, `catalog_provider.py` handles CelesTrak transport, `tle_fetcher.py` handles ingestion/cache, `propagator.py` computes states, `collision_detector.py` compares aligned samples, and `maneuver_engine.py` returns candidate geometry. There is no database, radar feed, trained AI model or background monitoring service.

## API compatibility and changes

Native catalogue objects now contain `omm` rather than synthetic TLE lines; analysis endpoints accept JSON-string `omm` (or `omm_a` / `omm_b`) alongside the existing alternative TLE interface. Frontend and backend must be updated together. `/catalog` supports `offset`/`limit` pagination; the UI still loads at most 1,000 active-group records. See [contract details](docs/DATA_PIPELINE.md).

Existing route names are preserved: `/health`, `/satellites`, `/propagate`, `/collision-check`, `/asset-scan`, `/maneuver-recommend`. `/catalog` adds an envelope with `objects` and `metadata`; `/satellites` retains its list shape with additive metadata fields.

- Propagation accepts an optional timezone-aware `start_time`; endpoints include the final forecast sample. Invalid TLEs return 422.
- Pair screening accepts `start_time` and `step_minutes` (default 1); selecting the same catalog object twice returns 422. Results preserve `path_a`, `path_b`, `min_distance_km`, `risk_level` and `closest_event`.
- Empty comparison results are `UNKNOWN` with null distance, never `SAFE` or infinity. Unequal/misaligned grids are rejected.
- Asset lookup uses exact NORAD matching in the validated active catalogue; arbitrary direct-by-ID CelesTrak lookup is no longer attempted. Objects outside that catalogue return 404.
- Maneuver fields `confidence_score`, `estimated_fuel_cost_percent` and `new_miss_distance_km` are retained but **null**. Candidate `risk_level` is `UNVALIDATED`. Clients must handle these deliberate correctness changes. An optional `event_time` aligns candidate geometry with the encounter sample.
- Default CORS allows only localhost frontend origins. For existing production hosting, set `CORS_ORIGINS=https://orbital-guardian-2-0-1.onrender.com` (comma-separated if adding origins). **No deployment has been performed.** Frontend and backend must be released together because the new frontend uses `/catalog`.

## Docker

```bash
cd backend
docker build -t orbital-guardian-api .
docker run --rm -p 127.0.0.1:8000:8000 -e ORBITAL_OFFLINE=1 orbital-guardian-api
```

The image now includes bundled data and excludes virtualenv/secrets/runtime cache. Runtime catalogs are written under `backend/data/runtime` locally, or `/app/data/runtime` in Docker. `ORBITAL_CACHE_DIR` can select a writable persistent directory. Memory is per process; filesystem refresh locks coordinate workers sharing a runtime directory on Linux/macOS. No distributed coordination across isolated replicas exists. The Docker build itself remains unverified in this environment.

## Scientific limits

This is research/demo software, not operational collision avoidance. SGP4 uses WGS72 dynamics. Display geodesy uses WGS84, GMST, UTC approximating UT1 and no polar motion. The globe is Earth-fixed; forecast paths are not inertial conic orbits. Only the selected object advances when scrubbing; other markers remain at the catalogue snapshot.

One-minute separation sampling can miss encounters between samples. The API's legacy `SAFE` band means “above the sampled threshold,” not guaranteed safety. No covariance, hard-body radius, probability of collision, orbit determination, historical observations or validated maneuver optimization is available. A valid checksum does not guarantee accurate or recent orbital elements.

## Assessment and next work

- [Repository audit and baseline](docs/PROJECT_AUDIT.md)
- [Product gap analysis](docs/PRODUCT_GAP_ANALYSIS.md)
- [LeoLabs public-material alignment](docs/LEOLABS_ALIGNMENT.md)
- [Prioritized technical roadmap](docs/TECHNICAL_ROADMAP.md)
- [Verification and outstanding work](docs/VERIFICATION.md)
- [Visual assets and licenses](docs/VISUAL_ASSETS.md)
- [GitHub handoff and continuation prompt](docs/HANDOFF.md)

The project has no affiliation with LeoLabs. Its relevance is in catalog quality, scientific computation, transparent analysis and testing, not replication of proprietary sensing systems. The previous README referenced an MIT license, but no root LICENSE file is present; repository-wide licensing remains to be resolved by the owner. The included Space Grotesk font has its own OFL license.

## Verification continuation (18 October 2026)

22 backend and 6 frontend tests pass; actual desktop WebGL, mobile/tablet portions, local HTTP workflows and isolated live HTTPS stations ingestion have been exercised. Fixed mobile viewport overflow, stale request/loading state and near-future epochs being called recent. Browser acceptance remains partial; Docker daemon is unavailable, hosted CI unverified, dependency advisories and licenses unresolved. See [current evidence](docs/VERIFICATION.md) and [next-session prompt](docs/NEXT_SESSION.md). No deployment performed.

19 October: current tests/lint/build and isolated clean installs pass; production single catalogue request and outage/retry verified. Hosted CI succeeded for df13a9b only. Full release acceptance, Docker, portable backend locking, advisories and licensing remain open. See docs/VERIFICATION.md and docs/NEXT_SESSION.md.

20 October: hosted CI verified for `1346d864`; exact 1366×768 browser dimensions, zoom/layers and altitude/freshness filtering confirmed. Added favicon and active form names; 22 backend/6 frontend tests, lint/build pass. Maximum-horizon pair response measured at 7.35 MB. Blank reload recurred and recovered in a fresh tab; release acceptance remains incomplete. See [verification evidence](docs/VERIFICATION.md) and [continuation instructions](docs/NEXT_SESSION.md).


21 October: hosted CI passed for `0182cbcf`; 22 backend/6 frontend tests, lint, build and pip check pass. Actual HTTP 168-hour pair returned 10,081 samples/path (7.35 MB); 500-candidate maximum-horizon ISS scan completed in 99.13 s with 496 successful/4 failed and 92 successful overlapping health probes. Brave newest-epoch sort and reset-to-all confirmed. Forecast fault injection remains partial; owner requested leaving Brave alone. Reload local Brave test tab before reuse to remove its temporary fetch wrapper. Docker, browser acceptance, dependency/security/portable locking and licensing remain open. No source/dependency/deployment/Render changes. See [verification evidence](docs/VERIFICATION.md).


## Current Phase 1/2 checkpoint — 24 October 2026

Native CelesTrak JSON retrieval succeeded for 16,792 active-group records, including 880 IDs above 99,999; zero malformed records and one explicit current-epoch propagation failure. Fresh cached reads are labeled as cache, and provider failures preserve the valid snapshot with a prominent error. Full provenance, two-hour refresh/cooldown policy, offline operation, API compatibility and limits are documented in [DATA_PIPELINE.md](docs/DATA_PIPELINE.md).

43 backend tests, 17 frontend tests, lint and production build pass locally. This uncommitted implementation is based on `e5ccb0310fb6d28fe5856ded10f607462ba59d66`; hosted CI success covers that starting commit only. Phases 3–8, optional Space-Track, browser acceptance, dependency/portable locking, Docker and licensing remain open. No classification metadata/glyph redesign, deployment, Render changes or merge was performed. Continue with [NEXT_SESSION.md](docs/NEXT_SESSION.md); exact evidence is in [VERIFICATION.md](docs/VERIFICATION.md).

### Globe and sampled-screening checkpoint (28 October 2026)

The R3F globe uses original instanced category symbols, selection/analysis rings, a selected label and category controls. Category styling requires confirmed metadata with a matching catalogue ID and source; current records remain unclassified while metadata ingestion is pending. Earth geography is an original schematic texture; symbol sizes are exaggerated. The inspector, legend and catalogue share category semantics.

The conjunction workbench uses a compact pair response that preserves every sampled separation and closest event, reducing duplicated trajectory data. Screening is exhaustive over the requested discrete grid, not a continuous collision assessment. Reproducible correctness/performance evidence, memory tradeoffs and remaining browser/release gates are in [docs/PHASE456.md](docs/PHASE456.md); continue from [docs/NEXT_SESSION.md](docs/NEXT_SESSION.md). This checkpoint is not release-ready.
