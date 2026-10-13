# Agent Instructions: Cashier Assistant

## Mission
Build and maintain a reliable, fast, mobile-first personal barcode/PLU lookup PWA. See `PRODUCT_SPEC.md` for scope and acceptance criteria.

## Non-negotiable constraints
- Do not replace, emulate, or integrate with a retailer POS or barcode scanner.
- Focus on finding the correct verified UPC/PLU/store code; no prices, inventory management, user accounts, employee messaging or admin portals.
- Do not scrape retailer sites or pull private employer data.
- All public imports are **unverified** until manually reviewed. Do not treat successful checksum validation as proof of product identity or POS compatibility.
- Preserve identifier strings and leading zeros; validate UPC/EAN symbology and checksums. Never turn an arbitrary PLU into a faux UPC barcode.
- Keep local-first storage and full import/export backups.
- Retain original values, provenance and edit/verification history for all identifier corrections.
- Product records can have multiple identifiers; don't collapse into one `barcode` field.
- Avoid feature creep and unnecessary dependencies.

## Working practices
1. Inspect the repository and `PRODUCT_SPEC.md` before making changes.
2. State a short implementation plan and use small, reviewable milestones.
3. Prefer TypeScript with explicit types, accessibility, simple components and tested domain logic.
4. Separate UI, domain, repository/storage, external data import and barcode renderer into modules.
5. Use stable sample data with clearly fictional demo labels. Never present invented identifiers as genuine retail codes.
6. Add tests for validation, search, duplicates, state transitions, history and offline persistence.
7. Run available lint/typecheck/test/build commands after meaningful changes; report results honestly.
8. Update README with setup, data licensing/attribution, offline limitations and import safety notes.
9. If a user decision is genuinely required, ask one precise question; otherwise use documented reasonable defaults.

## Definition of complete
The app runs locally, supports core flows end-to-end, is functional offline for previously saved data, has robust code verification safeguards, and passes tests/build. Do not declare completion based on static mockups.
