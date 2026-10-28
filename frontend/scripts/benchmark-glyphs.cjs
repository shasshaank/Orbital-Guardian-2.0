/* Offline CPU preparation only. No GPU, browser FPS or picking claims. */
const fs = require('fs');
const Module = require('module');
const path = require('path');
const THREE = require('three');
const source = path.resolve(__dirname, '../src/components/glyphGeometry.js');
const compiled = fs.readFileSync(source, 'utf8').replace("import * as THREE from 'three';", "const THREE = require('three');").replace('export function glyphGeometry', 'exports.glyphGeometry = function glyphGeometry');
const mod = new Module(source, module); mod.filename = source; mod.paths = module.paths; mod._compile(compiled, source);
const { glyphGeometry } = mod.exports;
const report = { node: process.version, platform: `${process.platform}/${process.arch}`, scope: 'Synthetic CPU geometry/matrix preparation; excludes GPU, browser, React and raycasting', results: [] };
for (const count of [100, 1000, 6000]) {
  const times = [];
  let triangles;
  for (let repeat = 0; repeat < 5; repeat++) {
    const start = performance.now();
    triangles = 0;
    const dummy = new THREE.Object3D();
    for (const category of ['payload', 'debris', 'rocket_body', 'unknown']) {
      const size = count / 4;
      const geometry = glyphGeometry(category);
      const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), size);
      triangles += size * (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      for (let i = 0; i < size; i++) {
        const angle = i * 2.399963229728653; // deterministic synthetic distribution
        dummy.position.set(Math.cos(angle)*1.1, Math.sin(angle)*1.1, (i/size-0.5)*2);
        dummy.scale.setScalar(0.012); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
      }
      mesh.computeBoundingSphere(); geometry.dispose(); mesh.material.dispose(); mesh.dispose();
    }
    times.push(performance.now()-start);
  }
  report.results.push({ objects: count, repeats: 5, preparation_ms: times, median_ms: [...times].sort((a,b)=>a-b)[2], full_detail_triangles: triangles, category_batches: 4, simplified_triangles: count*4, matrix_bytes: count*16*4 });
}
const output = JSON.stringify(report, null, 2)+'\n';
if (process.argv[2]) fs.writeFileSync(process.argv[2], output);
process.stdout.write(output);
