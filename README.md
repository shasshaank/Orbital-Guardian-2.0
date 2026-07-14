# Orbital Guardian

### Ranked **8th of 389+ teams** — IIT Hyderabad Technical Showcase (Mar 2026)

> **Physics-driven space debris collision prediction and avoidance system**

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Python](https://img.shields.io/badge/Python-3.11-green.svg)
![React](https://img.shields.io/badge/React-18-61dafb.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg)
![Three.js](https://img.shields.io/badge/Three.js-r160-black.svg)

---

## Awards & Recognition

- **8th place out of 389+ teams** at the **IIT Hyderabad Technical Showcase** (March 2026)
- Presented a working end-to-end collision detection and avoidance demo to **IIT faculty and industry evaluators**
- Recognized for combining **live NORAD/Celestrak TLE ingestion**, **SGP4 orbital propagation**, and a **physics-based maneuver advisor** in an interactive 3D interface

---

## Overview

Low Earth Orbit is increasingly congested. Tens of thousands of tracked objects — and millions of smaller fragments — travel at orbital velocities where even centimetre-scale debris can disable a satellite. Operators need more than raw catalogs: they need trajectory forecasts, conjunction risk, and actionable avoidance guidance.

**Orbital Guardian** is a full-stack decision-support demo that closes that loop:

1. Ingest live Two-Line Element (TLE) data from public catalogs  
2. Propagate orbits with the industry-standard **SGP4** model  
3. Detect closest-approach events and classify risk  
4. Recommend avoidance burns using orbital geometry (cross-track / radial heuristics)  
5. Visualize the fleet, selected conjunctions, and trajectories on an interactive **Three.js** Earth

The system is designed as a transparent, explainable pipeline — every recommendation is grounded in orbital mechanics and state vectors, not a black-box model.

---

## Problem

| Challenge | Why it matters |
|-----------|----------------|
| **Scale** | Thousands of active satellites and debris objects interact across altitudes and planes; pairwise screening is computationally demanding |
| **Static tooling** | Many tools surface warnings without clear operator guidance on *what burn to plan* |
| **Maneuver tradeoffs** | Avoidance burns must balance miss distance, fuel (Δv budget), and mission constraints |
| **Mega-constellations** | Dense LEO fleets raise conjunction rates and the long-term risk of cascade events (Kessler Syndrome) |

---

## Key Capabilities

| Capability | What it does |
|------------|--------------|
| **Interactive 3D orbital visualization** | React Three Fiber globe with live satellite markers, selection highlighting, and rendered trajectory arcs |
| **Live TLE ingestion** | Fetches NORAD TLEs from Celestrak, with local cache and offline fallback for resilient demos |
| **SGP4 propagation** | Predicts position/velocity hours ahead; exposes TEME Cartesian state and geodetic lat/lon/alt |
| **Pairwise collision screening** | Time-aligned closest-approach analysis with **CRITICAL / WARNING / SAFE** thresholds |
| **Strategic asset monitor** | Scans a primary satellite (by NORAD catalog number) against a large candidate fleet for non-SAFE conjunctions |
| **Physics-based maneuver advisor** | Recommends burn direction, Δv, estimated fuel cost, confidence, and tradeoff options (e.g. max separation vs emergency radial) |

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         ORBITAL GUARDIAN                           │
│                                                                    │
│   ┌──────────────┐    ┌─────────────────────────────────────────┐ │
│   │  Data Layer  │    │            Backend (FastAPI)            │ │
│   │              │───▶│  tle_fetcher  →  propagator             │ │
│   │  Celestrak   │    │       ↓                 ↓               │ │
│   │  (NORAD TLE) │    │  collision_detector  maneuver_engine    │ │
│   └──────────────┘    └──────────────────┬──────────────────────┘ │
│                                          │ REST API               │
│                        ┌─────────────────▼──────────────────────┐ │
│                        │     Frontend (React + Three.js)        │ │
│                        │  Globe · SatelliteLayer · AssetMonitor │ │
│                        │  CollisionMonitor · ManeuverPanel      │ │
│                        └────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**Pipeline:** Catalog TLEs → SGP4 state vectors → closest-approach geometry → risk labels → maneuver heuristics → 3D visualization and operator panels.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Tailwind CSS, Three.js (`@react-three/fiber`, `@react-three/drei`) |
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **Orbital mechanics** | SGP4 (`sgp4`), NumPy |
| **Data** | Celestrak / NORAD Two-Line Elements |
| **Ops** | Docker (API image), environment-based API URL for deployment (e.g. Render) |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- (Optional) Docker

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: `http://localhost:8000`  
- Interactive docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm start
```

App: `http://localhost:3000`  
Set `REACT_APP_API_URL` in `.env` to point at your backend (local or deployed).

### Docker (backend)

```bash
cd backend
docker build -t orbital-guardian-api .
docker run -p 8000:8000 orbital-guardian-api
```

---

## API Reference

### `GET /health`

```json
{ "status": "ok", "service": "Orbital Guardian API" }
```

### `GET /satellites`

Fetches TLE data and returns current geodetic positions.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `group` | string | `active` | Celestrak satellite group |
| `limit` | int | `1000` | Max satellites to return (1–6000) |

### `GET /propagate`

Propagates a satellite with SGP4 over a time window.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `line1`, `line2` | string | — | TLE lines |
| `hours` | int | `24` | Horizon (1–168) |
| `step_minutes` | int | `10` | Sample step (1–60) |

Returns timestamped `position_km`, `velocity_km_s`, `lat`, `lon`, `alt_km`.

### `GET /collision-check`

Closest-approach analysis between two satellites.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `line1_a`, `line2_a` | string | — | Satellite A TLE |
| `line1_b`, `line2_b` | string | — | Satellite B TLE |
| `hours` | int | `24` | Propagation window |

**Example response (shape):**

```json
{
  "min_distance_km": 8.34,
  "risk_level": "CRITICAL",
  "closest_event": {
    "time": "2024-01-01T15:30:00+00:00",
    "distance_km": 8.34,
    "position_a": { "x": -1234.5, "y": 6789.0, "z": 1234.5 },
    "position_b": { "x": -1230.0, "y": 6782.0, "z": 1228.0 }
  }
}
```

Risk thresholds: **CRITICAL** &lt; 10 km · **WARNING** &lt; 50 km · **SAFE** otherwise.

### `GET /asset-scan`

Screens a primary asset (NORAD catalog number) against a large candidate set for non-SAFE conjunctions.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `catnr` | int | — | NORAD catalog number |
| `hours` | int | `24` | Scan window |

Returns the asset name, scan count, and risks sorted by minimum distance.

### `GET /maneuver-recommend`

Physics-based avoidance recommendation for a threatened satellite.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `line1`, `line2` | string | — | Threatened satellite TLE |
| `threat_direction_x/y/z` | float | `1, 0, 0` | Threat direction vector |
| `threat_distance_km` | float | — | Closest-approach distance (km) |

Returns a **primary** recommendation plus **tradeoff** alternatives (e.g. max-separation burn, emergency radial burn), including burn unit vector, Δv (m/s), estimated fuel cost, confidence, and a short explanation.

---

```
Orbital-Guardian/
├── frontend/                         # React + Three.js client
│   ├── public/
│   │   ├── index.html
│   │   └── textures/                 # Earth map assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── Globe.jsx             # 3D Earth canvas
│   │   │   ├── SatelliteLayer.jsx    # Fleet markers & highlights
│   │   │   ├── SatelliteOrbit.jsx    # Trajectory polylines
│   │   │   ├── AssetMonitor.jsx      # Primary-asset fleet scan UI
│   │   │   ├── CollisionMonitorPanel.jsx
│   │   │   ├── ResultsDisplayPanel.jsx
│   │   │   └── ManeuverPanel.jsx     # Avoidance recommendation UI
│   │   ├── App.jsx                   # App state & API orchestration
│   │   └── index.js
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI routes
│   │   ├── tle_fetcher.py            # Celestrak fetch, cache, fallback
│   │   ├── propagator.py             # SGP4 propagation
│   │   ├── collision_detector.py     # Closest-approach & risk labels
│   │   └── maneuver_engine.py        # Physics-based burn advisor
│   ├── data/                         # Cache, fallback TLEs, samples
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── .gitignore
└── README.md
```

---

## How It Works

### Collision screening

1. **Ingest TLEs** — Two-Line Elements encode mean orbital elements from the public catalog  
2. **Propagate with SGP4** — Predict TEME position/velocity over the chosen horizon (drag and Earth oblateness effects as modeled by SGP4)  
3. **Closest approach** — Compare time-aligned samples; record minimum separation and event geometry  
4. **Classify risk** — Map miss distance to CRITICAL / WARNING / SAFE for the UI and advisor

### Maneuver advisor (physics-based)

1. **State vector** — Current position and velocity from SGP4  
2. **Threat geometry** — Direction toward the conjunction partner  
3. **Burn direction** — Prefer a **cross-track** burn (perpendicular to velocity and threat) to grow miss distance efficiently; fall back to radial when geometry is degenerate  
4. **Δv scaling** — Closer threats → larger recommended burns  
5. **Tradeoffs** — Surface primary advice plus higher-Δv / emergency options with fuel and confidence estimates  

This keeps recommendations **interpretable**: an engineer can inspect vectors, thresholds, and Δv rather than trusting an opaque score.

---

## Data Sources

| Source | Role |
|--------|------|
| [Celestrak](https://celestrak.org) | Primary live NORAD TLE feeds |
| NORAD | Two-Line Element catalog standard |
| Local cache / fallback | Offline and resilience for demos when the network is unavailable |

---

## Design Notes & Scope

Orbital Guardian is a **showcase-grade decision-support demo**, not an operational conjunction assessment system. Intentional simplifications include discrete-time sampling for closest approach and a simplified TEME→geodetic conversion for visualization. The architecture is modular so higher-fidelity propagators, finer TCA search, or authenticated catalogs can be swapped in without rewriting the UI.

---

## Roadmap

- [ ] WebSocket (or similar) streaming for near-real-time position updates  
- [ ] Authenticated Space-Track integration for richer debris catalogs  
- [ ] Higher-fidelity propagation / refined time-of-closest-approach search  
- [ ] Multi-asset fleet maneuver optimisation  
- [ ] Automated tests for propagation and conjunction helpers  
- [ ] Broader mobile-responsive layout polish  

---

## Showcase Context

Built for the **IIT Hyderabad Technical Showcase** to demonstrate applied orbital mechanics, API design, and interactive scientific visualization for space situational awareness — ranked **8th of 389+ teams**.

---

## Contributing

Pull requests are welcome. For larger changes, open an issue first to align on scope.

1. Fork the repository  
2. Create a feature branch (`git checkout -b feature/your-feature`)  
3. Commit your changes  
4. Push the branch and open a Pull Request  

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Built for safer skies.
</p>
