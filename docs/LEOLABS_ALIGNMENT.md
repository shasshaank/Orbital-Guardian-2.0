# LeoLabs alignment — public evidence, 17 October 2026

This project is independent. It does not reproduce proprietary LeoLabs systems or access their radar observations, catalog, APIs or customer data. “Persistent Orbital Intelligence” is the requested visual direction; the product itself is labeled a public-TLE research workspace, not a persistent operational service.

## What public sources establish

- [About](https://leolabs.space/about/): LeoLabs serves space-domain-awareness, traffic-management and operations missions through a radar network and orbital analytics.
- [Radars](https://leolabs.space/radars/): public descriptions include phased-array systems, digital signal processing, rapid revisits and radar scheduling. Several capabilities are explicitly in development or R&D; do not imply all are deployed.
- [Platform](https://leolabs.space/platform/): public capabilities span measurement calibration, orbit determination, ephemeris propagation, state vectors, event detection, web interfaces and REST APIs. The page describes low-latency processing and horizontal scaling. These are vendor claims, not measurements made in this audit.
- [Conjunction alerts](https://leolabs.space/conjunction-alerts/): the service describes continuous searches, operator ephemeris screening, CDMs, covariance access, and risk-trend reports. These explain why uncertainty and data provenance matter beyond rendering orbits.
- [Careers](https://leolabs.space/careers/) and [Senior Software Engineer](https://job-boards.greenhouse.io/leolabsinc/jobs/4392799009): the public role emphasizes Python/Go, distributed backends, APIs, cloud/container deployments, relational storage, brokers, observability and CI/CD; frontend experience is preferred. This particular role also has clearance requirements; technical alignment does not establish applicant eligibility. A radar-software job found in search redirected to the job board on opening, so it is not treated as a confirmed current vacancy.

Public catalog counts differ across pages; no single count is used as a benchmark target or reproduced as a project metric.

## Mapping to the project

| Engineering area | Baseline evidence | Selected contribution | Remaining opportunity |
|---|---|---|---|
| SSA/SDA and tracking | Public TLE forecasts, no measurements | Honest element epochs, source and coordinate frames | Observation processing requires licensed radar/optical observations |
| Catalog processing | Loose JSON arrays | Validation, deduplication, per-group cache, rejected counts | OMM and versioned catalog snapshots |
| Conjunction assessment | Sampled separation bands | Shared time grid, failure semantics, relative velocity, reproducibility | Validated TCA refinement and covariance/CDM pipeline |
| Decision support | Unvalidated heuristic advisor | Candidate-only labeling and explicit assumptions | Repropagated impulse simulation with constraints |
| Scientific scale | Serial 500-candidate scan | Measured propagation baseline, bounded work, shared frontend data | Conservative broad phase with recall tests, jobs and backpressure |
| Near-real-time systems | On-demand snapshots | Retrieval/state times distinct from epoch | Scheduled ingest, latency SLOs, replay and freshness metrics |
| Visualization | R3F Earth and paths | Linked catalogue/object selection, forecast samples, keyboard-accessible alternative | Uncertainty ellipsoids only when valid covariance exists |
| Reliability | No tests/CI | Reference vectors, negative cases, API/UI tests and build checks | Load testing, metrics, deployment health and incident runbooks |

The relevance above is an engineering inference from public material. The strongest demonstration is a small, validated pipeline with visible limitations, not a claim of equivalent sensing or flight-safety capability.
