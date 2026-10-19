# Continue Orbital Guardian 2.0

Continue from the current working tree on `orbital-guardian-research-workspace`. Preserve all uncommitted changes. Do not restart the project, rewrite architecture, blindly upgrade dependencies, deploy, or alter Render. Finish release verification before advanced features.

First read README.md, docs/VERIFICATION.md (including the 18 and 19 October evidence), docs/HANDOFF.md, docs/NEXT_SESSION.md, docs/PROJECT_AUDIT.md, docs/PRODUCT_GAP_ANALYSIS.md, docs/LEOLABS_ALIGNMENT.md, docs/TECHNICAL_ROADMAP.md, docs/VISUAL_ASSETS.md, docs/CHANGED_FILES.txt and docs/verification-2026-10-19.json. Inspect git status/diff before editing. Last observed HEAD was df13a9b; the owner may have pushed a new checkpoint since. Treat VERIFICATION.md as the ledger: never claim unexecuted checks passed.

Preserve React 18/CRA/Three/R3F + FastAPI/Python 3.11/SGP4, restrained navy/ice/amber design, functional globe, source/stale/time metadata, API compatibility and candidate-only maneuver semantics. No Pc, radar, orbit determination or flight-ready guidance exists.

Completed by 19 October:
- Prior fixes preserved: mobile table overflow, late forecast/maneuver cancellation/loading, all future epochs labelled future, API wording; 22 backend/6 frontend tests.
- Current tree backend tests, frontend lint/tests/build pass. Clean temporary Python install also passes 22 tests and pip check. Clean cached npm ci installs 1,365 packages; lint/tests/build pass; all 16 output files byte-identical to working build. Evidence JSON records versions/hashes. This is same-host repeatability, not portable locking.
- Backend transitives still unlocked: clean install resolved certifi 2026.10.18 vs existing 2026.7.22. No dependency updates made to working environment. Online npm audit was cancelled at owner stop request; use prior 18 October findings (98 affected package entries), not offline audit as clearance.
- GitHub API confirms successful hosted run 39030049272 for committed df13a9b ONLY; uncommitted edits have no hosted evidence. gh is unavailable. Docker CLI exists but daemon still unavailable.
- Actual production browser: one shared catalogue request confirmed in resource entries and API log; WebGL/texture/markers/path and font load; grid enabled; timeline End reaches sample 60 (+2h), reset restores snapshot. Tablet inner/scroll widths 768/768; laptop width 1366/1366 but actual height 1681, NOT verified at 1366×768. Earlier 390px QA remains recorded in ledger.
- Real outage/retained-snapshot/retry PASSED: stop API, Refresh snapshot displays API unavailable/Failed to fetch and retains catalogue; restart/retry clears error and updates snapshot/61-state forecast.
- Earlier local real pair/capped asset and live HTTPS stations ingestion evidence remains in ledger. No need to repeat solely for appearance.
- Selected static CSS text contrast ratios exceed 4.5:1, but no complete accessibility certification.
- Owner does not know original Earth texture provenance or intended root license. Both unresolved; do not invent either.

Local servers were stopped for the day. Recheck listeners before starting. Backend must load latest edits; use ORBITAL_OFFLINE=1 backend/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000. Sandbox binding required escalation. For production browser QA build then serve with backend/.venv/bin/python -m http.server 3000 --bind 127.0.0.1 --directory frontend/build; this is NOT CRA dev mode. Alternatively use documented npm start for development. Do not expose publicly.

Next priorities:
1. Complete outstanding browser checks: exact 1366×768 layout, 390px/tablet remaining controls, actual globe picking/zoom/reset/drag/layer visibility, catalogue sorting/filter reset, keyboard focus/names, touch table scrolling, reduced motion and forced WebGL/error boundary.
2. Browser slow-request and selection-change cancellation, maneuver zero/null/assumptions UI. Mocked tests do not replace browser fault injection. Outage/retry and clean production single-catalogue-request are already confirmed.
3. Review console/DevTools Issues: favicon.ico 404, form id/name improvements, source-less CSP eval issue. Do not weaken CSP. No application exception in limited capture; full console clearance not established. One reload attempt showed a blank surface, fresh-tab load recovered; cause unresolved.
4. Native CUA is the available browser interface, no browser automation surface in inventory. Chrome screenshots/AX work but input sometimes reports external changes or silently fails; get fresh state and verify every action. Width field click/Cmd+A/paste/Tab worked; height change did not. A 1366 width screenshot exists only in conversation, no screenshot artifact saved. Chrome contains two local tabs; avoid other user tabs.
5. Portable backend constraints/hash lock requires validation across target environments, especially Linux/container. No blindly frozen portable lock. Review compatible dependency security updates separately, serial CPU cancellation/large responses, and compact source without architecture rewrite. API max 168h permits 10,081 samples per object and serial 500-candidate scans; no load/maximum-horizon evidence yet.
6. Docker build/startup/offline fallback when daemon available. After owner pushes, inspect hosted CI for the exact new SHA; previous success only covers df13a9b. Do not deploy or change Render.
7. Run appropriate backend unittest, npm lint/test:ci/build after application changes, git diff --check and final diff review. Update ledger/audit/roadmap/handoff/manifest and exact remaining blockers. No TypeScript check exists.

Advanced continuous TCA validation, conservative broad-phase recall, replay, background ingestion, covariance/Pc and physical maneuver what-if remain deferred until release acceptance. Stop and checkpoint when owner requests; do not label this checkpoint release-ready.
