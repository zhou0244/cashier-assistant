# Cashier Assistant

A personal, mobile-first barcode/PLU lookup PWA. Search your local catalog, distinguish the exact product, inspect a verified numeric code and supported barcode, then use your existing register independently. There are no accounts, prices, inventory features, analytics, employee messages, retailer affiliation, POS connections or scanner integration.

All four implementation checkpoints are available. Checkpoint 1 was tested and accepted by the user; later checkpoints have automated coverage. Device installation, cold offline launch, actual barcode readability remain manual checks listed below. This is not a claim that those device checks have passed.

## Setup and commands

Node.js 22.12+ and npm are required (tested on Node 22.13.0).

```sh
npm install
npm run dev
```

Development normally runs at http://localhost:5173. Browser IndexedDB must be enabled. The service worker is deliberately disabled in development to keep hot reload predictable.

```sh
npm run typecheck
npm test
npm run build
npm run check:pwa
npm run preview -- --port 4173
```

Production preview runs at http://localhost:4173. `npm run check:pwa` requires an existing production build. `npm run test:watch` runs tests interactively. No linter is configured; TypeScript, Vitest and production/PWA checks are the automated checks. Build output is `dist/` and can be served by a static server with HTTPS; no backend, credential or cloud deployment is needed for local operation.

**Ports, hostnames and browser profiles have separate catalogs.** To move development data from port 5173 to production preview on 4173, export from development and preview/import that file in production. Keep the exported file outside browser storage.

The Vite servers bind to the local network for phone testing. Plain HTTP on a LAN address supports ordinary app use but does not provide a secure context for PWA installation/service workers and may restrict clipboard access. Record IDs use secure random bytes with a fallback for browsers that do not expose `crypto.randomUUID` on local HTTP; this also applies during database upgrades. Use localhost on the development computer or a trusted HTTPS origin on your phone for installable/offline operation. The manifest assumes deployment at the origin root `/`.

## Install and verify offline operation

1. Run the production build and preview commands above. Open http://localhost:4173 online and allow the first service-worker installation/precache to finish. Wait for offline setup to finish, then reload once so the worker controls the page. The connection notice appears only while offline; there is no online status label.
2. Install using the browser's Install app option. On iPhone/iPad use Safari's Share → Add to Home Screen on an HTTPS origin. Availability and wording vary by browser.
3. Add a permitted product and independently checked identifier, or restore your own trusted backup. Fictional demos cannot be verified. Compare the product and brand before recording verification.
4. Turn off network or enable browser offline mode. Close/reopen or reload the installed app. Search a previously saved record, browse departments, change a classification and reopen it, inspect its verified code/barcode, save/unsave it, edit it and inspect history. In Settings, rename an empty department and confirm it persists after restart.
5. Open Settings while offline and export a backup. Preview and restore that file into a separate test catalog.

The precache includes the app shell and **all** JS/CSS chunks, including lazy-loaded settings and validation tools. Local search, saved items, product/identifier edits, verification and history use IndexedDB. Service-worker updates require the explicit “Update app (finish edits first)” action rather than interrupting a form automatically.

Browser storage can be cleared/evicted; private browsing and device loss can remove it. Installation is not a substitute for external backups.

## Local workflow and verification safeguards

The bottom navigation contains Search, Saved, and Settings. Search includes the full product list and department filters; there is no separate product-browsing page. Add product and Needs checking appear only on the Settings page. The bottom navigation is hidden while adding a new product and returns after saving or canceling. Opening the product form does not auto-focus an input. Form controls use at least 16px text to avoid iPhone input-focus zoom; pinch zoom remains available.

Search matches name, brand, department names, original category labels, keywords and active non-rejected identifier strings. All query words must match; matching is case-insensitive with a small synonym list (`pop`/`soda`, `garbanzo`/`chickpeas`, `cilantro`/`coriander`). Department browsing narrows results. Exact identifier matches rank first; leading zeros are preserved. Archived products are excluded. Saved and recently opened records persist across reloads. The home page also offers frequently opened products after repeat use.

Six stable fictional products provide sample local records. Their identifiers are fictional unverified store codes, never genuine retailer codes. Demos stay marked fictional when edited and cannot receive packaging/POS verification or scannable artwork.

- UPC-A requires exactly 12 ASCII digits, EAN-13 exactly 13, EAN-8 exactly 8, including the check digit. Validation uses the modulo-10 checksum with alternating 3/1 weights starting at the rightmost payload digit. No trimming, padding, numeric coercion or automatic check-digit correction occurs.
- Only active, valid, non-demo UPC/EAN codes with packaging or POS verification render JsBarcode artwork. The renderer independently rechecks policy. Bars are black on white with quiet margins; the human-readable and copied code retains the exact stored string.
- Packaging verification checks the package/code and explicitly leaves register compatibility unverified. Only valid non-demo **checked at the register** supported codes receive the checkout-ready label. Checksum validity and public-data presence never establish verification.
- PLU/store codes remain numeric-only. Numeric-format validation does not prove identity or store rules. `OTHER` codes must be corrected to a supported type before verification. Conflicting associations block barcode, copy and checkout-ready presentation.
- Clipboard denial/unavailability produces a manual-copy message. The app never submits anything to a register.

