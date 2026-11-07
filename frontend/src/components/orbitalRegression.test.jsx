import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { CATEGORIES, categoryCounts, filterCategories } from '../objectSemantics';
import { latLonAltToVec3 } from './SatelliteOrbit';
import { trajectorySegments } from './trajectoryGeometry';
import Catalogue from './Catalogue';
import ObjectInspector from './ObjectInspector';
import { createMarkerMaterial } from './markerRendering';

test('axes, scene kilometres and dateline continuity match the Earth texture convention', () => {
  expect(latLonAltToVec3(0,0,0).toArray()).toEqual([1,0,-0]);
  expect(latLonAltToVec3(0,90,0).z).toBeCloseTo(-1);
  expect(latLonAltToVec3(90,0,0).y).toBeCloseTo(6356.752314245/6378.137);
  expect(latLonAltToVec3(0,0,6378.137).x).toBe(2);
  expect(latLonAltToVec3(0,179.9,400).distanceTo(latLonAltToVec3(0,-179.9,400))).toBeLessThan(.004);
});
test('trajectory gaps and invalid states do not create connecting segments', () => {
  const point=t=>({time:new Date(t*1000).toISOString(),lat:0,lon:0,alt_km:400});
  const path=[point(0),point(120),{...point(240),lat:NaN},point(360),point(480),point(1000),point(1120)];
  expect(trajectorySegments(path).map(s=>s.length)).toEqual([2,2,2]);
  expect(trajectorySegments([point(0),point(0)])).toEqual([]);
});
test('all category filters, loaded counts, materials, catalogue and inspector use one mapping', () => {
  global.IS_REACT_ACT_ENVIRONMENT=true;
  const objects=Object.keys(CATEGORIES).map((category,i)=>({norad_id:i+1,name:'Object',classification:{category,status:'confirmed',source:'SATCAT',norad_id:i+1}}));
  expect(categoryCounts(objects)).toEqual({payload:1,debris:1,rocket_body:1,unknown:1});
  expect(filterCategories(objects,[])).toEqual([]);
  const div=document.createElement('div'), root=createRoot(div);
  for (const [i,[key,category]] of Object.entries(CATEGORIES).entries()) {
    expect(filterCategories(objects,[key])).toEqual([objects[i]]);
    const material=createMarkerMaterial(category.color,i);
    expect(material.uniforms.uColor.value.equals(new THREE.Color(category.color))).toBe(true); material.dispose();
    act(()=>root.render(<><Catalogue objects={[objects[i]]} onSelect={()=>{}}/><ObjectInspector object={objects[i]}/></>));
    expect(div.querySelector('.object-link small').style.color).toBe(div.querySelector('.object-identity p').style.color);
  }
  act(()=>root.unmount());
});
