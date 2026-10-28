import * as THREE from 'three';

// Original code-built symbols, exaggerated size; no transform enters science data.
export function glyphGeometry(category) {
  if (category === 'payload') {
    const body = new THREE.BoxGeometry(0.8, 0.7, 0.7);
    const wings = [-1, 1].map(x => new THREE.BoxGeometry(1, 0.12, 0.65).translate(x, 0, 0));
    const parts = [body, ...wings].map(g => g.toNonIndexed());
    const geometry = new THREE.BufferGeometry();
    for (const key of ['position', 'normal', 'uv']) {
      const arrays = parts.map(g => g.getAttribute(key));
      const combined = new Float32Array(arrays.reduce((n, a) => n + a.array.length, 0));
      let offset = 0;
      arrays.forEach(a => { combined.set(a.array, offset); offset += a.array.length; });
      geometry.setAttribute(key, new THREE.BufferAttribute(combined, arrays[0].itemSize));
    }
    [body, ...wings, ...parts].forEach(g => g.dispose());
    return geometry;
  }
  if (category === 'debris') return new THREE.TetrahedronGeometry(0.85);
  if (category === 'rocket_body') return new THREE.CylinderGeometry(0.3, 0.3, 1.8, 6);
  return new THREE.OctahedronGeometry(0.7);
}
