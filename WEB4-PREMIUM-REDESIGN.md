# Web4 Premium Redesign — Customer Website + Admin CMS

This revision upgrades the visual system across both the customer-facing website and the admin CMS while preserving existing routes, EJS templates, application logic, product data, image handling, authentication, CSRF protection, and two-factor authentication.

## Visual direction
- Premium corporate identity built around forest green, warm ivory, and restrained brass accents.
- Consistent typography hierarchy, 8px-based spacing rhythm, calmer borders, softer natural shadows, and more intentional whitespace.
- Customer website: improved header/navigation, page hero hierarchy, search and filter controls, product cards, brand sections, buying guide, and footer.
- Admin CMS: unified sidebar and top bar, cleaner KPI cards, tables, forms, focus states, login/OTP screens, and more usable responsive navigation.
- Mobile refinements for product cards, filters, content spacing, and admin navigation.
- Respects `prefers-reduced-motion` and keeps visible keyboard focus indicators.

## Validation
- `node scripts/audit.js` — PASSED after the style changes.
- JavaScript syntax, route/template checks, and security checks are included in the audit.
- A real-browser visual QA pass has not been performed in this environment; verify the site and admin screens on desktop and mobile before production deployment.
