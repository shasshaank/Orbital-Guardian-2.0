# Orbital Guardian

A React and FastAPI workspace for exploring public orbital elements, viewing SGP4 predictions, and screening sampled close approaches. It is a research tool, not a flight operations system.

The globe, catalogue and inspector share object selection and metadata categories. Pair screening uses a shared UTC grid and reports its sampling interval. Maneuver outputs are illustrative candidates with explicit assumptions; they are not validated burns.

## Run locally

Requires Python 3.11 and Node.js 22. Install the locked dependencies:

```bash
python3.11 -m venv backend/.venv
backend/.venv/bin/python -m pip install --require-hashes -r backend/requirements-dev.txt
cd frontend
npm ci
cd ..
```

Start the API and frontend in separate terminals:

```bash
ORBITAL_OFFLINE=1 backend/.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm start
```

Open <http://127.0.0.1:3000>. Offline mode uses old bundled elements and labels them accordingly. Omit `ORBITAL_OFFLINE=1` for on-demand CelesTrak GP retrieval with verified HTTPS, bounded responses, a two-hour minimum refresh interval, and explicit cached fallback.

Backend settings are in [backend/.env.example](backend/.env.example); copy it to `backend/.env` if needed. The frontend accepts `REACT_APP_API_URL` in `frontend/.env` or the build environment. This is a public **build-time** value: rebuild after changing it. Backend credentials must never use this variable. CORS defaults to the two local port-3000 origins; configure exact origins for another host.

## Data and classifications

CelesTrak GP JSON supports full catalogue IDs without conversion to TLE. Retrieval time, element epoch and propagated-state time are separate fields. The active group and the loaded 1,000/3,000/6,000-record subset are not the complete catalogue.

Classification uses a separate SATCAT import joined by full numeric catalogue ID. Missing, unsupported and conflicting evidence remains unknown. Payload does not imply operational status. No classification is inferred from names or OMM security markings.

Use `ORBITAL_METADATA_FILE` for an independently obtained JSON import. An opt-in, separately scheduled SATCAT refresh command is also available; acquisition and redistribution terms must be reviewed for the intended use before running it. No real metadata is bundled. See [classification and refresh](docs/CLASSIFICATION.md) and [data/API contracts](docs/DATA_PIPELINE.md).

## Checks and production build

```bash
ORBITAL_OFFLINE=1 backend/.venv/bin/python -m unittest discover -s backend/tests -v
cd frontend
npm run lint
npm run test:ci
npm run build
```

The production frontend is written to `frontend/build`. It can be served by a static web server; the API remains a separate service. Vite binds its development server to localhost. Source maps are disabled in production builds.

Python requirements are fully pinned with SHA-256 hashes. Edit `backend/requirements.in` or `backend/requirements-dev.in`, then regenerate both `.txt` locks with Python 3.11 and pip-tools 7.6.2:

```bash
pip-compile --strip-extras --generate-hashes --no-emit-index-url --no-emit-trusted-host --output-file backend/requirements.txt backend/requirements.in
pip-compile --strip-extras --generate-hashes --no-emit-index-url --no-emit-trusted-host --output-file backend/requirements-dev.txt backend/requirements-dev.in
```

## Docker

```bash
docker build -t orbital-guardian-api backend
docker run --rm --name orbital-guardian-api -p 127.0.0.1:8000:8000 -e ORBITAL_OFFLINE=1 orbital-guardian-api
curl --fail http://127.0.0.1:8000/health
curl --fail 'http://127.0.0.1:8000/catalog?limit=10'
```

The image runs as UID 10001. `/app/data/runtime` is writable for snapshots and locks. A mounted cache must also be writable by that UID. Mount optional metadata read-only outside the build context and set `ORBITAL_METADATA_FILE` to its container path. Keep `.env`, runtime data and real imports out of the build context. Verify the image with the health and catalogue requests above before deployment.

## Deploy

Deploy the backend and frontend as separate services. Use Python 3.11 and Node.js 22, as in CI.

| Service | Root directory | Build command | Start / publish |
| --- | --- | --- | --- |
| API | `backend` | `pip install --require-hashes -r requirements.txt` | `uvicorn app.main:app --host 0.0.0.0 --port "$PORT"` |
| Static frontend | `frontend` | `npm ci && npm run build` | Publish `build/` |

Set these in the hosting service before the first build/start:

- Frontend: `REACT_APP_API_URL=https://<your-api-host>`; rebuild when this changes.
- Backend: `CORS_ORIGINS=https://<your-frontend-host>` with exact origins, separated by commas and no spaces or trailing slashes.
- Backend: `ORBITAL_OFFLINE=0` for provider retrieval, or `1` for a bundled-data demo.
- Backend: `ORBITAL_CACHE_DIR` pointing to a writable, persistent directory. Keep one API instance initially; isolated replicas do not share provider cooldowns.
- Native Python hosting: use the host's assigned `PORT`; set `PORT=8000` if it does not provide one. The Docker image listens on port 8000 instead.

Use `/health` for the API health check. After deployment, open `/catalog?limit=10` and inspect `metadata.mode`, retrieval time and errors, then load the frontend and check catalogue loading, object selection, forecasts and pair screening. A healthy API can still be serving bundled or stale data.

The API has no authentication or application rate limiting. Asset scans can run up to 500 propagations per request; browser cancellation does not stop that work. Configure request rate/concurrency limits at the hosting proxy before unrestricted public access.

GitHub should contain source, tests, dependency locks, `.env.example` files, CI, Docker configuration and required public assets. Keep `.env` files, virtual environments, `node_modules`, generated builds, runtime caches and private metadata imports out of Git. Check that Actions passes for the commit being deployed.

## Limits and licensing

Positions are SGP4 predictions from published mean orbital elements, not sensor observations. Sampled screening can miss encounters between samples. No covariance, collision probability, radar coverage, validated maneuver outcome or operational guarantee is provided. See [scientific limits and benchmarks](docs/SCIENTIFIC_LIMITS.md).

Original project code is [MIT licensed](LICENSE). Space Grotesk retains its [OFL notice](frontend/public/fonts/OFL.txt), and dependencies retain their own licenses. Earth maps are attributed to Solar System Scope under CC BY 4.0; marker silhouettes and atmosphere are drawn in code. See [visualization details](docs/VISUALIZATION.md). The horizon illustration is generated artwork, not observational imagery. Public orbital data and metadata retain their providers' terms; the MIT license does not grant rights to those datasets.

### Enable object-type metadata

Unknown types are expected until an authoritative SATCAT import is configured. GP `CLASSIFICATION_TYPE` is a security marking; it is not object type. The active group is not a complete debris catalogue. No names are used to infer type.

After reviewing the provider terms, fetch a single reusable snapshot outside the repository:

```bash
backend/.venv/bin/python -m backend.app.metadata_refresh --cache-dir /absolute/persistent/satcat --group active --terms-reviewed
```

Set `ORBITAL_METADATA_FILE=/absolute/persistent/satcat/active.json` in the backend environment and restart the API. Schedule the same command separately for refresh; the importer enforces its cooldown. Never commit the downloaded snapshot. Missing IDs and conflicting evidence remain unknown. See [classification](docs/CLASSIFICATION.md).
