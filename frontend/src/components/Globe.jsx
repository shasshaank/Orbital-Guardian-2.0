import React, { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import Earth from './Earth';
import useReducedMotion from './useReducedMotion';
function Camera({ command }) {
  const controls = useRef();
  const reduced = useReducedMotion();
  const { camera, invalidate } = useThree();
  useEffect(() => {
    if (command.action === 'reset') { camera.position.set(2.4, 1.1, 3.3); controls.current?.target.set(0, 0, 0); }
    if (command.action === 'in') camera.position.multiplyScalar(0.8);
    if (command.action === 'out') camera.position.multiplyScalar(1.25);
    controls.current?.update(); invalidate();
  }, [command, camera, invalidate]);
  return <OrbitControls ref={controls} enablePan={false} enableDamping={!reduced} dampingFactor={0.09} minDistance={1.3} maxDistance={16} />;
}
export class ViewBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="view-fallback" role="alert"><h3>3D view unavailable</h3><p>Your browser could not initialize the orbital view. All objects and analyses remain available in the catalogue.</p></div> : this.props.children; }
}
export default function Globe({ children, grid, command }) {
  const [contextLost, setContextLost] = React.useState(false);
  const [textureFailed, setTextureFailed] = React.useState(false);
  if (contextLost) return <div className="view-fallback" role="alert"><h3>3D view unavailable</h3><p>The graphics context was lost. Catalogue and analyses remain available. Reload to retry the view.</p></div>;
  return <ViewBoundary><Canvas onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true), { once: true })} frameloop="demand" dpr={[1, 1.5]} camera={{ position: [2.4, 1.1, 3.3], fov: 42 }} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}>
    <ambientLight intensity={0.24} /><directionalLight position={[4, 2, 5]} intensity={2.2} color="#fff4e8" />
    <Earth grid={grid} onTextureError={() => setTextureFailed(true)} />
    {children}<Camera command={command} />
  </Canvas>{textureFailed && <div className="earth-texture-status" role="status">Earth imagery unavailable · simplified view</div>}</ViewBoundary>;
}