## Catalog maintenance

Open Settings and choose Add product; record the product name, brand, department, search words. Similar name/brand records require explicit comparison acknowledgment. Product saves record a simple automatic history reason; no product-reason prompt is shown. Code changes and verification still require their separate evidence and reason.

Add an identifier with its actual type, complete numeric string, source description and rationale. It starts unverified. Invalid UPC/EAN codes and active duplicate associations are blocked. Duplicate detection includes identical strings across types and equivalent UPC-A / leading-zero EAN-13 forms; PLU/store leading zeros are not discarded.

The personal Needs checking list includes missing, unverified, invalid, conflicting and unknown identifiers, and packaging-only records whose register compatibility is unchecked. Check code requires source, reason and an explicit statement that you independently checked the exact product/code. Packaging verification requires a packaging source. Rejected-only records leave the pending queue; their history remains.

The identifier card contains Incorrect code, Check code and Stop using buttons at its bottom right, wrapping on smaller screens. The Incorrect code action retains the original code, type, verification and source in history and resets the new value to unverified. Changes to product identity details reset its active verified identifiers for review. Classification-only changes preserve identifier values, provenance and verification exactly. Retire removes a code from active search/checkout presentation but keeps the value and provenance under Codes no longer in use and in history. No destructive deletion or silent reassignment is provided.

Entity/evidence writes and before/after events commit in one transaction. History has no edit/delete API and repository hooks reject history updates/deletes. This is application-level immutability, not tamper-proof browser storage. Expected revisions reject stale edits; Dexie observation refreshes details when persisted data changes, removing obsolete barcode artwork. Reopen an editor after a stale-revision error.

## Departments

Global search remains the main lookup workflow. Expand Browse by department to select a department and see product counts. Lookup pages have no separate department dropdown. Clear filters keeps the typed search query. Products without a department remain searchable and have their own filter. Add product and Edit product offer one optional Department selector.

Settings → Manage departments supports adding, renaming, reordering and removing empty departments. Names must be unique (ignoring case and extra spaces). A department containing products, including archived products, cannot be removed. Renames retain IDs and product links. Department writes and before/after history commit atomically, and stale edits are rejected. Starting departments are illustrative supermarket groups, not official retailer classifications.

Database version 3 moves earlier category/subcategory product assignments to their top-level department. Codes, verification, saved state and older history stay intact; a new history entry retains each original assignment. Older hierarchy definitions remain available only as compatibility metadata in stored records/backups, with no browsing, selection or editing controls. Restoring an older hierarchy backup likewise maps new products to departments and records their original assignment. Removing an empty department also removes its unused legacy child definitions, retaining each definition in history. Fresh catalogs seed only departments.

Department browsing, editing and management use IndexedDB and work without network requests. Backup merges remain additive: unused starting departments absent from a backup are retained on the destination. Existing personal edits are never silently replaced; conflicts block the whole merge.

## JSON export and safe merge/restore

Settings → Download backup downloads format `cashier-assistant-backup`, version `2`. It includes **all department definitions and product links (plus legacy classification definitions where present), products, original external categories, active/retired identifiers, sources, original history, saved/recent metadata, uploaded photo bytes and legacy image metadata**. Earlier version `1` backups remain readable and their categories are migrated during preview. Uploaded photo bytes are embedded in the JSON file; there is no remote image cache. No backup is uploaded anywhere.

Select a JSON file (maximum 50 MB) for strict schema/reference validation and preview. Review new record counts, identical records, similar products, invalid codes and conflicts before acknowledging the merge. Nothing is written until that action.

Default import resets newly imported verification claims to unverified, retaining the original claim/value/source in a new history event. Public records always remain candidates. For your **own trusted personal backup**, explicitly choose “Keep the checks I recorded earlier, where the codes are still valid.” This retains valid recorded verification with evidence metadata, except fictional demos, invalid/unknown types and records whose claimed verification source is public data. It does not perform new verification.

Imports are atomic and additive: identical IDs/values are skipped; conflicting user record IDs or active duplicate codes block the entire merge. The write transaction rechecks the preview against current data. Sources/history are retained, never silently overwritten. Trusted restore may replace pristine built-in demo placeholders and unchanged starting category definitions with your backed-up revisions; existing user edits and history remain protected. Imported products get a `backup_imported` event; verification resets get separate events. Repeat imports skip identical original rows but an older backup cannot overwrite newer local state.

