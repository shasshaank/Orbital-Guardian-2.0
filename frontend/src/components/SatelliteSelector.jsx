import React, { useState } from "react";

export default function SatelliteSelector({
  satellites,
  satA,
  satB,
  setSatA,
  setSatB
}) {
  const [filterA, setFilterA] = useState("");
  const [filterB, setFilterB] = useState("");

  const filteredA = satellites.filter(s => 
    s.name.toLowerCase().includes(filterA.toLowerCase())
  ).slice(0, 200);

  const filteredB = satellites.filter(s => 
    s.name.toLowerCase().includes(filterB.toLowerCase())
  ).slice(0, 200);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
      
      {/* Selector A */}
      <div className="searchable-select">
        <input 
          type="text" 
          placeholder="Filter Satellite A..." 
          value={filterA} 
          onChange={(e) => setFilterA(e.target.value)}
          className="search-input-small"
        />
        <select
          value={satA || ""}
          onChange={(e) => setSatA(e.target.value)}
        >
          <option value="">-- Select Satellite A --</option>
          {filteredA.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Selector B */}
      <div className="searchable-select">
        <input 
          type="text" 
          placeholder="Filter Satellite B..." 
          value={filterB} 
          onChange={(e) => setFilterB(e.target.value)}
          className="search-input-small"
        />
        <select
          value={satB || ""}
          onChange={(e) => setSatB(e.target.value)}
        >
          <option value="">-- Select Satellite B --</option>
          {filteredB.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

    </div>
  );
}