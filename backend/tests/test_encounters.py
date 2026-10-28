"""Independent scalar math references for the sampled vector kernel."""
import json
import math
import random
import unittest
from copy import deepcopy
from datetime import timedelta
from pathlib import Path
from backend.tests.test_science import EPOCH, L1, L2
from backend.app.collision_detector import calculate_closest_approach
from backend.app.propagator import propagate_satellite


def state(t, position, velocity):
    return dict(time=(EPOCH+timedelta(seconds=t)).isoformat(),
                position_km=dict(zip('xyz', position)), velocity_km_s=dict(zip('xyz', velocity)),
                lat=0., lon=0., alt_km=622.)


class EncounterTests(unittest.TestCase):
    def test_analytic_corpus_and_dense_reference(self):
        cases = json.loads((Path(__file__).parent/'fixtures/encounters.json').read_text())['cases']
        for case in cases:
            with self.subTest(case=case['name']):
                r, v = case['r'], case['v']
                speed2 = sum(x*x for x in v)
                tca = max(0, min(case['duration'], -sum(x*y for x,y in zip(r,v))/speed2)) if speed2 else 0
                distance = lambda t: math.sqrt(sum((x+y*t)**2 for x,y in zip(r,v)))
                self.assertAlmostEqual(tca, case['continuous_time'])
                self.assertAlmostEqual(distance(tca), case['continuous_distance'])
                times = range(0, case['duration']+1, case['step'])
                a = [state(t, [7000,0,0], [0,0,0]) for t in times]
                b = [state(t, [7000+r[0]+v[0]*t,r[1]+v[1]*t,r[2]+v[2]*t], v) for t in times]
                result = calculate_closest_approach(a,b)
                self.assertAlmostEqual(result['min_distance_km'],case['sampled_distance'],places=6)
                dense = min(distance(i/100) for i in range(case['duration']*100+1))
                self.assertAlmostEqual(dense,distance(tca),places=6)
                self.assertGreaterEqual(result['min_distance_km']+1e-6,dense)
                if case['name'] == 'between-sample crossing':
                    self.assertEqual(result['risk_level'], 'WARNING')
                    self.assertEqual(distance(tca),0)  # sampling misses the collision

    def test_scalar_exhaustive_reference(self):
        rng = random.Random(42)
        a, b = [], []
        for i in range(2000):
            a.append(state(i,[rng.uniform(-8000,8000) for _ in range(3)],[rng.uniform(-8,8) for _ in range(3)]))
            b.append(state(i,[rng.uniform(-8000,8000) for _ in range(3)],[rng.uniform(-8,8) for _ in range(3)]))
        distances = [math.dist([pa['position_km'][k] for k in 'xyz'],[pb['position_km'][k] for k in 'xyz']) for pa,pb in zip(a,b)]
        result = calculate_closest_approach(a,b,include_paths=False)
        self.assertEqual(result['min_distance_km'],round(min(distances),6))
        self.assertEqual(result['closest_event']['time'],a[distances.index(min(distances))]['time'])
        for actual, expected in zip(result['separation_km'],distances):
            self.assertAlmostEqual(actual,expected,places=10)

    def test_named_velocity_axes_and_invalid_velocity(self):
        a = propagate_satellite(L1,L2,1,start_time=EPOCH)
        b = deepcopy(a)
        for p in b:
            p['velocity_km_s'] = {k:p['velocity_km_s'][k] for k in 'zyx'}
        self.assertEqual(calculate_closest_approach(a,b)['closest_event']['relative_velocity_km_s'],0)
        b[-1]['velocity_km_s']['x'] = float('nan')
        with self.assertRaises(ValueError): calculate_closest_approach(a,b)

    def test_compact_api_matches_legacy(self):
        from fastapi.testclient import TestClient
        from backend.app.main import app
        from backend.tests.test_omm import OMM
        # Distinct full IDs with identical dynamics are valid geometric zero-separation input.
        a, b = dict(OMM), dict(OMM)
        b['NORAD_CAT_ID'] = 999999999
        params = dict(omm_a=json.dumps(a),omm_b=json.dumps(b),hours=1,start_time=EPOCH.isoformat())
        client = TestClient(app)
        full = client.get('/collision-check',params=params)
        compact = client.get('/collision-check',params={**params,'include_paths':'false'})
        self.assertEqual(full.status_code,200)
        self.assertEqual(compact.status_code,200)
        f,c = full.json(),compact.json()
        self.assertEqual(f['closest_event'],c['closest_event'])
        self.assertEqual(c['separation_km'],[0]*61)
        self.assertNotIn('path_a',c)
        self.assertLess(len(compact.content),len(full.content)/3)
