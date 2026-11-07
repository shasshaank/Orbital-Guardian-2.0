// Local manual QA only. Not an entry in the production build.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import '../src/index.css';
const fetchOriginal = window.fetch.bind(window);
let blocked = false, extension, lostCanvas;
window.fetch = (url, options) => blocked && String(url).startsWith('/api/')
  ? Promise.reject(new TypeError('Simulated API connection failure')) : fetchOriginal(url, options);
let canvasAdds = 0;
const observer = new MutationObserver(records => {
  for (const record of records) for (const node of record.addedNodes) {
    if (node.nodeName === 'CANVAS') canvasAdds++;
    else canvasAdds += node.querySelectorAll?.('canvas').length || 0;
  }
});
observer.observe(document.body, { childList: true, subtree: true });
function Harness() {
  const [message, setMessage] = useState('Ready; normal API requests enabled');
  const [generation, setGeneration] = useState(0);
  function lose() {
    lostCanvas = document.querySelector('canvas');
    const context = lostCanvas?.getContext('webgl2') || lostCanvas?.getContext('webgl');
    extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) { setMessage('WEBGL_lose_context unavailable in this browser'); return; }
    lostCanvas.addEventListener('webglcontextlost', () => setMessage(`Actual loss event; isContextLost=${context.isContextLost()}; canvas count=${document.querySelectorAll('canvas').length}`), { once: true });
    extension.loseContext();
  }
  function restore() {
    if (!extension) { setMessage('No loss extension; use Lose WebGL first'); return; }
    lostCanvas.addEventListener('webglcontextrestored', () => setMessage(`Actual restoration event; same canvas=${lostCanvas === document.querySelector('canvas')}`), { once: true });
    extension.restoreContext();
  }
  return <><section aria-label="Local recovery verification" style={{ padding: 16, borderBottom: '1px solid #445', background: '#111827' }}>
    <h1 style={{fontSize:18}}>Local recovery verification</h1>
    <div className="actions"><button onClick={lose}>Lose WebGL</button><button onClick={restore}>Restore WebGL</button>
    <button onClick={() => { blocked=true; setMessage('API requests blocked; use Refresh snapshot in the app'); }}>Block API</button>
    <button onClick={() => { blocked=false; setMessage('API requests enabled; automatic retry or Refresh snapshot should recover'); }}>Restore API</button>
    <button onClick={() => setMessage(`Canvas instances currently=${document.querySelectorAll('canvas').length}; added since page load=${canvasAdds}`)}>Inspect canvas count</button>
    <button onClick={() => { setGeneration(n=>n+1); setMessage('App remounted; wait for catalogue'); }}>Remount app</button></div><p role="status">{message}</p>
  </section><App key={generation}/></>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
