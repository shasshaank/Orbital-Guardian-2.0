import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createEarthTexture } from './earthTexture';
import useReducedMotion from './useReducedMotion';

const noPick = () => null;
const sun = new THREE.Vector3(4, 2, 5).normalize();
const atmosphereVertex = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorldNormal;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vView = -view.xyz;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * view;
  }`;
const atmosphereFragment = `
  uniform vec3 uSun;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorldNormal;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.8);
    float day = smoothstep(-0.35, 0.7, dot(normalize(vWorldNormal), uSun));
    vec3 scatter = mix(vec3(0.12, 0.19, 0.65), vec3(0.18, 0.57, 1.0), day);
    gl_FragColor = vec4(scatter, rim * mix(0.19, 0.62, day));
    #include <colorspace_fragment>
  }`;

function Atmosphere() {
  const uniforms = useMemo(() => ({ uSun: { value: sun } }), []);
  return <mesh scale={[1.035, 1.0315, 1.035]} raycast={noPick}>
    <sphereGeometry args={[1, 96, 64]} />
    <shaderMaterial vertexShader={atmosphereVertex} fragmentShader={atmosphereFragment} uniforms={uniforms}
      side={THREE.BackSide} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
  </mesh>;
}

function FallbackEarth() {
  const texture = useMemo(createEarthTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh scale={[1, 0.99664719, 1]} onClick={event => event.stopPropagation()}>
    <sphereGeometry args={[1, 64, 48]} /><meshPhongMaterial map={texture} shininess={25} />
  </mesh>;
}

function TexturedEarth() {
  const { gl, size, invalidate } = useThree();
  const clouds = useRef();
  const reduced = useReducedMotion();
  // Load only the chosen albedo. A small viewport does not need a 4K GPU map.
  const [highResolution] = React.useState(() => size.width >= 700 && gl.capabilities.maxTextureSize >= 4096);
  const maps = useLoader(THREE.TextureLoader, [
    `/textures/earth/day-${highResolution ? '4k' : '2k'}.jpg`,
    '/textures/earth/normal-2k.png', '/textures/earth/specular-2k.png', '/textures/earth/clouds-2k.jpg'
  ]);
  useMemo(() => {
    maps.forEach((texture, i) => {
      texture.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
    });
  }, [maps, gl]);
  // A low-rate visual clock preserves demand rendering during idle/reduced motion.
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => { if (!document.hidden) invalidate(); }, 1000 / 24);
    return () => clearInterval(timer);
  }, [reduced, invalidate]);
  useFrame((_, delta) => {
    if (clouds.current && !reduced && !document.hidden) clouds.current.rotation.y += Math.min(delta, 0.1) * 0.003;
  });
  return <>
    <mesh scale={[1, 0.99664719, 1]} onClick={event => event.stopPropagation()}>
      <sphereGeometry args={[1, 128, 96]} />
      <meshPhongMaterial map={maps[0]} normalMap={maps[1]} normalScale={new THREE.Vector2(0.4, 0.4)}
        specularMap={maps[2]} specular="#364354" shininess={64} />
    </mesh>
    <mesh ref={clouds} scale={[1.006, 1.0026, 1.006]} raycast={noPick}>
      <sphereGeometry args={[1, 96, 64]} />
      <meshPhongMaterial alphaMap={maps[3]} color="#e9f3ff" transparent opacity={0.52} depthWrite={false} shininess={5} />
    </mesh>
  </>;
}

class TextureBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? <FallbackEarth /> : this.props.children; }
}

export default function Earth({ grid, onTextureError }) {
  return <group>
    <TextureBoundary onError={onTextureError}><Suspense fallback={<FallbackEarth />}><TexturedEarth /></Suspense></TextureBoundary>
    <Atmosphere />
    {grid && <mesh scale={[1.008, 1.0046, 1.008]} raycast={noPick}><sphereGeometry args={[1, 36, 18]} /><meshBasicMaterial wireframe color="#7bb9ec" transparent opacity={0.075} depthWrite={false} /></mesh>}
  </group>;
}
