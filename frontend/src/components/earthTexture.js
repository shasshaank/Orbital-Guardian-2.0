import * as THREE from 'three';

// Original schematic continent silhouettes, drawn in lon/lat, not a basemap.
// Deliberately approximate geography; the geodetic marker transform is separate.
const continents = [
  [[-168,70],[-140,72],[-125,60],[-110,55],[-95,50],[-60,53],[-55,45],[-80,25],[-98,17],[-110,30],[-125,48],[-150,60]],
  [[-81,12],[-62,10],[-48,-2],[-35,-9],[-44,-24],[-54,-34],[-68,-55],[-75,-35],[-78,-10]],
  [[-52,60],[-42,62],[-20,78],[-35,83],[-58,76]],
  [[-17,35],[10,37],[33,30],[44,12],[50,0],[40,-15],[30,-34],[18,-35],[10,-18],[-5,5],[-17,15]],
  [[-10,36],[-10,55],[8,60],[20,71],[40,68],[60,72],[100,77],[140,65],[179,65],[165,50],[140,40],[130,30],[120,20],[108,0],[98,10],[80,8],[68,25],[50,30],[40,42],[28,40],[20,35]],
  [[113,-22],[130,-12],[142,-11],[153,-25],[146,-39],[129,-35],[115,-34]],
  [[47,-13],[50,-17],[47,-26],[44,-23]], [[130,33],[142,45],[145,40],[135,32]],
  [[-180,-76],[-120,-72],[-60,-77],[0,-70],[60,-70],[120,-75],[180,-76],[180,-90],[-180,-90]]
];
export function createEarthTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#173c59'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#506b68';
  continents.forEach(points => {
    ctx.beginPath(); points.forEach(([lon, lat], i) => {
      const x = (lon + 180) / 360 * canvas.width, y = (90 - lat) / 180 * canvas.height;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }); ctx.closePath(); ctx.fill();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
