# Release checks

Checked on 5 November 2026 against the uncommitted working tree based on `b2caa837d02d80105e11ec27bc532fd463703c3a`, branch `orbital-guardian-research-workspace`. The starting commit has a successful [Actions run](https://github.com/shasshaank/Orbital-Guardian-2.0/actions/runs/41896550943). That run does not verify the current edits.

## Automated checks

| Check | Result |
| --- | --- |
| Offline backend suite, clean hash-locked Python 3.11 environment | 59 passed |
| Frontend unit/component suite | 27 passed |
| Frontend lint and production build | Passed |
| Python dependency audit | No known vulnerabilities reported |
| npm dependency audit | 0 affected package entries, previously 63 |
| Linux x86_64 Python 3.11 wheel download with required hashes | Passed |
| Docker build/run | Blocked: daemon unavailable |

The frontend uses Vite 6.4.5 and Vitest 4.1.12, retaining React 18, Three.js/R3F and the existing build-time `REACT_APP_API_URL`. React Scripts and its advisory-affected dependency chains were removed. Versions were checked against this host's Node 22.11.0. Python runtime and development dependencies are pinned with SHA-256 hashes; CI and Docker require hash verification. FastAPI, Requests and python-dotenv were updated to admit patched dependencies. SGP4 and NumPy versions were retained. Audit clearance is a dated advisory result, not proof of security or a complete reachability review. The frontend build still reports its main chunk exceeds 500 kB. npm also reports deprecations in the ESLint 8 and older Drei transitive tooling; these are not cleared by an advisory count of zero.

The Dockerfile now runs as UID 10001 with a writable runtime directory. The daemon check failed with `Cannot connect to the Docker daemon at unix:///Users/shashaankjain/.docker/run/docker.sock. Is the docker daemon running?`. A wheel download is not a Linux runtime or container test. Reproduce the offline container checks in the README when Docker is available.

Changed areas: metadata refresher/importer and provider error policy; metadata/graphics regressions; subset controls and density handling; frontend build/test/lint configuration and lockfile; Python inputs/locks, CI and Docker user; MIT license and concise documentation. Repetitive session prompts/audit logs were removed.

## Data verification

One private CelesTrak stations SATCAT request completed at `2026-11-05T12:47:47.253657+00:00`, after review of the [published usage policy](https://celestrak.org/usage-policy.php). All 19 records validated. The import remains outside the repository/build context. A TestClient join against 6,000 examined bundled orbital records returned 5,858 states and six confirmed payload matches, including ISS. Missing IDs remained unknown. This verifies retrieval, parsing, identity and provenance; it does not establish current orbital accuracy, broad debris coverage, operational payload status or bulk redistribution rights.

The importer preserves both original downloaded-byte SHA-256 and an exact import-byte hash. API requests reuse the local file; no SATCAT request is made by browsing or refreshing the catalogue. Every non-200 provider response now pauses automatic retrieval for human investigation. No new GP download or maximum-horizon asset scan was performed.

## Browser checks

Native Chrome loaded the Vite production frontend with the locked backend, old offline orbital elements and the private metadata import. Verified: 5,858 enabled markers with explicit subset/source counts; real `PAY` evidence and retrieval time; six-object payload filter; empty debris filter without changing the inspector; marker hiding; keyboard forecast advancement by two minutes; and return to snapshot. A prior large-subset selection showed the marker label and inspector synchronized on NORAD 51131. The synthetic renderer benchmark completed, but Chrome reported the tab hidden/occluded, so its timing samples are invalid for performance claims. A foreground retry returned native control error `-10005: noWindowsAvailable`. These observations are scoped interaction checks, not a complete browser matrix or GPU timing result.

Browser access through the browser host was unavailable, so native app control was used. Native control intermittently required reacquiring app state, returned `failedToCreateImageDestination`, or showed a blank page while a later state acquisition recovered content. DevTools showed an empty console and three Issues entries; the source-less CSP issue was not traced to application code. Security settings were not weakened. Brave was not used.

Remaining acceptance: complete drag-versus-pick and occlusion checks; desktop/tablet/mobile/touch controls; keyboard focus and reduced motion; forced WebGL failure in a real browser; slow forecast/pair/maneuver completion and cancellation; classification conflict/unavailable states; and sustained performance across representative devices. Component tests cover initialization/context-loss fallback and obsolete asynchronous responses, but do not substitute for these browser checks.

For browser timing/picking reproduction, run `npm run benchmark:browser` in `frontend` and open `http://127.0.0.1:3001/benchmarks/browser.html`. Alternatively run `npm run benchmark:build`, serve `frontend/build` and open `/benchmark/benchmarks/browser.html`. The harness is excluded from a normal application build. It uses deterministic production glyph geometry at 100/1,000/6,000 objects, with 10 warmup and 60 measured frames per size. It reports submission time, frame intervals, twelve-ray picking batches and GPU elapsed queries when supported. It excludes React, API work, labels and forecasts; disjoint or unresolved GPU queries are not presented as valid GPU timings. Hidden/occluded runs are explicitly marked invalid; JSON export is available for recording a valid manual run.

## Licensing and release decision

Original code is MIT licensed with the owner's authorization. The OFL font notice remains. Unused texture files with unknown provenance were removed from the project; copies were retained outside the repository. Provider datasets and dependencies retain their own terms. Private metadata verification does not clear public bulk redistribution of SATCAT or older bundled orbital data.

**Deployment remains blocked** by Docker execution, complete browser/performance acceptance, provider-data redistribution review, and CI for the eventual pushed commit. No push, merge, deployment, production/Render setting or production data change was performed.

After reviewing the complete diff:

```bash
git status --short
git diff --check
git add LICENSE README.md .github/workflows/ci.yml backend frontend docs
git diff --cached --stat
git diff --cached --check
git commit -m "Add SATCAT refresh and harden dependencies and runtime"
git push origin orbital-guardian-research-workspace
git rev-parse HEAD
```

Inspect Actions for the exact printed SHA. No merge to main or deployment is needed for that check.

Machine-readable counts, dependency-lock hashes and verification scope are in [release-checks.json](release-checks.json).
