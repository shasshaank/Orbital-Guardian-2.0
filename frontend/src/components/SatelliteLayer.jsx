import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { createMarkerMaterial, markerStyle, raycastMarkers } from './markerRendering';
import useReducedMotion from './useReducedMotion';
import { latLonAltToVec3 } from './SatelliteOrbit';
import { categoryOf, CATEGORIES, hasState } from '../objectSemantics';

function Batch({ objects, category, selected, comparison, forecast, onSelect, totalCount }) {
  const mesh = useRef();
  const { invalidate, camera, size } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const reduced = useReducedMotion();
  const positions = useMemo(() => new Float32Array(objects.length * 3), [objects]);
  const scales = useMemo(() => new Float32Array(objects.length), [objects]);
  const material = useMemo(() => createMarkerMaterial(CATEGORIES[category].color, Object.keys(CATEGORIES).indexOf(category)), [category]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  useFrame(({ clock }) => {
    const style = markerStyle(camera.position.length(), totalCount, size.width);
    material.uniforms.uRadius.value = style.radius;
    material.uniforms.uDetail.value = style.detail;
    material.uniforms.uTime.value = reduced ? 0 : clock.elapsedTime;
  });
  React.useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useLayoutEffect(() => {
    material.uniforms.uViewportHeight.value = size.height;
    mesh.current.raycast = (raycaster, hits) => raycastMarkers(mesh.current, positions, scales, camera, size.height,
      markerStyle(camera.position.length(), totalCount, size.width).radius, raycaster, hits);
  }, [camera, size.width, size.height, totalCount, positions, scales, material]);
  useLayoutEffect(() => {
    objects.forEach((sat, index) => {
      const active = sat.norad_id === selected?.norad_id;
      const participant = sat.norad_id === comparison?.norad_id;
      const state = active && hasState(forecast) ? forecast : sat;
      dummy.position.copy(latLonAltToVec3(state.lat, state.lon, state.alt_km));
      positions.set(dummy.position.toArray(), index * 3);
      scales[index] = active || participant ? 1.7 : 1;
      dummy.scale.setScalar(scales[index]);
      dummy.updateMatrix(); mesh.current.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere(); invalidate();
  }, [objects, selected, comparison, forecast, dummy, invalidate, positions, scales]);
  return <instancedMesh ref={mesh} args={[geometry, material, objects.length]} frustumCulled={false} onClick={e => {
    // Ignore clicks that finish a drag gesture.
    e.stopPropagation(); if (e.delta <= 4 && objects[e.instanceId]) onSelect(objects[e.instanceId]);
  }} />;
}
function Highlight({ object, forecast, primary, onVisibility }) {
  const ref = useRef();
  const { camera, size } = useThree();
  const state = hasState(forecast) ? forecast : object;
  const position = latLonAltToVec3(state.lat, state.lon, state.alt_km);
  const lastVisibility = useRef('');
  useFrame(() => {
    ref.current?.quaternion.copy(camera.quaternion);
    const depth = -position.clone().applyMatrix4(camera.matrixWorldInverse).z;
    ref.current?.scale.setScalar(Math.max(0.01, (primary ? 12 : 10) * 2 * depth / (size.height * camera.projectionMatrix.elements[5] * 0.033)));
    if (!onVisibility) return;
    const projected = position.clone().project(camera);
    const outside = Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || Math.abs(projected.z) > 1;
    // Segment/Earth-ellipsoid occlusion for this display only, never screening.
    const origin = camera.position.clone(); origin.y /= 0.99664719;
    const target = position.clone(); target.y /= 0.99664719;
    const direction = target.sub(origin);
    const t = Math.max(0, Math.min(1, -origin.dot(direction) / direction.lengthSq()));
    const hidden = origin.addScaledVector(direction, t).lengthSq() < 1;
    const status = outside ? 'out-of-view' : hidden ? 'behind-earth' : 'visible';
    if (status !== lastVisibility.current) { lastVisibility.current = status; onVisibility(status); }
  });
  return <group position={position}><mesh ref={ref}>
    <ringGeometry args={[0.031, 0.033, 48]} /><meshBasicMaterial color={primary ? '#c3f5ff' : '#b6acff'} side={THREE.DoubleSide} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
  </mesh>{primary && <Html center occlude distanceFactor={5} position={[0, 0.06, 0]} style={{ pointerEvents: 'none' }}><span className="globe-label">{object.name} · {object.norad_id}</span></Html>}</group>;
}
export default function SatelliteLayer({ satellites, selected, comparison, onSelect, forecast, onVisibility }) {
  const batches = useMemo(() => Object.keys(CATEGORIES).map(category => ({ category,
    objects: satellites.filter(s => hasState(s) && categoryOf(s) === category)
  })), [satellites]);
  return <group>{batches.filter(b => b.objects.length).map(b => <Batch key={b.category} {...b} totalCount={satellites.length} selected={selected} comparison={comparison} forecast={forecast} onSelect={onSelect} />)}
    {hasState(selected) && satellites.some(s => s.norad_id === selected.norad_id) && <Highlight object={selected} forecast={forecast} primary onVisibility={onVisibility} />}
    {hasState(comparison) && satellites.some(s => s.norad_id === comparison.norad_id) && <Highlight object={comparison} />}
  </group>;
}
