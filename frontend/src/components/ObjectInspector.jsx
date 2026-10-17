import React from 'react';
import { ArrowUpRight, Orbit } from 'lucide-react';
import { number, utc } from '../api';
export default function ObjectInspector({ object, onAnalyze, trajectory, loading, error }) {
  return <aside className="inspector"><div className="inspector-heading"><span className="eyebrow">OBJECT INSPECTOR</span><Orbit size={17} /></div>{!object ? <div className="empty"><h3>Select an orbital object</h3><p>Choose a marker on the globe or a row in the catalogue to inspect its elements and trajectory.</p></div> : <>
    <div className="object-identity"><span className="mono muted">NORAD / {object.norad_id}</span><h2>{object.name}</h2><span className={`badge ${object.freshness === 'recent' ? '' : 'warning'}`}>{object.freshness === 'recent' ? 'Recent elements' : object.freshness === 'future' ? 'Future epoch' : 'Stale elements'}</span></div>
    <dl className="telemetry"><div><dt>Altitude</dt><dd>{number(object.alt_km)} <small>km</small></dd></div><div><dt>Inclination</dt><dd>{number(object.inclination_deg, 2)}°</dd></div><div><dt>Period</dt><dd>{number(object.period_minutes)} <small>min</small></dd></div><div><dt>Eccentricity</dt><dd>{number(object.eccentricity, 6)}</dd></div></dl>
    <div className="inspector-section"><span className="eyebrow">ELEMENT EPOCH</span><p className="mono">{utc(object.epoch)}</p><p className="muted">{number(object.epoch_age_days)} days from snapshot. Age is not an uncertainty estimate.</p></div>
    <div className="inspector-section"><span className="eyebrow">PREDICTED LOCATION / SNAPSHOT</span><p className="mono">{number(object.lat, 2)}° lat / {number(object.lon, 2)}° lon</p><p className="muted">{utc(object.time)}</p></div>
    <button className="wide-button" onClick={onAnalyze}>Use as primary object <ArrowUpRight size={16} /></button>
    {loading && <p role="status" className="muted">Propagating a two-hour trajectory…</p>}{error && <p role="alert" className="error">{error}</p>}{trajectory?.length > 0 && <p className="muted small">{trajectory.length} forecast states · 2-minute spacing. Use the timeline to inspect samples.</p>}
    <details><summary>Source elements</summary><p>{object.source}. Retrieval: {utc(object.retrieved_at)}.</p><pre>{object.line1}{'\n'}{object.line2}</pre><p className="muted">Object classification is not supplied. No covariance or tracking observations are available.</p></details>
  </>}</aside>;
}
