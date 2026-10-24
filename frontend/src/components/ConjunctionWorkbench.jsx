import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Play, Shield } from 'lucide-react';
import { request, number, utc, band } from '../api';
import ManeuverPanel from './ManeuverPanel';

function SeparationPlot({ result }) {
  const distances = result.path_a.map((a, i) => Math.hypot(...['x', 'y', 'z'].map(k => a.position_km[k] - result.path_b[i].position_km[k])));
  const max = Math.max(...distances, 1), min = Math.min(...distances);
  const points = distances.map((d, i) => `${i / Math.max(1, distances.length - 1) * 600},${100 - d / max * 90}`).join(' ');
  return <figure className="separation-plot"><figcaption><span>Sampled separation</span><span className="mono">{number(min)}–{number(max)} km</span></figcaption><svg viewBox="0 0 600 110" role="img" aria-label={`Separation over ${result.hours} hours, sampled every ${result.step_minutes} minute. Minimum ${number(min)} kilometres.`}><path d="M0 100H600 M0 55H600 M0 10H600" stroke="#233343" strokeWidth="1" /><polyline points={points} fill="none" stroke="#9fc8df" strokeWidth="1.5" /></svg><div className="plot-labels"><span>Start</span><span>+{result.hours} h</span></div></figure>;
}
export default function ConjunctionWorkbench({ objects, selected, comparison, onCompare }) {
  const [aId, setAId] = useState(selected?.norad_id || '');
  const [bId, setBId] = useState(comparison?.norad_id || '');
  const [hours, setHours] = useState(24);
  const [result, setResult] = useState(null);
  const [scan, setScan] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [severity, setSeverity] = useState('all');
  const [sort, setSort] = useState('distance');
  const active = useRef(null);
  const a = objects.find(s => s.norad_id === Number(aId));
  const b = objects.find(s => s.norad_id === Number(bId));
  useEffect(() => { if (selected) setAId(selected.norad_id); }, [selected]);
  useEffect(() => {
    active.current?.abort(); setResult(null); setScan(null); setError(''); setBusy('');
  }, [aId, bId, hours]);
  useEffect(() => () => active.current?.abort(), []);
  const candidates = useMemo(() => {
    if (!result?.closest_event || !a || result.risk_level === 'SAFE' || result.risk_level === 'UNKNOWN') return null;
    const e = result.closest_event;
    return { line1: a.line1, line2: a.line2, threat_distance_km: result.min_distance_km, event_time: e.time,
      ...Object.fromEntries(['x', 'y', 'z'].map(k => [`threat_direction_${k}`, e.position_b[k] - e.position_a[k]])) };
  }, [result, a]);
  async function run(mode) {
    active.current?.abort(); const c = new AbortController(); active.current = c;
    setBusy(mode); setError(''); setResult(null); setScan(null);
    try {
      if (mode === 'pair') {
        onCompare(b);
        const data = await request('/collision-check', { line1_a: a.line1, line2_a: a.line2, line1_b: b.line1, line2_b: b.line2, hours, step_minutes: 1 }, c.signal);
        if (!c.signal.aborted) setResult(data);
      } else {
        const data = await request('/asset-scan', { catnr: a.norad_id, hours }, c.signal);
        if (!c.signal.aborted) setScan(data);
      }
    } catch (e) { if (!c.signal.aborted && e.name !== 'AbortError') setError(e.message); }
    finally { if (!c.signal.aborted) setBusy(''); }
  }
  const risks = (scan?.risks || []).filter(r => severity === 'all' || r.risk_level === severity).sort((x, y) => sort === 'time' ? Date.parse(x.closest_event.time) - Date.parse(y.closest_event.time) : x.min_distance_km - y.min_distance_km);
  return <section className="analysis-workbench">
    <div className="section-heading"><div><span className="eyebrow">GEOMETRIC SCREENING</span><h2>Conjunction analysis</h2></div><span className="badge">SGP4 · TEME</span></div>
    <p className="muted">Compare two objects, or screen a primary object against the first 500 catalogue candidates. A distance threshold is not a probability of collision.</p>
    <div className="analysis-inputs"><label>Primary object<select name="primary-object" value={aId} onChange={e => setAId(e.target.value)}><option value="">Select an object</option>{objects.map(s => <option key={s.norad_id} value={s.norad_id}>{s.name} · {s.norad_id}</option>)}</select></label><ArrowRight className="pair-arrow" size={18} /><label>Comparison object<select name="comparison-object" value={bId} onChange={e => setBId(e.target.value)}><option value="">Select an object</option>{objects.filter(s => s.norad_id !== Number(aId)).map(s => <option key={s.norad_id} value={s.norad_id}>{s.name} · {s.norad_id}</option>)}</select></label><label>Look-ahead<select name="look-ahead" value={hours} onChange={e => setHours(Number(e.target.value))}><option value={1}>1 hour</option><option value={6}>6 hours</option><option value={24}>24 hours</option></select></label></div>
    <div className="actions"><button className="primary-button" disabled={!a || !b || a.norad_id === b.norad_id || !!busy} onClick={() => run('pair')}><Play size={14} />{busy === 'pair' ? 'Screening pair…' : 'Run pair screen'}</button><button disabled={!a || !!busy} onClick={() => run('scan')}><Shield size={15} />{busy === 'scan' ? 'Screening catalogue…' : 'Scan primary asset'}</button></div>
    {(a?.freshness !== 'recent' || (b && b.freshness !== 'recent')) && a && <p className="notice">Selected elements are stale or future-dated. These forecasts may be unreliable; inspect the source epochs before interpreting results.</p>}
    {busy && <p role="status" className="notice">Computing shared UTC samples. Asset scans may take several seconds.</p>}{error && <p role="alert" className="error">{error}</p>}
    {!busy && !result && !scan && !error && <div className="analysis-empty"><div className="orbit-symbol" aria-hidden="true">⌖</div><h3>A closer look at orbital encounters.</h3><p>Select two different objects to compare their predicted separation.<br />No conjunction has been assessed yet.</p></div>}
    {result && <div className="analysis-result" aria-live="polite"><div className="result-title"><h3>{a.name} <span className="muted">/</span> {b.name}</h3><span className={`badge ${result.risk_level.toLowerCase()}`}>{band(result.risk_level)}</span></div>
      <div className="result-metrics"><div><span>Minimum sampled separation</span><strong>{number(result.min_distance_km, 3)} <small>km</small></strong></div><div><span>Relative speed at sample</span><strong>{number(result.closest_event?.relative_velocity_km_s, 3)} <small>km/s</small></strong></div><div><span>Collision probability</span><strong className="unavailable">Unavailable</strong></div></div>
      <p className="mono event-time">Closest sampled epoch · {utc(result.closest_event?.time)}</p>
      {result.path_a?.length > 1 && <SeparationPlot result={result} />}
      <details><summary>Method, thresholds and reproducibility</summary><p>Start: {utc(result.start_time)}. Window: {result.hours} h. Step: {result.step_minutes} min. {result.sample_count} aligned samples. Distances use TEME km; velocities use km/s. Under 10 km: critical screening band; under 50 km: warning band. Above threshold does not establish safety between samples. Covariance and object radii are unavailable.</p><p>Element epochs: A {utc(result.elements_a?.epoch)} / B {utc(result.elements_b?.epoch)}.</p></details></div>}
    {scan && <div className="analysis-result" aria-live="polite"><h3>{scan.asset} · Catalogue screen</h3><p className="muted">{scan.scan_count} successfully screened / {scan.attempted_count} attempted · {scan.failed_count} failed · {number(scan.processing_ms, 0)} ms</p><p className="notice">{scan.truncated ? `Limited to 500 of ${scan.candidate_count} candidates. ` : ''}One-minute sampled separation. This is not exhaustive continuous conjunction assessment.</p><div className="catalogue-tools"><select name="scan-severity" aria-label="Filter scan severity" value={severity} onChange={e => setSeverity(e.target.value)}><option value="all">All flagged samples</option><option value="CRITICAL">Within 10 km</option><option value="WARNING">Within 50 km</option></select><select name="scan-sort" aria-label="Sort scan results" value={sort} onChange={e => setSort(e.target.value)}><option value="distance">Closest distance</option><option value="time">Earliest sample</option></select></div><div className="table-scroll"><table><thead><tr><th>Object</th><th>Separation (km)</th><th>Sample epoch (UTC)</th></tr></thead><tbody>{risks.map((r, i) => <tr key={i}><td>{r.target_name}<small className="block">NORAD {r.norad_id}</small></td><td className="mono">{number(r.min_distance_km, 3)}</td><td className="mono">{utc(r.closest_event?.time)}</td></tr>)}</tbody></table></div>{!risks.length && <p className="empty">No samples match this filter. This does not imply collision-free trajectories.</p>}</div>}
    <ManeuverPanel threatParams={candidates} />
  </section>;
}
