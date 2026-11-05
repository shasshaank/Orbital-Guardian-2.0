import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Globe from './Globe';

const graphics = vi.hoisted(() => ({ fail: false, target: null }));
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ onCreated }) => {
    React.useEffect(() => { onCreated({ gl: { domElement: graphics.target } }); }, [onCreated]);
    if (graphics.fail) throw new Error('WebGL initialization failed');
    return <div>Canvas initialized</div>;
  },
  useThree: () => ({})
}));
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }));

let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  graphics.fail = false; graphics.target = new EventTarget();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

test('graphics context loss replaces the view with an accessible recovery message', async () => {
  await act(async () => root.render(<Globe command={{ action: 'reset' }} />));
  expect(container.textContent).toContain('Canvas initialized');
  await act(async () => graphics.target.dispatchEvent(new Event('webglcontextlost')));
  expect(container.querySelector('[role="alert"]').textContent).toContain('graphics context was lost');
  expect(container.textContent).toContain('Catalogue and analyses remain available');
});

test('initialization failure is contained by the view boundary', async () => {
  graphics.fail = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const expectedError = event => { if (event.error?.message === 'WebGL initialization failed') event.preventDefault(); };
  window.addEventListener('error', expectedError);
  try { await act(async () => root.render(<Globe command={{ action: 'reset' }} />)); }
  finally { window.removeEventListener('error', expectedError); }
  expect(container.querySelector('[role="alert"]').textContent).toContain('3D view unavailable');
  expect(container.textContent).toContain('All objects and analyses remain available');
});
