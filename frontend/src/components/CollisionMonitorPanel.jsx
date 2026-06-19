import React, { useState } from 'react';
import { Satellite, Search } from 'lucide-react';

export default function CollisionMonitorPanel({ satellites, onCheckCollision, onSelectA, onSelectB }) {
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [satA, setSatA] = useState(null);
  const [satB, setSatB] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const [isFocusedA, setIsFocusedA] = useState(false);
  const [isFocusedB, setIsFocusedB] = useState(false);

  const filteredA = searchA 
    ? satellites.filter(s => s.name.toLowerCase().includes(searchA.toLowerCase())).slice(0, 10)
    : satellites.slice(0, 10);
    
  const filteredB = searchB 
    ? satellites.filter(s => s.name.toLowerCase().includes(searchB.toLowerCase())).slice(0, 10)
    : satellites.slice(0, 10);

  const handleCheck = async () => {
    if (!satA || !satB) return;
    setIsChecking(true);
    await onCheckCollision(satA, satB);
    setIsChecking(false);
  };

  return (
    <div className={`glass-panel p-6 relative ${(isFocusedA || isFocusedB) ? 'z-20' : 'z-10'}`}>
      <div className="flex items-center gap-2 mb-4">
        <Satellite className="w-5 h-5 text-cyan-400" strokeWidth={2} />
        <h3 className="text-lg font-semibold text-[#f5f5f7]">Collision Risk Monitor</h3>
      </div>

      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#a1a1a6]" />
          <input
            type="text"
            placeholder="Select Satellite A..."
            value={searchA}
            onChange={(e) => { setSearchA(e.target.value); setSatA(null); onSelectA?.(null); }}
            onFocus={() => setIsFocusedA(true)}
            onBlur={() => setTimeout(() => setIsFocusedA(false), 200)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-[#f5f5f7] placeholder-[#a1a1a6] focus:outline-none focus:border-cyan-400/50 transition-colors text-sm shadow-inner"
          />
          {isFocusedA && !satA && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1c1c1e] rounded-xl overflow-hidden border border-white/20 shadow-2xl">
              {filteredA.map(s => (
                <div 
                  key={s.name} 
                  onClick={() => { setSatA(s); setSearchA(s.name); setIsFocusedA(false); onSelectA?.(s); }}
                  className="px-4 py-3 cursor-pointer border-b border-white/5 hover:bg-[#2c2c2e] transition-colors text-sm text-[#f5f5f7] flex items-center gap-2"
                >
                  <Satellite className="w-4 h-4 text-cyan-400" />
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#a1a1a6]" />
          <input
            type="text"
            placeholder="Select Satellite B..."
            value={searchB}
            onChange={(e) => { setSearchB(e.target.value); setSatB(null); onSelectB?.(null); }}
            onFocus={() => setIsFocusedB(true)}
            onBlur={() => setTimeout(() => setIsFocusedB(false), 200)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-[#f5f5f7] placeholder-[#a1a1a6] focus:outline-none focus:border-cyan-400/50 transition-colors text-sm shadow-inner"
          />
          {isFocusedB && !satB && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1c1c1e] rounded-xl overflow-hidden border border-white/20 shadow-2xl">
              {filteredB.map(s => (
                <div 
                  key={s.name} 
                  onClick={() => { setSatB(s); setSearchB(s.name); setIsFocusedB(false); onSelectB?.(s); }}
                  className="px-4 py-3 cursor-pointer border-b border-white/5 hover:bg-[#2c2c2e] transition-colors text-sm text-[#f5f5f7] flex items-center gap-2"
                >
                  <Satellite className="w-4 h-4 text-cyan-400" />
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button 
        onClick={handleCheck}
        disabled={!satA || !satB || isChecking}
        className="w-full px-4 py-3 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-500 hover:to-emerald-500 text-black rounded-lg font-bold text-sm transition-all soft-shadow disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isChecking ? 'Computing Orbital Mechanics...' : 'Check Collision Risk'}
      </button>

    </div>
  );
}
