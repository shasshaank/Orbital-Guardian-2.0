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

Start both services from the repository root with one command:

```bash
./dev
```

Open <http://127.0.0.1:3000>. The launcher verifies API health before starting Vite, stops both services on Ctrl-C or a child failure, and reports occupied ports instead of silently connecting to an old service. API logs share this terminal. No Python reload worker is started; restart `./dev` after backend/environment changes. Vite updates frontend edits automatically.

The browser uses `/api`, proxied by Vite to `http://127.0.0.1:8000`. This avoids cross-origin development requests and IPv4/IPv6 `localhost` ambiguity. `npm start` inside `frontend` starts **only** Vite; it requires a separately running API. Avoid concurrent Vite servers sharing this checkout. The launcher forces dependency-cache rebuilding on startup to clear stale optimized chunks.

For an explicit offline demonstration:

```bash
ORBITAL_OFFLINE=1 ./dev
```

Offline mode uses old bundled elements and labels them accordingly. Normal startup uses provider retrieval and retained runtime snapshots, with a two-hour minimum provider refresh interval. `/health` verifies the backend only; `/api/catalog?limit=10` on the frontend origin reports provider/cache/metadata availability separately.

Backend settings are in [backend/.env.example](backend/.env.example); copy it to the ignored `backend/.env` and configure `ORBITAL_METADATA_FILE` as described below. Real metadata imports must remain outside Git. The launcher loads this file into the API environment.

`REACT_APP_API_URL` is a public **build-time** frontend setting. Leave it unset (or `/api`) locally. For a separately hosted API set its full HTTPS origin, configure exact frontend origins in backend `CORS_ORIGINS`, then rebuild. Static production hosting must either proxy `/api` to the API or use that explicit origin. Vite preview also proxies `/api` locally. Backend secrets must never use frontend variables. `ORBITAL_API_PROXY` can override the Vite proxy target; it is server-only.

The last successful in-memory catalogue survives temporary refresh failures, with its state time and a retained-snapshot notice. Failed refreshes retry every 15 seconds while the page is open; provider downloads still obey backend cooldowns. Browser reload clears this in-memory copy. A successful empty response is shown as empty, rather than silently keeping old objects.

The globe remains mounted while navigating. Actual WebGL loss retains the canvas and waits for restoration; manual **Retry 3D view** creates a new renderer, with at most three retries per mounted workspace. Renderer errors are reported separately from context loss and API availability. The React 18 Strict Mode development wrapper is intentionally omitted with the installed R3F 8 Canvas lifecycle, whose effect teardown schedules a forced context loss. GPU listeners and timers are removed on teardown.

For manual recovery verification, open <http://127.0.0.1:3000/benchmarks/recovery.html> while `./dev` runs. This development-only harness is excluded from the production build. It can trigger actual `WEBGL_lose_context` loss/restoration, block/restore API requests, count live canvases, and remount the workspace. Block API, use Refresh snapshot, then restore API and wait up to 15 seconds. Loss/restoration should retain the same canvas; Retry should replace it once. Navigation and selection should not add canvases. Reload the normal app URL after testing.

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
