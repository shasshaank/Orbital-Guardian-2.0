# Verification and implementation checkpoint

Date: 17 October 2026. Original revision: `33dd7bc`. Work stopped expanding in scope at the owner's request so the current implementation could be packaged before their usage limit.

## Completed implementation

The original satellite/TLE → SGP4 → proximity/advisor → globe pipeline is preserved. The frontend now has a coherent midnight-blue visual system, locally hosted typography, overview, catalogue, conjunction workspace, object inspector and source/health view. Interactions include search/filter/sort/pagination, selection, camera/layer controls, discrete forecast samples, pair screening, capped asset scans and explicitly unvalidated maneuver candidates. One original editorial asset was generated and integrated separately from the scientific globe.

Backend changes add strict TLE validation, exact identifiers, source metadata, separate atomic runtime caching, HTTPS validation, shared UTC propagation grids, WGS84/GMST display coordinates, invalid-state rejection, relative velocity and non-fabricated maneuver fields. Existing endpoint paths remain; semantic compatibility changes are described in README.

## Baseline commands and outcomes

| Command/check | Baseline outcome |
|---|---|
| Python 3.11 venv + pinned dependencies | Installed after sandbox network retry |
| `npm ci --no-audit --no-fund` | Installed 1,365 packages after sandbox network retry; legacy toolchain deprecation warnings |
| `python -m unittest discover -s backend -v` | 0 tests discovered |
| `CI=true npm test -- --watchAll=false --runInBand` | Watchman filesystem permission failure |
| Same command with `--watchman=false` | Exit 1: no tests found |
| `eslint src --ext .js,.jsx` | 0 errors, 1 missing hook dependency warning |
| `npm run build` | Passed with MediaPipe missing source map and hook warnings; original main JS 271.05 KB gzip |
| TestClient `/health` | 200 |
| TestClient malformed pair TLE | Incorrectly returned 200 |
| Empty comparison | Incorrect SAFE and infinity |
| Checksum audit | 15,830/15,830 cache pairs valid; 0/51 fallback pairs valid |

## Final automated checks

- `backend/.venv/bin/python -m unittest discover -s backend/tests -v`: **18 passed**, latest run 0.052 s. HTTPX emits a known test-client deprecation warning. Tests cover published Vallado state/velocity values, alignment, missing data, malformed TLEs, freshness, duplicate handling, caching, TLS defaults, API health/validation and maneuver null semantics.
- `npm run lint`: **passed, zero errors/warnings** (Browserslist prints a stale-data advisory). A Testing Library rule falsely recognized direct ReactDOM rendering; a single documented suppression preserves the required React `act` wrapper.
- `CI=true npm run test:ci`: **4 tests passed**, 1 suite, 1.394 s. Covers catalogue interactions, provenance, forecast selection, retry recovery and pair-screen inputs/results. WebGL is mocked. Node prints a transitive punycode deprecation warning.
- `CI=true GENERATE_SOURCEMAP=false npm run build`: **compiled successfully**, exit 0. Gzip: main JS 265.52 KB, CSS 8.37 KB, chunks 7.58 KB and 1.13 KB. Browserslist data-age advisory remains.
- An intermediate build failed because CRA resolved a public font URL as a source import; moving the font-face declaration to public HTML fixed it. An initial lint invocation from the repository root also failed because package.json is in frontend; final commands use the correct directory.
- No TypeScript or type-check script exists.
- Git diff whitespace checking passed. No changes to bundled catalog fixtures, lockfile or production configuration were made.

## Performance evidence

See `benchmark.json` and reproduce with `ORBITAL_OFFLINE=1 backend/.venv/bin/python -m backend.scripts.benchmark`.

Host: Python 3.11.15, macOS ARM64. Fixed start 2026-06-20, first 100 bundled catalog objects, three propagation runs:

| Workload | Measured result |
|---|---|
| 100 objects, 24h, 10-minute spacing / 145 samples | Median 0.1534 s |
| 100 objects, 24h, 1-minute spacing / 1,441 samples | Median 2.0470 s |
| 99 pair comparisons, 10-minute spacing | 0.1153 s, one run |
| 99 pair comparisons, 1-minute spacing | 1.2040 s, one run |
| Cold offline catalog request, limit 1,000 | 0.9976 s, 996 returned |
| Warm offline catalog request, limit 1,000 | 0.0172 s, 996 returned |

Four of the first 1,000 objects failed current-epoch propagation and are counted, not silently relabeled valid. The old 0.2958 s propagation baseline used a different wall-clock start and implementation; do not present the new result as a controlled speedup. Cold/warm timings are single observations, not p95 latency or production SLOs. No full-catalog, concurrency, rendering/FPS or memory benchmark was completed.

## Runtime and deployment verification limits

- Public frontend returned HTTP 200; downloaded bundle points to the separate deployed API, whose `/health` returned 200. This does not establish production analytical workflow correctness.
- Browser automation had no available DOM browser surface. Native Brave exposed browser chrome but no useful page tree; screenshot was blank. This is an instrumentation limitation, not proof that the deployed UI is blank.
- Local API and frontend launch attempts hit sandbox `EPERM` port-binding failures. Escalated startup was interrupted while approvals were being handled. Live local HTTP/browser workflows remain unverified. Do not assume an interrupted process is running; check ports before restarting.
- No desktop/mobile screenshot comparison, browser console/network review, real WebGL visual QA, keyboard audit or touch QA was completed.
- No Docker build, hosted GitHub Actions run or production release was performed.
- Source integration tests do not replace independent scientific validation or real-browser testing.

## Remaining known limits and review items

1. One-minute screening still misses between-sample minima. No refined continuous TCA or Pc.
2. Bundled data is stale; live CelesTrak fetch with the new validation path was mocked in regression tests, not verified against a current network response.
3. Up to 1,000 objects are requested by the UI; asset scans examine the first 500 candidates in serial. No conservative broad-phase acceleration or background job queue.
4. Cache lock and state are per process; no distributed cache coordination, rate limiting, telemetry metrics or persisted analysis history.
5. Approximate Earth transform omits EOP/UT1 correction and polar motion. Reference tests validate selected numerical cases, not full geodesy accuracy.
6. Maneuvers remain simple geometry/distance heuristics with no propagated impulse or spacecraft constraints. Degenerate zero threat vectors are disclosed as underdetermined.
7. Native selectors contain the loaded catalogue; large-selector usability and mobile tables require browser review. WebGL fallback, camera framing, stale-request transitions and GPU behavior need real-browser tests.
8. Old unused components/styles are retained to avoid unrelated deletion; they are not the current UI. Source formatting is compact and should be made more reviewable without behavior changes.
9. Legacy CRA dependency age and transitive security advisories need a separate reviewed dependency audit. No blind major upgrades were attempted. Backend transitive dependencies are not fully locked.
10. Existing Earth texture licensing is undocumented; owner must confirm provenance. Previous README claimed MIT, but no root license file exists.
11. CORS now requires the production frontend origin explicitly. New frontend requires `/catalog`; release order/version alignment must be planned before deployment. Asset-by-ID lookup now searches the active validated catalogue only.

See HANDOFF.md for the exact continuation scope and GitHub checkpoint commands.
