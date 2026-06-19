import React from 'react';
import { Satellite } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-white/10 backdrop-blur-xl bg-white/5">
      <div className="px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center">
            <Satellite className="w-6 h-6 text-black" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#f5f5f7] tracking-tight">
              Orbital Guardian
            </h1>
            <p className="text-sm text-[#a1a1a6] mt-0.5">
              Physics-Driven Space Debris Collision Prediction & Avoidance System
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
