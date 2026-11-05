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

The image runs as UID 10001. `/app/data/runtime` is writable for snapshots and locks. A mounted cache must also be writable by that UID. Mount optional metadata read-only outside the build context and set `ORBITAL_METADATA_FILE` to its container path. Keep `.env`, runtime data and real imports out of the build context. Docker build/run verification requires a running daemon; see [release status](docs/RELEASE_READINESS.md).

## Limits and licensing

Positions are SGP4 predictions from published mean orbital elements, not sensor observations. Sampled screening can miss encounters between samples. No covariance, collision probability, radar coverage, validated maneuver outcome or operational guarantee is provided. See [scientific limits and benchmarks](docs/SCIENTIFIC_LIMITS.md).

Original project code is [MIT licensed](LICENSE). Space Grotesk retains its [OFL notice](frontend/public/fonts/OFL.txt), and dependencies retain their own licenses. The schematic Earth and glyphs are drawn in code. The horizon illustration is generated artwork, not observational imagery. Old texture files with unknown provenance have been removed. Public orbital data and metadata retain their providers' terms; the MIT license does not grant rights to those datasets.
