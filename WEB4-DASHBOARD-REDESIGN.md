# Web4 UI Redesign — Corporate Premium + Analytics Dashboard

## Scope
- Refined the public site's visual rhythm, navigation section headings, hero area, product/service cards, brand chips, and feature showcase.
- Redesigned the Admin landing dashboard while preserving existing EJS variables and routes.
- No changes to authentication, 2FA, CSRF, database operations, upload handling, API routes, session store, Docker settings, or security middleware.

## Public site
- Warm off-white surfaces, forest-green accents, restrained brass details, subtle dotted textures and thin borders.
- Clearer typography and section rhythm.
- Card hover lift and gentle image zoom, with reduced-motion support.
- Feature showcase uses meaningful illustrations and compact supporting points rather than empty decorative space.
- Responsive behavior retained and refined for narrow screens.

## Admin dashboard
- Welcome panel with quick links to the public website and product management.
- Four summary KPI cards use current `stats.services`, `stats.products`, `stats.projects`, and `stats.news` values supplied by the server.
- Recent news table uses `latestNews`, with a helpful empty state when there are no news items.
- Quick-action links to products, services, projects, and banners.
- Help tip and public-site preview link.
- Responsive layouts for desktop, tablet, and mobile; reduced-motion support.
- No invented trend percentages or time-series analytics were added. Metrics reflect only the data currently supplied to the template.

## Verification
- `node scripts/audit.js` — AUDIT PASSED after UI changes.
- Audit covers route/template presence, EJS include resolution, JavaScript syntax, CSRF, upload validation, 2FA safeguards, CSP, atomic database writes, exact admin host validation, bounded sessions, and Docker health/security checks.
- Runtime browser QA was not performed in this build environment; run the application locally before deployment.

## Suggested local test
1. Extract ZIP into a new folder.
2. Run `npm install`.
3. Run `npm run audit`.
4. Run `npm start` and test the public homepage.
5. Test Admin login, 2FA, content CRUD, and uploads using the existing project setup.
