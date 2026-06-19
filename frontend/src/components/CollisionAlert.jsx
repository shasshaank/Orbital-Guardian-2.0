import React, { useState, useEffect } from 'react';
import SatelliteSelector from "./SatelliteSelector";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/** Risk-level → accent colour mapping */
const RISK_COLORS = {
  CRITICAL: '#f44336',
  WARNING: '#ff9800',
  SAFE: '#4caf50',
};

export default function CollisionAlert({ 
  satellites = [],
  satA,
  satB,
  setSatA,
  setSatB,
  selectedSatA,
  selectedSatB,
  alertData, 
  onDataChange,
  pipelineStage,
  setPipelineStage 
}) {

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(alertData || null);

  const runCollisionCheck = React.useCallback(async () => {
    if (!selectedSatA || !selectedSatB) {
      setError("Please select both satellites first.");
      return;
    }
    setLoading(true);
    setError(null);

    try {

      const params = new URLSearchParams({
        line1_a: selectedSatA.line1,
        line2_a: selectedSatA.line2,
        line1_b: selectedSatB.line1,
        line2_b: selectedSatB.line2,
        hours: '24',
      });

      const res = await fetch(`${API_URL}/collision-check?${params}`);

      if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);

      const data = await res.json();

      setResult(data);
      if (onDataChange) onDataChange(data);

      if (pipelineStage === 'propagating') {
        // If there's a risk, auto-continue to maneuver, else just complete
        if (data.risk_level === 'SAFE') {
          setPipelineStage('complete');
        } else {
          setTimeout(() => setPipelineStage('computing_maneuver'), 100);
        }
      }

    } catch (err) {
      setError(err.message);
      if (pipelineStage === 'propagating') setPipelineStage('idle');
    } finally {
      setLoading(false);
    }
  }, [selectedSatA, selectedSatB, pipelineStage, onDataChange, setPipelineStage]);

  useEffect(() => {
    // Auto-run if triggered by App.jsx pipeline
    if (pipelineStage === 'propagating' && selectedSatA && selectedSatB) {
      runCollisionCheck();
    }
  }, [pipelineStage, selectedSatA, selectedSatB, runCollisionCheck]);

  const riskColor = result
    ? (RISK_COLORS[result.risk_level] || '#9e9e9e')
    : '#9e9e9e';

  const isCritical = result?.risk_level === 'CRITICAL';

  return (
    <div className="panel collision-panel">

      <h2 className="panel-title">
        🛰 Collision Risk Monitor
      </h2>

    <div className="satellite-selector-wrapper">
      <SatelliteSelector
        satellites={satellites}
        satA={satA}
        satB={satB}
        setSatA={setSatA}
        setSatB={setSatB}
    />
    </div>

      <button
        className="action-btn"
        onClick={runCollisionCheck}
        disabled={loading}
      >
        {loading ? '⏳ Analysing…' : '🔍 Check Collision'}
      </button>

      {error && (
        <div className="error-box">⚠ {error}</div>
      )}

      {result && (
        <div className={`risk-card ${isCritical ? 'pulse bg-critical' : result.risk_level === 'WARNING' ? 'bg-warning' : 'bg-safe'}`}>
          <div className="risk-header-row">
            <div className="risk-badge" style={{ background: riskColor, marginBottom: 0 }}>
              {result.risk_level}
            </div>
            <p className="risk-hint" style={{ margin: 0 }}>
              {result.risk_level === 'CRITICAL' && 'Immediate maneuver required!'}
              {result.risk_level === 'WARNING' && 'Elevated risk — monitor closely.'}
              {result.risk_level === 'SAFE' && 'No threat detected.'}
            </p>
          </div>

          <div className="critical-headline">
            {result.min_distance_km != null ? `${Number(result.min_distance_km).toFixed(2)} km` : '—'}
          </div>
          <div style={{ color: "var(--text-muted)", marginBottom: "15px", fontSize: "0.80rem" }}>
            Est. closest approach distance
          </div>

          {result.closest_event && (
            <div className="advanced-details">
              <details>
                <summary>View Telemetry Data</summary>
                <div className="advanced-details-content">
                  <div className="risk-detail">
                    <span className="detail-label">Event Time</span>
                    <span className="detail-value">
                      {new Date(result.closest_event.time).toUTCString()}
                    </span>
                  </div>

                  <div className="risk-detail">
                    <span className="detail-label">Sat A Pos (km)</span>
                    <span className="detail-value detail-mono">
                      ({result.closest_event.position_a.x.toFixed(0)}, {result.closest_event.position_a.y.toFixed(0)}, {result.closest_event.position_a.z.toFixed(0)})
                    </span>
                  </div>

                  <div className="risk-detail">
                    <span className="detail-label">Sat B Pos (km)</span>
                    <span className="detail-value detail-mono">
                      ({result.closest_event.position_b.x.toFixed(0)}, {result.closest_event.position_b.y.toFixed(0)}, {result.closest_event.position_b.z.toFixed(0)})
                    </span>
                  </div>
                </div>
              </details>
            </div>
          )}

          <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "10px", fontStyle: "italic", textAlign: "right", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
            * Note: This is an uncalibrated SGP4 screening. Covariance analysis excluded for presentation.
          </p>
        </div>
      )}

      {!result && !loading && (
        <p className="placeholder-text">
          Press "Check Collision" to run a conjunction analysis between two satellites.
        </p>
      )}

    </div>
  );
}