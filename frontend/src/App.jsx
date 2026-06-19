import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Globe from './components/Globe';
import SatelliteLayer from './components/SatelliteLayer';
import SatelliteOrbit from './components/SatelliteOrbit';
import AssetMonitor from './components/AssetMonitor';
import CollisionMonitorPanel from './components/CollisionMonitorPanel';
import ResultsDisplayPanel from './components/ResultsDisplayPanel';
import ManeuverPanel from './components/ManeuverPanel';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function App() {
  const [satellites, setSatellites] = useState([]);
  const [collisionData, setCollisionData] = useState(null);
  const [orbitPathA, setOrbitPathA] = useState(null);
  const [orbitPathB, setOrbitPathB] = useState(null);
  const [threatParams, setThreatParams] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedSatA, setSelectedSatA] = useState(null);
  const [selectedSatB, setSelectedSatB] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/satellites?limit=1000`)
      .then(res => res.json())
      .then(data => setSatellites(data))
      .catch(console.error);
  }, []);

  const handleCheckCollision = async (satA, satB) => {
    try {
      setCollisionData(null);
      setOrbitPathA(null);
      setOrbitPathB(null);
      setThreatParams(null);

      // Check collision
      const params = new URLSearchParams({
        line1_a: satA.line1, line2_a: satA.line2,
        line1_b: satB.line1, line2_b: satB.line2,
        hours: 24
      });
      const res = await fetch(`${API_URL}/collision-check?${params.toString()}`);
      if (!res.ok) throw new Error("Collision check failed");
      const data = await res.json();
      
      setCollisionData({
        risk: data.risk_level,
        distance: data.min_distance_km,
        isColliding: data.risk_level !== 'SAFE',
        closestEvent: data.closest_event
      });

      if (data.risk_level !== 'SAFE') {
        setThreatParams({
          line1: satA.line1,
          line2: satA.line2,
          threat_distance_km: data.min_distance_km
        });
      }

      // Fetch orbital paths for visualization
      const paramsA = new URLSearchParams({ line1: satA.line1, line2: satA.line2, hours: 4, step_minutes: 5 });
      const pathA = await fetch(`${API_URL}/propagate?${paramsA.toString()}`).then(r => r.json());
      setOrbitPathA(pathA);

      const paramsB = new URLSearchParams({ line1: satB.line1, line2: satB.line2, hours: 4, step_minutes: 5 });
      const pathB = await fetch(`${API_URL}/propagate?${paramsB.toString()}`).then(r => r.json());
      setOrbitPathB(pathB);

    } catch (err) {
      console.error(err);
      alert("Failed to check collision: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f7]">
      <Header />
      <main className="p-4 lg:p-6 h-[calc(100vh-88px)] overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          
          <div className="lg:col-span-2 flex flex-col h-full">
            <div className="glass-panel p-6 flex flex-col h-full">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[#f5f5f7]">Orbital Visualization</h2>
                <p className="text-xs text-[#a1a1a6] mt-1">Real-time debris trajectory simulation (3D)</p>
              </div>
              <div className="rounded-xl overflow-hidden border border-white/10 flex-grow relative bg-black">
                <Globe>
                  <SatelliteLayer 
                    group="active" 
                    limit={150} 
                    selectedAsset={selectedAsset}
                    selectedSatA={selectedSatA}
                    selectedSatB={selectedSatB}
                  />
                  {orbitPathA && <SatelliteOrbit path={orbitPathA} color="#30b0c0" />}
                  {orbitPathB && <SatelliteOrbit path={orbitPathB} color="#ff3b30" />}
                </Globe>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-[#a1a1a6] pointer-events-none">
                  <span>Drag to rotate • Scroll to zoom • Built with React Three Fiber</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar h-full pb-10">
            <AssetMonitor satellites={satellites} onSelect={setSelectedAsset} />
            <CollisionMonitorPanel 
              satellites={satellites} 
              onCheckCollision={handleCheckCollision} 
              onSelectA={setSelectedSatA}
              onSelectB={setSelectedSatB}
            />
            <ResultsDisplayPanel collisionData={collisionData} />
            <ManeuverPanel threatParams={threatParams} />
          </div>

        </div>
      </main>
    </div>
  );
}
