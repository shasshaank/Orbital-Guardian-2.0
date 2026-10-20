import React, { useMemo, useState } from 'react';
import { Search, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { filterObjects, number } from '../api';
export default function Catalogue({ objects, selected, onSelect, compact = false }) {
  const [query, setQuery] = useState('');
  const [freshness, setFreshness] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => filterObjects(objects, query, freshness, sort), [objects, query, freshness, sort]);
  const size = compact ? 6 : 20;
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / size) - 1));
  const change = setter => event => { setter(event.target.value); setPage(0); };
  return <section className="catalogue" aria-label="Object catalogue">
    <div className="section-heading"><div><span className="eyebrow">PUBLIC ELEMENT SETS</span><h2>Object catalogue <span className="count">{objects.length.toLocaleString()}</span></h2></div><span className="muted">Active-group objects · type unclassified</span></div>
    <div className="catalogue-tools"><label className="search"><Search size={16} /><span className="sr-only">Search catalogue</span><input name="catalogue-search" value={query} onChange={change(setQuery)} placeholder="Search name or NORAD ID" /></label>
      <label><span className="sr-only">Filter by element freshness</span><select name="catalogue-freshness" aria-label="Filter by element freshness" value={freshness} onChange={change(setFreshness)}><option value="all">All element ages</option><option value="recent">Recent elements</option><option value="stale">Stale elements</option><option value="future">Future epoch</option></select></label>
      <label><span className="sr-only">Sort catalogue</span><select name="catalogue-sort" aria-label="Sort catalogue" value={sort} onChange={change(setSort)}><option value="name">Name A–Z</option><option value="altitude">Altitude ↑</option><option value="epoch">Newest epoch</option></select></label></div>
    <div className="table-scroll"><table><thead><tr><th scope="col">Object / NORAD</th><th scope="col">Altitude</th><th scope="col">Inclination</th><th scope="col">Element age</th><th scope="col"><span className="sr-only">Selection</span></th></tr></thead>
      <tbody>{filtered.slice(safePage * size, (safePage + 1) * size).map(s => <tr key={s.norad_id} className={selected?.norad_id === s.norad_id ? 'selected-row' : ''}><td><button className="object-link" onClick={() => onSelect(s)} aria-pressed={selected?.norad_id === s.norad_id}><span>{s.name}</span><small className="mono">NORAD {s.norad_id}</small></button></td><td className="mono">{number(s.alt_km)} <small>km</small></td><td className="mono">{number(s.inclination_deg)}°</td><td><span className={`age ${s.freshness}`}>{number(s.epoch_age_days)} d</span></td><td><button className="icon-button" aria-label={`Inspect ${s.name}`} onClick={() => onSelect(s)}><ArrowUpRight size={17} /></button></td></tr>)}</tbody></table></div>
    {!filtered.length && <p className="empty">{objects.length ? 'No objects match these filters.' : 'No catalog objects are available. Check the source status or retry retrieval.'}</p>}
    <div className="table-footer"><span aria-live="polite">{filtered.length ? safePage * size + 1 : 0}–{Math.min((safePage + 1) * size, filtered.length)} of {filtered.length} matching objects</span><div><button className="icon-button" disabled={safePage === 0} aria-label="Previous catalogue page" onClick={() => setPage(safePage - 1)}><ChevronLeft size={17} /></button><button className="icon-button" disabled={(safePage + 1) * size >= filtered.length} aria-label="Next catalogue page" onClick={() => setPage(safePage + 1)}><ChevronRight size={17} /></button></div></div>
  </section>;
}
