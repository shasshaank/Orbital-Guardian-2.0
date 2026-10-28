// Phase 3 metadata must supply this explicit contract before a category is shown.
// Never infer type from names, active-group membership or OMM security markings.
export const CATEGORIES = {
  payload: { label: 'Payload / spacecraft', color: '#79d6a0', symbol: '▣' },
  debris: { label: 'Debris', color: '#ef7d84', symbol: '◆' },
  rocket_body: { label: 'Rocket body', color: '#d9b16f', symbol: '▰' },
  unknown: { label: 'Unknown / unclassified', color: '#a6b7c7', symbol: '◇' }
};
export function categoryOf(object) {
  const c = object?.classification;
  return c?.status === 'confirmed' && typeof c.source === 'string' && c.source.trim() &&
    c.norad_id === object.norad_id && Object.prototype.hasOwnProperty.call(CATEGORIES, c.category)
    ? c.category : 'unknown';
}
export const hasState = object => object && ['lat', 'lon', 'alt_km'].every(k => Number.isFinite(object[k]));
