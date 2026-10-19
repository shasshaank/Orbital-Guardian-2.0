import React, { useEffect, useState } from 'react';
import { request, number } from '../api';
export default function ManeuverPanel({ threatParams }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!threatParams) { setResult(null); setError(''); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(null);
    request('/maneuver-recommend', threatParams, controller.signal).then(data => { if (!controller.signal.aborted) setResult(data); }).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [threatParams]);
  return <section className="candidate-panel"><span className="eyebrow">DECISION SUPPORT / EXPERIMENTAL</span><h3>Manoeuvre candidates</h3>
    <p className="muted">Illustrative direction and Δv heuristics. No validated post-burn trajectory, fuel estimate or flight command.</p>
    {!threatParams && <p className="empty">Run a pair screen with a sampled separation below 50 km to explore candidates.</p>}
    {loading && <p role="status">Computing heuristic candidates…</p>}{error && <p role="alert" className="error">{error}</p>}
    {result?.primary && <><div className="table-scroll"><table><thead><tr><th>Candidate</th><th>Δv (m/s)</th><th>Validation</th></tr></thead><tbody>{[result.primary, ...(result.tradeoffs || [])].map((r, i) => <tr key={i}><td>{i === 0 ? 'Primary geometry' : i === 1 ? 'Higher Δv' : 'Radial alternative'}</td><td className="mono">{number(r.delta_v_m_s, 3)}</td><td>Not validated</td></tr>)}</tbody></table></div>
      <details><summary>Model assumptions and direction</summary><p className="mono">TEME unit direction: {Object.values(result.primary.burn_direction).map(v => number(v, 4)).join(' / ')}</p><ul>{result.assumptions?.map(text => <li key={text}>{text}</li>)}</ul></details></>}
  </section>;
}
