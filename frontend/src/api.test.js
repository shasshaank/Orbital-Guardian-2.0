import { request, API_URL } from './api';
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
test('development requests use the same-origin proxy and network failures are actionable', async () => {
  expect(API_URL).toBe('/api');
  global.fetch=vi.fn(async()=>{throw new TypeError('Failed to fetch');});
  await expect(request('/catalog')).rejects.toThrow('Start both services with ./dev');
  expect(fetch.mock.calls[0][0]).toBe('/api/catalog?');
});
test('proxy failures and malformed contracts remain failures', async () => {
  global.fetch=vi.fn(async()=>({ok:false,status:502,json:async()=>{throw new Error('html');}}));
  await expect(request('/health')).rejects.toThrow('API service unavailable (502)');
});
test('hung requests time out and explicit cancellation stays an AbortError', async () => {
  vi.useFakeTimers();
  global.fetch=vi.fn((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
  const pending=request('/catalog');
  const expected=expect(pending).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(45000); await expected;
  const controller=new AbortController(); const cancelled=request('/health',{},controller.signal);
  controller.abort(); await expect(cancelled).rejects.toHaveProperty('name','AbortError');
});
