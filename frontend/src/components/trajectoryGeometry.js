import * as THREE from 'three';

const stops = ['#22d3ee', '#3b82f6', '#8b5cf6', '#e879f9'].map(color => new THREE.Color(color));
export function altitudeRange(path = []) {
  if (!path.length || !path.every(p => Number.isFinite(p.alt_km))) return null;
  const values = path.map(p => p.alt_km);
  return { min: Math.min(...values), max: Math.max(...values) };
}
export function altitudeColors(path, fullRange = null) {
  const range = fullRange || altitudeRange(path);
  if (!range) return [];
  return path.flatMap(p => {
    const t = range.max - range.min > 1e-9 ? (p.alt_km - range.min) / (range.max - range.min) : 0.5;
    const phase = t * (stops.length - 1), index = Math.min(stops.length - 2, Math.floor(phase));
    return stops[index].clone().lerp(stops[index + 1], phase - index).toArray();
  });
}

// Preserve gaps: never connect across missing/non-monotone timestamps or invalid
// coordinates. Longitude wrapping is continuous in Cartesian scene coordinates.
export function trajectorySegments(path = [], maxGapSeconds = 300) {
  const segments = []; let segment = [];
  for (const state of path) {
    const valid = state && ['lat', 'lon', 'alt_km'].every(k => Number.isFinite(state[k])) &&
      Math.abs(state.lat) <= 90 && Math.abs(state.lon) <= 180 && state.alt_km >= 0 && Number.isFinite(Date.parse(state.time));
    const previous = segment.at(-1);
    const dt = previous ? (Date.parse(state?.time) - Date.parse(previous.time)) / 1000 : 0;
    if (!valid || (previous && (dt <= 0 || dt > maxGapSeconds))) {
      if (segment.length > 1) segments.push(segment);
      segment = [];
    }
    if (valid) segment.push(state);
  }
  if (segment.length > 1) segments.push(segment);
  return segments;
}
