export const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export async function request(path, params = {}, signal) {
  const response = await fetch(`${API_URL}${path}?${new URLSearchParams(params)}`, { signal });
  const data = await response.json().catch(() => { throw new Error('The API returned an unreadable response.'); });
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Request failed (${response.status}). Check the analysis inputs.`);
  return data;
}
export const number = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : 'Unavailable';
export const utc = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'Unknown';
export const band = risk => ({ SAFE: 'Above threshold', WARNING: 'Within 50 km', CRITICAL: 'Within 10 km', UNKNOWN: 'Unavailable' }[risk] || 'Not assessed');
export function filterObjects(objects, query, freshness, sort) {
  const q = query.toLowerCase().trim();
  return objects.filter(s => (!q || `${s.name} ${s.norad_id}`.toLowerCase().includes(q)) && (freshness === 'all' || s.freshness === freshness))
    .sort((a, b) => sort === 'altitude' ? a.alt_km - b.alt_km : sort === 'epoch' ? Date.parse(b.epoch) - Date.parse(a.epoch) : a.name.localeCompare(b.name));
}

// Native OMM elements travel intact; legacy TLE clients remain supported.
export function elementParams(object, suffix = '') {
  return object.omm ? { [`omm${suffix}`]: JSON.stringify(object.omm) } :
    { [`line1${suffix}`]: object.line1, [`line2${suffix}`]: object.line2 };
}
export const freshnessLabel = value => ({ recent: 'Recent elements', stale: 'Stale elements', future: 'Future epoch', unknown: 'Unknown element epoch', unavailable: 'Elements unavailable' }[value] || 'Unknown element epoch');
export function sourceLabel(metadata) {
  if (metadata.mode === 'unavailable') return 'Source unavailable';
  if (metadata.mode === 'offline') return 'Offline catalogue';
  if (metadata.cache_status === 'bundled' || metadata.mode === 'fallback') return 'Bundled fallback catalogue';
  if (metadata.cache_status === 'stale' || metadata.is_stale) return 'Stale cached catalogue';
  if (metadata.mode === 'cache') return 'Fresh cached catalogue';
  if (metadata.mode === 'live') return 'Retrieved from provider';
  return 'Source status unknown';
}
