# Globe and interface

The Earth uses local Solar System Scope albedo, tangent-space normal, ocean specular and cloud maps. The day map is 4096×2048 on larger viewports and 2048×1024 on smaller ones, chosen when the globe mounts. Other maps are 2048×1024. The source is [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/), published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Resizing and TIFF-to-PNG conversion are documented in the bundled attribution notice. [earth-assets.json](earth-assets.json) records URLs, sizes and hashes. No texture request goes to a third-party host at runtime.

Directional lighting, normal detail, a restrained ocean highlight and a Fresnel atmosphere create the Earth shading. The atmosphere is a visual scattering approximation, not a physical atmosphere model. Clouds move slowly over a fixed Earth map. Cloud motion and debris tumbling are decorative, not weather or attitude predictions. Missing image assets fall back to the original schematic Earth with an explicit message.

## Markers and trajectories

Markers use at most four `THREE.InstancedMesh` batches, one per category. Each object is a two-triangle billboard. Shader silhouettes distinguish body/solar-panel payloads, irregular debris, rocket bodies and hollow unknown markers. Camera distance and visible density continuously blend detail and size toward smaller dots; smaller viewports reduce marker size further. Selected objects retain the detailed silhouette. Colors are emerald `#00FF66` for confirmed payloads, coral `#FF3B30` for debris, softer coral for rocket bodies and neutral grey-blue for unknowns. Classification does not establish current operational status.

Billboard size is computed in screen space. A matching raycast uses camera projection and instance identity, since native triangle raycasts would otherwise test the original unprojected quad. Solid Earth still blocks far-side selection. Selected/comparison rings and labels are independent of category color. Geometry, cloud and marker transforms never modify analytical states.

Forecast paths use a cyan/blue/violet/pink altitude gradient, normalized to the selected forecast's actual minimum and maximum altitude. A flat-altitude path uses the midpoint color. The legend names the quantity and its range. Two screen-width line passes provide a crisp core and subtle additive halo; depth testing retains Earth occlusion. Samples and timestamps are unchanged, and no interpolation enters analysis.

## Interface and motion

Panels use dark translucent acrylic, 20 px backdrop blur, thin white borders, restrained highlights and system typography that uses San Francisco on Apple platforms. Source provenance is grouped into a compact status widget with expandable details; errors remain visible. Responsive navigation, cards, tables, inspector and camera controls share the same surface and spacing rules.

Reduced motion stops cloud animation and marker tumbling, disables camera damping and removes CSS transitions/entry motion. Hidden pages do not schedule cloud frames. Idle cloud animation requests up to 24 frames per second; pointer-driven camera interaction can render at the browser's interaction cadence. Viewports without backdrop-filter get opaque readable panels.

## Checks

Regression checks cover altitude color mapping and unchanged input, smooth LOD, projected picking at three zoom levels, far-side Earth occlusion, metadata semantics, asynchronous UI behavior and graphics fallbacks. Run the frontend lint, tests and builds using the README commands.

The standalone browser benchmark now uses the production billboard material and picking helper at 100/1,000/6,000 synthetic objects. It deliberately uses a simple Earth material and excludes the application's React/labels/forecast and photorealistic Earth costs. Timing results apply only to that workload. Hidden/occluded runs are flagged invalid; they cannot establish supported-device frame rates.
