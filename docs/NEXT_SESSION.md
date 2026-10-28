# Orbital Guardian 2.0 — continuation after Phases 4–6 implementation

Continue `shasshaank/Orbital-Guardian-2.0` on `orbital-guardian-research-workspace`. Improve the existing React/Three.js/R3F + FastAPI/Python 3.11/SGP4 implementation; do not rewrite it. Preserve all uncommitted work. No deployment, production settings/data changes, Render changes, merge into main, invented licences or blind dependency upgrades. **Leave Brave alone unless explicitly authorized.**

## Read first and current state — 28 October 2026

1. Inspect git status, full HEAD, tracking, staged/unstaged diffs and untracked files before editing. This session started clean at **17be30c1f795a60d93e29da16a7640b615aa7823**, branch `orbital-guardian-research-workspace`. Owner will commit/push; today's changes remain uncommitted. Do not assume this SHA still matches next session.
2. Read [PHASE456.md](PHASE456.md) and `## Owner Phases 4–6 — 28 October 2026` in VERIFICATION.md first. DATA_PIPELINE.md documents native OMM, cache and compact pair-response contracts. Earlier verification sections only resolve concrete gaps; do not reconstruct completed work by repeating expensive checks.
3. Phases 1/2 remain implemented: native OMM/full IDs, verified bounded HTTPS, rate-limited refresh/atomic cache, source/freshness UI and API pagination. No provider request this session; retained real-source evidence remains dated 24 October. Do not describe bundled offline data as current.
4. Phase 4 implementation: original instanced category glyphs, shared category semantics, category filter, selected/comparison rings, selected label, explicit availability/filter/visibility status, responsive flowing legend and procedural schematic Earth with shading. Far/dense batches simplify. Current data still renders **unknown**: Phase 3 metadata ingestion has not been implemented. No classification inferred from names or OMM security marking. Original Earth textures remain unused by the globe but unlicensed/unresolved in the repository.
5. Phase 5: named-axis velocity bug fixed; finite-state validation strengthened; seven-case analytic/dense encounter corpus and 2,000-state independent scalar distance comparison. Existing Vallado/shared-grid/scientific limits retained. No continuous refinement, probability or validated maneuvers added. Real-orbit independent encounter corpus remains future work.
6. Phase 6: vectorized exhaustive sampled separation; optional `include_paths=false` compact pair API used by workbench; explicit scan skipped count. Same synthetic 10,081-state kernel median **77.98 → 27.25 ms** (5 calls, increased temporary memory). Single offline 168 h pair: **7,347,838 → 187,264 B**, **475.95 → 273.52 ms**, closest event unchanged. CPU glyph preparation measured at 100/1,000/6,000 objects; no thousands-object GPU claim. Full raw evidence/reproduction/limits in PHASE456.md. Do not repeat maximum-horizon 500-candidate scan without a concrete reason.
7. Final automated validation: **47 backend tests, 21 frontend tests, lint/build pass**. Native Chrome checks include desktop globe, label/inspector, category filter, camera controls, mobile 390×844 and tablet 820×1180 layout and mobile two-minute timeline advancement. Full browser/release acceptance remains open; see exact checklist below. Brave untouched. Local servers started only for offline acceptance and stopped at session end.
8. No hosted CI result verifies today's dirty tree. Owner should commit/push this feature branch, then inspect Actions for the **exact resulting SHA**. No push, merge, deployment, production settings changes, infrastructure or dependency upgrades performed. Root licence/original texture provenance, security advisories and Docker gates remain unresolved. **Not release-ready.**

## Next session priorities

- Inspect owner changes and pushed-SHA CI first. Preserve all existing work.
- Implement Phase 3 metadata investigation/join/provenance before claiming real payload/debris/rocket categories. The frontend rendering contract in PHASE456.md is ready but does not authorize a data source or its redistribution.
- Finish Phase 4/7 browser matrix: drag versus click/picking and occlusion, all layer/camera controls, catalogue/inspector sync and full IDs, desktop/tablet/mobile/touch, keyboard/focus/reduced motion, forced WebGL failure and slow forecast/pair/maneuver completion/cancellation. Verify actual source/OMM UX; don't treat Jest or TestClient as browser evidence.
- Profile real browser/GPU and picking at thousands of objects. CPU-only geometry evidence already exists; measure before further renderer changes. Keep instancing, deterministic simplification, loaded-subset labels, exhaustive sample recall and bounded scans.
- Build a representative independent orbital encounter corpus before continuous/adaptive TCA refinement. Analytic linear-motion cases already demonstrate sampled misses; do not invent collision probabilities or maneuver validation.
- Complete Phase 7 security/licensing/Docker/configuration gates and Phase 8 final audit. Do not deploy or merge to main without explicit permission.

## Remaining owner prompt — preserve and implement incrementally

The following retains the remaining requested scope. Phases 4–6 implementation and scoped evidence are recorded above; remaining acceptance requirements below are retained. Continue with a reviewable increment and update this handoff. Existing release gates remain requirements; new data does not substitute for acceptance. Historical roadmap Stage 3/4 numbering differs from these owner phases.

### Phase 3 — defensible satellite/debris classification

Investigate public catalogue metadata and its licensing/usage conditions. Join orbital elements and metadata using stable catalogue IDs, never display names. Preserve actual source vocabulary, original classification and provenance for payload/spacecraft, rocket body, debris and unknown/unclassified. Do not assume payloads are operational, unknown objects are debris, or `DEB` names prove classification. `CLASSIFICATION_TYPE` in OMM is a security marking, not object category.

Represent conflicting metadata or apply a documented precedence policy. Test missing classifications, mismatched IDs, conflicting sources, six-/nine-digit IDs and unknown types. No classification is currently claimed by the application. Do not infer redistribution permission from public availability.

### Phase 4 — globe implementation present; complete acceptance

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

### Phase 5 — sampled-kernel fixes/corpus present; preserve scientific limits

Inspect actual completed work before changing it. Shared UTC grids, explicit state failures, approximate GMST/WGS84 conversion, validation, honest sampled-screening accounting, Vallado reference tests and candidate-only maneuvers already exist. Preserve them and their limitations.

Prioritize shared grids, missing data, coordinate/time approximations, input validation and nonfabricated outputs, scan accounting, independent numerical references, maneuver semantics and reproducible benchmarks. Establish an independent encounter corpus before adaptive/bounded closest-approach refinement; compare to dense/independent reference results. Discrete sampling cannot prove no collision.

No collision probability without covariance/uncertainty, object-size assumptions, encounter geometry, validated method and references. Maneuver candidates are unvalidated heuristics: no invented confidence, fuel savings, post-burn miss distance or operational guarantees. A physical what-if requires burn epoch, impulse/force model, spacecraft constraints, propagation and re-screening. No radar custody, orbit determination or LeoLabs-equivalent coverage claims.

### Phase 6 — measured optimizations present; extend browser/GPU evidence

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

## Owner Git commands for this checkpoint

Run from the repository root after reviewing the changes. Current branch is already `orbital-guardian-research-workspace`; do not merge into main. All changes in this session are within the paths staged below. Check the status for any subsequent owner edits before staging.

```bash
git status --short
git branch --show-current
git diff --check
git add README.md backend frontend docs
git diff --cached --stat
git diff --cached --check
git commit -m "Improve globe glyphs, sampled screening and performance"
git push origin orbital-guardian-research-workspace
git rev-parse HEAD
```

After pushing, inspect GitHub Actions for the printed full SHA. The local working-tree checks do not establish hosted CI success. No force push, deployment or merge is needed.
