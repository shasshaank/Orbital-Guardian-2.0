# Public orbital elements: ingestion and freshness

Implemented scope: the owner's Phases 1 and 2, 24 October 2026. Classification, new glyphs and advanced analysis remain separate work.

## Provider and coverage

Default source: [CelesTrak GP](https://celestrak.org/NORAD/documentation/gp-data-formats.php), `https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON`. These are OMM-compatible JSON elements, not radar observations or a continuous sensor feed. SGP4 computes each displayed state at `state_time`; `epoch` describes the element set, while `retrieved_at` describes the download. Recent elements do not establish positional accuracy.

The active group is **not the full space-object catalogue** and is not a classification authority. The backend allows these explicit query groups from the [current-data catalogue](https://celestrak.org/NORAD/elements/): `active`, `stations`, `visual`, `last-30-days`, `analyst`, `fengyun-1c-debris`, `iridium-33-debris`, `cosmos-2251-debris`. Debris-event groups cover particular populations, not all debris. Only the active group was fetched in this session. Other allowed groups are API options, not verified coverage claims or automatic additional downloads. Unsupported groups return 422. The current frontend requests active only; group selection and classification UX are deferred.

SupGP is a different interface with potentially several elements per object/source/epoch; see [SupGP queries](https://celestrak.org/NORAD/documentation/sup-gp-queries.php). It is not ingested by this GP implementation. Space-Track is optional and **not implemented**; no account or credentials are needed for the default application. Authenticated provider terms and credential handling must be reviewed before that integration.

## Refresh and failure policy

- Refresh is on demand, never background polling. `ORBITAL_REFRESH_SECONDS` defaults to **7200** and is clamped to at least two hours. CelesTrak requests that clients use their latest download and not check more often than its update cadence. Browser Refresh snapshot recalculates states from the provider cache until eligible for another download.
- Cache namespace includes provider URL, format and group. Runtime snapshot and refresh-status files are separate from tracked bundled data. Atomic temporary-file replacement preserves the prior snapshot on write failure. The previous valid in-memory snapshot is also retained.
- A thread lock and filesystem `flock` serialize refresh across processes sharing the same cache directory on Linux/macOS. Readers recheck disk after locking. Parsed snapshots are reused while inode/mtime/size are unchanged. This is **single-host/shared-filesystem coordination**, not a distributed lock across isolated replicas. A durable shared runtime directory is necessary to preserve cooldowns across restarts. Never erase the cache to force repeated provider requests.
- HTTPS verification stays enabled; credentials/query tokens in the source URL and redirects are rejected. Connect/read timeouts are 3/15 seconds. At most one transport retry follows a 0.5-second delay; TLS failures are not retried. Responses are bounded to 32 MiB, 50,000 records, and a 30-second streaming-loop budget. Socket reads still use the read timeout, so the loop budget is not a hard total wall-clock deadline.
- HTTP errors are never immediately retried. Redirects, 403 and 404 pause automatic refresh until an operator investigates. Other errors and validation failures get at least a two-hour cooldown, extended by `Retry-After` when supplied. Cooldowns are persisted. After resolving a blocked-source cause, stop local workers and remove only the affected `<group>.status.json` from the namespaced runtime directory; retain its valid `<group>.json`. Do not do this to bypass provider restrictions.
- One malformed required record rejects the whole update; error metadata includes attempted received/rejected counts. Existing valid data remains active. Duplicate valid IDs choose the newest normalized epoch; equal epochs choose the lexicographically greatest canonical JSON. Results are ordered by numeric ID.
- All accepted records are checked for current-epoch propagation compatibility. Individual state failures are counted, not silently presented as valid positions. An update for which every propagation fails is rejected. Per-request API propagation failures are counted separately for the requested slice.
- `ORBITAL_OFFLINE=1` performs no provider request. Active uses validated bundled elements preferentially for deterministic demonstrations. Other groups may use their own cached snapshot but never borrow active data. Without valid data, the envelope reports `cache_status=unavailable` and no objects.
- If the runtime directory cannot be locked/written, do not fetch; serve retained memory/bundled data with a visible error. There is no Redis, database or queue.

## Canonical records and API compatibility

Native record:

```json
{"name":"Example","omm":{"NORAD_CAT_ID":100001,"EPOCH":"2026-10-24T00:00:00+00:00","...":"validated GP fields"}}
```

The abbreviated example is a schema illustration, not valid propagation input. Native records retain provider fields and precision. CelesTrak's omitted EARTH/TEME/UTC/SGP4 defaults are made explicit; contradictory values, unsupported ephemeris types, malformed dates, non-finite/range-invalid elements and IDs outside 1–999,999,999 are rejected. `CLASSIFICATION_TYPE` is a security marking, **not** payload/debris classification. Object classification remains unknown until Phase 3.

Bundled/legacy records keep `{name,line1,line2}` with strict TLE format/checksum validation. There is no JSON→TLE conversion. sgp4 2.23 limits its internal Alpha-5 identity tag to 339999; the wrapper preserves the true ID separately and uses an internal nonphysical tag of zero above that limit. No orbital value or public ID is truncated. Tests compare position/velocity with the retained Vallado TLE reference over 24 hours and several 6-/9-digit IDs. This compatibility test does not independently validate every orbit regime.

`/catalog` returns `{objects,metadata}`. Objects add `omm` or legacy lines, `element_format`, `norad_id`, `epoch`, age/freshness, predicted state, `source`, `retrieved_at`, and `snapshot_id`. `/satellites` retains its list shape; clients must support native `omm` records rather than assume all records have TLE lines. Existing TLE analysis requests still work:

- `/propagate` and `/maneuver-recommend`: either `line1`/`line2` or JSON-string query `omm` (max 6000 characters), not both.
- `/collision-check`: independently use legacy `line1_a`/`line2_a`, `line1_b`/`line2_b`, or `omm_a`/`omm_b`.
- `/asset-scan`: numeric `catnr` lookup in the active snapshot; full integer identity is preserved. Existing 500-candidate cap and sampled-screening limitations remain.
- Catalogue pagination: `offset` 0–50000 and `limit` 1–6000 (default 1000). `next_offset` advances through source records, including failed states; `examined_count = returned_count + propagation_failed`. The UI still loads at most 1000 objects and paginates that subset locally. It does not claim full-catalogue coverage.

Snapshot metadata includes provider/query/format, unique content+retrieval `snapshot_id`, real UTC retrieval/last-success time, received/accepted/rejected/duplicate counts, validation propagation failures, cache age/status, source errors, next eligible refresh, and blocked status. API state generation and per-page propagation failures are separate fields. Bundled retrieval time remains null; no fabricated original timestamp.

| State | API fields | User wording |
|---|---|---|
| This request downloaded valid data | `mode=live`, `cache_status=fresh` | Retrieved from provider |
| Cache reused within interval | `mode=cache`, `cache_status=fresh` | Fresh cached catalogue |
| Retained downloaded data after expiry/failure | `mode=cache`, `cache_status=stale` | Stale cached catalogue |
| Automatic bundled fallback | `mode=fallback`, `cache_status=bundled` | Bundled fallback catalogue |
| Explicit offline | `mode=offline`, `offline=true` | Offline catalogue |
| Nothing valid | `mode=unavailable`, `cache_status=unavailable` | Source unavailable |

`is_stale` concerns snapshot retrieval age/availability, not orbital uncertainty. Element freshness is relative to the API state timestamp: any future epoch → `future`; age 0–7 days inclusive → `recent`; over seven days → `stale`. Invalid/missing required epochs are rejected, not assigned a synthetic epoch. UI labels also handle unknown/unavailable metadata distinctly. These policies do not establish orbit accuracy.

## Local operation and opt-in integration evidence

Backend `.env` is loaded; see `backend/.env.example`. Frontend `REACT_APP_API_URL` is substituted **at build time**; changing it requires rebuilding. CORS defaults to localhost:3000 and 127.0.0.1:3000; `CORS_ORIGINS` configures exact additional origins. `/health` only proves service availability. A reachable health endpoint does not prove fresh provider data or a compatible `/catalog` contract.

```bash
# Offline deterministic tests; no network required.
ORBITAL_OFFLINE=1 backend/.venv/bin/python -m unittest discover -s backend/tests -v

# Explicit real-provider test, isolated reusable cache. Do not repeatedly force downloads.
ORBITAL_OFFLINE=0 ORBITAL_CACHE_DIR=/tmp/orbital-omm-verification \
  backend/.venv/bin/python -m backend.scripts.verify_provider --group active \
  --output /tmp/orbital-omm-active.json
```

The opt-in script exits nonzero on fallback/unavailable data and records real retrieval metadata, counts, sample epochs, IDs above 99999, CORS, catalogue and forecast TestClient results. It does not run in offline CI or start/deploy servers. Real provider transport is verified, but TestClient is not socket/browser acceptance. Evidence and limitations are in [VERIFICATION.md](VERIFICATION.md).

Public access does not by itself establish a blanket redistribution licence. Attribute CelesTrak and retain its query/provenance. Consult provider terms before redistributing bulk snapshots. No project licence, texture licence, Space-Track permission or classification metadata licence is inferred here.

## Phase 4–6 additions — 28 October 2026

`/collision-check` accepts `include_paths` (boolean, default true). False returns `separation_km`, one full-precision value for every shared UTC grid sample, instead of `path_a`/`path_b`. Start/window/step, count, closest event and element provenance are unchanged. The workbench uses compact mode; legacy default retains full states. Both modes propagate and screen every sample and have the same sampling limitations. `/asset-scan` adds `skipped_count` for candidates beyond its cap; failed propagations are still separate from successful screens.

The frontend reserves `classification: {category, status: "confirmed", source, norad_id}` for future joined metadata. Recognized categories: `payload`, `debris`, `rocket_body`, `unknown`. Nonempty source and exact numeric catalogue-ID match are required for confirmed styling; unsupported, missing or conflicting metadata stays unknown. No backend classification importer or confirmed metadata is supplied yet. This rendering contract does not establish provenance or redistribution rights. See [PHASE456.md](PHASE456.md) for visual/scientific contracts and measurements.
