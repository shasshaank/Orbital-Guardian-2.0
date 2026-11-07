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
// Keep listeners paired with a live canvas, never with a stale onCreated closure.
export function bindContextEvents(canvas, lost, restored) {
  const onLost = event => { event.preventDefault(); lost(); };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', restored);
  return () => {
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', restored);
  };
}
export class ViewBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="view-fallback" role="alert"><h3>3D renderer unavailable</h3>
      <p>The renderer could not initialize or render the scene. This is separate from API connectivity. Catalogue data and analysis status are shown in the workspace.</p>
      <button disabled={this.props.exhausted} onClick={this.props.onRetry}>Retry 3D view</button>
      {this.props.exhausted && <p>Three retries used. Close other graphics tabs or check browser WebGL support before reloading.</p>}
    </div> : this.props.children;
  }
}
export default function Globe({ children, grid, command, active = true }) {
  const [renderer, setRenderer] = React.useState(null);
  const [contextState, setContextState] = React.useState('ready');
  const [generation, setGeneration] = React.useState(0);
  const [textureFailed, setTextureFailed] = React.useState(false);
  const created = React.useCallback(({ gl, invalidate }) => setRenderer({ canvas: gl.domElement, invalidate }), []);
  useEffect(() => {
    if (!renderer) return;
    return bindContextEvents(renderer.canvas, () => setContextState('lost'), () => {
      setContextState('ready'); renderer.invalidate();
    });
  }, [renderer]);
  useEffect(() => {
    if (contextState !== 'lost') return;
    const timeout = setTimeout(() => setContextState('waiting'), 8000);
    return () => clearTimeout(timeout);
  }, [contextState]);
  const retry = () => {
    if (generation >= 3) return;
    setRenderer(null); setContextState('ready'); setTextureFailed(false); setGeneration(n => n + 1);
  };
  const lost = contextState !== 'ready';
  return <ViewBoundary key={generation} onRetry={retry} exhausted={generation >= 3}>
    <Canvas onCreated={created} style={{ visibility: lost ? 'hidden' : 'visible' }} frameloop={lost || !active ? 'never' : 'demand'} dpr={[1, 1.25]} camera={{ position: [2.4, 1.1, 3.3], fov: 42 }} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <ambientLight intensity={0.24} /><directionalLight position={[4, 2, 5]} intensity={2.2} color="#fff4e8" />
      <Earth active={active && !lost} grid={grid} onTextureError={() => setTextureFailed(true)} />
      {children}<Camera command={command} />
    </Canvas>
    {lost && <div className="view-fallback graphics-recovery" role="alert"><h3>Graphics context lost</h3>
      <p>The browser reported a WebGL context loss. {contextState === 'lost' ? 'Waiting up to 8 seconds for restoration.' : 'Automatic restoration has not completed.'} Earth and objects will return when it restores, or you can retry the renderer.</p>
      <p>Catalogue and analysis availability are independent; check their API status.</p>
      <button disabled={generation >= 3} onClick={retry}>Retry 3D view</button>
      {generation >= 3 && <p>Three retries used. Close other graphics tabs or check WebGL support before reloading.</p>}
    </div>}
    {textureFailed && !lost && <div className="earth-texture-status" role="status">Earth imagery unavailable · simplified view</div>}
  </ViewBoundary>;
}
