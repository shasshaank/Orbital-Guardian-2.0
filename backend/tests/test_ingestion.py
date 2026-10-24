import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch, Mock
import requests
from backend.app import tle_fetcher as f
from backend.app import catalog_provider as provider
from backend.tests.test_science import RECORD, L1, L2

OMM = json.loads((Path(__file__).parent/'fixtures/omm_vanguard.json').read_text())
# Contemporary synthetic epoch is only for deterministic transport/cache tests.
CURRENT = dict(OMM, EPOCH='2026-10-24T00:00:00Z')


class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        f._memory.clear()
        f._status_memory.clear()
        self.patches = [patch.object(f, 'RUNTIME_DIR', self.root),
                        patch.object(f, 'CACHE_FILE', self.root/'legacy.json'),
                        patch.object(f, 'FALLBACK_FILE', self.root/'fallback.json'),
                        patch.dict('os.environ', {'ORBITAL_OFFLINE': '0'})]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)

    @patch.object(f, 'fetch_json', return_value=[CURRENT])
    def test_live_then_warm_memory_and_disk_are_cache(self, fetch):
        first = f.get_catalog('stations')
        second = f.get_catalog('stations')
        self.assertEqual(first['mode'], 'live')
        self.assertEqual(second['mode'], 'cache')
        self.assertEqual(first['snapshot_id'], second['snapshot_id'])
        self.assertEqual(second['cache_status'], 'fresh')
        self.assertEqual(fetch.call_count, 1)
        f._memory.clear()
        self.assertEqual(f.get_catalog('stations')['mode'], 'cache')
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual(first['accepted_count'], 1)
        self.assertIsNotNone(first['last_successful_refresh'])

    @patch.object(f, 'fetch_json', side_effect=provider.ProviderError('Connection failed'))
    def test_failed_source_preserves_bundle_and_no_group_leak(self, fetch):
        raw = json.dumps([RECORD])
        f.CACHE_FILE.write_text(raw)
        result = f.get_catalog()
        self.assertEqual(result['mode'], 'fallback')
        self.assertEqual(result['cache_status'], 'bundled')
        self.assertIsNone(result['retrieved_at'])
        self.assertTrue(result['is_stale'])
        self.assertEqual(f.CACHE_FILE.read_text(), raw)
        self.assertEqual(f.get_catalog('stations')['mode'], 'unavailable')
        self.assertEqual(f.get_catalog('stations')['records'], [])
        self.assertEqual(fetch.call_count, 2)  # one per distinct group, no storm

    @patch.object(f, 'fetch_json')
    def test_offline_ignores_fresh_cache_and_never_requests(self, fetch):
        f.CACHE_FILE.write_text(json.dumps([RECORD]))
        with patch.dict('os.environ', {'ORBITAL_OFFLINE': '1'}):
            result = f.get_catalog()
        self.assertEqual(result['mode'], 'offline')
        self.assertIsNone(result['retrieved_at'])
        fetch.assert_not_called()

    @patch.object(f, 'fetch_json', side_effect=provider.ProviderError('Bad JSON'))
    def test_corrupt_cache_and_invalid_bundle_are_unavailable(self, fetch):
        f.CACHE_FILE.write_text('not json')
        f.FALLBACK_FILE.write_text('[{"line1":"bad","line2":"bad"}]')
        self.assertEqual(f.get_catalog()['records'], [])
        self.assertEqual(f.get_catalog()['mode'], 'unavailable')

    def expire(self, group):
        path, status_path = f._paths(group)
        data = json.loads(path.read_text())
        data['retrieved_at'] = (datetime.now(timezone.utc)-timedelta(hours=3)).isoformat()
        f._persist(path, data)
        status_path.write_text('{}')
        f._memory.clear()
        f._status_memory.clear()
        return path

    @patch.object(f, 'fetch_json', return_value=[CURRENT])
    def test_malformed_refresh_preserves_snapshot_and_counts_rejections(self, fetch):
        initial = f.get_catalog('stations')
        path = self.expire('stations')
        original = path.read_bytes()
        fetch.return_value = [CURRENT, dict(CURRENT, MEAN_MOTION='NaN')]
        result = f.get_catalog('stations')
        self.assertEqual(path.read_bytes(), original)
        self.assertEqual(result['snapshot_id'], initial['snapshot_id'])
        self.assertEqual(result['cache_status'], 'stale')
        self.assertEqual(result['last_rejected_records'], 1)
        self.assertIn('previous snapshot retained', result['last_error'])
        f._memory.clear()
        f._status_memory.clear()
        f.get_catalog('stations')
        self.assertEqual(fetch.call_count, 2)  # cooldown persisted across restart

    @patch.object(f, 'fetch_json', return_value=[CURRENT])
    def test_http_failure_preserves_valid_data_and_blocks_until_operator_review(self, fetch):
        f.get_catalog('stations')
        path = self.expire('stations')
        original = path.read_bytes()
        fetch.side_effect = provider.ProviderError('HTTP 403', status=403, blocked=True)
        result = f.get_catalog('stations')
        self.assertTrue(result['refresh_blocked'])
        self.assertEqual(path.read_bytes(), original)
        f._memory.clear()
        f._status_memory.clear()
        f.get_catalog('stations')
        self.assertEqual(fetch.call_count, 2)

    @patch.object(f, 'fetch_json', return_value=[CURRENT])
    def test_concurrent_threads_only_retrieve_once(self, fetch):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: f.get_catalog('stations'), range(4)))
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual(len({r['snapshot_id'] for r in results}), 1)
        self.assertEqual(sum(r['mode'] == 'live' for r in results), 1)

    @patch.object(f, 'fetch_json', return_value=[CURRENT])
    def test_warm_reads_reuse_validation_but_detect_atomic_replacement(self, fetch):
        f.get_catalog('stations')
        f.get_catalog('stations')  # populate parsed disk cache
        with patch.object(f, 'validate_omm_records', wraps=f.validate_omm_records) as validate:
            f.get_catalog('stations')
            validate.assert_not_called()
            path, _ = f._paths('stations')
            payload = json.loads(path.read_text())
            payload['records'][0]['omm']['OBJECT_NAME'] = 'CHANGED'
            f._persist(path, payload)
            self.assertEqual(f.get_catalog('stations')['records'][0]['name'], 'CHANGED')
            validate.assert_called_once()

    def test_separate_processes_share_refresh_lock(self):
        import multiprocessing
        import time
        context = multiprocessing.get_context('fork')  # supported Linux/macOS runtime
        journal = self.root/'requests.txt'
        results = context.Queue()

        def fetch(url, group):
            with journal.open('a') as file:
                file.write('fetch\n')
            time.sleep(0.1)
            return [CURRENT]

        def worker():
            f._memory.clear()
            f._status_memory.clear()
            with patch.object(f, 'fetch_json', side_effect=fetch):
                results.put(f.get_catalog('stations')['snapshot_id'])

        processes = [context.Process(target=worker) for _ in range(2)]
        for process in processes:
            process.start()
        for process in processes:
            process.join(5)
            if process.is_alive():
                process.terminate()
                process.join()
                self.fail('Refresh-lock test exceeded five seconds.')
            self.assertEqual(process.exitcode, 0)
        self.assertEqual(journal.read_text(), 'fetch\n')
        self.assertEqual(results.get(timeout=1), results.get(timeout=1))
        results.close()

    def test_deduplication_uses_epoch_and_is_order_independent(self):
        older = dict(CURRENT, EPOCH='2026-10-23T00:00:00Z')
        newer = dict(CURRENT, OBJECT_NAME='LATEST')
        a, rejected, duplicates = f.validate_omm_records([older, newer, CURRENT])
        b, _, _ = f.validate_omm_records([CURRENT, newer, older])
        self.assertEqual(a, b)
        self.assertEqual((len(a), rejected, duplicates), (1, 0, 2))
        self.assertEqual(a[0]['omm']['EPOCH'], '2026-10-24T00:00:00+00:00')

    @patch.object(f, 'fetch_json', return_value=[CURRENT])
    def test_provider_namespace_and_groups_are_isolated(self, fetch):
        f.get_catalog('stations')
        with patch.object(f, 'BASE_URL', 'https://example.org/gp.php'):
            f.get_catalog('stations')
        self.assertEqual(fetch.call_count, 2)
        with self.assertRaises(ValueError):
            f.get_catalog('../secret')
        with self.assertRaises(ValueError):
            f.get_catalog('arbitrary-query')

    @patch.object(f, 'fetch_json', return_value=[CURRENT])
    @patch.object(f, 'get_current_position', return_value=None)
    def test_unpropagatable_snapshot_does_not_replace_cache(self, position, fetch):
        self.assertEqual(f.get_catalog('stations')['mode'], 'unavailable')
        self.assertFalse(f._paths('stations')[0].exists())

    @patch.object(f, 'fetch_json', return_value=[CURRENT])
    def test_persistence_failure_keeps_newest_memory_snapshot_without_refetch(self, fetch):
        first = f.get_catalog('stations')
        self.expire('stations')
        persist = f._persist

        def fail_snapshot(path, payload):
            if path == f._paths('stations')[0]:
                raise OSError('disk full')
            return persist(path, payload)

        fetch.return_value = [dict(CURRENT, OBJECT_NAME='NEWEST')]
        with patch.object(f, '_persist', side_effect=fail_snapshot):
            refreshed = f.get_catalog('stations')
        warm = f.get_catalog('stations')
        self.assertNotEqual(refreshed['snapshot_id'], first['snapshot_id'])
        self.assertEqual(warm['snapshot_id'], refreshed['snapshot_id'])
        self.assertEqual(warm['records'][0]['name'], 'NEWEST')
        self.assertEqual(warm['mode'], 'cache')
        self.assertIn('could not be persisted', warm['last_error'])
        self.assertEqual(fetch.call_count, 2)

    def test_atomic_write_failure_preserves_file(self):
        path = self.root/'snapshot.json'
        path.write_text('{"old": true}')
        with patch.object(f.os, 'replace', side_effect=OSError('read only')):
            with self.assertRaises(OSError):
                f._persist(path, {'new': True})
        self.assertEqual(json.loads(path.read_text()), {'old': True})
        self.assertEqual(list(self.root.iterdir()), [path])


