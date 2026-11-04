import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ClassificationEvidence from './ClassificationEvidence';

test('classification evidence exposes conflicts and original source timestamps', () => {
  const view = renderToStaticMarkup(<ClassificationEvidence classification={{ status: 'conflict', evidence: [
    { source: 'CelesTrak SATCAT', original_type: 'PAY', retrieved_at: '2026-01-01T00:00:00Z' },
    { source: 'Space-Track SATCAT', original_type: 'DEBRIS', retrieved_at: null }
  ] }} />);
  expect(view).toContain('Metadata disagrees');
  expect(view).toContain('no source takes precedence');
  expect(view).toContain('original type: PAY');
  expect(view).toContain('original type: DEBRIS');
  expect(view).toContain('2026-01-01 00:00:00 UTC');
  expect(view).toContain('retrieved Unknown');
});

test('missing and unavailable imports stay explicit, confirmed payload is not operational', () => {
  expect(renderToStaticMarkup(<ClassificationEvidence />)).toContain('No matching classification metadata');
  expect(renderToStaticMarkup(<ClassificationEvidence classification={{ status: 'unavailable' }} />)).toContain('metadata is unavailable');
  expect(renderToStaticMarkup(<ClassificationEvidence classification={{ status: 'confirmed' }} />)).toContain('Payload does not imply operational status');
});
