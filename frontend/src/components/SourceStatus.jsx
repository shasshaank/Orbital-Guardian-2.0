import React from 'react';
import { Info, ChevronDown } from 'lucide-react';
import { sourceLabel, utc } from '../api';

export default function SourceStatus({ metadata, count }) {
  return <section className={`source-notice ${metadata.is_stale ? 'source-degraded' : ''}`} aria-label="Catalogue source status">
    <div className="source-summary"><span className="source-pill"><i />{sourceLabel(metadata)}</span>
      <span className="source-provider">{metadata.source || 'Unknown provider'} <span> / {metadata.group || 'active'}</span></span>
      <details className="source-details"><summary><Info size={14} /> Data details <ChevronDown size={12} /></summary><div>
        <p>{metadata.retrieved_at ? `Retrieved ${utc(metadata.retrieved_at)}.` : 'Original retrieval time unknown.'} {metadata.stale_count ?? 'Unknown'} of {count} displayed objects have stale or future epochs.</p>
        <p>Positions are SGP4 predictions, not sensor observations.</p>
      </div></details>
    </div>
    {metadata.last_error && <p role="alert" className="source-message">{metadata.last_error}</p>}
    {metadata.refresh_blocked && <p>Automatic source refresh is paused pending operator review.</p>}
    {metadata.classification_metadata?.status === 'unavailable' && <p role="alert">Classification metadata could not be validated. Categories remain unknown.</p>}
    {metadata.classification_metadata?.is_stale && <p>Classification evidence is historical (oldest retrieval {utc(metadata.classification_metadata.oldest_retrieved_at)}). Current category accuracy is not guaranteed.</p>}
    {metadata.classification_metadata?.refresh_error && <p role="alert">{metadata.classification_metadata.refresh_error}</p>}
  </section>;
}
