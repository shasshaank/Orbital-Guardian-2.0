import * as THREE from 'three';
import { createMarkerMaterial, markerStyle, raycastMarkers } from '../src/components/markerRendering';
import { CATEGORIES } from '../src/objectSemantics';

const button = document.querySelector('#run');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
const canvas = document.querySelector('#view');
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const stats = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: values.length, median_ms: sorted[Math.floor(sorted.length / 2)],
    p95_ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
};

button.onclick = async () => {
  button.disabled = true;
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(900, 550, false);
    const gl = renderer.getContext();
    const timer = renderer.capabilities.isWebGL2 ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    const camera = new THREE.PerspectiveCamera(42, 900 / 550, 0.1, 100);
    const dummy = new THREE.Object3D();
    const ray = new THREE.Raycaster();
    const point = new THREE.Vector2();
    const report = { browser: navigator.userAgent, viewport: [900, 550],
      pixel_ratio: renderer.getPixelRatio(), webgl2: renderer.capabilities.isWebGL2,
      gpu_timer_available: Boolean(timer), visible: !document.hidden,
      scope: 'Synthetic production billboard markers; simplified Earth (not production Earth shader); continuous rotating camera; 60 measured frames after 10 warmup frames per size; picking includes Earth and four instanced batches; excludes React/API/labels', workloads: [] };
    for (const count of [100, 1000, 6000]) {
      status.textContent = `Measuring ${count.toLocaleString()} objects…`;
      const scene = new THREE.Scene();
      const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: '#18394e' }));
      scene.add(earth);
      const categories = ['payload', 'debris', 'rocket_body', 'unknown'];
      const meshes = categories.map((category, batch) => {
        const size = Math.floor(count / 4);
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = createMarkerMaterial(CATEGORIES[category].color, batch);
        material.uniforms.uViewportHeight.value = 550;
        const mesh = new THREE.InstancedMesh(geometry, material, size);
        mesh.frustumCulled = false;
        const positions = new Float32Array(size * 3), scales = new Float32Array(size).fill(1);
        for (let i = 0; i < size; i++) {
          const id = i * 4 + batch;
          // Fibonacci sphere and deterministic altitude: no random/live data.
          const y = 1 - 2 * (id + 0.5) / count;
          const angle = id * Math.PI * (3 - Math.sqrt(5));
          const radius = 1.08 + (id % 71) / 180;
          dummy.position.set(Math.sqrt(1 - y * y) * Math.cos(angle), y, Math.sqrt(1 - y * y) * Math.sin(angle)).multiplyScalar(radius);
          positions.set(dummy.position.toArray(), i * 3);
          dummy.scale.setScalar(1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.raycast = (raycaster, hits) => raycastMarkers(mesh, positions, scales, camera, 550, markerStyle(camera.position.length(), count).radius, raycaster, hits);
        mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); scene.add(mesh);
        return mesh;
      });
      const draw = [], intervals = [], picking = [], queries = [];
      let previous, intersections = 0, hiddenFrames = 0;
      for (let i = 0; i < 70; i++) {
        const timestamp = await frame();
        if (document.hidden) hiddenFrames++;
        camera.position.set(3.8 * Math.cos(i / 80), 1.1, 3.8 * Math.sin(i / 80)); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
        const style = markerStyle(camera.position.length(), count);
        meshes.forEach(mesh => { mesh.material.uniforms.uRadius.value = style.radius; mesh.material.uniforms.uDetail.value = style.detail; mesh.material.uniforms.uTime.value = i / 60; });
        let query;
        if (timer && i >= 10) { query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query); }
        const start = performance.now(); renderer.render(scene, camera); const elapsed = performance.now() - start;
        if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT); queries.push(query); }
        if (i >= 10) {
          draw.push(elapsed); intervals.push(timestamp - previous);
          const pickStart = performance.now();
          for (let p = 0; p < 12; p++) {
            point.set(((p * 7) % 13) / 6 - 1, ((p * 5) % 11) / 5 - 1);
            ray.setFromCamera(point, camera);
            intersections += ray.intersectObjects([earth, ...meshes], false).length;
          }
          picking.push(performance.now() - pickStart);
        }
        previous = timestamp;
      }
      const gpu = [];
      let disjoint = false;
      // Poll boundedly without gl.finish(), which would distort the workload.
      for (let attempt = 0; queries.length && attempt < 120; attempt++) {
        await frame();
        if (gl.getParameter(timer.GPU_DISJOINT_EXT)) { disjoint = true; break; }
        while (queries.length && gl.getQueryParameter(queries[0], gl.QUERY_RESULT_AVAILABLE)) {
          const query = queries.shift(); gpu.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(query);
        }
      }
      const timedOut = queries.length;
      queries.forEach(query => gl.deleteQuery(query));
      report.workloads.push({ count, lod_detail: markerStyle(camera.position.length(), count).detail, draw_calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles, submission: stats(draw), frame_interval: stats(intervals),
        picking_12_rays: stats(picking), intersection_count: intersections, hidden_frames: hiddenFrames,
        gpu: !disjoint && !timedOut ? stats(gpu) : null, gpu_disjoint: disjoint, gpu_queries_unresolved: timedOut });
      [earth, ...meshes].forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
    }
    renderer.dispose();
    report.valid_visible_run = report.visible && report.workloads.every(workload => workload.hidden_frames === 0);
    output.textContent = JSON.stringify(report, null, 2);
    status.textContent = report.valid_visible_run ? 'Complete. Timings apply only to this browser and synthetic workload.' : 'Completed while hidden or occluded. Bring this window to the front and rerun before using the timings.';
    const download = document.querySelector('#download');
    download.disabled = false;
    download.onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'orbital-browser-benchmark.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  } catch (error) {
    status.textContent = `Benchmark unavailable: ${error.message}`;
  } finally { button.disabled = false; }
};
