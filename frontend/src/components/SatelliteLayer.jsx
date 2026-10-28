import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { glyphGeometry } from './glyphGeometry';
import { latLonAltToVec3 } from './SatelliteOrbit';
import { categoryOf, CATEGORIES, hasState } from '../objectSemantics';

function Batch({ objects, category, selected, comparison, forecast, onSelect }) {
  const mesh = useRef();
  const { invalidate } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [detailed, setDetailed] = React.useState(true);
  useFrame(({ camera }) => {
    const next = camera.position.length() < 6 && objects.length <= 2000;
    if (next !== detailed) setDetailed(next);
  });
  const geometry = useMemo(() => detailed ? glyphGeometry(category) : new THREE.TetrahedronGeometry(0.7), [category, detailed]);
  React.useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    objects.forEach((sat, index) => {
      const active = sat.norad_id === selected?.norad_id;
      const participant = sat.norad_id === comparison?.norad_id;
      const state = active && hasState(forecast) ? forecast : sat;
      dummy.position.copy(latLonAltToVec3(state.lat, state.lon, state.alt_km));
      dummy.scale.setScalar(active || participant ? 0.023 : 0.012);
      dummy.updateMatrix(); mesh.current.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere(); invalidate();
  }, [objects, selected, comparison, forecast, dummy, invalidate, geometry]);
  return <instancedMesh ref={mesh} args={[geometry, null, objects.length]} onClick={e => {
    // Ignore clicks that finish a drag gesture.
    e.stopPropagation(); if (e.delta <= 4 && objects[e.instanceId]) onSelect(objects[e.instanceId]);
  }}><meshBasicMaterial color={CATEGORIES[category].color} /></instancedMesh>;
}
function Highlight({ object, forecast, primary, onVisibility }) {
  const ref = useRef();
  const { camera } = useThree();
  const state = hasState(forecast) ? forecast : object;
  const position = latLonAltToVec3(state.lat, state.lon, state.alt_km);
  const lastVisibility = useRef('');
  useFrame(() => {
    ref.current?.quaternion.copy(camera.quaternion);
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
    <ringGeometry args={[0.031, 0.035, 32]} /><meshBasicMaterial color={primary ? '#fff0c4' : '#b6acff'} side={THREE.DoubleSide} />
  </mesh>{primary && <Html center occlude distanceFactor={5} position={[0, 0.06, 0]} style={{ pointerEvents: 'none' }}><span className="globe-label">{object.name} · {object.norad_id}</span></Html>}</group>;
}
export default function SatelliteLayer({ satellites, selected, comparison, onSelect, forecast, onVisibility }) {
  const batches = useMemo(() => Object.keys(CATEGORIES).map(category => ({ category,
    objects: satellites.filter(s => hasState(s) && categoryOf(s) === category)
  })), [satellites]);
  return <group>{batches.filter(b => b.objects.length).map(b => <Batch key={b.category} {...b} selected={selected} comparison={comparison} forecast={forecast} onSelect={onSelect} />)}
    {hasState(selected) && satellites.some(s => s.norad_id === selected.norad_id) && <Highlight object={selected} forecast={forecast} primary onVisibility={onVisibility} />}
    {hasState(comparison) && satellites.some(s => s.norad_id === comparison.norad_id) && <Highlight object={comparison} />}
  </group>;
}
