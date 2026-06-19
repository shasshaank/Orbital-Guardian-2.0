import React, { useState, useEffect } from 'react';
import { Rocket, Info, AlertTriangle, Crosshair, Navigation } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function ManeuverPanel({ threatParams }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Auto-fetch when threatParams change
  useEffect(() => {
    if (threatParams) {
      fetchRecommendation();
    }
  }, [threatParams]);

  const fetchRecommendation = async () => {
    if (!threatParams) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        line1: threatParams.line1,
        line2: threatParams.line2,
        threat_direction_x: threatParams.threat_direction_x || 1.0,
        threat_direction_y: threatParams.threat_direction_y || 0.0,
        threat_direction_z: threatParams.threat_direction_z || 0.0,
        threat_distance_km: threatParams.threat_distance_km || 10,
      });
      const res = await fetch(`${API_URL}/maneuver-recommend?${query}`);
      if (!res.ok) throw new Error(`Failed to compute maneuver: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const primary = result ? result.primary : null;

  return (
    <div className="glass-panel p-6 border-t-2 border-emerald-400/50">
      <div className="flex items-center gap-2 mb-4">
        <Rocket className="w-5 h-5 text-emerald-400" strokeWidth={2} />
        <h3 className="text-lg font-semibold text-[#f5f5f7]">Maneuver Advisor</h3>
      </div>

      {!threatParams ? (
        <div className="text-center py-6 opacity-60">
          <p className="text-xs text-[#a1a1a6]">
            Run a collision check on two satellites first to enable the maneuver advisor.
          </p>
        </div>
      ) : loading ? (
        <div className="text-center py-6">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full mb-2"></div>
          <p className="text-xs text-emerald-400">Computing optimal avoidance trajectory...</p>
        </div>
      ) : error ? (
        <div className="p-3 mb-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-xs flex gap-2 items-center">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : primary ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-400/10 border border-emerald-400/20 rounded-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-[#f5f5f7] tracking-wider uppercase">{primary.maneuver_type}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                RECOMMENDED
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/5">
                <p className="text-[10px] text-[#a1a1a6] mb-1">Delta-v Required</p>
                <p className="text-lg font-semibold text-[#f5f5f7]">{primary.delta_v_m_s} <span className="text-xs text-[#a1a1a6]">m/s</span></p>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/5">
                <p className="text-[10px] text-[#a1a1a6] mb-1">New Miss Dist.</p>
                <p className="text-lg font-semibold text-[#f5f5f7]">{primary.new_miss_distance_km} <span className="text-xs text-[#a1a1a6]">km</span></p>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/5">
                <p className="text-[10px] text-[#a1a1a6] mb-1">Fuel Cost (Est)</p>
                <p className="text-lg font-semibold text-[#f5f5f7]">{primary.estimated_fuel_cost_percent}%</p>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-3 border border-white/5">
                <p className="text-[10px] text-[#a1a1a6] mb-1">Confidence</p>
                <p className="text-lg font-semibold text-[#f5f5f7]">{(primary.confidence_score * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-emerald-400/20">
              <div className="flex items-center gap-2 mb-2">
                <Crosshair className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-[#a1a1a6]">Burn Vector</span>
              </div>
              <p className="text-sm font-medium text-[#f5f5f7] bg-[#1a1a1a] p-2 rounded border border-white/5 text-center">
                {Math.abs(primary.burn_direction.z) > 0.8 ? 'Radial Outward' : 'Cross-track (+Normal)'}
              </p>
            </div>
          </div>

          <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-start gap-3">
            <Info className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-[#a1a1a6] leading-relaxed">
              {primary.explanation} Execute by {primary.time_to_execute}.
            </p>
          </div>
          
          <button 
            onClick={fetchRecommendation}
            className="w-full mt-2 px-4 py-2.5 glass-button text-emerald-300 rounded-lg font-medium text-sm flex items-center justify-center gap-2 border-emerald-400/30 hover:bg-emerald-400/10"
          >
            <Navigation className="w-4 h-4" />
            Recalculate Maneuver
          </button>
        </div>
      ) : null}
    </div>
  );
}
