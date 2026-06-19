import React, { useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

export default function ResultsDisplayPanel({ collisionData }) {
  const [showTelemetry, setShowTelemetry] = useState(false);

  if (!collisionData) return null;

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'SAFE':
        return { bg: 'bg-emerald-400/20', border: 'border-emerald-400/50', text: 'text-emerald-300' };
      case 'WARNING':
        return { bg: 'bg-amber-400/20', border: 'border-amber-400/50', text: 'text-amber-300' };
      case 'CRITICAL':
        return { bg: 'bg-red-400/20', border: 'border-red-400/50', text: 'text-red-300' };
      default:
        return { bg: 'bg-cyan-400/20', border: 'border-cyan-400/50', text: 'text-cyan-300' };
    }
  };

  const colors = getRiskColor(collisionData.risk);

  return (
    <div className={`glass-panel p-6 border-t-2 ${colors.border}`}>
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-cyan-400" strokeWidth={2} />
        <h3 className="text-lg font-semibold text-[#f5f5f7]">Prediction Results</h3>
      </div>

      <div className={`${colors.bg} border ${colors.border} rounded-xl p-4 mb-6`}>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${colors.text}`}>{collisionData.risk}</span>
          <span className={`text-xs ${colors.text} opacity-75`}>Risk Level</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-[#a1a1a6] mb-2">Closest Approach Distance</p>
          <p className="text-2xl font-semibold text-[#f5f5f7]">
            {collisionData.distance.toFixed(2)} <span className="text-sm text-[#a1a1a6]">km</span>
          </p>
          <p className="text-xs text-[#a1a1a6] mt-1">Est. closest approach distance</p>
        </div>

        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-[#a1a1a6] mb-2">Collision Status</p>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                collisionData.isColliding ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'
              }`}
            ></span>
            <span className="text-sm text-[#f5f5f7] font-medium">
              {collisionData.isColliding ? 'Collision Alert Active' : 'No threat detected.'}
            </span>
          </div>
        </div>
      </div>

      <button 
        onClick={() => setShowTelemetry(!showTelemetry)}
        className="w-full mt-6 px-4 py-3 glass-button text-[#f5f5f7] rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/15 transition-colors"
      >
        {showTelemetry ? 'Hide Telemetry Data' : 'View Telemetry Data'}
        {showTelemetry ? (
          <ChevronUp className="w-4 h-4 text-cyan-400" strokeWidth={2} />
        ) : (
          <ChevronDown className="w-4 h-4 text-cyan-400" strokeWidth={2} />
        )}
      </button>

      {showTelemetry && (
        <div className="mt-4 p-4 rounded-xl bg-black/40 border border-white/5 space-y-3 overflow-hidden transition-all duration-300">
          <div className="border-b border-white/10 pb-2">
            <span className="text-[10px] uppercase text-cyan-400 font-semibold tracking-wider block mb-1">Conjunction Event Time</span>
            <span className="text-xs font-mono text-[#f5f5f7]">
              {collisionData.closestEvent ? new Date(collisionData.closestEvent.time).toUTCString() : 'N/A'}
            </span>
          </div>

          {collisionData.closestEvent ? (
            <div className="space-y-4">
              {/* Satellite A Telemetry */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-cyan-400 font-semibold tracking-wider block">Satellite A Position</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white/5 p-2 rounded-lg text-center border border-white/5">
                    <div className="text-[9px] text-[#a1a1a6] mb-0.5">X (km)</div>
                    <div className="font-mono text-[#f5f5f7]">{collisionData.closestEvent.position_a.x.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg text-center border border-white/5">
                    <div className="text-[9px] text-[#a1a1a6] mb-0.5">Y (km)</div>
                    <div className="font-mono text-[#f5f5f7]">{collisionData.closestEvent.position_a.y.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg text-center border border-white/5">
                    <div className="text-[9px] text-[#a1a1a6] mb-0.5">Z (km)</div>
                    <div className="font-mono text-[#f5f5f7]">{collisionData.closestEvent.position_a.z.toFixed(2)}</div>
                  </div>
                </div>
                {collisionData.closestEvent.location_a && (
                  <div className="flex justify-between text-[10px] text-[#a1a1a6] bg-white/5 px-2 py-1.5 rounded-lg border border-white/5">
                    <span>Lat: {collisionData.closestEvent.location_a.lat.toFixed(2)}°</span>
                    <span>Lon: {collisionData.closestEvent.location_a.lon.toFixed(2)}°</span>
                    <span>Alt: {collisionData.closestEvent.location_a.alt_km.toFixed(0)} km</span>
                  </div>
                )}
              </div>

              {/* Satellite B Telemetry */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-emerald-400 font-semibold tracking-wider block">Satellite B Position</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white/5 p-2 rounded-lg text-center border border-white/5">
                    <div className="text-[9px] text-[#a1a1a6] mb-0.5">X (km)</div>
                    <div className="font-mono text-[#f5f5f7]">{collisionData.closestEvent.position_b.x.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg text-center border border-white/5">
                    <div className="text-[9px] text-[#a1a1a6] mb-0.5">Y (km)</div>
                    <div className="font-mono text-[#f5f5f7]">{collisionData.closestEvent.position_b.y.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg text-center border border-white/5">
                    <div className="text-[9px] text-[#a1a1a6] mb-0.5">Z (km)</div>
                    <div className="font-mono text-[#f5f5f7]">{collisionData.closestEvent.position_b.z.toFixed(2)}</div>
                  </div>
                </div>
                {collisionData.closestEvent.location_b && (
                  <div className="flex justify-between text-[10px] text-[#a1a1a6] bg-white/5 px-2 py-1.5 rounded-lg border border-white/5">
                    <span>Lat: {collisionData.closestEvent.location_b.lat.toFixed(2)}°</span>
                    <span>Lon: {collisionData.closestEvent.location_b.lon.toFixed(2)}°</span>
                    <span>Alt: {collisionData.closestEvent.location_b.alt_km.toFixed(0)} km</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#a1a1a6] italic text-center py-2">Detailed trajectory data not available.</p>
          )}
        </div>
      )}

      <p className="text-xs text-[#a1a1a6] mt-4 text-center">
        * Note: Based on real-time SGP4 propagation
      </p>
    </div>
  );
}
