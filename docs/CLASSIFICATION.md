# Object classification

Classification is optional SATCAT evidence joined to orbital elements by the full numeric catalogue ID. Names, active-group membership and OMM `CLASSIFICATION_TYPE` never determine an object category. Payload does not establish current operational status.

## Sources and rights

[CelesTrak SATCAT documentation](https://celestrak.org/satcat/satcat-format.php) defines `NORAD_CAT_ID` through nine digits and the types `PAY`, `R/B`, `DEB`, `UNK`. Its JSON endpoint is separate from GP elements. [Usage policy](https://celestrak.org/usage-policy.php) describes retrieval cadence; public access alone does not establish redistribution rights. Use documented queries, download only needed data, and investigate non-200 responses before retrying.

[Space-Track documentation](https://www.space-track.org/documentation) describes authenticated access and citation conditions for basic SSA redistribution. The importer understands its type vocabulary, but no authenticated integration or account agreement has been exercised. Review the exact product and applicable terms before acquisition or redistribution. No credentials are accepted by this importer.

The project's MIT license covers original code, not provider datasets. No real metadata snapshot is bundled. Source labels identify supplied provenance; the local importer cannot authenticate file origin.

## Local imports

Set `ORBITAL_METADATA_FILE` to an absolute readable JSON path outside the repository and Docker build context. In Docker, mount it read-only and use the container path. Local imports work in offline mode.

This is a synthetic schema illustration, not a factual classification:

```json
{
  "schema_version": 1,
  "sources": [{
    "provider": "celestrak_satcat",
    "source_url": "https://celestrak.org/satcat/records.php?GROUP=active&FORMAT=JSON",
    "retrieved_at": "2026-01-01T00:00:00Z",
    "records": [{"NORAD_CAT_ID": 999999999, "OBJECT_TYPE": "PAY"}]
  }]
}
```

Wrap an independently obtained JSON record list in `sources[].records`, retaining its actual download time and public query URL. CSV conversion is not implemented. Optional `content_sha256` is the lowercase SHA-256 of original downloaded bytes. The refresh command supplies it automatically. The separate snapshot hash identifies exact import bytes.

For `space_track_satcat`, the supported provenance URL is `https://www.space-track.org/basicspacedata/query/class/satcat/format/json`. CelesTrak URLs use `/satcat/records.php` with documented selectors or `/pub/satcat.csv`. HTTPS, expected host, no userinfo/fragments and an allowlist of query keys are required. Do not supply authenticated URLs, tokens or credentials.

Imports are bounded to 16 MiB, 100,000 records and one to eight source snapshots. Timestamps must be timezone-aware and not future-dated. A malformed source, ID or record rejects the entire import. Paths and parse exceptions are never returned publicly. An invalid replacement becomes unavailable rather than silently retaining old classifications. File changes invalidate the parsed cache.

## Opt-in refresh

After reviewing terms applicable to the intended acquisition and use, run from the repository root:

```bash
backend/.venv/bin/python -m backend.app.metadata_refresh \
  --cache-dir /tmp/orbital-satcat --group active --terms-reviewed
```

Then set `ORBITAL_METADATA_FILE=/tmp/orbital-satcat/active.json`. Use durable storage for ongoing operation; `/tmp` is only an example. The flag records an operator decision to proceed; it grants no rights and does not resolve redistribution conditions.

Schedule this command separately if automatic refresh is wanted. It never runs inside an API catalogue request. The default is no metadata retrieval. Supported groups match the GP allowlist; only the requested group is fetched. There is no per-object download loop, authenticated source or force-refresh switch.

The command uses verified HTTPS, no redirects, one transport attempt, 3/15-second connect/read timeouts, a 30-second streaming-loop budget and bounded bytes/records. The loop budget is not a hard total deadline because socket reads have their own timeout. Whole-snapshot validation precedes atomic replacement. Original downloaded-byte SHA-256, public query, types and UTC retrieval time are retained.

A filesystem lock coordinates processes sharing the directory. A persisted reservation enforces at least 12 hours between attempts even after a crash. HTTP errors never trigger immediate retries; `Retry-After` can extend the cooldown. Every non-200 HTTP response blocks until operator review. Invalid status or unwritable coordination fails closed. Failed refreshes retain the previous validated import and expose a generic error; there is no new retrieval timestamp for retained data. Offline mode makes no request. Isolated replicas without shared storage are not coordinated.

Investigate the cause before clearing a blocked status file; never clear it to evade provider restrictions. Stop refresh workers before an operator repairs `<group>.status.json`, retaining `<group>.json`.

## Join policy and API

| Evidence | Category/status |
| --- | --- |
| All matching evidence agrees on a known category | `payload`, `rocket_body` or `debris` / `confirmed` |
| Matching unknown, missing or unsupported type only | `unknown` / `unknown` |
| Different normalized categories, including known vs unknown | `unknown` / `conflict` |
| No matching ID | `unknown` / `missing` |
| Configured import invalid or unreadable | `unknown` / `unavailable` |

There is no newest-source or provider precedence. Same-category duplicates retain all evidence without creating a conflict. CelesTrak types map exactly; Space-Track maps `PAYLOAD`, `ROCKET BODY`, `DEBRIS`, `UNKNOWN`. Unknown vocabulary is never fuzzy-matched. IDs must be integers or digit strings in 1–999,999,999. There is no truncation or name matching.

Both `/catalog` and `/satellites` add `classification` with category, status, ID, source, snapshot hash and original evidence. Any embedded classification on an orbital record is replaced. Evidence includes provider, public source URL, terms reference, original type, normalized category, retrieval time and optional original-byte hash. Extra SATCAT fields are not forwarded.

`/catalog.metadata.classification_metadata` reports configuration/load status, counts/hash, oldest retrieval, age and `is_stale`. Evidence older than 24 hours is labeled historical; this is a descriptive policy, not an accuracy guarantee. Refresh failure never changes the imported provenance. Confirmed means agreement under these rules, not independent observation or current operational status.

Automated tests use synthetic fixtures. Validate your own import and its usage terms before publishing classifications.
