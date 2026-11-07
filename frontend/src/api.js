export const API_URL = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '');
export async function request(path, params = {}, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
  try {
    let response;
    try {
      response = await fetch(`${API_URL}${path}?${new URLSearchParams(params)}`, { signal: controller.signal });
    } catch (error) {
      if (timedOut) throw new Error(`API request timed out at ${API_URL}${path}. Check backend logs, then retry.`);
      if (error.name === 'AbortError') throw error;
      throw new Error(`Cannot reach API at ${API_URL}${path}. Start both services with ./dev; for a deployed API check its URL, HTTPS and CORS origin.`);
    }
    const data = await response.json().catch(() => {
      throw new Error(response.status >= 500 ? `API service unavailable (${response.status}) at ${API_URL}${path}. Start ./dev or check backend logs.` : 'The API returned an unreadable response.');
    });
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `API request failed (${response.status}). Check backend logs and analysis inputs.`);
    return data;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
  }
}
export const number = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : 'Unavailable';
export const utc = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'Unknown';
export const band = risk => ({ SAFE: 'Separation ≥ 50 km', WARNING: 'Within 50 km', CRITICAL: 'Within 10 km', UNKNOWN: 'Unavailable' }[risk] || 'Not assessed');
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
  if (metadata.client_retained) return 'Retained snapshot · refresh failed';
  if (metadata.mode === 'unavailable') return 'Source unavailable';
  if (metadata.mode === 'offline') return 'Offline catalogue';
  if (metadata.cache_status === 'bundled' || metadata.mode === 'fallback') return 'Bundled fallback catalogue';
  if (metadata.cache_status === 'stale' || metadata.is_stale) return 'Stale cached catalogue';
  if (metadata.mode === 'cache') return 'Fresh cached catalogue';
  if (metadata.mode === 'live') return 'Retrieved from provider';
  return 'Source status unknown';
}
