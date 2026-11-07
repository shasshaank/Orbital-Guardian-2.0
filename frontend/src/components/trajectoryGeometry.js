import * as THREE from 'three';

const stops = ['#22d3ee', '#3b82f6', '#8b5cf6', '#e879f9'].map(color => new THREE.Color(color));
export function altitudeRange(path = []) {
  if (!path.length || !path.every(p => Number.isFinite(p.alt_km))) return null;
  const values = path.map(p => p.alt_km);
  return { min: Math.min(...values), max: Math.max(...values) };
}
export function altitudeColors(path) {
  const range = altitudeRange(path);
  if (!range) return [];
  return path.flatMap(p => {
    const t = range.max - range.min > 1e-9 ? (p.alt_km - range.min) / (range.max - range.min) : 0.5;
    const phase = t * (stops.length - 1), index = Math.min(stops.length - 2, Math.floor(phase));
    return stops[index].clone().lerp(stops[index + 1], phase - index).toArray();
  });
}
