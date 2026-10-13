# Cashier Assistant: Barcode Finder
## Product Specification v0.1 (Personal MVP)

### Product goal
Help one cashier identify a product with a missing or unreadable barcode and retrieve the **correct verified POS identifier** (UPC, EAN, PLU, or store-specific numeric code) as quickly as possible. The existing POS and scanner are NOT replaced or integrated with.

### Primary workflow
1. Open PWA on phone; search box is focused or immediately accessible.
2. Search local product catalog by name, brand, variant, keywords, category, or identifier.
3. Compare photograph, packaging description, weight/size, and brand; select matching product.
4. Show a large checkout code, its type, and verification status. If an actual verified barcode symbology is supported, render a scannable barcode; otherwise show numeric code for manual entry.
5. Return to checkout. Never automatically submit data to POS.

### Audience
Personal use by one cashier in v0.1. Architecture should allow optional shared catalog, contributor roles, and audit requests in future versions, but implement NONE of those now.

### Scope v0.1
- Mobile-first responsive PWA, touch targets >= 44px, quick launch, and offline local search.
- Instant local search with case-insensitive matching across name/brand/keywords/code, basic synonyms and category filters.
- Product list: photo, name, distinguishing variant/size, verification badge.
- Product detail: verified numeric identifiers prioritized above other fields; code type and copy action; render standards-compliant UPC-A/EAN-13/EAN-8 barcode when valid. Codes like PLU/store-specific numbers show numeric text only unless POS-supported barcode format is independently established.
- Favourites / saved, plus recently used product records. Recently updated can appear as a small home section, not a primary destination.
- Add/edit product, attach image reference, category, brand, variant, keywords. Warn about nearly identical variants.
- Add/edit/retire product identifier; support multiple identifiers; record source and rationale; never silently overwrite existing identifiers; preserve change history.
- Verification workflow and statuses: `unverified`, `packaging_verified`, `pos_verified`, `rejected`. Import defaults to `unverified`. Only verified codes are presented as checkout-ready; never infer verification from existence in public data. Packaging verification is not POS verification.
- Personal review queue for unverified entries and corrections, not an admin approval queue.
- Import/export JSON backup; optional CSV import with validation and preview. Avoid destructive imports; detect duplicate codes/products.
- Public data: a separate explicit action to import an individual public product record using official Open Food Facts endpoints, ideally by known barcode; user reviews before saving. Do not use remote API for every keystroke of lookup. Do not mass-crawl any retailer's site.
- Clearly label demonstration/sample entries as fictional or unverified; never imply example codes belong to pictured products.
- Offline search, product details, favourites, edits, and history. Network only for optional external enrichment.

### Out of scope
POS integration/replacement, scanner replacement, pricing/price override, inventory counts, workforce messaging, employee routing, manager accounts, login/multi-user sync, automated computer-vision recognition, arbitrary bulk retailer crawling, OCR pipeline, cloud deployment requirement.

### Navigation / IA
- `Search` (home; primary, with recent and frequent products)
- `Saved`
- `Catalog` (category browsing, filters)
- `Product Details` (search/saved/catalog -> detail)
- Secondary: `Add Product`, `Review Queue`, `Settings / Import & Export`
- Product Details actions: `Copy Code`, `Edit/Correct Code`, `Mark Verified`, `Save`.

### Suggested stack
- Vite, React, TypeScript
- React Router or equivalent lean routing
- Dexie + IndexedDB for local persistence (avoid plain localStorage as primary database)
- Zod for input/import validation
- JsBarcode or a maintained equivalent; validate EAN/UPC lengths, digits and checksums before rendering
- vite-plugin-pwa for installable/offline experience
- Vitest + Testing Library for unit/component tests; lightweight end-to-end smoke test where practical
- CSS solution: choose one consistent accessible approach; avoid heavy component libraries unless justified

### Data model
**products**
- `id: UUID` (internal app ID, distinct from a UPC)
- `name`, `brand?`, `category?`, `variant?`, `size?`, `keywords: string[]`, `imageUrl?`, `imageAttribution?`
- `createdAt`, `updatedAt`, `archivedAt?`

