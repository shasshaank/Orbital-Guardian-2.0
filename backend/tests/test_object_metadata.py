"""Synthetic SATCAT fixtures only; no provider download or real metadata."""
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.object_metadata import parse_snapshot, classification_for, load_metadata, MAX_BYTES
from backend.tests.test_science import RECORD


def source(records, provider='celestrak_satcat'):
    return dict(provider=provider, retrieved_at='2026-01-01T00:00:00Z', records=records,
                source_url=('https://celestrak.org/satcat/records.php?GROUP=active&FORMAT=JSON'
                            if provider == 'celestrak_satcat' else
                            'https://www.space-track.org/basicspacedata/query/class/satcat/format/json'))


def snapshot(sources):
    return json.dumps(dict(schema_version=1, sources=sources)).encode()


class MetadataTests(unittest.TestCase):
    def classify(self, sources, identifier=100001):
        index, metadata = parse_snapshot(snapshot(sources))
        return classification_for(identifier, index, metadata)

    def test_normalized_id_and_separate_status_security(self):
        result = self.classify([source([dict(NORAD_CAT_ID='000025544', OBJECT_TYPE='PAY',
                                            OPS_STATUS_CODE='-', CLASSIFICATION_TYPE='S')])], 25544)
        self.assertEqual(result['category'], 'payload')
        self.assertEqual(result['evidence'][0]['norad_id'], 25544)
        self.assertNotIn('operational_status', result)
        self.assertNotIn('security_classification', result)
        missing = classification_for(1, {}, {'status': 'not_configured'})
        self.assertIn('No SATCAT import', missing['explanation'])

    def test_vocabularies_full_ids_and_original_evidence(self):
        for provider, codes in [('celestrak_satcat', ['PAY', 'R/B', 'DEB']),
                                ('space_track_satcat', ['PAYLOAD', 'ROCKET BODY', 'DEBRIS'])]:
            for code, category in zip(codes, ['payload', 'rocket_body', 'debris']):
                for identifier in [100001, 999999999]:
                    result = self.classify([source([dict(NORAD_CAT_ID=str(identifier), OBJECT_TYPE=code)], provider)], identifier)
                    self.assertEqual(result['norad_id'], identifier)
                    self.assertEqual(result['category'], category)
                    self.assertEqual(result['status'], 'confirmed')
                    self.assertEqual(result['evidence'][0]['original_type'], code)
                    self.assertEqual(result['evidence'][0]['retrieved_at'], '2026-01-01T00:00:00+00:00')
                    self.assertEqual(len(result['snapshot_id']), 64)

    def test_missing_mismatched_and_unsupported_types_never_infer(self):
        for code in [None, '', 'UNK', 'UNKNOWN', 'OTHER', 'TBA', 'operational', 'pay']:
            result = self.classify([source([dict(NORAD_CAT_ID=100001, OBJECT_TYPE=code,
                                                OBJECT_NAME='DEB', CLASSIFICATION_TYPE='U')])])
            self.assertEqual(result['category'], 'unknown')
            self.assertEqual(result['status'], 'unknown')
        result = self.classify([source([dict(NORAD_CAT_ID=100002, OBJECT_TYPE='PAY')])])
        self.assertEqual(result['status'], 'missing')
        self.assertEqual(result['evidence'], [])

    def test_conflicts_duplicates_and_order_independence(self):
        a = source([dict(NORAD_CAT_ID=100001, OBJECT_TYPE='PAY')])
        b = source([dict(NORAD_CAT_ID=100001, OBJECT_TYPE='DEBRIS')], 'space_track_satcat')
        for sources in [[a, b], [b, a]]:
            result = self.classify(sources)
            self.assertEqual((result['category'], result['status']), ('unknown', 'conflict'))
            self.assertEqual(len(result['evidence']), 2)
        self.assertEqual(self.classify([a, a])['status'], 'confirmed')
        b['records'][0]['OBJECT_TYPE'] = None
        self.assertEqual(self.classify([a, b])['status'], 'conflict')
        a['records'].append(dict(NORAD_CAT_ID=100001, OBJECT_TYPE='DEB'))
        self.assertEqual(self.classify([a])['status'], 'conflict')

    def test_invalid_ids_and_provenance_reject_whole_import(self):
        for identifier in [True, 1.5, 0, -1, 1000000000, '１２３', '1e6']:
            with self.assertRaises(ValueError):
                parse_snapshot(snapshot([source([dict(NORAD_CAT_ID=identifier, OBJECT_TYPE='PAY')])]))
        for changes in [dict(provider='unverified'), dict(retrieved_at='2026-01-01'),
                        dict(retrieved_at='2999-01-01T00:00:00Z'),
                        dict(source_url='http://celestrak.org/satcat'),
                        dict(source_url='https://user:secret@celestrak.org/satcat'),
                        dict(source_url='https://celestrak.org/satcat?token=secret')]:
            with self.assertRaises((ValueError, KeyError)):
                parse_snapshot(snapshot([{**source([]), **changes}]))
        with self.assertRaises(ValueError):
            parse_snapshot(b' ' * (MAX_BYTES + 1))

    def test_configuration_reload_failure_and_no_path_disclosure(self):
        with patch.dict(os.environ, {'ORBITAL_METADATA_FILE': ''}):
            self.assertEqual(load_metadata()[1]['status'], 'not_configured')
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'private-metadata.json'
            with patch.dict(os.environ, {'ORBITAL_METADATA_FILE': str(path)}):
                self.assertEqual(load_metadata()[1]['status'], 'unavailable')
                path.write_bytes(snapshot([source([dict(NORAD_CAT_ID=100001, OBJECT_TYPE='PAY')])]))
                index, metadata = load_metadata()
                self.assertEqual(classification_for(100001, index, metadata)['category'], 'payload')
                path.write_text('{invalid')
                index, metadata = load_metadata()
                self.assertEqual(index, {})
                self.assertEqual(metadata['status'], 'unavailable')
                self.assertNotIn(directory, json.dumps(metadata))

    def test_api_join_overrides_untrusted_embedded_classification(self):
        from backend.app.orbital_data import record_metadata
        identifier = record_metadata(RECORD)['norad_id']
        index, metadata = parse_snapshot(snapshot([source([dict(NORAD_CAT_ID=identifier, OBJECT_TYPE='R/B')])]))
        record = {**RECORD, 'classification': {'category': 'payload', 'status': 'confirmed'}}
        with patch('backend.app.main.get_catalog', return_value=dict(records=[record], source='fixture', retrieved_at=None)), \
             patch('backend.app.main.load_metadata', return_value=(index, metadata)):
            client = TestClient(app)
            result = client.get('/catalog').json()
            self.assertEqual(result['objects'][0]['classification']['category'], 'rocket_body')
            self.assertEqual(result['metadata']['classification_metadata']['status'], 'loaded')
            self.assertEqual(client.get('/satellites').json()[0]['classification']['norad_id'], identifier)
        with patch('backend.app.main.get_catalog', return_value=dict(records=[record], source='fixture', retrieved_at=None)), \
             patch('backend.app.main.load_metadata', return_value=({}, {'status': 'unavailable'})):
            result = TestClient(app).get('/catalog').json()
            self.assertEqual(result['objects'][0]['classification']['status'], 'unavailable')
            self.assertEqual(result['objects'][0]['classification']['category'], 'unknown')

    def test_api_join_native_omm_full_ids_and_no_name_matching(self):
        from backend.tests.test_omm import OMM
        records = [dict(name='SAME DEB NAME', omm={**OMM, 'NORAD_CAT_ID': identifier})
                   for identifier in (100001, 999999999)]
        index, metadata = parse_snapshot(snapshot([source([dict(NORAD_CAT_ID='999999999', OBJECT_TYPE='PAY')])]))
        with patch('backend.app.main.get_catalog', return_value=dict(records=records, source='fixture', retrieved_at=None)), \
             patch('backend.app.main.load_metadata', return_value=(index, metadata)), \
             patch('backend.app.main.get_current_position', return_value={'lat': 0, 'lon': 0, 'alt_km': 500}):
            result = TestClient(app).get('/catalog').json()['objects']
        self.assertEqual(result[0]['classification']['status'], 'missing')
        self.assertEqual(result[1]['classification']['category'], 'payload')
        self.assertEqual(result[1]['classification']['norad_id'], 999999999)
