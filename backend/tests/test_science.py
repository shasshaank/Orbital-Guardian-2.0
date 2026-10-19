import unittest
from datetime import datetime, timezone, timedelta
from sgp4.propagation import gstime
from sgp4.api import jday
from backend.app.orbital_data import validated_satellite, element_metadata
from backend.app.propagator import propagate_satellite, _teme_to_geodetic
from backend.app.collision_detector import calculate_closest_approach
from backend.app.tle_fetcher import validate_records, parse_tle

# Vallado SGP4 verification case 00005, published in SGP4-VER.TLE / tcppver.out.
L1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753'
L2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667'
EPOCH = datetime(2000, 6, 27, 18, 50, 19, 733568, tzinfo=timezone.utc)
RECORD = dict(name='VANGUARD reference', line1=L1, line2=L2)

class ScienceTests(unittest.TestCase):
    def test_vallado_epoch_and_six_hours(self):
        paths = propagate_satellite(L1,L2,hours_ahead=6,step_minutes=60,start_time=EPOCH)
        for state, expected in [(paths[0],(7022.46529266,-1400.08296755,0.03995155)),
                                (paths[-1],(-7154.03120202,-3783.17682504,-3536.19412294))]:
            for actual, ref in zip(state['position_km'].values(), expected):
                self.assertAlmostEqual(actual,ref,delta=0.00002) # 2 cm, numerical not orbit accuracy
        self.assertEqual(len(paths),7)
        for actual,ref in zip(paths[0]['velocity_km_s'].values(),(1.893841015,6.405893759,4.534807250)):
            self.assertAlmostEqual(actual,ref,delta=2e-8)

    def test_identical_grid_and_zero_distance(self):
        paths=propagate_satellite(L1,L2,hours_ahead=1,start_time=EPOCH)
        result=calculate_closest_approach(paths,paths)
        self.assertEqual(result['min_distance_km'],0)
        self.assertEqual(result['risk_level'],'CRITICAL')
        self.assertEqual(result['closest_event']['relative_velocity_km_s'],0)

    def test_grid_mismatch_rejected(self):
        a=propagate_satellite(L1,L2,hours_ahead=1,start_time=EPOCH)
        b=propagate_satellite(L1,L2,hours_ahead=1,start_time=EPOCH+timedelta(seconds=1))
        with self.assertRaises(ValueError):calculate_closest_approach(a,b)
        with self.assertRaises(ValueError):calculate_closest_approach(a,a[:-1])

    def test_unavailable_not_safe(self):
        result=calculate_closest_approach([],[])
        self.assertEqual(result['risk_level'],'UNKNOWN')
        self.assertIsNone(result['min_distance_km'])

    def test_bad_tle(self):
        for a,b in [('bad','bad'),(L1[:-1]+'0',L2),(L1,L2.replace('00005','00006'))]:
            with self.assertRaises(ValueError):validated_satellite(a,b)

    def test_utc_required(self):
        with self.assertRaises(ValueError):propagate_satellite(L1,L2,start_time=EPOCH.replace(tzinfo=None))

    def test_wgs84_equator_pole_and_rotation(self):
        jd,fr=jday(2000,1,1,12,0,0);theta=gstime(jd+fr)
        import math
        at=datetime(2000,1,1,12,tzinfo=timezone.utc)
        lat,lon,alt=_teme_to_geodetic(6378.137*math.cos(theta),6378.137*math.sin(theta),0,at)
        self.assertAlmostEqual(lat,0,places=8);self.assertAlmostEqual(lon,0,places=8);self.assertAlmostEqual(alt,0,places=8)
        lat,lon,alt=_teme_to_geodetic(0,0,6356.752314245,at)
        self.assertAlmostEqual(lat,90);self.assertAlmostEqual(alt,0,places=6)
        lon0=_teme_to_geodetic(7000,0,0,at)[1]
        lon1=_teme_to_geodetic(7000,0,0,at+timedelta(hours=6))[1]
        self.assertAlmostEqual((lon0-lon1)%360,90.2464,delta=0.001)

    def test_metadata_and_ingest(self):
        meta=element_metadata(L1,L2,EPOCH)
        self.assertEqual(element_metadata(L1,L2,EPOCH-timedelta(hours=1))['freshness'],'future')
        self.assertEqual(meta['norad_id'],5);self.assertEqual(meta['epoch_age_days'],0)
        self.assertEqual(element_metadata(L1,L2,EPOCH+timedelta(days=8))['freshness'],'stale')
        records,rejected,duplicates=validate_records([RECORD,RECORD,dict(line1='bad',line2='bad')])
        self.assertEqual((len(records),rejected,duplicates),(1,1,1))
        self.assertEqual(parse_tle('0 VANGUARD\n'+L1+'\n'+L2)[0][0]['name'],'VANGUARD')
        self.assertEqual(len(parse_tle(L1+'\n'+L2)[0]),1)

    def test_distance_bands(self):
        from copy import deepcopy
        p=propagate_satellite(L1,L2,hours_ahead=1,start_time=EPOCH)[:1]
        for d,level in [(9,'CRITICAL'),(10,'WARNING'),(50,'SAFE')]:
            q=deepcopy(p);q[0]['position_km']['x']+=d
            self.assertEqual(calculate_closest_approach(p,q)['risk_level'],level)
        q[0]['position_km']['x']=float('nan')
        with self.assertRaises(ValueError):calculate_closest_approach(p,q)
