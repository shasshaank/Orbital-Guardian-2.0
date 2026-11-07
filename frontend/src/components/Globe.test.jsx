import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Globe from './Globe';

const graphics = vi.hoisted(() => ({ fail: false, target: null, mounts: 0, invalidates: 0 }));
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ onCreated }) => {
    React.useEffect(() => {
      graphics.mounts++;
      graphics.target = new EventTarget();
      onCreated({ gl: { domElement: graphics.target }, invalidate: () => graphics.invalidates++ });
    }, [onCreated]);
    if (graphics.fail) throw new Error('WebGL initialization failed');
    return <div>Canvas initialized</div>;
  },
  useThree: () => ({})
}));
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }));
let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  graphics.fail = false; graphics.mounts = 0; graphics.invalidates = 0;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
const render = async () => { await act(async () => root.render(<Globe command={{ action: 'reset' }} />)); };
const lose = async () => { const e = new Event('webglcontextlost', { cancelable: true }); await act(async () => graphics.target.dispatchEvent(e)); return e; };

test('real loss keeps canvas mounted, permits restoration, and removes overlay', async () => {
  await render();
  expect((await lose()).defaultPrevented).toBe(true);
  expect(container.textContent).toContain('Graphics context lost');
  expect(container.textContent).toContain('Canvas initialized');
  expect(graphics.mounts).toBe(1);
  await act(async () => graphics.target.dispatchEvent(new Event('webglcontextrestored')));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(graphics.invalidates).toBe(1);
});

test('retry replaces canvas and ignores disposed canvas notifications, with a finite budget', async () => {
  await render(); const old = graphics.target;
  for (let i=0; i<3; i++) {
    await lose(); await act(async () => container.querySelector('button').click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
  }
  await act(async () => old.dispatchEvent(new Event('webglcontextlost')));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await lose(); expect(container.querySelector('button').disabled).toBe(true);
  expect(graphics.mounts).toBe(4);
});

test('restoration deadline does not trigger automatic remount loops', async () => {
  vi.useFakeTimers(); await render(); await lose();
  await act(async () => vi.advanceTimersByTime(30000));
  expect(container.textContent).toContain('Automatic restoration has not completed');
  expect(graphics.mounts).toBe(1);
});

test('data/selection rerenders preserve canvas and listener identity', async () => {
  await render(); const target=graphics.target;
  await render(); expect(graphics.target).toBe(target); expect(graphics.mounts).toBe(1);
});

test('initialization exceptions have a distinct fallback and working retry', async () => {
  graphics.fail = true; vi.spyOn(console, 'error').mockImplementation(() => {});
  const expected = e => { if (e.error?.message === 'WebGL initialization failed') e.preventDefault(); };
  window.addEventListener('error', expected);
  try { await render(); } finally { window.removeEventListener('error', expected); }
  expect(container.textContent).toContain('3D renderer unavailable');
  expect(container.textContent).not.toContain('Graphics context lost');
  graphics.fail=false;
  await act(async () => container.querySelector('button').click());
  expect(container.textContent).toContain('Canvas initialized');
});
