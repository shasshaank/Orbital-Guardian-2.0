import json
import math
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from backend.app.collision_detector import calculate_closest_approach, refine_closest_approach
from backend.app.orbital_data import element_metadata, validated_satellite
from backend.app.propagator import state_at, _teme_to_geodetic
from backend.tests.test_encounters import state
from backend.tests.test_science import EPOCH


class RefinementTests(unittest.TestCase):
    def test_mixed_frame_is_rejected(self):
        a = state(0, [7000, 0, 0], [0, 0, 0])
        with self.assertRaises(ValueError):
            calculate_closest_approach([a], [{**a, 'frame': 'ITRF'}])

    def screen(self, a, b, times):
        aa, bb = [a(EPOCH+timedelta(seconds=t)) for t in times], [b(EPOCH+timedelta(seconds=t)) for t in times]
        return refine_closest_approach(calculate_closest_approach(aa, bb, include_paths=False), aa, bb, a, b)

    def test_between_sample_crossing_and_endpoints(self):
        a = lambda at: state((at-EPOCH).total_seconds(), [7000,0,0], [0,0,0])
        b = lambda at: state((at-EPOCH).total_seconds(), [7000,100-4*(at-EPOCH).total_seconds(),0], [0,-4,0])
        result = self.screen(a,b,[0,60])
        self.assertEqual(result['minimum_sampled_separation_km'],100)
        self.assertLess(result['min_distance_km'],0.05)
        self.assertLess(abs((datetime.fromisoformat(result['closest_event']['time'])-EPOCH).total_seconds()-25),0.02)
        self.assertEqual(result['risk_level'],'CRITICAL')
        for direction in (-1,1):
            b = lambda at: state((at-EPOCH).total_seconds(), [7000,100+direction*(at-EPOCH).total_seconds(),0], [0,direction,0])
            r=self.screen(a,b,[0,60])
            self.assertEqual(r['closest_event']['time'],(EPOCH+timedelta(seconds=60 if direction<0 else 0)).isoformat())

    def test_multiple_local_minima(self):
        a=lambda at: state((at-EPOCH).total_seconds(),[7000,0,0],[0,0,0])
        def b(at):
            t=(at-EPOCH).total_seconds()
            return state(t,[7000,100*math.cos(t*math.pi/60),2],[0,-100*math.pi/60*math.sin(t*math.pi/60),0])
        r=self.screen(a,b,[0,60,120,180])
        self.assertEqual(r['refinement']['candidate_intervals'],3)
        self.assertAlmostEqual(r['min_distance_km'],2,delta=0.001)

    def test_failed_refinement_is_not_safe(self):
        a=lambda at: state((at-EPOCH).total_seconds(),[7000,0,0],[0,0,0])
        b=lambda at: state((at-EPOCH).total_seconds(),[7000,100-4*(at-EPOCH).total_seconds(),0],[0,-4,0])
        aa,bb=[a(EPOCH),a(EPOCH+timedelta(seconds=60))],[b(EPOCH),b(EPOCH+timedelta(seconds=60))]
        def failed(at): raise ValueError('state failed')
        with self.assertRaises(ValueError): refine_closest_approach(calculate_closest_approach(aa,bb),aa,bb,failed,b)


class RegimeTests(unittest.TestCase):
    def test_equal_instants_with_different_utc_offsets(self):
        from backend.tests.test_science import L1, L2
        sat = validated_satellite(L1, L2)
        at = datetime.fromisoformat('2000-06-28T00:20:19.733568+05:30')
        self.assertEqual(state_at(sat, at), state_at(sat, EPOCH))

    def test_published_vallado_vectors_all_regimes(self):
        cases=json.loads((Path(__file__).parent/'fixtures/vallado_regimes.json').read_text())['cases']
        self.assertEqual({c['case'] for c in cases},{'LEO','polar','eccentric','GEO'})
        for case in cases:
            epoch=datetime.fromisoformat(element_metadata(case['line1'],case['line2'])['epoch'])
            sat=validated_satellite(case['line1'],case['line2'])
            for ref in case['states']:
                at=epoch+timedelta(minutes=ref['minutes'])
                actual=state_at(sat,at)
                for k,v in zip('xyz',ref['position']): self.assertAlmostEqual(actual['position_km'][k],v,delta=2e-5)
                for k,v in zip('xyz',ref['velocity']): self.assertAlmostEqual(actual['velocity_km_s'][k],v,delta=2e-8)
                # Independent WGS84 forward reconstruction checks the inverse
                # geodetic solve against direct TEME->rotating Cartesian math.
                from sgp4.api import jday
                from sgp4.propagation import gstime
                jd,fr=jday(at.year,at.month,at.day,at.hour,at.minute,at.second+at.microsecond/1e6)
                theta=gstime(jd+fr)
                x,y,z=[actual['position_km'][k] for k in 'xyz']
                expected=(math.cos(theta)*x+math.sin(theta)*y,-math.sin(theta)*x+math.cos(theta)*y,z)
                lat,lon,h=_teme_to_geodetic(x,y,z,at); phi,lam=math.radians(lat),math.radians(lon)
                n=6378.137/math.sqrt(1-0.00669437999014*math.sin(phi)**2)
                reconstructed=((n+h)*math.cos(phi)*math.cos(lam),(n+h)*math.cos(phi)*math.sin(lam),(n*(1-0.00669437999014)+h)*math.sin(phi))
                self.assertLess(math.dist(expected,reconstructed),1e-6)
