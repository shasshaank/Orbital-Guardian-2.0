import React, { useState } from 'react';
import { Shield, Search, Satellite } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function AssetMonitor({ satellites, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSat, setSelectedSat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const [isFocused, setIsFocused] = useState(false);

  const displaySats = Array.isArray(satellites)
    ? (searchTerm 
        ? satellites.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10)
        : satellites.slice(0, 10))
    : [];

  async function handleScan(sat) {
    const catnr = parseInt(sat.line1.substring(2, 7).trim(), 10);
    setLoading(true);
    setError(null);
    setSelectedSat(sat);
    onSelect?.(sat);
    setSearchTerm(sat.name);
    setIsFocused(false);
    try {
      const params = new URLSearchParams({ catnr, hours: 24 });
      const res = await fetch(`${API_URL}/asset-scan?${params.toString()}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError(err.message || "Network Error: Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`glass-panel p-6 relative ${isFocused ? 'z-20' : 'z-10'}`}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-cyan-400" strokeWidth={2} />
        <h3 className="text-lg font-semibold text-[#f5f5f7]">Strategic Asset Monitor</h3>
      </div>
      <p className="text-xs text-[#a1a1a6] mb-4">
        Monitor a specific satellite against the entire orbital fleet.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#a1a1a6]" />
        <input 
          type="text" 
          placeholder="Search satellite name (e.g. Starlink)..." 
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setSelectedSat(null); onSelect?.(null); }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-[#f5f5f7] placeholder-[#a1a1a6] focus:outline-none focus:border-cyan-400/50 transition-colors text-sm shadow-inner"
        />
        
        {isFocused && !selectedSat && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1c1c1e] rounded-xl overflow-hidden border border-white/20 shadow-2xl">
            {displaySats.map(s => (
              <div 
                key={s.name} 
                onClick={() => handleScan(s)}
                className="px-4 py-3 cursor-pointer border-b border-white/5 hover:bg-[#2c2c2e] transition-colors text-sm text-[#f5f5f7] flex items-center gap-2"
              >
                <Satellite className="w-4 h-4 text-cyan-400" />
                {s.name}
              </div>
            ))}
            {displaySats.length === 0 && (
              <div className="px-4 py-3 text-xs text-[#a1a1a6]">
                No satellites found.
              </div>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-6">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full mb-2"></div>
          <p className="text-xs text-cyan-400">Propagating orbits and scanning 1000+ candidates...</p>
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-xs">
          <strong>Scan Failed:</strong> {error}
        </div>
      )}

      {results && !loading && (
        <div className="mt-4">
          <div className="p-3 bg-cyan-400/10 border border-cyan-400/20 rounded-xl mb-4">
            <div className="text-[10px] uppercase text-cyan-400 mb-1 font-semibold tracking-wider">Target Asset</div>
            <div className="font-bold text-[#f5f5f7] text-lg">{results.asset}</div>
            <div className="flex justify-between mt-2 text-xs text-[#a1a1a6]">
              <span>Candidates: {results.scan_count}</span>
              <span>Threats: {results.risks.length}</span>
            </div>
          </div>

          <div className="max-h-[200px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {results.risks.length === 0 ? (
              <div className="text-center p-4 bg-emerald-400/10 rounded-xl border border-emerald-400/20">
                <span className="text-2xl mb-2 block">✅</span>
                <p className="text-emerald-400 text-xs font-medium">No immediate conjunction threats detected.</p>
              </div>
            ) : (
              results.risks.map((risk, i) => (
                <div key={i} className={`p-3 rounded-xl border bg-white/5 ${risk.risk_level === 'CRITICAL' ? 'border-red-400/50' : 'border-amber-400/50'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm text-[#f5f5f7]">{risk.target_name}</span>
                    <span className={`font-bold text-sm ${risk.risk_level === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`}>
                      {risk.min_distance_km} km
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#a1a1a6]">
                    <span>ETA: {new Date(risk.closest_event.time).toLocaleTimeString()}</span>
                    <span className={`px-1.5 py-0.5 rounded font-medium ${risk.risk_level === 'CRITICAL' ? 'bg-red-400/20 text-red-300' : 'bg-amber-400/20 text-amber-300'}`}>
                      {risk.risk_level}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {!results && !loading && (
        <div className="text-center py-4 opacity-60">
           <p className="text-xs text-[#a1a1a6]">
            Search for a satellite above to start a collision sweep.
          </p>
        </div>
      )}
    </div>
  );
}

