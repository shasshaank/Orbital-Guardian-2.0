import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import App from './App';
import Catalogue from './components/Catalogue';
import { filterObjects, number } from './api';

jest.mock('./components/Globe', () => ({ __esModule: true, default: ({ children }) => <div data-testid="globe">{children}</div> }));
jest.mock('./components/SatelliteLayer', () => () => null);
jest.mock('./components/SatelliteOrbit', () => () => null);
const objects = [
  { name: 'ALPHA', norad_id: 1, line1: 'line1-a', line2: 'line2-a', alt_km: 400, inclination_deg: 51.6, eccentricity: 0.001, period_minutes: 92, freshness: 'stale', epoch_age_days: 30, epoch: '2026-09-01T00:00:00Z', time: '2026-10-01T00:00:00Z' },
  { name: 'BETA', norad_id: 2, line1: 'line1-b', line2: 'line2-b', alt_km: 600, inclination_deg: 40, freshness: 'recent', epoch_age_days: 1, epoch: '2026-09-30T00:00:00Z', time: '2026-10-01T00:00:00Z' }
];
const states = [0, 1].map(i => ({ time: `2026-10-01T00:0${i * 2}:00Z`, lat: 0, lon: i, alt_km: 400, position_km: { x: 7000, y: i, z: 0 }, velocity_km_s: { x: 0, y: 7, z: 0 } }));
let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  global.fetch = jest.fn(async url => {
    const path = new URL(url).pathname;
    return { ok: true, json: async () => path === '/health' ? { status: 'ok' } : path === '/catalog' ? { objects, metadata: { mode: 'offline', stale_count: 1, catalog_count: 2, state_time: objects[0].time, retrieved_at: null } } : path === '/propagate' ? states : {} };
  });
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.restoreAllMocks(); });
// ReactDOM createRoot is used directly, not Testing Library; act is required.
// eslint-disable-next-line testing-library/no-unnecessary-act
async function render(node) { await act(async () => { root.render(node); }); }
async function click(text) { const button = [...container.querySelectorAll('button')].find(e => e.textContent === text || e.textContent.includes(text)); expect(button).toBeTruthy(); await act(async () => button.click()); }
async function change(element, value) { await act(async () => Simulate.change(element, { target: { value } })); }

test('catalogue search, freshness and selection preserve numeric zero semantics', async () => {
  const select = jest.fn(); await render(<Catalogue objects={objects} onSelect={select} />);
  await change(container.querySelector('input'), '2');
  expect(container.querySelector('tbody').textContent).toContain('BETA');
  expect(container.querySelector('tbody').textContent).not.toContain('ALPHA');
  await click('BETA'); expect(select).toHaveBeenCalledWith(objects[1]);
  await change(container.querySelector('input'), '');
  await change(container.querySelector('[aria-label="Filter by element freshness"]'), 'stale');
  expect(container.querySelector('tbody').textContent).not.toContain('BETA');
  expect(number(0, 1)).toBe('0.0'); expect(number(null)).toBe('Unavailable');
  expect(filterObjects(objects, '', 'all', 'altitude')[0].norad_id).toBe(1);
});
test('loads real source state, supports forecast scrubber and system navigation', async () => {
  await render(<App />);
  expect(container.textContent).toContain('API reachable');
  expect(container.textContent).toContain('Offline catalogue');
  expect(fetch.mock.calls.filter(([url]) => url.includes('/catalog?'))).toHaveLength(1);
  await change(container.querySelector('input[type="range"]'), '1');
  expect(container.textContent).toContain('2026-10-01 00:02:00 UTC');
  await click('System & sources');
  expect(container.textContent).toContain('What the model knows');
  expect(container.querySelector('img').getAttribute('alt')).toContain('Illustrative');
});
test('catalogue errors are actionable and retry recovers', async () => {
  const original = fetch;
  global.fetch = jest.fn(async url => url.includes('/catalog?') ? { ok: false, status: 503, json: async () => ({ detail: 'Source unavailable' }) } : original(url));
  await render(<App />); expect(container.querySelector('[role="alert"]').textContent).toContain('Source unavailable');
  global.fetch = original;
  await click('Refresh snapshot'); expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain('ALPHA');
});
test('pair workflow uses explicit inputs and does not invent probability', async () => {
  const original = fetch;
  global.fetch = jest.fn(async url => {
    if (url.includes('/collision-check?')) return { ok: true, json: async () => ({ risk_level: 'SAFE', min_distance_km: 100, closest_event: { time: states[0].time, relative_velocity_km_s: 2 }, hours: 1, step_minutes: 1, sample_count: 61, start_time: states[0].time, elements_a: objects[0], elements_b: objects[1] }) };
    return original(url);
  });
  await render(<App />); await click('Conjunction analysis');
  const selects = container.querySelectorAll('.analysis-inputs select');
  expect([...container.querySelectorAll('button')].find(e => e.textContent === 'Run pair screen').disabled).toBe(true);
  await change(selects[1], '2'); await change(selects[2], '1'); await click('Run pair screen');
  expect(container.textContent).toContain('100.000'); expect(container.textContent).toContain('Above threshold');
  expect(container.textContent).toContain('Collision probability'); expect(container.textContent).toContain('Unavailable');
  const url = fetch.mock.calls.find(([url]) => url.includes('/collision-check?'))[0]; expect(url).toContain('line1_a=line1-a');
  await change(selects[2], '6'); expect(container.textContent).not.toContain('100.000');
});

