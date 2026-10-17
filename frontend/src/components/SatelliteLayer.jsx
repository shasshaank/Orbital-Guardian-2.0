import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLonAltToVec3 } from './SatelliteOrbit';

// One instanced draw call, shared catalogue, no network work in the renderer.
export default function SatelliteLayer({ satellites, selected, comparison, onSelect, forecast }) {
  const mesh = useRef();
  const { invalidate } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    satellites.forEach((sat, index) => {
      const active = sat.norad_id === selected?.norad_id;
      const secondary = sat.norad_id === comparison?.norad_id;
      const state = active && forecast ? forecast : sat;
      dummy.position.copy(latLonAltToVec3(state.lat, state.lon, state.alt_km));
      dummy.scale.setScalar(active || secondary ? 0.018 : 0.007);
      dummy.updateMatrix(); mesh.current.setMatrixAt(index, dummy.matrix);
      mesh.current.setColorAt(index, new THREE.Color(active ? '#f0c582' : secondary ? '#a8b8ff' : '#8aafc5'));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere(); invalidate();
  }, [satellites, selected, comparison, forecast, dummy, invalidate]);
  return <instancedMesh ref={mesh} args={[null, null, satellites.length]} onClick={event => { event.stopPropagation(); onSelect(satellites[event.instanceId]); }}>
    <sphereGeometry args={[1, 6, 6]} /><meshBasicMaterial />
  </instancedMesh>;
}
