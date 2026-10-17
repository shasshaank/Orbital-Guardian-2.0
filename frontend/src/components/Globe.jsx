import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';

function Earth({ grid }) {
  const texture = useTexture('/images/earth-map.jpg');
  return <group>
    <mesh scale={[1, 0.99664719, 1]}><sphereGeometry args={[1, 64, 48]} /><meshPhongMaterial map={texture} color="#c1d4e2" shininess={5} /></mesh>
    <mesh scale={[1.015, 1.0116, 1.015]}><sphereGeometry args={[1, 48, 32]} /><meshBasicMaterial color="#8bbbd9" transparent opacity={0.09} side={THREE.BackSide} /></mesh>
    {grid && <mesh scale={[1.002, 0.9986, 1.002]}><sphereGeometry args={[1, 36, 18]} /><meshBasicMaterial wireframe color="#7895aa" transparent opacity={0.13} /></mesh>}
  </group>;
}
function Camera({ command }) {
  const controls = useRef();
  const { camera, invalidate } = useThree();
  useEffect(() => {
    if (command.action === 'reset') { camera.position.set(2.4, 1.1, 3.3); controls.current?.target.set(0, 0, 0); }
    if (command.action === 'in') camera.position.multiplyScalar(0.8);
    if (command.action === 'out') camera.position.multiplyScalar(1.25);
    controls.current?.update(); invalidate();
  }, [command, camera, invalidate]);
  return <OrbitControls ref={controls} enablePan={false} enableDamping={false} minDistance={1.3} maxDistance={16} />;
}
export class ViewBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="view-fallback"><h3>3D view unavailable</h3><p>Your browser could not initialize the orbital view. All objects and analyses remain available in the catalogue.</p></div> : this.props.children; }
}
export default function Globe({ children, grid, command }) {
  return <ViewBoundary><Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [2.4, 1.1, 3.3], fov: 42 }} gl={{ antialias: true, alpha: true }}>
    <ambientLight intensity={0.8} /><directionalLight position={[4, 3, 5]} intensity={2} color="#e3efff" />
    <Suspense fallback={<mesh><sphereGeometry args={[1, 32, 24]} /><meshBasicMaterial color="#172a3b" /></mesh>}><Earth grid={grid} /></Suspense>
    {children}<Camera command={command} />
  </Canvas></ViewBoundary>;
}
