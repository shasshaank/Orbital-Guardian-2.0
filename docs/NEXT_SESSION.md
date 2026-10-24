# Orbital Guardian 2.0 — continuation after Phases 1 and 2

Continue `shasshaank/Orbital-Guardian-2.0` on `orbital-guardian-research-workspace`. Improve the existing React/Three.js/R3F + FastAPI/Python 3.11/SGP4 implementation; do not rewrite it. Preserve all uncommitted work. No deployment, production settings/data changes, Render changes, merge into main, invented licences or blind dependency upgrades. **Leave Brave alone unless explicitly authorized.**

## Read first and current state

1. Inspect git status, full HEAD, tracking status, staged/unstaged diffs and untracked files before editing. Last starting HEAD was `e5ccb0310fb6d28fe5856ded10f607462ba59d66`; today's changes remain uncommitted. Owner will commit/push. Do not assume a prior SHA still matches.
2. Read only `## Owner Phases 1 and 2 — 24 October 2026` in VERIFICATION.md and DATA_PIPELINE.md. Read relevant source/test files for the selected next task. Older ledger sections only resolve concrete gaps. Do not repeat completed checks merely to reconstruct context.
3. Owner scoped 24 October to **Phases 1 and 2 only**. Those implementation changes are present: native CelesTrak OMM-compatible JSON; native SGP4 with full 6-/9-digit IDs; legacy TLE API input retained; bounded verified HTTPS; 2-hour minimum on-demand refresh; per-provider/group atomic cache, thread/filesystem refresh locking, persisted cooldown/blocked errors; deterministic deduplication; explicit source/freshness UI and timestamps; catalogue API pagination.
4. Real active-group HTTPS retrieval succeeded at `2026-10-24T18:12:09.242229+00:00`: 16,792 records, zero rejected/duplicates, 880 IDs above 99,999, one validation propagation failure. API returned 1,000 predicted objects, 5 with stale/future epochs; final cached native forecast for real ID 100000 returned 61 samples. These are provider + TestClient checks, not socket/browser acceptance. Other query groups were investigated but not fetched; no all-debris coverage claim.
5. Local validation: **43 backend tests, 17 frontend tests, lint and production build pass**; build `main.5aea5801.js`, CSS `main.1a319105.css`. Known HTTPX/punycode/Browserslist notices remain. CI [40111775775](https://github.com/shasshaank/Orbital-Guardian-2.0/actions/runs/40111775775) succeeded for starting full SHA above, not uncommitted code. Check exact new SHA after owner pushes; do not trigger/push automatically.
6. Optional Space-Track remains unimplemented. Classification, glyph redesign, new scientific algorithms and infrastructure were not added. Existing cancellation fixes from the previous session are preserved in HEAD.
7. No local servers were started this session. Live cache is isolated at `/tmp/orbital-omm-verification`, not a tracked fixture. Do not clear it to force another provider request. Runtime cache locks require Linux/macOS and a shared writable directory; separate replicas are not coordinated. Config/API details and reproducible commands: DATA_PIPELINE.md. Raw observations: verification-phase12-2026-10-24.json.

## Remaining owner prompt — preserve and implement incrementally

The following retains the remaining requested scope. A new session should select a small reviewable increment, verify it, and update this handoff. Existing release gates remain requirements; new data does not substitute for acceptance. Historical roadmap Stage 3/4 numbering differs from these owner phases.

### Phase 3 — defensible satellite/debris classification

Investigate public catalogue metadata and its licensing/usage conditions. Join orbital elements and metadata using stable catalogue IDs, never display names. Preserve actual source vocabulary, original classification and provenance for payload/spacecraft, rocket body, debris and unknown/unclassified. Do not assume payloads are operational, unknown objects are debris, or `DEB` names prove classification. `CLASSIFICATION_TYPE` in OMM is a security marking, not object category.

Represent conflicting metadata or apply a documented precedence policy. Test missing classifications, mismatched IDs, conflicting sources, six-/nine-digit IDs and unknown types. No classification is currently claimed by the application. Do not infer redistribution permission from public availability.

### Phase 4 — LeoLabs-inspired globe, retaining the functional R3F scene

Use restrained navy space, realistic Earth shading, readable paths, controlled glow, coherent legend and clear selection. Do not copy proprietary LeoLabs artwork. Use documented licensed, self-created or procedural assets. Existing Earth texture provenance is unresolved; do not invent a licence.

- Confirmed payloads: green satellite-shaped glyphs with body and solar-panel wings.
- Confirmed debris: red debris-specific glyphs.
- Rocket bodies: distinct neutral/amber rocket-body glyphs.
- Unknown objects: neutral styling, never implied known category.
- Selection: highlight, label and synchronized inspector. Analysis participants: additional highlight retaining classification meaning.
- Glyphs are visual symbols, not to physical scale; document exaggerated size. Visual transforms must never enter calculations.
- Profile thousands of objects. Preserve instancing/batching; use detail/visibility thresholds or deterministic simplification when justified. Avoid per-object expensive meshes/lights/materials. Do not render every object at full complexity at every zoom.
- Verify globe/catalogue selection, search/filtering, inspector sync, category and marker/path toggles, camera/reset, labels, forecast/timeline, desktop/tablet/mobile, keyboard/focus/names and reduced motion. Legend, catalogue and inspector must share semantics.
- Distinguish filtered-out, unavailable and out-of-view objects. Do not imply the loaded 1,000-object UI subset is the whole catalogue.

### Phase 5 — remaining scientific correctness

Inspect actual completed work before changing it. Shared UTC grids, explicit state failures, approximate GMST/WGS84 conversion, validation, honest sampled-screening accounting, Vallado reference tests and candidate-only maneuvers already exist. Preserve them and their limitations.

Prioritize shared grids, missing data, coordinate/time approximations, input validation and nonfabricated outputs, scan accounting, independent numerical references, maneuver semantics and reproducible benchmarks. Establish an independent encounter corpus before adaptive/bounded closest-approach refinement; compare to dense/independent reference results. Discrete sampling cannot prove no collision.

No collision probability without covariance/uncertainty, object-size assumptions, encounter geometry, validated method and references. Maneuver candidates are unvalidated heuristics: no invented confidence, fuel savings, post-burn miss distance or operational guarantees. A physical what-if requires burn epoch, impulse/force model, spacecraft constraints, propagation and re-screening. No radar custody, orbit determination or LeoLabs-equivalent coverage claims.

### Phase 6 — measured performance/scalability

Use retained evidence: 168-hour pair has 10,081 samples/path and a 7.35 MB response; maximum-horizon 500-candidate serial scan took about 99 s. Do not repeat that expensive scan without a concrete reason. The new warm-cache microbenchmark measures only parsed cache reads, not API/scan/render performance.

Measure before optimizing. Prioritize shared catalogue requests, parsed-cache reuse, avoiding redundant frontend work, reducing unnecessary response data while preserving analysis, and streaming/pagination only when useful. Any conservative broad phase must demonstrate recall against exhaustive screening; no silently missed possible encounters. Keep bounded workloads, scan caps, attempted/successful/failed/skipped counts and predictable cancellation/loading/error states. Browser abort does not cancel backend CPU computation.

Benchmark representative small/medium/large datasets, with environment, dataset, horizon, sampling interval, accuracy, runtime and memory where available. Distinguish single observations from statistical claims. Do not add Redis/database/queue or other infrastructure without measured need.

### Phase 7 — complete release readiness

Tests/CI: after relevant application edits run the complete backend suite, frontend tests/lint/build. Keep offline fixtures deterministic; real provider integration is explicit and rate-limited. Add focused regressions for freshness/fallback/classification/missing metadata/full IDs/errors/globe behavior as implemented. Inspect hosted Actions for **the exact final pushed commit**; never call starting-SHA CI evidence for a dirty tree. Fix failures and rerun relevant checks.

Browser acceptance: actual desktop/tablet/mobile browser verification is still partial. Open gates include blank-reload diagnosis and source-less CSP issue without weakening security; globe picking/drag/reset; remaining mobile/tablet/touch table controls; keyboard/focus/reduced motion; forced WebGL/error boundary; full slow-request completion/cancellation for forecast/pair/maneuver; maneuver zero/null/assumptions UI; updated OMM/source-status UI. Earlier native Chrome CUA sometimes failed silently or returned noWindowsAvailable; record exact tool blockers and avoid lengthy repeated failed attempts. Screenshots are conversation-only. Brave retains an old console-only fetch-delay override: only when authorized, reload its test tab before reuse. No source injection exists.

Security/licensing: review advisories and compatible changes, portable/hash-validated Python locking, TLS, CORS, secrets, request limits/failure behavior, bundled/cache paths. Historical npm audit had 98 affected package entries; no current clearance. No blind npm audit fix or major upgrades. Root LICENSE and original Earth texture provenance are unknown; propose a justified resolution to the owner, never choose a licence without authority. Record public-data attribution and redistribution conditions; any optional Space-Track credentials stay backend-only and out of code/logs/public responses.

Docker/configuration: check daemon once, build/start/offline-test if available, otherwise record exact blocker with reproduction commands. Verify data files, writable runtime/cache-lock paths, health, API configuration and frontend/backend OMM contract. Frontend API URL is build-time configuration; deployed origins require explicit CORS. Do not deploy or change production/Render settings. No merge to main without explicit permission.

### Phase 8 — documentation and handoff

Update relevant README/audit/roadmap/evidence with actual implementation, providers/limits, refresh/caching/error policy, optional-source environment variables only when implemented, local/offline setup, canonical schema/classification rules, observation vs elements vs propagated state, scientific limits, reproducible tests/benchmarks, unresolved issues and exact commit/CI result. Never describe a planned capability as complete.

At the end report exact tested commit plus dirty-tree qualifier where applicable, changed files, commands/outcomes, provider evidence, before/after measurements with scope, and a clear deployment go/no-go. Provide reviewed feature-branch Git push commands. Do not perform the push, merge or deployment automatically.

### Final definition of done for the full task

1. Default public-source retrieval validates current elements when reachable; failures and safe cached fallback are explicit.
2. Retrieval, element and propagated-state times/freshness are distinct and honest.
3. OMM and supported full catalogue IDs propagate without truncation/corruption.
4. Metadata-driven payload/debris/rocket/unknown categories are consistent throughout catalogue/legend/inspector/globe.
5. Supported-scale 3D globe is polished, interactive, responsive and measured.
6. Analytical calculations and limitations remain scientifically responsible.
7. Tests/lint/build and hosted CI verify the final commit; browser/security/licensing/Docker checks pass or have precise documented blockers.
8. No production deployment, settings/data mutation or merge to main occurs without permission.

## Commands when needed

```bash
ORBITAL_OFFLINE=1 backend/.venv/bin/python -m unittest discover -s backend/tests -v
cd frontend
npm run lint
CI=true npm run test:ci
CI=true GENERATE_SOURCEMAP=false npm run build
cd ..
git diff --check
```

Real-provider and warm-cache commands are in DATA_PIPELINE.md. No TypeScript check exists. Recheck localhost listeners before starting servers; bind localhost only. Current checkpoint is **not release-ready**.
