import { categoryOf, hasState } from './objectSemantics';
import { glyphGeometry } from './components/glyphGeometry';

test('only confirmed metadata with matching full ID and source enables category', () => {
  const object = { norad_id: 999999999, name: 'DEB', omm: { CLASSIFICATION_TYPE: 'U' } };
  expect(categoryOf(object)).toBe('unknown');
  const classification = { norad_id: object.norad_id, status: 'confirmed', category: 'payload', source: 'test fixture' };
  expect(categoryOf({ ...object, classification })).toBe('payload');
  for (const change of [{ norad_id: 99999 }, { source: '' }, { source: '  ' }, { category: 'toString' }, { status: 'conflict' }, { category: 'operational' }]) {
    expect(categoryOf({ ...object, classification: { ...classification, ...change } })).toBe('unknown');
  }
  expect(hasState({ lat: 0, lon: 0, alt_km: 0 })).toBe(true);
  expect(hasState({ lat: 0, lon: NaN, alt_km: 0 })).toBe(false);
});
test('original category glyphs remain bounded shared geometry', () => {
  for (const category of ['payload', 'debris', 'rocket_body', 'unknown']) {
    const geometry = glyphGeometry(category);
    expect(geometry.attributes.position.count).toBeLessThan(150);
    geometry.computeBoundingSphere();
    expect(geometry.boundingSphere.radius).toBeLessThan(2);
    geometry.dispose();
  }
});
