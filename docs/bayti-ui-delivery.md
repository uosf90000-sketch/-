# Bayti visual experience

Implemented the supplied Arabic desktop/mobile direction with warm ivory surfaces, dark olive controls, Arabic typography, architectural photography, and a spacious layout. The model remains the center of the working screens.

## Routes

- `/`: landing, matching illustrative plan/model comparison, journey, design inspiration.
- `/upload`: file, photo and camera inputs; drag/drop, validation, preview, upload recovery.
- `/project/[id]`: original plan, honest analysis states, actual counts, element details, overlay visibility and zoom, optional existing room-name extraction.
- `/project/[id]/3d`: the project's real geometry, floating camera controls, room focus, day/night lighting, before/after furnishing, style drawer, element information and shopping drawer.
- `/project/[id]/walk`: the same home at eye level, mouse/keyboard/touch controls, collision-aware routes through connected doors, room navigation, cinematic pause/next/exit, optional look-to-walk.
- `/dashboard`: recently opened projects on this device, without the previous hardcoded project ID or fictitious progress.
- `/explore`: five style directions; the selection follows upload and review to the design drawer.
- `/project/demo`: one clearly labeled illustrative home, also used by the landing comparison and its walkthrough. Previous demo tour URLs redirect here.
- `/project/[id]/materials`: opens the real project with its shopping drawer.

## Preserved contracts

The upload endpoint, BIMy recovery and analysis endpoints, room-reading endpoints, IFC parsing and conversion, wall graph, door detection and room inference are unchanged. Existing saved project URLs still work. Image alignment and detection calculations in PlanReading are unchanged; only presentation and selection were revised.

The design endpoint now accepts a validated style and optional room index. A room result is merged with the previous design without replacing items outside its polygon. Invalid or empty room results fail before writing. No live paid analysis/design calls were made during development.

The renderer uses imported wall coordinates without changing stored geometry. The sign used to place segmented walls along their Z axis was corrected to match the existing wall rotation and opening positions. Walking uses the same positions for collision checks. Door leaves are hidden while walking so valid door openings remain passable.

## Current product limits

- Direct IFC uploads are not accepted by the existing upload endpoint. The UI accurately lists its actual supported formats (PNG/JPG/WEBP/PDF/DXF/DWG) and explains IFC rejection.
- No account system, server-wide project listing, granular sharing permissions, notifications feed or undo API exists. No simulated state is presented as one of these services. Shared links have the access behavior of the existing server.
- Shopping lists show actual generated items, dimensions and materials. Prices, store links, availability, paint coverage and verified costs are not invented. Their interfaces remain honest empty states until catalog data exists.
- Room labels use known geometric room names, otherwise numbered rooms; no semantic names are guessed from shape.
- Rendering uses the existing parametric furniture. Better daylight, shadows and material tones improve presentation, but this is not the photoreal asset library shown in the conceptual mockups.
- Only floors and openings supplied by the existing model are shown. No fictitious floors, confidence scores or correction persistence are added.
- Room navigation stays within the available wall, doorway and furniture geometry; disconnected rooms produce an explanatory message.

## Validation

Production Next.js build and TypeScript check pass. Seven targeted regression tests cover solid wall/disconnected room blocking, door traversal, furniture/exterior collision, rotated furniture, room validation, preserving other rooms during design and rejecting empty room designs. Browser screenshots and production provider integrations were not exercised in this pass.

## Assets

Three original AI-generated image assets: Saudi villa courtyard, majlis, and a four-quadrant style image (Modern, Warm Minimal, Luxury, Japandi). They are used as inspiration images, never substituted for a user's 3D model. IBM Plex Sans Arabic fonts are self-hosted with their OFL license in `public/fonts/OFL.txt`.
