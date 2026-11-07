import * as THREE from 'three';
import { markerStyle, raycastMarkers } from './markerRendering';
import { altitudeColors, altitudeRange } from './trajectoryGeometry';

test('marker detail changes smoothly with zoom and retains readable far markers', () => {
  expect(markerStyle(2, 6000).detail).toBe(1);
  expect(markerStyle(4, 6000).detail).toBeLessThan(markerStyle(4, 1000).detail);
  expect(markerStyle(12, 6000).detail).toBe(0);
  expect(markerStyle(12, 6000).radius).toBeGreaterThan(1.5);
  expect(markerStyle(4, 6000, 390).radius).toBeLessThan(markerStyle(4, 6000, 900).radius);
  expect(Math.abs(markerStyle(7.01, 6000).radius - markerStyle(7, 6000).radius)).toBeLessThan(0.02);
});

test.each([3, 7, 14])('projected picking follows marker size at camera distance %s', distance => {
  const camera = new THREE.PerspectiveCamera(42, 900 / 550, 0.1, 100);
  camera.position.z = distance; camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial(), 3);
  const positions = new Float32Array([0, 0, 0, 2, 2, 0, 0, 0, distance + 1]);
  const scales = new Float32Array([1.7, 1, 1]);
  const radius = markerStyle(distance, 6000).radius;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(radius * 1.3 * 2 / 900, 0), camera);
  const hits = [];
  raycastMarkers(mesh, positions, scales, camera, 550, radius, ray, hits);
  expect(hits.map(hit => hit.instanceId)).toEqual([0]);
  const miss = [];
  ray.setFromCamera(new THREE.Vector2(0.9, 0.9), camera);
  raycastMarkers(mesh, positions, scales, camera, 550, radius, ray, miss);
  expect(miss).toEqual([]);
  mesh.geometry.dispose(); mesh.material.dispose();
});

test('solid Earth remains nearer than a marker on the far side', () => {
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
  camera.position.z = 5; camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(), camera);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial());
  earth.updateMatrixWorld();
  const markers = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial(), 1);
  const hits = ray.intersectObject(earth);
  raycastMarkers(markers, new Float32Array([0, 0, -1.1]), new Float32Array([1]), camera, 550, 5, ray, hits);
  expect(hits.sort((a, b) => a.distance - b.distance)[0].object).toBe(earth);
  earth.geometry.dispose(); earth.material.dispose(); markers.geometry.dispose(); markers.material.dispose();
});

test('trajectory colors represent altitude, preserve inputs, and handle a level orbit', () => {
  const path = [{ alt_km: 400 }, { alt_km: 500 }, { alt_km: 600 }];
  const before = JSON.stringify(path);
  const colors = altitudeColors(path);
  expect(altitudeRange(path)).toEqual({ min: 400, max: 600 });
  expect(colors.slice(0, 3)).toEqual(new THREE.Color('#22d3ee').toArray());
  expect(colors.slice(-3)).toEqual(new THREE.Color('#e879f9').toArray());
  expect(JSON.stringify(path)).toBe(before);
  const level = altitudeColors([{ alt_km: 400 }, { alt_km: 400 }]);
  expect(level.slice(0, 3)).toEqual(level.slice(3));
  expect(altitudeColors([{ alt_km: NaN }])).toEqual([]);
});
