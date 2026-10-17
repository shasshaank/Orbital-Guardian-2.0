# Product gap analysis

## Functional

The ambition is persistent decision support. The baseline is a request-driven active-satellite catalog, pair distance screen and heuristic advisor. No observation stream, persisted event history, operator ephemeris upload, notification delivery or fleet optimization exists. Preserve useful interactive exploration first: shared selection, searchable catalogue, explicit forecast timeline and dedicated pair/asset analysis. Object type must remain unknown because TLEs alone do not reliably classify debris versus spacecraft.

## Scientific

SGP4 is a valid foundation, but the wrapper can invalidate results through unsynchronized times, missing samples and incorrect Earth-frame mapping. TLE age is not uncertainty. Fixed miss-distance bands do not measure collision probability. The advisor's confidence, fuel percentage and post-burn distance are not validated predictions. Correct these semantics, test against published states, and disclose approximate UT1/EOP treatment. Even improved discrete sampling cannot establish a collision-free interval. Covariance, object radii, time/frame conventions, encounter modeling and reference validation are prerequisites for Pc. A maneuver what-if needs a physically propagated impulse, execution epoch, spacecraft constraints and re-screening against other objects.

## Product design

The original globe is useful but panel-heavy, poorly linked to search, and fixed-height layout hides content. Hierarchy should begin with catalog availability and a large Earth view, then object inspection and analysis. Labels must distinguish snapshot, forecast, stale elements, service health and unknown provenance. A “SAFE” API enum should read “Above screening threshold” in the interface. Display unavailable rather than zero for missing measurements. Earth texture must not rotate independently from Earth-fixed positions.

## Infrastructure

No scheduled ingestion, storage schema, observability, rate limiting, CI or reproducible validation exists. Network retries are slow and repeated; runtime cache overwrites tracked fixtures; Docker lacks offline data. First stage: TTL cache, atomic separate runtime files, bounded requests, explicit offline mode, regression suite and CI. Later: versioned snapshots, metrics, background jobs and backpressure. Multi-process cache coherence remains a separate concern.

## Portfolio position

A defensible portfolio demonstration is: validated public TLE ingestion → reproducible UTC propagation → transparent sampled proximity screening → linked scientific visualization → measured/tested behavior. It should demonstrate engineering judgment about uncertain data rather than claim operational collision avoidance, continuous custody or radar sensing.
