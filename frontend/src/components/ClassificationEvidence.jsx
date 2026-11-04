import React from 'react';
import { utc } from '../api';

const messages = {
  confirmed: 'Source metadata agrees on this category. Payload does not imply operational status.',
  conflict: 'Metadata disagrees. Category remains unknown; no source takes precedence.',
  unknown: 'Source type is unknown, missing or unsupported.',
  unavailable: 'Classification metadata is unavailable. Category remains unknown.',
  missing: 'No matching classification metadata for this catalogue ID.'
};

export default function ClassificationEvidence({ classification }) {
  return <div className="inspector-section"><span className="eyebrow">CLASSIFICATION EVIDENCE</span>
    <p>{messages[classification?.status] || messages.missing}</p>
    {classification?.evidence?.map((entry, i) => <p key={i} className="muted small">
      {entry.source} · original type: {entry.original_type || 'Not supplied'} · retrieved {utc(entry.retrieved_at)}
    </p>)}
  </div>;
}
