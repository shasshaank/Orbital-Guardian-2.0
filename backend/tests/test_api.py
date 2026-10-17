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
