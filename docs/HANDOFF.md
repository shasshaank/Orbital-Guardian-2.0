# GitHub checkpoint and continuation

This is an implemented, automatically tested checkpoint, not a claim that all original phases or browser acceptance are complete. No commit, push or deployment was performed by the agent. Preserve all current changes.

## Push this checkpoint

From the repository root, create a branch so a push does not automatically update the production branch:

```bash
git switch -c orbital-guardian-research-workspace
git add .gitignore README.md .github/workflows/ci.yml
git add backend/.dockerignore backend/.env.example backend/Dockerfile backend/requirements-dev.txt
git add backend/app backend/tests backend/scripts/benchmark.py
git add frontend/package.json frontend/public/index.html frontend/public/fonts frontend/public/images
git add frontend/src/App.jsx frontend/src/App.test.jsx frontend/src/api.js frontend/src/index.css
git add frontend/src/components/Globe.jsx frontend/src/components/ManeuverPanel.jsx frontend/src/components/SatelliteLayer.jsx frontend/src/components/SatelliteOrbit.jsx
git add frontend/src/components/Catalogue.jsx frontend/src/components/ConjunctionWorkbench.jsx frontend/src/components/ObjectInspector.jsx
git add docs
git diff --cached --check
git diff --cached --stat
git commit -m "Add orbital research workspace, validated TLE pipeline, tests and technical assessment"
git push -u origin orbital-guardian-research-workspace
```

If that branch name already exists, choose a new checkpoint branch name. Inspect the staged diff before committing. Do not stage `.env`, `.venv`, `node_modules`, `build`, runtime caches, `.DS_Store` or credentials. Only `.env.example` is intended for source control. Production-connected branch auto-deployment behavior must be checked before merging. Do not deploy simply because a build passes.

The exact changed/added file manifest is in `CHANGED_FILES.txt`.

## Copy this prompt into the next session

```text
Continue the existing Orbital Guardian 2.0 repository task from the current working tree/branch. Do not start over, discard changes, or rewrite the architecture. The previous session completed an audit, assessment documents, a major frontend implementation and backend correctness improvements, then stopped scope expansion at my request because of a usage limit.

FIRST read README.md, docs/PROJECT_AUDIT.md, docs/PRODUCT_GAP_ANALYSIS.md, docs/LEOLABS_ALIGNMENT.md, docs/TECHNICAL_ROADMAP.md, docs/VERIFICATION.md, docs/VISUAL_ASSETS.md, docs/HANDOFF.md and docs/CHANGED_FILES.txt. Inspect git status and preserve local work. Treat VERIFICATION.md as the evidence ledger; never claim unexecuted checks passed.

Existing implementation to preserve:
- React 18 / CRA / Three.js / React Three Fiber + FastAPI / Python 3.11 / SGP4.
- Midnight-navy research workspace with overview, searchable/sortable/filterable catalogue, object inspector, instanced globe markers, camera/layer controls, selected-object forecast scrubber, conjunction/asset analysis and source-health view.
- Original generated Earth-horizon illustration and self-hosted Space Grotesk with OFL license. Functional globe remains data-driven.
- Strict checksum/format/ID validation; shared timezone-aware propagation start; explicit missing-state handling; GMST/WGS84 display conversion; separate atomic runtime TTL cache; /catalog envelope; source/epoch/retrieval metadata.
- Candidate-only maneuver output: unsupported confidence/fuel/post-burn values null. Existing endpoint names preserved; deliberate semantic changes documented in README.
- 18 backend tests, 4 frontend interaction tests, benchmark script/results and a GitHub Actions workflow. Read the final recorded build/lint outcomes rather than assuming success.

IMMEDIATE TASK: finish and harden this implementation before adding advanced features.
1. Check whether interrupted localhost servers are running. Start backend on 127.0.0.1:8000 with ORBITAL_OFFLINE=1 and frontend on port 3000. Sandbox port binding previously required escalation. Do not change production or expose services publicly.
2. Verify the actual browser interface at desktop, laptop, tablet and 390px mobile widths. Capture screenshots if tooling works. Previous browser tooling exposed only native chrome and a blank capture, so visual QA is NOT complete. Inspect real WebGL rendering, font loading, camera framing, object selection, all nav views, catalogue pagination/search/sort/filter, layer controls, timeline and reduced-motion behavior. Check keyboard names/focus, native selectors, table overflow, contrast, error boundary and narrow layouts. Fix actual defects, not speculative redesigns.
3. Test real frontend-to-backend workflows: valid pair, self-pair rejection, asset scan (including capped/failed counts), stale data, invalid records, API outage/retry, slow requests, changing selections during in-flight requests, zero/null values and maneuver assumptions. Review browser console/network and ensure a single shared catalog request; mocked UI tests do not validate WebGL or actual HTTP integration.
4. Verify live CelesTrak ingestion with HTTPS and provenance without modifying tracked data fixtures; keep offline tests deterministic. Confirm no stale/future data is presented as current measurements. Add focused regressions for real findings, especially valid pair/asset-scan end-to-end cases and propagation failures.
5. Run backend unittest, frontend lint/test:ci and CI=true GENERATE_SOURCEMAP=false npm run build. There is no TypeScript type-check command. Verify Docker image startup and bundled-data fallback if Docker is available. Hosted CI is not yet verified.
6. Review the final diff for regressions/secrets, compact source readability, unused legacy components, API changes, large responses and request cancellation. Resolve repository-wide license and original Earth texture attribution with me if needed. Do not invent licenses. Evaluate dependency advisories and backend transitive reproducibility in a scoped way; do not blindly upgrade all dependencies.
7. Update README, audit/roadmap status, VERIFICATION.md and manifest with actual evidence. Provide a concise report and exact run/test/push commands. Do not deploy or alter Render settings without explicit permission. Production CORS must include the deployed frontend origin, and frontend/backend versions must be aligned because the new frontend uses /catalog.

Scientific scope remaining (prioritize only after the current release is verified): validate continuous TCA refinement against a dense/independent reference corpus; conservative broad-phase screening with false-negative recall benchmarks; versioned snapshots and analysis replay; background ingestion/metrics/backpressure; then CDM/covariance-aware Pc and physically propagated maneuver what-if only when required inputs and validation exist. No radar data, sensor custody, orbit determination, historical tracking, continuous real-time intelligence, Pc or flight-ready advice currently exists. Do not label sampled miss-distance thresholds as probability or safety.

Retain the original visual direction: restrained midnight navy, icy blue, warm amber, strong typography, dominant functional globe, no fake telemetry or gratuitous effects. design-ui-with-restraint and write-practical-copy skills were unavailable previously; use them if genuinely available now, otherwise follow these principles. No additional decorative images are necessary to finish verification.
```
