# Plan reading repair

The reported screenshot showed incomplete doors/windows and no room names. Its count of six doors did not establish that their positions were correct. The deployed provider error could not be retrieved from this environment; this change does not claim to have identified that production error or achieved complete automatic detection.

Changes:
- Preserve fine arc evidence at up to 1600px while retaining 720px alignment. Run arc detection in a cancellable worker so mobile interaction remains responsive.
- Use one deduplicated opening union for counts and 3D. Publish new raster results to the page only after their save succeeds.
- Add confirmed doors/windows on walls or validated gaps between collinear wall segments, remove false detections, and name inferred rooms. Persist these edits separately in review.json and apply them in the plan and 3D/walk views. Gap hosts are removed when their correction is removed.
- Prepare room-name images by cropping broad light pages from black phone chrome, normalize MIME to PNG, and request high image detail. Map returned coordinates back to the original image. The attached IMG_5049.png was checked locally: the retained vertical interval was approximately 18.2%–81.8%, including the plan and its dimensions.
- Distinguish unavailable configuration, provider usage limits, incomplete output and timeout in room-reading messages; keep provider response details out of the UI. OPENAI_VISION_MODEL can override the room-reading model independently.
- Map sufficiently confident room labels into existing inferred rooms using the saved image alignment. Manual names take priority.

Verification: 17 automated tests cover navigation/design regressions, opening deduplication and rejection, gaps, room-name mapping, phone-image coordinate preservation and the actual correction route's disk persistence. Next production build and TypeScript checking pass. Tests do not measure real-plan door/window recall or validate production OpenAI credentials. Automatic window detection remains the provider's responsibility; missing windows can now be corrected and saved directly.
