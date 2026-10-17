import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Orbit, Layers, List, Crosshair, Activity, RefreshCw, ArrowUpRight, Minus, Plus, RotateCcw, Globe2, Info } from 'lucide-react';
import Catalogue from './components/Catalogue';
import ObjectInspector from './components/ObjectInspector';
import ConjunctionWorkbench from './components/ConjunctionWorkbench';
import SatelliteLayer from './components/SatelliteLayer';
import SatelliteOrbit from './components/SatelliteOrbit';
import { request, number, utc, API_URL } from './api';
const Globe = lazy(() => import('./components/Globe'));
const views = [{ id: 'overview', label: 'Orbital overview', icon: Globe2 }, { id: 'catalogue', label: 'Object catalogue', icon: List }, { id: 'conjunctions', label: 'Conjunction analysis', icon: Crosshair }, { id: 'system', label: 'System & sources', icon: Activity }];
export default function App() {
  const [view, setView] = useState('overview');
  const [objects, setObjects] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [selected, setSelected] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [status, setStatus] = useState('loading');
  const [health, setHealth] = useState('Checking API');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [trajectory, setTrajectory] = useState([]);
  const [orbitLoading, setOrbitLoading] = useState(false);
  const [orbitError, setOrbitError] = useState('');
  const [sample, setSample] = useState(null);
  const [grid, setGrid] = useState(false);
  const [markers, setMarkers] = useState(true);
  const [paths, setPaths] = useState(true);
  const [command, setCommand] = useState({ action: 'reset', serial: 0 });
  const camera = action => setCommand(c => ({ action, serial: c.serial + 1 }));
  useEffect(() => {
    const c = new AbortController(); setStatus('loading'); setError(''); setHealth('Checking API');
    request('/health', {}, c.signal).then(data => setHealth(data.status === 'ok' ? 'API reachable' : 'API degraded')).catch(e => { if (e.name !== 'AbortError') setHealth('API unavailable'); });
    request('/catalog', { limit: 1000 }, c.signal).then(data => {
      if (!Array.isArray(data.objects) || !data.metadata) throw new Error('Unexpected catalogue response. Confirm that the frontend and API versions match.');
      setObjects(data.objects); setMetadata(data.metadata); setStatus('ready'); setComparison(null);
      setSelected(previous => data.objects.find(s => s.norad_id === previous?.norad_id) || data.objects.find(s => s.name.startsWith('ISS ')) || data.objects[0] || null);
    }).catch(e => { if (e.name !== 'AbortError') { setError(e.message); setStatus('error'); } });
    return () => c.abort();
  }, [refresh]);
  useEffect(() => {
    setTrajectory([]); setSample(null); setOrbitError('');
    if (!selected) return;
    const c = new AbortController(); setOrbitLoading(true);
    request('/propagate', { line1: selected.line1, line2: selected.line2, hours: 2, step_minutes: 2, start_time: selected.time }, c.signal).then(data => {
      if (!Array.isArray(data) || !data.length) throw new Error('No trajectory samples returned.');
      setTrajectory(data);
    }).catch(e => { if (e.name !== 'AbortError') setOrbitError(e.message); }).finally(() => { if (!c.signal.aborted) setOrbitLoading(false); });
    return () => c.abort();
  }, [selected]);
  const select = useCallback(object => { setSelected(object); setSample(null); }, []);
  const inspect = object => { select(object); setView('overview'); };
  const analyze = () => setView('conjunctions');
  const displayTime = sample !== null ? trajectory[sample]?.time : metadata?.state_time;
  return <div className="app-shell"><a className="skip-link" href="#main">Skip to workspace</a>
    <header className="topbar"><a href="#main" className="brand" onClick={() => setView('overview')}><Orbit size={30} strokeWidth={1.2} /><span>ORBITAL<span className="brand-light"> GUARDIAN</span><small>PUBLIC-TLE RESEARCH WORKSPACE</small></span></a><div className="header-context"><span className={`status-dot ${health === 'API reachable' ? 'reachable' : ''}`} /><span>{health}</span><span className="version">02 / RESEARCH</span></div></header>
    <div className="app-body"><nav className="sidebar" aria-label="Workspace"><span className="nav-caption">WORKSPACE</span>{views.map(({ id, label, icon: Icon }) => <button key={id} aria-label={label} aria-current={view === id ? 'page' : undefined} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={18} strokeWidth={1.5} /><span>{label}</span></button>)}<div className="sidebar-note"><Orbit size={24} strokeWidth={1} /><p>Explore the orbit.<br />Understand the limits.</p><span>SGP4 / PUBLIC CATALOGUE</span></div></nav>
      <main id="main" className="main-content"><div className="page-heading"><div><p className="eyebrow">ORBITAL GUARDIAN / {view === 'overview' ? 'MISSION OVERVIEW' : view.toUpperCase()}</p><h1>{view === 'overview' ? 'A clearer view of orbit.' : views.find(v => v.id === view).label}</h1><p>{view === 'overview' ? 'Explore orbital objects. Inspect trajectories. Examine close approaches.' : view === 'catalogue' ? 'Find an object and follow its predicted path around Earth.' : view === 'conjunctions' ? 'Transparent geometric analysis, with the assumptions in view.' : 'Know where each state comes from, and what it can tell you.'}</p></div><button className="refresh-button" disabled={status === 'loading'} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={15} className={status === 'loading' ? 'loading-icon' : ''} />{status === 'loading' ? 'Retrieving' : 'Refresh snapshot'}</button></div>
      {error && <div role="alert" className="error">{error} {objects.length > 0 && 'The previous snapshot is retained.'}</div>}
      {status === 'loading' && <p role="status" className="notice">Retrieving and validating public orbital elements…</p>}
      {metadata && (metadata.mode !== 'live' || metadata.stale_count > 0) && <div className="source-notice"><Info size={16} /><span><strong>{metadata.mode === 'offline' ? 'Offline catalogue' : metadata.mode === 'fallback' ? 'Fallback catalogue' : metadata.mode === 'cache' ? 'Cached catalogue' : 'Element freshness advisory'}</strong> · {metadata.stale_count} of {objects.length} displayed objects have stale or future epochs. {metadata.retrieved_at ? `Retrieved ${utc(metadata.retrieved_at)}.` : 'Original retrieval time unknown.'} These are predictions, not sensor observations.</span></div>}
      {view === 'overview' && <><div className="metric-strip"><div><span>DISPLAYED OBJECTS</span><strong>{metadata ? objects.length.toLocaleString() : '—'} <small>/ {metadata?.catalog_count?.toLocaleString() || '—'}</small></strong></div><div><span>PROPAGATION MODEL</span><strong>SGP4 <small>WGS72 dynamics</small></strong></div><div><span>ELEMENTS ≤ 7 DAYS OLD</span><strong>{metadata ? objects.filter(s => s.freshness === 'recent').length.toLocaleString() : '—'} <small>in this snapshot</small></strong></div><div><span>SNAPSHOT EPOCH</span><strong className="time-metric">{metadata ? utc(metadata.state_time) : 'Awaiting catalogue'}</strong></div></div>
      <div className="orbital-workspace"><section className="orbital-view" aria-label="Interactive orbital view"><div className="view-top"><div><span className="eyebrow">EARTH-FIXED VIEW</span><h2>Orbital environment</h2></div><span className="badge">{sample !== null ? 'Forecast sample' : 'Catalog snapshot'}</span></div><div className="globe-canvas"><Suspense fallback={<div className="view-fallback" role="status">Initializing orbital view…</div>}><Globe grid={grid} command={command}>{markers && objects.length > 0 && <SatelliteLayer satellites={objects} selected={selected} comparison={comparison} onSelect={select} forecast={sample !== null ? trajectory[sample] : null} />}{paths && trajectory.length > 0 && <SatelliteOrbit path={trajectory} color="#d3b47f" />}</Globe></Suspense></div>
      <div className="view-legend"><span><i />Catalog objects</span><span><i className="selected-dot" />Selected / forecast path</span></div><div className="camera-controls"><button className="icon-button" aria-label="Zoom in" onClick={() => camera('in')}><Plus size={16} /></button><button className="icon-button" aria-label="Zoom out" onClick={() => camera('out')}><Minus size={16} /></button><button className="icon-button" aria-label="Reset camera" onClick={() => camera('reset')}><RotateCcw size={15} /></button></div>
      <div className="view-controls"><span><Layers size={14} /> Layers</span><label><input type="checkbox" checked={markers} onChange={e => setMarkers(e.target.checked)} />Objects</label><label><input type="checkbox" checked={paths} onChange={e => setPaths(e.target.checked)} />Trajectory</label><label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} />Grid</label><small>Drag to rotate · Scroll to zoom</small></div>
      <div className="timeline"><div><span className="eyebrow">{sample !== null ? 'SELECTED OBJECT FORECAST' : 'CATALOG SNAPSHOT'}</span><span className="mono">{utc(displayTime)}</span></div><label className="timeline-slider"><span>+0 h</span><input aria-label="Selected object forecast sample" type="range" min="0" max={Math.max(0, trajectory.length - 1)} value={sample ?? 0} disabled={!trajectory.length} onChange={e => setSample(Number(e.target.value))} /><span>+2 h</span></label><div className="timeline-note"><span>Only the selected object advances. Paths show Earth-fixed forecast positions.</span><button className="text-button" disabled={sample === null} onClick={() => setSample(null)}>Return to snapshot</button></div></div></section>
      <ObjectInspector object={selected} onAnalyze={analyze} trajectory={trajectory} loading={orbitLoading} error={orbitError} /></div><Catalogue objects={objects} selected={selected} onSelect={select} compact /></>}
      {view === 'catalogue' && <><Catalogue objects={objects} selected={selected} onSelect={inspect} /><p className="muted section-note">The workspace requests up to 1,000 objects. Selecting a row opens the object inspector and its forecast on the globe.</p></>}
      {view === 'conjunctions' && <ConjunctionWorkbench objects={objects} selected={selected} comparison={comparison} onCompare={setComparison} />}
      {view === 'system' && <div className="system-page"><section className="editorial"><img src="/images/earth-horizon.jpg" alt="Illustrative Earth horizon with a thin blue atmospheric rim against dark space" width="2048" height="683" loading="lazy" /><div><span className="eyebrow">THE DESIGN DIRECTION</span><h2>Persistent orbital intelligence.</h2><p>An ambition expressed through careful observation and transparent analysis. This application currently offers on-demand public-TLE snapshots and forecasts.</p><small>AI-generated editorial illustration · not an observed orbital state</small></div></section><div className="system-grid"><section className="panel"><h2>Source & processing</h2><dl className="system-details">{[['API', health], ['Endpoint', API_URL], ['Catalogue source', metadata?.source || 'Unknown'], ['Mode', metadata?.mode || 'Unknown'], ['Retrieved', utc(metadata?.retrieved_at)], ['State epoch', utc(metadata?.state_time)], ['Valid source records', metadata?.catalog_count ?? 'Unknown'], ['Rejected input records', metadata?.rejected_records ?? 'Unknown'], ['Duplicate records', metadata?.duplicate_records ?? 'Unknown'], ['Failed propagations', metadata?.propagation_failed ?? 'Unknown'], ['Last catalogue processing', metadata ? `${number(metadata.processing_ms, 0)} ms` : 'Unknown']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{metadata?.last_error && <p className="notice">{metadata.last_error}</p>}<a className="text-link" href={`${API_URL}/docs`} target="_blank" rel="noreferrer">Explore API documentation <ArrowUpRight size={15} /></a></section><section className="panel"><h2>What the model knows</h2><ul className="limits-list"><li><strong>Public orbital elements</strong><p>TLEs describe fitted mean elements. Retrieval time and element epoch are different quantities.</p></li><li><strong>Predicted states, not measurements</strong><p>SGP4 uses WGS72 dynamics. Positions are TEME; displayed coordinates use WGS84 with GMST rotation, UTC approximating UT1 and no polar motion.</p></li><li><strong>Sampled proximity</strong><p>One-minute screening can miss close approaches between samples. No covariance, object radii or collision probability are provided.</p></li><li><strong>Candidate manoeuvres</strong><p>Heuristic Δv and direction only. No validated post-burn orbit, fuel use or autonomous command.</p></li></ul><a className="text-link" href="https://celestrak.org/" target="_blank" rel="noreferrer">Orbital element source: CelesTrak <ArrowUpRight size={15} /></a></section></div></div>}
      <footer className="workspace-footer"><span>ORBITAL GUARDIAN <span className="muted">/ Independent research project</span></span><span>Public TLEs · No radar observations · Not for flight operations</span></footer>
    </main></div></div>;
}
