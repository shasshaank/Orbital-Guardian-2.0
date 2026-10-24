"""Native OMM vs independently retained Vallado TLE reference, no live network."""
import json
import unittest
from copy import deepcopy
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app.orbital_data import normalize_omm, satellite_from_elements, record_metadata
from backend.app.propagator import propagate_satellite
from backend.app.main import app
from backend.tests.test_science import L1, L2, EPOCH

OMM = json.loads((Path(__file__).parent/'fixtures/omm_vanguard.json').read_text())


class OmmTests(unittest.TestCase):
    def test_native_omm_matches_tle_positions_and_velocities(self):
        reference = propagate_satellite(L1, L2, hours_ahead=24, step_minutes=60, start_time=EPOCH)
        for identifier in (5, 100001, 339999, 340000, 799500001, 999999999):
            record = dict(OMM, NORAD_CAT_ID=identifier)
            satellite = satellite_from_elements(omm=record)
            self.assertEqual(satellite.satnum, identifier)
            actual = propagate_satellite(omm=record, hours_ahead=24, step_minutes=60, start_time=EPOCH)
            for expected, observed in zip(reference, actual):
                for field in ('position_km', 'velocity_km_s'):
                    for axis in 'xyz':
                        self.assertAlmostEqual(observed[field][axis], expected[field][axis], places=7)
            self.assertEqual(record_metadata({'omm': record}, EPOCH)['norad_id'], identifier)

    def test_required_fields_frames_ranges_and_ids(self):
        for key, value in (('NORAD_CAT_ID', 1000000000), ('NORAD_CAT_ID', 100001.5),
                           ('NORAD_CAT_ID', True), ('NORAD_CAT_ID', 0), ('MEAN_MOTION', float('nan')),
                           ('ECCENTRICITY', 1), ('INCLINATION', 181), ('REF_FRAME', 'ITRF'),
                           ('CENTER_NAME', 'MARS'), ('TIME_SYSTEM', 'TAI'), ('EPHEMERIS_TYPE', 4),
                           ('MEAN_ELEMENT_THEORY', 'SGP4-XP'), ('EPOCH', 'not a date'),
                           ('EPOCH', '2026-10-24'), ('ELEMENT_SET_NO', 10000000000),
                           ('EPHEMERIS_TYPE', False)):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                normalize_omm(dict(OMM, **{key: value}))
        missing = deepcopy(OMM)
        del missing['BSTAR']
        with self.assertRaises(ValueError):
            normalize_omm(missing)
        with self.assertRaises(ValueError):
            satellite_from_elements(L1, L2, OMM)

    def test_omitted_provider_defaults_epoch_precision_and_freshness(self):
        fields = {k: v for k, v in OMM.items() if k not in ('CENTER_NAME', 'REF_FRAME', 'TIME_SYSTEM', 'MEAN_ELEMENT_THEORY')}
        normalized = normalize_omm(fields)
        self.assertTrue(normalized['EPOCH'].endswith('733568+00:00'))
        for at, expected in ((EPOCH-timedelta(microseconds=1), 'future'), (EPOCH, 'recent'),
                             (EPOCH+timedelta(days=7), 'recent'), (EPOCH+timedelta(days=7, seconds=1), 'stale')):
            self.assertEqual(record_metadata({'omm': fields}, at)['freshness'], expected)

    def test_omm_through_catalog_forecast_pair_and_maneuver_contract(self):
        client = TestClient(app)
        a = dict(OMM, NORAD_CAT_ID=100001)
        b = dict(OMM, NORAD_CAT_ID=799500001, MEAN_ANOMALY=20)
        records = [{'name': 'A', 'omm': a}, {'name': 'B', 'omm': b}]
        payload = dict(records=records, source='test OMM fixture', mode='offline', retrieved_at=None)
        with patch('backend.app.main.get_catalog', return_value=payload):
            page = client.get('/catalog', params={'limit': 1, 'offset': 1}).json()
        self.assertEqual(page['objects'][0]['norad_id'], 799500001)
        self.assertEqual(page['objects'][0]['element_format'], 'OMM JSON')
        self.assertIsNone(page['metadata']['next_offset'])
        self.assertEqual(page['metadata']['examined_count'], 1)
        r = client.get('/propagate', params={'omm': json.dumps(a), 'start_time': EPOCH.isoformat(), 'hours': 1})
        self.assertEqual(r.status_code, 200, r.text)
        r = client.get('/collision-check', params={'omm_a': json.dumps(a), 'omm_b': json.dumps(b), 'start_time': EPOCH.isoformat(), 'hours': 1})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['elements_b']['norad_id'], 799500001)
        self.assertEqual(r.json()['sample_count'], 61)
        r = client.get('/maneuver-recommend', params={'omm': json.dumps(a), 'event_time': EPOCH.isoformat(), 'threat_distance_km': 0})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['status'], 'unvalidated_candidate')
        with patch('backend.app.main.fetch_tle_by_catnr', return_value=records[0]), \
             patch('backend.app.main.fetch_tle_data', return_value=records):
            r = client.get('/asset-scan', params={'catnr': 100001, 'hours': 1})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['attempted_count'], 1)
        self.assertEqual(r.json()['asset_elements']['norad_id'], 100001)

    def test_malformed_omm_and_ambiguous_formats_return_422(self):
        client = TestClient(app)
        for fields in ({'omm': '{}'}, {'omm': '{bad'}, {'omm': json.dumps(OMM), 'line1': L1, 'line2': L2}, {}):
            self.assertEqual(client.get('/propagate', params=fields).status_code, 422)