**identifiers**
- `id: UUID`, `productId: UUID`
- `code: string` (preserve leading zeros), `type: 'UPC_A'|'EAN_13'|'EAN_8'|'PLU'|'STORE_CODE'|'OTHER'`
- `verificationStatus`, `verifiedAt?`, `verificationMethod?`, `sourceId?`
- `isActive`, `createdAt`, `updatedAt`

**sources**
- `id: UUID`, `type: 'open_food_facts'|'packaging'|'authorized_reference'|'manual'`, `externalUrl?`, `externalId?`, `attribution?`, `capturedAt`

**events**
- `id: UUID`, `entityType`, `entityId`, `eventType`, `before?`, `after?`, `reason?`, `timestamp`
- Appends immutable revision events for identifier changes and verification actions.

**saved_products**
- `productId`, `savedAt`, `lastUsedAt?`, `useCount` (single-user v0.1; future identity can be added in a migration)

Do not require a `users` table in v0.1. Encapsulate repository and verification logic behind interfaces/modules for eventual server migration.

### Verification and barcode policy
- Public dataset records are **candidates**, not authoritative for local POS recognition.
- UPC-A is 12 digits, EAN-13 is 13, EAN-8 is 8; validate checksums. UPC/EAN barcode generator must encode exactly the stored verified code, including leading zeros.
- PLU and store codes are not automatically valid UPC/EAN barcodes. Default to numeric manual entry for them.
- New/modified codes revert to unverified until checked. Record packaging verification separately from POS verification.
- Do not permit visually plausible product similarities to substitute for verifying exact brand, size, variant, and identifier.
- Include a clear "Incorrect code" correction action and history view.

### Open Food Facts integration rules
- Use documented APIs and keep requests explicitly triggered by the user. Prefer current v3 product-read APIs where available.
- Rate-limit and cache responses. OFF documentation currently lists 10 search requests/min/IP and discourages search-as-you-type over its API; local search is the instant search experience.
- Use a descriptive client/application identification strategy compatible with official API guidance (a browser may restrict custom `User-Agent` headers).
- Respect ODbL database, CC BY-SA image, and attribution/share-alike requirements. Show attribution and preserve provenance in record metadata/export. Do not assume any OFF item is POS-verified.
- Handle missing images, incomplete names, discontinued variants, and API/offline failures gracefully.

### Security and ethics
- Only store product data acquired from public or otherwise permitted sources. Do not collect customer/employee identifying information or private store screens/documents.
- Do not claim Loblaw endorsement or affiliation. User is responsible for complying with workplace device and data handling policies.
- No passwords, accounts, sensitive personal data, analytics tracking or external data uploads needed for v0.1.

### Acceptance tests
1. User opens installed PWA offline, searches local records, opens result, retrieves a verified code.
2. Name, keywords, brand and numeric-code queries return expected matching products (including leading-zero UPCs).
3. Variants with similar names remain clearly distinguishable by size/brand/image.
4. UPC-A/EAN-13/EAN-8 inputs reject bad lengths, characters, and check digits; renderer creates correct symbols for valid values.
5. PLU/store codes are displayed numerically unless explicit tested symbology support exists.
6. Editing a verified identifier preserves its old value in history and marks new value unverified.
7. Imported public records enter the review queue, never immediately checkout-ready.
8. Duplicate identifier associations are flagged for review, not silently assigned.
9. Export JSON and restore into a fresh local database preserve products, identifiers, events, and attribution.
10. Missing network does not break previously saved local search; external lookup fails gracefully.
11. UI is usable on a 375px-wide viewport, with keyboard access, accessible labels, no horizontal overflow.
12. No pricing, POS integration, login, or admin approval screens exist in v0.1.

### Milestone order
1. Scaffold app, models, Dexie repository, sample fixture data, tests.
2. Search, catalog, saved, product detail, checksum validation, barcode rendering.
3. Add/edit products, identifier corrections, verification, audit trail, review queue.
4. Import/export, opt-in single-record OFF enrichment, offline PWA, full test pass.
5. Manual testing with a permitted verified sample catalog; measure time-to-code and incorrect selections.

### Definition of done
`npm install`, `npm run dev`, `npm run build`, and `npm test` work; documentation shows how to run and install PWA; no remote service or credential is required for local MVP; all acceptance tests passing or explicitly noted with actionable follow-ups. Working code, not just wireframes.
