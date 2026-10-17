import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

export function latLonAltToVec3(lat, lon, altKm) {
  const a = 6378.137, e2 = 0.00669437999014;
  const phi = lat * Math.PI / 180, lambda = lon * Math.PI / 180;
  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return new THREE.Vector3(
    (n + altKm) * Math.cos(phi) * Math.cos(lambda) / a,
    (n * (1 - e2) + altKm) * Math.sin(phi) / a,
    -(n + altKm) * Math.cos(phi) * Math.sin(lambda) / a
  );
}

export default function SatelliteOrbit({ path, color = "#4fc3f7" }) {
  const geometry = useMemo(() => {
    if (!path || !path.length) return new THREE.BufferGeometry();
    const points = path.map(
      p => latLonAltToVec3(p.lat, p.lon, p.alt_km)
    );
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [path]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} opacity={0.6} transparent />
    </line>
  );
}

export function CollisionMarker({ event, satA, satB }) {
  const [hoverA, setHoverA] = React.useState(false);
  const [hoverB, setHoverB] = React.useState(false);

  const posA = useMemo(() => latLonAltToVec3(event.location_a.lat, event.location_a.lon, event.location_a.alt_km), [event]);
  const posB = useMemo(() => latLonAltToVec3(event.location_b.lat, event.location_b.lon, event.location_b.alt_km), [event]);
  
  const lineGeom = useMemo(() => new THREE.BufferGeometry().setFromPoints([posA, posB]), [posA, posB]);

  return (
    <group>
      <mesh 
        position={posA}
        onPointerEnter={(e) => { e.stopPropagation(); setHoverA(true); }}
        onPointerLeave={(e) => { e.stopPropagation(); setHoverA(false); }}
      >
        <sphereGeometry args={[hoverA ? 0.03 : 0.02, 16, 16]} />
        <meshBasicMaterial color="#ff3366" />
        {hoverA && satA && (
          <Html distanceFactor={8} style={{ pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(10,10,20,0.92)', border: '1px solid #ff3366', borderRadius: 6, padding: '6px 10px', color: '#e0f7fa', fontSize: 12, whiteSpace: 'nowrap', transform: 'translate(-50%, -140%)', backdropFilter: 'blur(6px)' }}>
              <strong style={{ color: '#ff3366' }}>{satA.name}</strong><br/>
              Alt: {event.location_a.alt_km?.toFixed(0)} km<br/>
              Lat: {event.location_a.lat?.toFixed(2)}° Lon: {event.location_a.lon?.toFixed(2)}°
            </div>
          </Html>
        )}
      </mesh>
      <mesh 
        position={posB}
        onPointerEnter={(e) => { e.stopPropagation(); setHoverB(true); }}
        onPointerLeave={(e) => { e.stopPropagation(); setHoverB(false); }}
      >
        <sphereGeometry args={[hoverB ? 0.03 : 0.02, 16, 16]} />
        <meshBasicMaterial color="#ff9800" />
        {hoverB && satB && (
          <Html distanceFactor={8} style={{ pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(10,10,20,0.92)', border: '1px solid #ff9800', borderRadius: 6, padding: '6px 10px', color: '#e0f7fa', fontSize: 12, whiteSpace: 'nowrap', transform: 'translate(-50%, -140%)', backdropFilter: 'blur(6px)' }}>
              <strong style={{ color: '#ff9800' }}>{satB.name}</strong><br/>
              Alt: {event.location_b.alt_km?.toFixed(0)} km<br/>
              Lat: {event.location_b.lat?.toFixed(2)}° Lon: {event.location_b.lon?.toFixed(2)}°
            </div>
          </Html>
        )}
      </mesh>
      <line geometry={lineGeom}>
        <lineBasicMaterial color="#ff3366" transparent opacity={0.8} />
      </line>
    </group>
  );
}