class ProviderTests(unittest.TestCase):
    def response(self, body, status=200, headers=None):
        response = Mock(status_code=status, headers=headers or {})
        response.iter_content.return_value = [body]
        return response

    @patch.object(provider.requests, 'get')
    def test_verified_https_and_explicit_json(self, get):
        get.return_value = self.response(json.dumps([CURRENT]).encode())
        self.assertEqual(provider.fetch_json(f.BASE_URL, 'stations'), [CURRENT])
        options = get.call_args.kwargs
        self.assertEqual(options['params'], {'GROUP': 'stations', 'FORMAT': 'JSON'})
        self.assertNotIn('verify', options)
        self.assertFalse(options['allow_redirects'])
        get.return_value.close.assert_called_once()

    @patch.object(provider.requests, 'get')
    def test_http_errors_are_not_retried_and_retry_after_is_respected(self, get):
        get.return_value = self.response(b'blocked', 429, {'Retry-After': '14400'})
        with self.assertRaises(provider.ProviderError) as caught:
            provider.fetch_json(f.BASE_URL, 'active')
        self.assertEqual(caught.exception.retry_after, 14400)
        self.assertEqual(get.call_count, 1)
        get.return_value = self.response(b'blocked', 403)
        with self.assertRaises(provider.ProviderError) as caught:
            provider.fetch_json(f.BASE_URL, 'active')
        self.assertTrue(caught.exception.blocked)

    @patch.object(provider.time, 'sleep')
    @patch.object(provider.requests, 'get', side_effect=requests.Timeout)
    def test_transport_retry_is_bounded_with_backoff(self, get, sleep):
        with self.assertRaises(provider.ProviderError):
            provider.fetch_json(f.BASE_URL, 'stations')
        self.assertEqual(get.call_count, 2)
        sleep.assert_called_once_with(0.5)

    @patch.object(provider.requests, 'get', side_effect=requests.exceptions.SSLError)
    def test_tls_failure_is_not_retried(self, get):
        with self.assertRaises(provider.ProviderError):
            provider.fetch_json(f.BASE_URL, 'stations')
        self.assertEqual(get.call_count, 1)

    @patch.object(provider.requests, 'get')
    def test_malformed_and_oversize_responses_are_rejected(self, get):
        for body in (b'<html>not JSON</html>', b'{}', b'[]'):
            get.return_value = self.response(body)
            with self.assertRaises(provider.ProviderError):
                provider.fetch_json(f.BASE_URL, 'stations')
        get.return_value = self.response(b'12345')
        with patch.object(provider, 'MAX_BYTES', 4), self.assertRaises(provider.ProviderError):
            provider.fetch_json(f.BASE_URL, 'stations')

    def test_insecure_and_credential_urls_rejected(self):
        for url in ('http://example.org/gp.php', 'https://user:secret@example.org/gp.php', 'https://example.org/?token=secret'):
            with self.assertRaises(ValueError):
                provider.validate_url(url)