To restore into a fresh catalog, use a fresh origin/browser profile and preview your file. Unchanged demo placeholders merge identically; modified demos can restore over pristine placeholders using trusted restore. For conflicting user data, retain a current export and use a fresh catalog rather than editing IDs or bypassing validation. Invalid original code strings in a backup are preserved for review; their artwork/copy/readiness remains blocked. Arbitrary JSON product dumps are not accepted as trusted backups. CSV import is optional in the spec and is not implemented.

Version / flavour, Size / weight, Packaging description, Photo link, Photo owner / website and the product Reason / where the details came from prompt are removed from forms, cards, search, comparison lists and displayed history. Older values remain in database records and JSON backups for lossless restore, and edits neither change nor use them.

## Product codes when adding a product

The Add product form includes Product codes with optional PLU and Barcode photo fields. PLU accepts the exact numeric string, preserving leading zeros. It is stored as a separate unverified identifier with source/history, never as a generated UPC. Invalid numeric input or an active duplicate association blocks saving the whole product, including its photos; creation is one transaction.

Barcode photo has its own gallery/camera controls, preview and removal, independent of the product photo. Both photos use the same local compression, size limits, offline storage and full backup support. The barcode photo remains an unverified reference: no number is extracted, no code is inferred and no verification or generated barcode is produced from it. Product details put it in a collapsed Barcode photo · reference only section. Manually add/check the printed UPC/EAN using the existing code tools before checkout. Edit product can replace/remove this reference; PLU corrections use the existing code cards so their original values and evidence stay in history.

## Add photo

Add product and Edit product include Add photo → Choose from gallery and Take photo. Gallery opens the device’s image picker; Take photo requests the outward-facing camera using a native file input (`capture="environment"`). Mobile browsers control the exact picker; on desktop the camera option may use an ordinary file chooser. See [the capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture). On Chrome for iPhone/iPad, Take photo opens the standard image picker instead of forcing direct capture, as a workaround for a reported black native-camera preview. Choose its camera option; if it still fails, use Safari or take a picture in the Camera app and select it from the gallery. The workaround is covered by browser-identification tests but needs a real Chrome/iPhone check. This uses no live camera-stream API and requires no photo service or server upload.

A selected photo previews before saving. You can replace or remove it, or cancel the product form to discard the change. Input photos must be no larger than 20 MB; supported images are resized to at most 1600 pixels on the longest side and re-encoded as JPEG at up to 512 KB. This strips original file metadata and keeps storage bounded. Unsupported formats (including HEIC on browsers that cannot decode it) show a message; try a JPG/PNG or a new camera photo. A failed upload keeps the earlier selection. Saving is disabled while a photo is prepared.

Photos are embedded in product records as `photoDataUrl`, persist in IndexedDB, display on search/saved cards and details, and work offline with the installed shell. No remote image URLs are fetched. Full backups include photo bytes and earlier snapshots, including removed/replaced photos retained in immutable history. Restoring photos uses the same raster-only validation and per-photo size limit. Photo changes reset checked codes for review because the displayed product identity changed; unchanged photos and department-only edits preserve checks. Backup files may grow with photo history; restore currently accepts files up to 50 MB.

The iPhone gallery/camera picker and actual installed-offline photo display need a device check. Automated tests simulate image decoding/canvas processing, picker inputs, preview/error/removal, app saving/display/reopening, IndexedDB persistence and backup round-trip; they do not exercise a physical camera.

## Manual entry and existing data

Populate the catalog through Settings → Add product, then add the exact printed code and record its source. No product API client, online lookup, public response cache or automatic category mapping is included. Search and all catalog writes stay on this device. Local uploaded photos are supported; remote photo links remain removed. Product cards and details show a No photo placeholder when no local photo is available.

