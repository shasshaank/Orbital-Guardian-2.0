import React, { useEffect, useState } from 'react';
import { Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Convert geodetic lat/lon/alt to Three.js Cartesian coordinates.
 */
function latLonAltToVec3(lat, lon, altKm) {
  const EARTH_RADIUS_KM = 6371;
  const GLOBE_RADIUS = 1;

  const r = GLOBE_RADIUS * (1 + altKm / EARTH_RADIUS_KM);

  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;

  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Individual satellite marker
 */
function SatelliteDot({ satellite, isHovered, role, onHover, onUnhover }) {

  const pos = latLonAltToVec3(
    satellite.lat,
    satellite.lon,
    satellite.alt_km
  );

  let color = '#00e5ff'; // default cyan
  let size = 0.013;
  let haloOpacity = 0.15;
  let haloScale = 2.2;

  if (role === 'asset') {
    color = '#ff9500'; // Orange
    size = 0.035;
    haloOpacity = 0.45;
    haloScale = 3.0;
  } else if (role === 'satA') {
    color = '#30b0c0'; // Cyan/Teal (matches path)
    size = 0.035;
    haloOpacity = 0.45;
    haloScale = 3.0;
  } else if (role === 'satB') {
    color = '#ff3b30'; // Red (matches path)
    size = 0.035;
    haloOpacity = 0.45;
    haloScale = 3.0;
  }

  if (isHovered) {
    color = '#ffeb3b'; // Yellow
    size = role ? 0.04 : 0.022;
    haloOpacity = 0.6;
  }

  return (
    <group position={pos}>

      {/* Main satellite sphere */}
      <Sphere
        args={[size, 10, 10]}
        onPointerEnter={(e) => {
          e.stopPropagation();
          onHover();
        }}
        onPointerLeave={() => onUnhover()}
      >
        <meshBasicMaterial color={color} />
      </Sphere>

      {/* Satellite glow halo */}
      <Sphere args={[size * haloScale, 16, 16]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={haloOpacity}
        />
      </Sphere>

      {/* Hover tooltip */}
      {isHovered && (
        <Html distanceFactor={8} style={{ pointerEvents: 'none' }}>

          <div
            style={{
              background: 'rgba(10,10,20,0.92)',
              border: `1px solid ${color}`,
              borderRadius: 6,
              padding: '6px 10px',
              color: '#e0f7fa',
              fontSize: 12,
              whiteSpace: 'nowrap',
              transform: 'translate(-50%, -140%)',
              backdropFilter: 'blur(6px)'
            }}
          >
            <strong style={{ color: color }}>
              {satellite.name}
            </strong>
            <br />
            Alt: {satellite.alt_km?.toFixed(0)} km
            <br />
            Lat: {satellite.lat?.toFixed(2)}° Lon: {satellite.lon?.toFixed(2)}°
          </div>
        </Html>
      )}

    </group>
  );
}

/**
 * SatelliteLayer — fetches satellites and renders them
 */
export default function SatelliteLayer({ 
  group = 'active', 
  limit = 50, 
  selectedAsset = null,
  selectedSatA = null,
  selectedSatB = null
}) {

  const [satellites, setSatellites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSatellites() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `${API_URL}/satellites?group=${group}&limit=${limit}`
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (!cancelled) {
          // data already contains lat, lon, alt_km from the backend optimization
          setSatellites(data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSatellites();
    return () => { cancelled = true; };
  }, [group, limit]);

  if (loading) return null;

  if (error) {
    console.warn("Satellite fetch error:", error);
  }

  const satList = Array.isArray(satellites)
    ? satellites.map(s => {
        let role = null;
        if (selectedAsset && s.name === selectedAsset.name) role = 'asset';
        else if (selectedSatA && s.name === selectedSatA.name) role = 'satA';
        else if (selectedSatB && s.name === selectedSatB.name) role = 'satB';
        return { ...s, role };
      })
    : [];

  const selecteds = [
    selectedAsset ? { ...selectedAsset, role: 'asset' } : null,
    selectedSatA ? { ...selectedSatA, role: 'satA' } : null,
    selectedSatB ? { ...selectedSatB, role: 'satB' } : null,
  ].filter(Boolean);

  selecteds.forEach(sel => {
    if (!satList.some(s => s.name === sel.name)) {
      satList.push(sel);
    }
  });

  return (
    <group>
      {satList.map((sat, i) => (
        <SatelliteDot
          key={`${sat.name}-${i}`}
          satellite={sat}
          isHovered={hoveredIndex === i}
          role={sat.role}
          onHover={() => setHoveredIndex(i)}
          onUnhover={() => setHoveredIndex(null)}
        />
      ))}
    </group>
  );
}