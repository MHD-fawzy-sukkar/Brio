# Bolt mascot asset

The final application asset is `apps/web/public/bolt-original.png` (1536 × 1024, RGBA). It was derived from the supplied front-facing JPG using the built-in imagegen tool to remove the green backdrop. The navbar displays the cutout without rotation. The lobby displays the original face without masking, tinting, or pose transforms, and flies throughout the host content above the start of the players panel, with responsive measured bounds, gentle whole-image 3D tilts, and no reserved layout space. Avatars also use the untouched original face, upright and unmirrored, enlarged within square cards. Stable avatar IDs preserve the chosen hue across the join screen and lobby.

## Generation prompt

Use case: background-extraction. Edit target: the supplied perfectly symmetrical front-facing Bolt robot. Remove ONLY the green background to true alpha transparency. Preserve the exact robot identity, front-facing vertical alignment, perfectly symmetrical pose, proportions, red and white body, black visor with original yellow eyes and smile, both red hands, headphones, cyan underside glow. No redesign or rotation. Keep original landscape 3:2 composition, robot size and placement unchanged, with transparent margins where the green backdrop was. No new objects or text. This is the final app mascot and navbar icon, a faithful clean cutout.

## UI preview

`host-lobby-ui-preview.png` shows the actual host lobby components with 15 sample players. The temporary preview route is removed from the application.
