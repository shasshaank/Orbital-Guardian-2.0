"""Start one local API and Vite together; fail visibly instead of reusing stale servers."""
import os
import errno
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def check_port(port):
    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(('127.0.0.1', port))
        except OSError as exc:
            if exc.errno in (errno.EACCES, errno.EPERM):
                raise RuntimeError(f'Permission denied binding local port {port}. Allow this command to run a local server.') from exc
            raise RuntimeError(f'Port {port} is occupied. Stop the existing Orbital Guardian service (lsof -nP -iTCP:{port} -sTCP:LISTEN), then run ./dev again.') from exc


def main():
    def stop(signum, frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    processes = []
    try:
        from dotenv import load_dotenv
        load_dotenv(ROOT / 'backend/.env')
        for port in (8000, 3000):
            check_port(port)
        if not (ROOT / 'frontend/node_modules/.bin/vite').exists():
            raise RuntimeError('Frontend dependencies are missing. Run npm ci --prefix frontend.')
        env = dict(os.environ)
        # Offline demonstrations remain explicit; normal runs use provider/cache policy.
        if not env.get('ORBITAL_METADATA_FILE'):
            print('SATCAT: not configured. Set ORBITAL_METADATA_FILE in backend/.env; see README.', flush=True)
        api = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '8000'], cwd=ROOT, env=env)
        processes.append(api)
        for _ in range(100):
            if api.poll() is not None:
                raise RuntimeError('API exited during startup. Read the backend error above.')
            try:
                with urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=.5) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('API health did not become ready on port 8000.')
        processes.append(subprocess.Popen(['npm', 'start', '--', '--force'], cwd=ROOT / 'frontend', env=env, start_new_session=True))
        print('Orbital Guardian: http://127.0.0.1:3000 (API: 127.0.0.1:8000; browser proxy: /api)', flush=True)
        while True:
            for process in processes:
                if process.poll() is not None:
                    raise RuntimeError(f'A service exited ({process.returncode}). Both services are stopping; read its log above.')
            time.sleep(.25)
    except KeyboardInterrupt:
        return 0
    except (RuntimeError, OSError, ImportError) as exc:
        print(f'Startup failed: {exc}', file=sys.stderr, flush=True)
        return 1
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                if process is processes[0]:
                    process.terminate()
                else:
                    os.killpg(process.pid, signal.SIGTERM)
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == '__main__':
    raise SystemExit(main())
