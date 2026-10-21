# Focused continuation — 21 October 2026

Continue on `orbital-guardian-research-workspace`. Preserve all uncommitted work. Finish release verification before advanced features. Do not deploy, alter Render, invent licenses, blindly upgrade dependencies or rewrite architecture.

## Read only what is needed

1. Read this file, then run `git status --short --branch`, `git rev-parse HEAD`, `git diff --stat` and inspect any current diff before editing.
2. Read **only the section beginning `## Continuation checkpoint — 21 October 2026`** in `docs/VERIFICATION.md`. It is the evidence ledger; never mark attempted/unexecuted checks passed. Read `docs/verification-2026-10-21.json` only if raw measurements are needed.
3. Choose one remaining task below and open only its relevant files. Do not reread the whole repository, README, historical handoffs, audit, product analysis, LeoLabs alignment or roadmap. Consult a specific older ledger section only to resolve a concrete missing fact.
4. Do not repeat completed checks just to reconstruct context. Run tests after application changes, or when new evidence warrants them. Documentation-only edits need diff review, not another full test/build run.

## Current state and completed evidence

- Last observed HEAD: `0182cbcf290ca7393c13da2483d6a25c46741dc4`. Owner will commit/push today's documentation checkpoint; inspect actual HEAD rather than assuming this SHA remains current.
- Today's changes are documentation/evidence only. Application code, fixtures, dependencies and licenses unchanged. No agent commit/push/deployment. Local API/static servers stopped; no listeners on 8000/3000 at stop.
- 22 backend tests, 6 frontend tests, lint, production build and pip check passed on 21 October. Build `main.27c03b43.js`. Hosted run **39424127127** passed for the full SHA above, not the forthcoming documentation commit.
- Already verified: real WebGL/texture/markers/path/font; exact 1366×768 layout; selected 390px/768px layouts and fixed mobile overflow; zoom/layer toggles; timeline end/reset; catalogue search/pagination/altitude/newest-epoch sorting and freshness reset; production single catalogue request; outage/retained snapshot/retry; real pair/capped scan and live HTTPS stations ingestion. These are scoped passes, not comprehensive browser/accessibility acceptance.
- Maximum-horizon actual HTTP: pair 168 h, 10,081 samples/path, 7.35 MB, 0.6641 s. ISS scan 168 h: 500 attempts, 496 successes/4 failures, 99.1311 s; 92 overlapping health probes all 200. Not multi-client capacity, memory, cancellation or proxy-timeout evidence. Do not repeat this expensive scan without a specific reason.
- Same-host clean installs previously passed; backend transitives drifted. No portable/hash lock exists. Historical npm audit: 98 affected package entries; unresolved, not current security clearance.
- Preserve React 18/CRA/Three/R3F + FastAPI/Python 3.11/SGP4, navy/ice/amber design, source/stale/time metadata, API compatibility and candidate-only maneuver semantics. No Pc, radar, orbit determination or flight-ready guidance.

## Remaining work, in priority order

1. **Browser acceptance**: diagnose blank reload and source-less CSP issue without weakening security; globe picking/drag/reset; remaining mobile/tablet controls and touch scrolling; keyboard focus/names and reduced motion; forced WebGL/error boundary; slow-request/selection cancellation for forecast/pair/maneuver; maneuver zero/null/assumptions UI.
   - Open only `frontend/src/App.jsx`, `frontend/src/components/Globe.jsx`, `SatelliteLayer.jsx`, `Catalogue.jsx`, `ConjunctionWorkbench.jsx`, `ManeuverPanel.jsx`, `frontend/src/api.js` or `frontend/src/index.css` as relevant to the selected check. Tests: `frontend/src/App.test.jsx`.
   - **Owner requested leaving Brave alone. Do not control Brave without renewed authorization.** Local Brave test tab has a console-only fetch delay override; reload before reuse once authorized. Nothing injected into source files.
   - Forecast injection is partial: old ABS-2A response delayed 3 s/shortened to 3 states, switched to ABS-3A after 250 ms; later UI retained ABS-3A/61 states with loading cleared. Completion trace was not captured. Do not relabel this a full pass.
   - Native CUA was the only browser interface; Chrome inputs sometimes fail silently or report `noWindowsAvailable`. Reconnect/fresh state and verify actual results. Chrome blank surface later exposed populated UI after reconnect; root cause remains unknown. Avoid lengthy repeated failed UI attempts; record tooling blockers. Screenshots are conversation-only.
2. **Docker**: check daemon once. If reachable, build/start API and verify offline fallback. Otherwise record unavailable; do not repeatedly retry. Relevant files: `backend/Dockerfile`, `backend/.dockerignore`, `backend/requirements*.txt`.
3. **Dependency security/portable locking**: separate scoped compatibility review. No auto `npm audit fix`, major upgrades or blindly frozen portable lock. Read dependency files and the ledger's `### Dependency/licensing review` only if tackling this. Root license and original Earth texture provenance are unknown; no invented resolution.
4. **Exact-SHA CI**: after owner pushes, inspect existing hosted run for actual full HEAD. Read-only GitHub API works after network escalation; `gh` unavailable. Query `https://api.github.com/repos/shasshaank/Orbital-Guardian-2.0/actions/runs?head_sha=<FULL_SHA>`. Prior run is not evidence for a new commit. Do not push/trigger/deploy automatically.

No Stage 3/4 work until release acceptance. Continuous TCA, broad-phase acceleration, replay/background ingestion, covariance/Pc and physical maneuver simulation remain deferred.

## Local commands, only when needed

Recheck listeners before starting. Bind only localhost; sandbox bind/network failures previously required escalation.

```bash
ORBITAL_OFFLINE=1 backend/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
# Separate terminal: production build server, not CRA dev mode
backend/.venv/bin/python -m http.server 3000 --bind 127.0.0.1 --directory frontend/build
```

After relevant application changes:

```bash
backend/.venv/bin/python -m unittest discover -s backend/tests -v
cd frontend
npm run lint
CI=true npm run test:ci
CI=true GENERATE_SOURCEMAP=false npm run build
cd ..
git diff --check
```

No TypeScript check exists. Update only relevant evidence/status documents with actual outcomes and remaining blockers. At stop, keep this file concise and current instead of appending obsolete continuation prompts. Full historical evidence stays in VERIFICATION.md. This checkpoint is not release-ready.
