import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.tests.test_science import L1,L2,RECORD,EPOCH

class ApiTests(unittest.TestCase):
    def setUp(self):self.client=TestClient(app)
    def test_health_and_invalid_inputs(self):
        self.assertEqual(self.client.get('/health').status_code,200)
        self.assertEqual(self.client.get('/propagate',params=dict(line1='bad',line2='bad')).status_code,422)
        self.assertEqual(self.client.get('/catalog',params=dict(group='../secret')).status_code,422)
        self.assertEqual(self.client.get('/catalog',params=dict(limit=6001)).status_code,422)
    def test_fixed_time_propagation_and_self_pair(self):
        r=self.client.get('/propagate',params=dict(line1=L1,line2=L2,hours=1,start_time=EPOCH.isoformat()))
        self.assertEqual(r.status_code,200);self.assertEqual(r.json()[0]['time'],EPOCH.isoformat())
        p=dict(line1_a=L1,line2_a=L2,line1_b=L1,line2_b=L2)
        self.assertEqual(self.client.get('/collision-check',params=p).status_code,422)
        p.update(line1_a='bad');self.assertEqual(self.client.get('/collision-check',params=p).status_code,422)
    @patch('backend.app.main.get_catalog')
    def test_catalog_list_compatibility_and_provenance(self,mock):
        mock.return_value=dict(records=[RECORD],source='test fixture',mode='offline',retrieved_at=None)
        r=self.client.get('/catalog').json()
        self.assertEqual(r['metadata']['catalog_count'],1)
        self.assertIsNone(r['objects'][0]['retrieved_at'])
        self.assertEqual(r['objects'][0]['freshness'],'stale')
        self.assertIsInstance(self.client.get('/satellites').json(),list)
    def test_maneuver_zero_and_nonfinite(self):
        p=dict(line1=L1,line2=L2,threat_distance_km=0,event_time=EPOCH.isoformat())
        r=self.client.get('/maneuver-recommend',params=p)
        self.assertEqual(r.status_code,200);self.assertEqual(r.json()['status'],'unvalidated_candidate')
        self.assertIsNone(r.json()['primary']['confidence_score'])
        self.assertIsNone(r.json()['primary']['new_miss_distance_km'])
        p['threat_direction_x']='nan';self.assertEqual(self.client.get('/maneuver-recommend',params=p).status_code,422)
    @patch('backend.app.main.fetch_tle_by_catnr',return_value=None)
    def test_missing_asset(self,mock):
        self.assertEqual(self.client.get('/asset-scan',params=dict(catnr=999999)).status_code,404)

class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import json
        from pathlib import Path
        cls.records = json.loads((Path(__file__).parents[1] / 'data/tle_cache.json').read_text())[:502]

    def setUp(self):
        self.client = TestClient(app)

    def test_valid_pair_real_sgp4(self):
        a, b = self.records[:2]
        params = {f'line{i}_{key}': record[f'line{i}']
                  for key, record in [('a', a), ('b', b)] for i in (1, 2)}
        params.update(hours=1, start_time='2026-06-20T00:00:00Z')
        response = self.client.get('/collision-check', params=params)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['sample_count'], 61)
        self.assertIsNone(result['probability_of_collision'])
        self.assertEqual([p['time'] for p in result['path_a']],
                         [p['time'] for p in result['path_b']])
        import math
        distances = [math.dist(list(a['position_km'].values()), list(b['position_km'].values()))
                     for a, b in zip(result['path_a'], result['path_b'])]
        self.assertAlmostEqual(result['min_distance_km'], min(distances), places=5)

    def test_asset_cap_failures_and_shared_start(self):
        from backend.app.propagator import propagate_satellite
        starts = []
        def propagate(line1, line2, **kwargs):
            starts.append(kwargs['start_time'])
            if line1 == self.records[1]['line1']:
                raise ValueError('Injected candidate state failure')
            return propagate_satellite(line1, line2, **kwargs)
        with patch('backend.app.main.fetch_tle_by_catnr', return_value=self.records[0]), \
             patch('backend.app.main.fetch_tle_data', return_value=self.records), \
             patch('backend.app.main.datetime') as clock, \
             patch('backend.app.main.propagate_satellite', side_effect=propagate):
            from datetime import datetime
            clock.now.return_value = datetime.fromisoformat('2026-06-20T00:00:00+00:00')
            response = self.client.get('/asset-scan', params={'catnr': 900, 'hours': 1})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['attempted_count'], 500)
        self.assertEqual(result['candidate_count'], 501)
        self.assertEqual(result['skipped_count'], 1)
        self.assertTrue(result['truncated'])
        self.assertGreaterEqual(result['failed_count'], 1)
        self.assertEqual(result['scan_count'] + result['failed_count'], 500)
        self.assertEqual(len(set(starts)), 1)

    @patch('backend.app.main.propagate_satellite', side_effect=ValueError('SGP4 state unavailable'))
    def test_propagation_failures_are_not_success(self, propagate):
        a, b = self.records[:2]
        params = {f'line{i}_{key}': record[f'line{i}']
                  for key, record in [('a', a), ('b', b)] for i in (1, 2)}
        self.assertEqual(self.client.get('/collision-check', params=params).status_code, 422)
        self.assertEqual(self.client.get('/propagate', params=a).status_code, 422)
        with patch('backend.app.main.fetch_tle_by_catnr', return_value=a), \
             patch('backend.app.main.fetch_tle_data', return_value=self.records):
            self.assertEqual(self.client.get('/asset-scan', params={'catnr': 900}).status_code, 422)

    @patch('backend.app.main.get_current_position', return_value=None)
    def test_catalog_counts_failed_states(self, position):
        with patch('backend.app.main.get_catalog', return_value={
                'records': self.records[:2], 'source': 'fixture', 'retrieved_at': None}):
            result = self.client.get('/catalog').json()
        self.assertEqual(result['objects'], [])
        self.assertEqual(result['metadata']['propagation_failed'], 2)