Older databases and backups remain readable. Existing imported products, exact identifier strings, source credits, original category metadata and immutable history are preserved. Legacy public-source verification claims cannot be trusted during restore; check those codes independently and record permitted evidence. Recorded attribution is displayed verbatim rather than replaced with provider-specific text. Keep any obligations attached to previously acquired data or photos when sharing them.

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/domain/models.ts` | Product, multiple identifier, source, event and saved/recent types |
| `src/domain/search.ts` | Pure local search, synonyms and descendant filters |
| `src/domain/classification.ts` | Hierarchy validation, paths, legacy migration and descendant matching |
| `src/data/taxonomy.ts` | Stable editable starting department/category/subcategory definitions |
| `src/domain/identifier-policy.ts` | Exact checksum/symbology checks and presentation policy |
| `src/domain/maintenance.ts` | Metadata/evidence validation, duplicates, similar products and review rules |
| `src/data/repository.ts` | Dexie repository, transactions, observed catalog, revisions, snapshots and imports |
| `src/imports/backup.ts` | Strict Zod backup parsing, references, conflict checks and merge plan |
| `src/domain/photo.ts`, `src/photos/prepare.ts` | Raster photo validation, resize/re-encoding and local upload limits |
| `src/components/PhotoInput.tsx` | Gallery/camera picker, local preview and removal |
| `src/barcode/render.ts` | Guarded JsBarcode SVG adapter |
| `src/components/` | Small UI forms, details, history, Settings and PWA status |
| `src/data/demo.ts` | Stable clearly fictional fixtures and provenance |
| `vite.config.ts` | Vite + React, manifest, shell and font precache |
| `scripts/check-pwa.mjs` | Built manifest/icon/asset/fallback checks |

The primary database uses schema version 3 with `categories`, `products`, `identifiers`, `sources`, `events`, `saved_products`. The version 1 upgrade is transactional: it preserves original category strings, identifier records and verification, source records, saved state and earlier history, and appends classification migration events. Demo population happens atomically only on first creation and never reseeds an intentionally emptied catalog. Primary persistence uses IndexedDB, not localStorage. Backup modules and Settings load separately from the initial search bundle; the PWA precaches those chunks for offline access. There are no user tables or shared-catalog/admin workflows.

## Validation and remaining manual checks

Executed successfully: dependency installation, `npm run typecheck`, `npm test` (**100 tests across 20 files**), `npm run build`, `npm run check:pwa`, `git diff --check`, development and production preview startup. No known vulnerabilities were reported during installation. Production build has no chunk-size warning after splitting settings/import tooling.

Tests additionally cover department filters and forms, absence of category/subcategory controls, department management, legacy relationship validation, actual version 1 and 2 database upgrades, department persistence after reopening, classification-only verification preservation and older hierarchy backup restore. Tests cover checksum rejection and exact SVG symbol vectors, leading-zero copying, unsafe-state artwork removal, local search and similar products, saved/recent persistence, metadata/identifier maintenance, evidence and state transitions, immutable snapshots, duplicate/stale/concurrent writes, rollback, complete backup round-trip, default verification reset, conflicts after preview and backup preview/import UI flows. Tests use jsdom and fake-indexeddb; no live product API is used. Build checks verify every app JS/CSS chunk is precached and navigation falls back to the shell; they do **not** prove actual browser offline operation.

Browser automation reported no connected browser. Complete the installed/cold-offline steps above, verify the 375px layout and keyboard/touch controls, and check symbol readability with your existing equipment. Measure time from opening search to identifying the exact permitted product/code, record incorrect selections, and adjust the catalog's distinguishing metadata. Physical register compatibility must be established independently; it is not an integration feature. Optional CSV import and automated browser end-to-end tests are not included.

## Plain language and explanations

The interface uses “code” instead of identifier, “Checked on package” and “Checked at register” instead of technical verification labels, “Stop using” instead of retire, and “Download backup” / “Add from this backup” instead of export / merge. Warnings and errors use everyday language. Search and department controls keep accessible names without visible labels above them. Change history shows readable before/after details, exact code strings, sources and dates rather than raw data keys. The original records, original source credits, stored code status values remain unchanged. JSON backups now use version 2 with category definitions, while version 1 backups remain supported.

Question-mark buttons explain UPC-A, EAN-13, EAN-8, PLU and store codes. Hover, focus with the keyboard or tap to open the explanation; tap again, move focus away or press Escape to close. These controls have accessible names and linked descriptions, 44px touch targets, and bubbles positioned within the screen. Backup and history help explain what is saved and retained.

Keyboard focus uses subtle green field colours and underlined button/link text instead of box outlines.

Interface icons use `lucide-react` SVG icons, bundled locally for offline use. Decorative icons are hidden from screen readers; buttons keep their text or accessible names.

The favicon and 192px/512px install icons use the same Lucide Search artwork. Run `npm run icons` to regenerate them from the installed Lucide package. Lucide is licensed under ISC; its licence is included in `node_modules/lucide-react/LICENSE`.

Inter is the primary interface font, bundled locally as a variable WOFF2 font through `@fontsource-variable/inter` and precached for offline use. System fonts provide fallback for characters outside its Latin subset. Numeric codes retain their monospace display. Inter uses the SIL Open Font License 1.1; see `node_modules/@fontsource-variable/inter/LICENSE`.

If opening saved products fails, keep site data intact and read the error details shown in the app. Reload the same address after closing other app tabs. Avoid Safari’s Clear History and Website Data unless you have a backup and intend to reset the catalog. A local `http://192.168…:5173` development address supports ordinary catalog testing but cannot provide service-worker installation/offline launch. Different addresses or ports use separate catalogs.
