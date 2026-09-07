# Tectly comparison in Bayti

The additional reader is isolated from BIMy analysis. It can compare geometry on the original raster and adopt individual openings or room names into the existing review/3D model. It does not choose a provider by element counts or replace BIMy walls automatically.

## Configuration and connection

Set TECTLY_CLIENT_ID and TECTLY_CLIENT_SECRET on the bayti-web Railway service. TECTLY_API_KEY / TECTLY_API_SECRET are supported as a complete alternative pair; incomplete pairs are never mixed. TECTLY_API_BASE_URL defaults to https://platform.tectly.com/api/v1; the documented sandbox host is also accepted. TECTLY_DISABLED=true blocks use.

GET /api/tectly/check exchanges Basic credentials for a bearer token on the server and returns only configuration/authentication booleans and safe failure codes. It does not submit a floor plan. GET /api/health reports whether the reader is configured and includes the deployed Railway commit SHA when available. Neither endpoint returns secrets or tokens.

## User flow

Open a saved project and scroll to the comparison section. Check the connection, acknowledge account-credit usage, and start the additional reading. PNG/JPEG/WEBP/PDF uploads are supported; a PDF can contain multiple billable plans. Processing resumes by polling saved document/page/plan identifiers. Reloading or repeated starts never automatically upload the same file again. A lost upload response is recovered by reading the unique project's documents; an uncertain upload is not replayed.

The original raster can show current geometry, additional geometry, or both, with zoom and per-plan selection. Review alignment before selecting an opening or room name to adopt. Opening endpoints must match a wall's direction, distance and bounds; a valid existing wall gap can host a confirmed opening. Unmatched or ambiguous elements require manual correction. Names require one matching existing room. An original-file hash prevents adopting geometry from a replaced image. Changes persist in review.json and therefore reach the existing 3D/walk views; the original analysis remains intact.

For PDF, each extracted plan has a separate vector preview. This first integration does not transfer PDF elements into the existing 3D model because an independently verified page-to-model alignment is not available. Missing scale is shown explicitly and is not assigned an invented meter conversion. Raster adoption uses the reviewed BIMy-to-image alignment.

## Contracts and validation

Primary documentation:
- https://docs.tectly.com/pages/getting-started/authentication.html
- https://docs.tectly.com/pages/getting-started/quickstart.html
- https://docs.tectly.com/pages/concepts/data-model.html
- https://docs.tectly.com/pages/concepts/coordinate-system.html

REST document/floor routes and structural opening variants were also checked against the existing bayti-living-twin Tectly client and its SDK-derived schemas. Points are normalized to the plan section, then composed into the page; floor scale fields are portions of the plan per meter. Hinged doors use hinge/closed/open, windows from/to and sliding doors closed/open. Raw signed image URLs and provider response/error bodies are not sent to the browser.

Validation: production build and 31 tests, including the previous viewer/review checks, auth/header behavior, secret suppression, paid-upload replay protection, processing states, original-coordinate mapping, ambiguous/wrong hosts, concurrent locks and the actual adoption endpoint's persistence. These are integration/contract tests with local fixtures, not a claim of measured real-plan detection accuracy. No paid Tectly analysis was launched during implementation.
