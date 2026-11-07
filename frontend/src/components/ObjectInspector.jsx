import React from 'react';
import { ArrowUpRight, Orbit } from 'lucide-react';
import { categoryOf, CATEGORIES } from '../objectSemantics';
import { number, utc, freshnessLabel } from '../api';
import ClassificationEvidence from './ClassificationEvidence';
export default function ObjectInspector({ object, displayedState, onAnalyze, trajectory, loading, error }) {
  return <aside className="inspector"><div className="inspector-heading"><span className="eyebrow">OBJECT INSPECTOR</span><Orbit size={17} /></div>{!object ? <div className="empty"><h3>Select an orbital object</h3><p>Choose a marker on the globe or a row in the catalogue to inspect its elements and trajectory.</p></div> : <>
    <div className="object-identity" key={object.norad_id}><span className="mono muted">NORAD / {object.norad_id}</span><h2>{object.name}</h2><p style={{ color: CATEGORIES[categoryOf(object)].color }}>{CATEGORIES[categoryOf(object)].label}</p><span className={`badge ${object.freshness === 'recent' ? '' : 'warning'}`}>{freshnessLabel(object.freshness)}</span></div>
    <ClassificationEvidence classification={object.classification} />
    <dl className="telemetry"><div><dt>Altitude</dt><dd>{number((displayedState || object).alt_km)} <small>km</small></dd></div><div><dt>Inclination</dt><dd>{number(object.inclination_deg, 2)}°</dd></div><div><dt>Period</dt><dd>{number(object.period_minutes)} <small>min</small></dd></div><div><dt>Eccentricity</dt><dd>{number(object.eccentricity, 6)}</dd></div></dl>
    <div className="inspector-section"><span className="eyebrow">ELEMENT EPOCH</span><p className="mono">{utc(object.epoch)}</p><p className="muted">{number(object.epoch_age_days)} days from snapshot. Age is not an uncertainty estimate.</p></div>
    <div className="inspector-section"><span className="eyebrow">PREDICTED LOCATION / DISPLAYED TIME</span><p className="mono">{number((displayedState || object).lat, 2)}° lat / {number((displayedState || object).lon, 2)}° lon</p><p className="muted">{utc((displayedState || object).time)}</p></div>
    <button className="wide-button" onClick={onAnalyze}>Use as primary object <ArrowUpRight size={16} /></button>
    {loading && <p role="status" className="muted">Propagating a two-hour trajectory…</p>}{error && <p role="alert" className="error">{error}</p>}{trajectory?.length > 0 && <p className="muted small">{trajectory.length} forecast states · 2-minute spacing. Use the timeline to inspect samples.</p>}
    <details><summary>Source elements</summary><p>{object.source}. Retrieval: {utc(object.retrieved_at)}.</p><pre>{object.omm ? JSON.stringify(object.omm, null, 2) : `${object.line1}\n${object.line2}`}</pre><p className="muted">{categoryOf(object) === 'unknown' ? 'Object classification is unavailable or unconfirmed.' : `Classification source: ${object.classification.source}.`} No covariance or tracking observations are available.</p></details>
  </>}</aside>;
}