test('clearing maneuver inputs cancels pending work and clears loading and late results', async () => {
  const ManeuverPanel = require('./components/ManeuverPanel').default;
  let finish;
  global.fetch = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  await render(<ManeuverPanel threatParams={{ threat_distance_km: 0 }} />);
  const signal = fetch.mock.calls[0][1].signal;
  expect(container.textContent).toContain('Computing heuristic candidates');
  await render(<ManeuverPanel threatParams={null} />);
  expect(signal.aborted).toBe(true);
  expect(container.textContent).not.toContain('Computing heuristic candidates');
  await act(async () => finish({ ok: true, json: async () => ({ primary: { delta_v_m_s: 999 } }) }));
  expect(container.textContent).not.toContain('999');
});

test('changing pair selection aborts slow request and ignores late response', async () => {
  const original = fetch;
  let finish, signal;
  global.fetch = jest.fn((url, options) => {
    if (url.includes('/collision-check?')) {
      signal = options.signal;
      return new Promise(resolve => { finish = resolve; });
    }
    return original(url, options);
  });
  await render(<App />); await click('Conjunction analysis');
  const selects = container.querySelectorAll('.analysis-inputs select');
  await change(selects[1], '2'); await click('Run pair screen');
  expect(container.textContent).toContain('Screening pair');
  await change(selects[2], '6');
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ ok: true, json: async () => ({ min_distance_km: 12345 }) }));
  expect(container.textContent).not.toContain('12,345');
  expect(container.textContent).not.toContain('Screening pair');
});

test('a cancelled forecast cannot replace the new selection with a late error', async () => {
  const original = fetch;
  let fail, signal;
  global.fetch = jest.fn((url, options) => {
    if (url.includes('/propagate?') && url.includes('line1-a')) {
      signal = options.signal;
      return new Promise((resolve, reject) => { fail = reject; });
    }
    return original(url, options);
  });
  await render(<App />);
  await click('Object catalogue');
  await click('BETA');
  expect(signal.aborted).toBe(true);
  await act(async () => fail(new Error('Obsolete forecast failed')));
  expect(container.textContent).not.toContain('Obsolete forecast failed');
  expect(container.querySelector('input[type="range"]').disabled).toBe(false);
});

test.each(['Run pair screen', 'Scan primary asset'])('cancelled %s ignores late errors while replacement work remains pending', async action => {
  const Workbench = require('./components/ConjunctionWorkbench').default;
  const pending = [];
  global.fetch = jest.fn((url, options) => new Promise((resolve, reject) => pending.push({ reject, signal: options.signal })));
  await render(<Workbench objects={objects} selected={objects[0]} comparison={objects[1]} onCompare={() => {}} />);
  await click(action);
  await change(container.querySelector('[name="look-ahead"]'), '6');
  await click(action);
  expect(pending[0].signal.aborted).toBe(true);
  expect(pending[1].signal.aborted).toBe(false);
  await act(async () => pending[0].reject(new Error('Obsolete screen failed')));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector('[role="status"]')).not.toBeNull();
});

test('cancelled maneuver errors cannot contaminate replacement candidates', async () => {
  const ManeuverPanel = require('./components/ManeuverPanel').default;
  const pending = [];
  global.fetch = jest.fn((url, options) => new Promise((resolve, reject) => pending.push({ resolve, reject, signal: options.signal })));
  await render(<ManeuverPanel threatParams={{ threat_distance_km: 1 }} />);
  await render(<ManeuverPanel threatParams={{ threat_distance_km: 0 }} />);
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () => pending[1].resolve({ ok: true, json: async () => ({ primary: { delta_v_m_s: 0, burn_direction: { x: 0, y: 1, z: 0 } }, tradeoffs: [{ delta_v_m_s: null }], assumptions: ['Illustrative only'] }) }));
  await act(async () => pending[0].reject(new Error('Obsolete maneuver failed')));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.querySelector('tbody').textContent).toContain('0.000');
  expect(container.querySelector('tbody').textContent).toContain('Unavailable');
  expect(container.querySelector('details').textContent).toContain('Illustrative only');
  expect(container.querySelector('[role="status"]')).toBeNull();
});
