"""No provider requests: exercise policy, transport budgets and persisted failure."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch

from backend.app import metadata_refresh as refresh
from backend.app.object_metadata import load_metadata, parse_snapshot
from backend.tests.test_object_metadata import snapshot, source


class RefreshTests(unittest.TestCase):
    def document(self):
        return json.loads(snapshot([source([{'NORAD_CAT_ID': 999999999, 'OBJECT_TYPE': 'PAY'}])]))

    def test_policy_offline_and_repository_guard_never_fetch(self):
        with TemporaryDirectory() as directory, patch.object(refresh, 'fetch_satcat') as fetch:
            with self.assertRaises(ValueError):
                refresh.refresh(directory)
            with self.assertRaises(ValueError):
                refresh.refresh(Path(__file__).parents[2], terms_reviewed=True)
            self.assertEqual(refresh.refresh(directory, terms_reviewed=True, offline=True)['status'], 'offline')
            fetch.assert_not_called()

    def test_concurrent_cli_refresh_downloads_once_and_keeps_full_id(self):
        with TemporaryDirectory() as directory, patch.object(refresh, 'fetch_satcat', return_value=self.document()) as fetch:
            with ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(lambda _: refresh.refresh(directory, terms_reviewed=True), range(4)))
            self.assertTrue(all(result['status'] == 'loaded' for result in results))
            fetch.assert_called_once_with('active')
            with patch.dict(os.environ, {'ORBITAL_METADATA_FILE': str(Path(directory) / 'active.json')}):
                index, metadata = load_metadata()
            self.assertEqual(index[999999999][0]['category'], 'payload')
            self.assertTrue(metadata['is_stale'])

    def test_failed_update_retains_snapshot_and_persists_http_block(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'active.json'
            path.write_text(json.dumps(self.document()))
            before = path.read_bytes()
            with patch.object(refresh, 'fetch_satcat', side_effect=refresh.ProviderError('secret', status=403, blocked=True)) as fetch:
                result = refresh.refresh(directory, terms_reviewed=True)
                self.assertEqual(refresh.refresh(directory, terms_reviewed=True), result)
                fetch.assert_called_once()
            self.assertTrue(result['blocked'])
            self.assertNotIn('secret', json.dumps(result))
            self.assertEqual(path.read_bytes(), before)
            with patch.dict(os.environ, {'ORBITAL_METADATA_FILE': str(path)}):
                self.assertIn('refresh_error', load_metadata()[1])

    def test_invalid_update_status_and_unwritable_coordination_fail_closed(self):
        with TemporaryDirectory() as directory, patch.object(refresh, 'fetch_satcat', return_value={'invalid': True}) as fetch:
            self.assertEqual(refresh.refresh(directory, terms_reviewed=True)['status'], 'failed')
            self.assertFalse((Path(directory) / 'active.json').exists())
            (Path(directory) / 'active.status.json').write_text('{broken')
            self.assertEqual(refresh.refresh(directory, terms_reviewed=True)['status'], 'blocked')
            fetch.assert_called_once()
        with patch.object(refresh, '_persist', side_effect=OSError), patch.object(refresh, 'fetch_satcat') as fetch:
            with TemporaryDirectory() as directory:
                self.assertEqual(refresh.refresh(directory, terms_reviewed=True)['status'], 'blocked')
            fetch.assert_not_called()

    def test_transport_validates_tls_redirect_size_time_and_retry_after(self):
        response = Mock(status_code=200, headers={})
        raw = b'[{"NORAD_CAT_ID":999999999,"OBJECT_TYPE":"R/B"}]'
        response.iter_content.return_value = [raw]
        with patch.object(refresh.requests, 'get', return_value=response) as get:
            document = refresh.fetch_satcat('active')
            index, _ = parse_snapshot(json.dumps(document).encode())
            self.assertEqual(index[999999999][0]['category'], 'rocket_body')
            self.assertEqual(len(index[999999999][0]['content_sha256']), 64)
            self.assertFalse(get.call_args.kwargs['allow_redirects'])
            self.assertNotIn('verify', get.call_args.kwargs)  # Requests default verifies TLS.
        for code in [302, 403, 429, 500]:
            response.status_code = code
            response.headers = {'Retry-After': '90000'}
            with patch.object(refresh.requests, 'get', return_value=response), self.assertRaises(refresh.ProviderError) as raised:
                refresh.fetch_satcat('active')
            self.assertEqual(raised.exception.retry_after, 90000)
            self.assertTrue(raised.exception.blocked)
        response.status_code = 200
        with ExitStack() as stack:
            stack.enter_context(patch.object(refresh.requests, 'get', return_value=response))
            stack.enter_context(patch.object(refresh, 'MAX_BYTES', 2))
            with self.assertRaises(refresh.ProviderError):
                refresh.fetch_satcat('active')
        with patch.object(refresh.requests, 'get', side_effect=refresh.requests.exceptions.SSLError('secret')):
            with self.assertRaisesRegex(refresh.ProviderError, 'verified HTTPS'):
                refresh.fetch_satcat('active')

