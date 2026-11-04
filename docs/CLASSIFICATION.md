# SATCAT classification — local import checkpoint, 5 November 2026

Phase 3 now has an optional local metadata join and inspector evidence. No real metadata snapshot is shipped, downloaded or independently verified. Default objects remain unknown. Automatic metadata retrieval, refresh policy and real-source/browser acceptance remain unfinished; this is not full Phase 3 completion.

## Source investigation

Primary documentation consulted on 5 November 2026:

| Source | Documented type vocabulary / access | Usage and redistribution finding |
| --- | --- | --- |
| [CelesTrak SATCAT format](https://celestrak.org/satcat/satcat-format.php) | `NORAD_CAT_ID` supports nine digits; `OBJECT_TYPE`: `PAY`, `R/B`, `DEB`, `UNK`. JSON/CSV SATCAT is separate from GP. | [Usage policy](https://celestrak.org/usage-policy.php) asks clients to download only needed data once per update; SATCAT changes manually once or twice daily. Stop on non-200 responses. That policy does not establish a blanket redistribution licence for this application. |
| [Space-Track documentation](https://www.space-track.org/documentation) | Authenticated SATCAT access requires an account. The local adapter recognizes `PAYLOAD`, `ROCKET BODY`, `DEBRIS`, `UNKNOWN`; other values remain unknown. [Official operator handbook](https://www.space-track.org/documents/SFS_Handbook_For_Operators_V1.7.pdf) documents these object-type terms. No authenticated API request was made. | Public documentation describes approval to redistribute basic SSA information, including SATCAT, conditioned on appropriate citation. Review the applicable account agreement and exact product before acquisition or redistribution. No blanket project licence is inferred. |

CelesTrak is the natural public metadata candidate alongside existing GP ingestion. Its usage documentation alone leaves this project's redistribution basis unresolved. Space-Track remains an optional local-import vocabulary adapter, not an authenticated integration. No credentials are required or accepted by this importer. Terms URLs are provenance references, not proof of permission. Source labels identify operator-supplied provenance; the importer does not authenticate that a file came from the named provider.

## Local configuration

Keep real imports outside the repository and Docker build context. Set backend `ORBITAL_METADATA_FILE` to an absolute readable JSON path. In Docker, mount the file read-only and set the path inside the container. There is no download endpoint or background refresh. `ORBITAL_OFFLINE=1` still allows this explicitly configured local file, without network access.

Synthetic schema illustration (the ID/type below is not a factual classification):

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

Wrap an independently obtained SATCAT JSON record list in `sources[].records`; use its actual download time and public query URL. CSV conversion is not implemented. For `space_track_satcat`, the supported public provenance URL is `https://www.space-track.org/basicspacedata/query/class/satcat/format/json`. Do not supply authenticated URLs, session tokens or credentials. CelesTrak URLs are restricted to `/satcat/records.php` with documented selectors or `/pub/satcat.csv`; Space-Track URL paths are restricted to the endpoint above. HTTPS, expected host, no userinfo/fragments and an allowlist of query keys are required.

Limits: 16 MiB, 100,000 records total, one to eight source snapshots. Retrieval timestamps must include a timezone and cannot be in the future. A malformed source, ID or record rejects the entire file. Local paths and parse exceptions are never returned publicly. Missing/unreadable/invalid imports leave orbital elements usable, classifications unknown and an explicit metadata-unavailable notice. Validated files are cached by path/inode/mtime/ctime/size; replacing the file is detected on the next catalogue request. An invalid replacement is not silently replaced with old confirmed evidence.

## Join and conflict rules

- Join only by numeric catalogue ID, range 1–999,999,999; digit strings normalize to integers. No name matching, truncation, active-group inference, operational inference or use of OMM `CLASSIFICATION_TYPE`.
- Map provider-specific `OBJECT_TYPE` to `payload`, `rocket_body`, `debris`, `unknown`. Preserve the original string or null. Unsupported/missing/unknown values remain unknown; no fuzzy normalization.
- All matching evidence must agree on one known category for `status=confirmed`. Different normalized categories, including known versus unknown, yield `status=conflict` and neutral styling. No newest-source/provider precedence. Same-category duplicates do not create a conflict; all evidence is retained.
- No matching ID: `missing`; matching unknown-only evidence: `unknown`; invalid configured import: `unavailable`. Without configuration, status is `missing` and metadata reports `not_configured`.
- `confirmed` means agreement of imported metadata under these rules, not independent observational verification or current operational status. Old metadata remains historical evidence: its retrieval time is shown; there is no classification freshness/accuracy guarantee.

Both `/catalog` and legacy `/satellites` objects gain `classification` with `norad_id`, `category`, `status`, `source`, `snapshot_id` and `evidence`. Each evidence entry preserves provider, source URL, terms reference, original type, normalized category and retrieval time. The SHA-256 snapshot ID identifies exact import bytes and is separate from the orbital-element snapshot. Extra SATCAT fields, credentials and unrelated metadata are not forwarded. Any embedded classification on an orbital record is replaced by the explicit join result.

`/catalog.metadata.classification_metadata` reports `not_configured`, `loaded` (with counts/hash) or `unavailable` (generic error). The inspector exposes original types/times and conflicts. Catalogue, legend and globe continue sharing the existing category contract. No visual transform changes analysis inputs.

## Validation and remaining work

Deterministic synthetic tests cover both vocabularies, full IDs through the API, same-name mismatches, missing/unknown/malformed records, source and duplicate conflicts, provenance validation, invalid file replacement and legacy list compatibility. Frontend tests cover ID validation and evidence rendering. These are automated checks, not browser or real-source verification.

Next: resolve the applicable source/redistribution conditions, then add a separately cached, bounded, policy-compliant opt-in retriever and verify a real join. Finish browser category/picking/accessibility/slow-request acceptance, sustained GPU profiling and Phase 7 security/licensing/Docker gates. No deployment is authorized by this checkpoint.
