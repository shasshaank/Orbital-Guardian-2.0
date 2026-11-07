// Confirmed metadata must supply this contract before a category is shown.
// Never infer type from names, active-group membership or OMM security markings.
export const CATEGORIES = {
  payload: { label: 'Payload / spacecraft', color: '#00ff66', symbol: '▣' },
  debris: { label: 'Debris', color: '#ff3b30', symbol: '◆' },
  rocket_body: { label: 'Rocket body', color: '#ef6560', symbol: '▰' },
  unknown: { label: 'Unknown / unclassified', color: '#91a1ba', symbol: '◇' }
};
export function categoryOf(object) {
  const c = object?.classification;
  return Number.isSafeInteger(object?.norad_id) && object.norad_id >= 1 && object.norad_id <= 999999999 &&
    c?.status === 'confirmed' && typeof c.source === 'string' && c.source.trim() &&
    c.norad_id === object.norad_id && Object.prototype.hasOwnProperty.call(CATEGORIES, c.category)
    ? c.category : 'unknown';
}
export const hasState = object => object && ['lat', 'lon', 'alt_km'].every(k => Number.isFinite(object[k]));
