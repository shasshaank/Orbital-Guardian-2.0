import * as THREE from 'three';

const smoothstep = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function markerStyle(distance, count, viewportWidth = 900) {
  const density = smoothstep(2000, 6500, count);
  const detail = 1 - smoothstep(THREE.MathUtils.lerp(4.5, 2.3, density), THREE.MathUtils.lerp(11, 6, density), distance);
  const screenScale = THREE.MathUtils.clamp(Math.sqrt(viewportWidth / 900), 0.65, 1);
  return { detail, radius: THREE.MathUtils.lerp(2, 5.5, detail) * THREE.MathUtils.lerp(1, 0.82, density) * screenScale };
}

export function createMarkerMaterial(color, category) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uCategory: { value: category },
      uRadius: { value: 5.5 }, uDetail: { value: 1 }, uViewportHeight: { value: 600 }, uTime: { value: 0 }
    },
    transparent: true, depthWrite: false, toneMapped: false, extensions: { derivatives: true },
    vertexShader: `
      uniform float uRadius, uViewportHeight, uTime, uCategory, uDetail;
      varying vec2 vPoint;
      varying float vDetail;
      void main() {
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float scale = length(instanceMatrix[0].xyz);
        vDetail = mix(uDetail, 1.0, step(1.1, scale));
        float seed = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float angle = uCategory == 1.0 ? seed * 6.283185 + uTime * 0.13 : 0.0;
        mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 offset = rotation * position.xy;
        float pixelWorldSize = 2.0 * max(0.0, -center.z) / (uViewportHeight * projectionMatrix[1][1]);
        center.xy += offset * uRadius * scale * pixelWorldSize;
        vPoint = position.xy;
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uCategory;
      varying vec2 vPoint;
      varying float vDetail;
      float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
      void main() {
        vec2 p = vPoint;
        float silhouette;
        if (uCategory == 0.0) {
          float body = box(p, vec2(0.19, 0.31));
          float panels = min(box(p - vec2(0.57, 0.0), vec2(0.25, 0.27)), box(p + vec2(0.57, 0.0), vec2(0.25, 0.27)));
          silhouette = min(min(body, panels), box(p, vec2(0.6, 0.045)));
        } else if (uCategory == 1.0) {
          silhouette = max(abs(p.x * 0.82 + p.y * 0.25) + abs(p.y * 0.95 - p.x * 0.22) - 0.68, -length(p - vec2(0.42, 0.32)) + 0.24);
        } else if (uCategory == 2.0) {
          silhouette = min(box(p, vec2(0.22, 0.45)) - 0.09, box(p - vec2(0.0, -0.39), vec2(0.4, 0.11)));
        } else {
          silhouette = abs(abs(p.x) + abs(p.y) - 0.65) - 0.105;
        }
        float dotShape = length(p) - 0.47;
        float distance = mix(dotShape, silhouette, smoothstep(0.05, 0.9, vDetail));
        float edge = max(fwidth(distance), 0.035);
        float alpha = 1.0 - smoothstep(-edge, edge, distance);
        if (alpha < 0.01) discard;
        float panelLines = uCategory == 0.0 && abs(p.x) > 0.3 ? mix(0.72, 1.0, step(0.17, fract((p.y + 1.0) * 7.0))) : 1.0;
        gl_FragColor = vec4(uColor * mix(1.0, panelLines, vDetail), alpha * (uCategory == 3.0 ? mix(0.48, 0.78, vDetail) : 1.0));
        #include <colorspace_fragment>
      }`
  });
}

// Billboards move only in the vertex shader. Native triangle raycasting would
// test the unprojected quads, so use matching screen-space hit radii instead.
export function raycastMarkers(mesh, positions, scales, camera, viewportHeight, radius, raycaster, hits) {
  const point = new THREE.Vector3(), view = new THREE.Vector3(), fromRay = new THREE.Vector3();
  for (let i = 0; i < scales.length; i++) {
    point.fromArray(positions, i * 3).applyMatrix4(mesh.matrixWorld);
    view.copy(point).applyMatrix4(camera.matrixWorldInverse);
    if (view.z >= 0) continue;
    fromRay.copy(point).sub(raycaster.ray.origin);
    const along = fromRay.dot(raycaster.ray.direction);
    if (along < raycaster.near || along > raycaster.far) continue;
    const hitRadius = Math.max(radius * scales[i], 5) * 2 * -view.z / (viewportHeight * camera.projectionMatrix.elements[5]);
    if (raycaster.ray.distanceSqToPoint(point) <= hitRadius * hitRadius) {
      hits.push({ distance: along, point: raycaster.ray.at(along, new THREE.Vector3()), object: mesh, instanceId: i });
    }
  }
}
