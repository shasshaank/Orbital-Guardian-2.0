import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
from backend.app import tle_fetcher as f
from backend.tests.test_science import RECORD,L1,L2
import requests

class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);f._memory.clear()
        self.patches=[patch.object(f,'RUNTIME_DIR',self.root),patch.object(f,'CACHE_FILE',self.root/'legacy.json'),
                      patch.object(f,'FALLBACK_FILE',self.root/'fallback.json'),patch.dict('os.environ',{'ORBITAL_OFFLINE':'0'})]
        for p in self.patches:p.start();self.addCleanup(p.stop)
    @patch.object(f.requests,'get')
    def test_verified_tls_group_and_warm_cache(self,get):
        get.return_value=Mock(text='VANGUARD\n'+L1+'\n'+L2)
        first=f.get_catalog('stations');second=f.get_catalog('stations')
        self.assertEqual(first,second);self.assertEqual(get.call_count,1)
        self.assertEqual(get.call_args.kwargs['params']['GROUP'],'stations')
        self.assertNotIn('verify',get.call_args.kwargs)
        self.assertTrue((self.root/'stations.json').exists())
        f._memory.clear();self.assertEqual(f.get_catalog('stations')['mode'],'cache')
        self.assertEqual(get.call_count,1)
    @patch.object(f.requests,'get',side_effect=requests.ConnectionError)
    def test_failed_source_preserves_legacy_and_no_group_leak(self,get):
        raw=json.dumps([RECORD]);f.CACHE_FILE.write_text(raw)
        self.assertEqual(f.get_catalog()['mode'],'fallback')
        self.assertIsNone(f.get_catalog()['retrieved_at'])
        self.assertEqual(f.CACHE_FILE.read_text(),raw)
        self.assertEqual(f.get_catalog('stations')['records'],[])
    @patch.object(f.requests,'get',side_effect=requests.ConnectionError)
    def test_corrupt_cache_and_invalid_fallback(self,get):
        f.CACHE_FILE.write_text('not json');f.FALLBACK_FILE.write_text('[{"line1":"bad","line2":"bad"}]')
        self.assertEqual(f.get_catalog()['records'],[])
    @patch.object(f.requests,'get')
    def test_offline_never_requests(self,get):
        f.CACHE_FILE.write_text(json.dumps([RECORD]))
        with patch.dict('os.environ',{'ORBITAL_OFFLINE':'1'}):self.assertEqual(f.get_catalog()['mode'],'offline')
        get.assert_not_called()
