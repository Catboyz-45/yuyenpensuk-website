const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const fail = [];
const ok = (msg) => console.log('✓ ' + msg);
const bad = (msg) => fail.push(msg);

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function walk(dir) {
  const out=[];
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const p=path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}

// Catalog integrity without requiring npm dependencies (catalog.js is a plain data module).
const catalog = require(path.join(root, 'catalog.js'));
if (catalog.length !== 30) bad(`catalog has ${catalog.length} products; expected 30`); else ok('catalog has 30 products');
const brands = [...new Set(catalog.map(x => x.brand))];
if (brands.length !== 6) bad(`catalog has ${brands.length} brands; expected 6`); else ok('catalog has 6 brands');
const keys = catalog.map(x => `${x.brand}|${x.model}`);
if (new Set(keys).size !== keys.length) bad('duplicate brand/model pair found'); else ok('all brand/model pairs are unique');
for (const p of catalog) {
  for (const k of ['id','brand','name','model','type','spec','description','source']) if (!p[k]) bad(`product ${p.id} missing ${k}`);
  if (!/^https:\/\//i.test(p.source)) bad(`product ${p.id} source is not HTTPS`);
}
if (!fail.some(x => /missing|source is/.test(x))) ok('all products have required identity/source fields');

// Source files / route targets.
const routeFiles = [
  'views/site/home.ejs','views/site/services.ejs','views/site/service-detail.ejs',
  'views/site/products.ejs','views/site/product-detail.ejs','views/site/brand.ejs',
  'views/site/projects.ejs','views/site/project-detail.ejs','views/site/pricing-install.ejs',
  'views/site/pricing-clean.ejs','views/site/payment.ejs','views/site/contact.ejs','views/site/404.ejs',
  'views/admin/dashboard.ejs','views/admin/company.ejs','views/admin/banners.ejs','views/admin/services.ejs',
  'views/admin/products.ejs','views/admin/projects.ejs','views/admin/news.ejs','views/admin/pricing.ejs',
  'views/admin/payment.ejs','views/admin/admins.ejs','views/admin/profile.ejs','views/admin/login.ejs','views/admin/otp.ejs','views/admin/error.ejs'
];
for (const f of routeFiles) if (!exists(f)) bad(`missing template ${f}`);
if (!fail.some(x => x.startsWith('missing template'))) ok('all route templates exist');

// EJS include targets.
for (const f of walk(path.join(root,'views')).filter(x => x.endsWith('.ejs'))) {
  const s=fs.readFileSync(f,'utf8');
  const re=/<%[-=]?\s*include\(['"]([^'"]+)['"]/g;
  let m;
  while ((m=re.exec(s))) {
    const base=path.dirname(f);
    const target=path.resolve(base,m[1]+'.ejs');
    if (!fs.existsSync(target)) bad(`missing include ${m[1]} referenced by ${path.relative(root,f)}`);
  }
}
if (!fail.some(x => x.startsWith('missing include'))) ok('all EJS includes resolve');

// JS syntax checks.
for (const f of walk(root).filter(x => x.endsWith('.js') && !x.includes('node_modules'))) {
  try { execFileSync(process.execPath, ['--check', f], {stdio:'pipe'}); }
  catch { bad(`JavaScript syntax error: ${path.relative(root,f)}`); }
}
if (!fail.some(x => x.startsWith('JavaScript syntax'))) ok('all JavaScript files pass syntax check');

// Customer-facing pages must not expose source/reference URLs or admin navigation.
for (const f of walk(path.join(root,'views/site')).filter(x => x.endsWith('.ejs'))) {
  const s=fs.readFileSync(f,'utf8');
  if (/href=["'][^"']*\/admin\b/i.test(s)) bad(`admin link exposed in ${path.relative(root,f)}`);
  if (/IMAGE_SOURCES|แหล่งที่มา|source URL|อ้างอิงรูป/i.test(s)) bad(`source/reference text exposed in ${path.relative(root,f)}`);
}
if (!fail.some(x => x.includes('admin link exposed'))) ok('no admin navigation exposed in customer pages');
if (!fail.some(x => x.includes('source/reference text'))) ok('no image source/reference text exposed in customer pages');

// Production image architecture: all product images are local files.
const imageUtil = read('utils/product-images.js');
for (const required of ['getProductImages','getProductImageBinary','getLocalProductImages','looksLikeImage']) {
  if (!imageUtil.includes(required)) bad(`image utility missing ${required}`);
}
if (/fetch\s*\(/.test(imageUtil) || /https?:\/\//i.test(imageUtil)) bad('runtime product image utility contains external fetch logic');
else ok('runtime product images are local-only');
if (!fail.some(x => x.startsWith('image utility'))) ok('product image utility has local proxy and validation logic');

const productJpgs = exists('uploads/products')
  ? walk(path.join(root, 'uploads/products')).filter(x => /\.jpg$/i.test(x))
  : [];
if (productJpgs.length < 1) bad('no local product JPGs found');
else ok(`local product JPGs present: ${productJpgs.length}`);

// Site/admin endpoints must be present.
const siteRoutes=read('routes/site.js');
const adminRoutes=read('routes/admin.js');
if (siteRoutes.includes('images.pexels.com')) bad('customer runtime contains external hero image fallback'); else ok('customer runtime has no external hero image fallback');
for (const s of [siteRoutes, adminRoutes]) {
  if (!s.includes('/api/product-gallery/:id')) bad('missing product gallery endpoint');
  if (!s.includes('/api/product-image/:id/:index')) bad('missing product image endpoint');
}
if (!fail.some(x => x.includes('missing product'))) ok('site and admin image endpoints exist');

// Production health check must match deployment docs/compose.
const deploy=read('deploy-server.js');
const compose=read('docker-compose.yml');
if (!deploy.includes('root.get("/healthz"') || !compose.includes('/healthz')) bad('healthcheck route mismatch');
else ok('Docker healthcheck matches /healthz');

// Forms that mutate admin data must carry CSRF tokens (except pages with no forms).
for (const f of walk(path.join(root,'views/admin')).filter(x => x.endsWith('.ejs'))) {
  const s=fs.readFileSync(f,'utf8');
  if (/<form\b[^>]*method=["']post/i.test(s) && !s.includes('name="_csrf"')) bad(`POST form without CSRF token in ${path.relative(root,f)}`);
}
if (!fail.some(x => x.startsWith('POST form without'))) ok('all admin POST forms include CSRF tokens');

// Production hardening checks.
const pkg = JSON.parse(read('package.json'));
if (String(pkg.dependencies.multer || '') !== '2.4.0') bad('multer must be pinned to 2.4.0'); else ok('multer is pinned to 2.4.0');
for (const [name, version] of Object.entries(pkg.dependencies)) { if (/^[~^><=*]/.test(String(version))) bad(`${name} must be pinned to an exact version`); }
if (!fail.some(x => x.includes('must be pinned to an exact version'))) ok('direct production dependencies are pinned to exact versions');
const adminSrc = read('routes/admin.js');
if (/router\.get\(["']\/logout/.test(adminSrc)) bad('logout must not be GET'); else ok('logout is POST-only');
if (!adminSrc.includes('fileSize: 10 * 1024 * 1024') || !adminSrc.includes('files: 10') || !adminSrc.includes('parts: 100') || !adminSrc.includes('fieldArrayIndexLimit: 100')) bad('upload limits are incomplete'); else ok('upload request limits are configured');
if (!adminSrc.includes('detectUploadKind') || !adminSrc.includes('ชนิดไฟล์ไม่ตรงกับไฟล์จริง')) bad('upload magic-byte validation missing'); else ok('upload magic-byte validation is enabled');
if (!adminSrc.includes('รหัสผ่านปัจจุบันไม่ถูกต้อง') || !adminSrc.includes('ต้องยืนยันรหัส OTP ปัจจุบันก่อนปิดใช้ 2FA')) bad('2FA disable re-authentication missing'); else ok('2FA disable requires password and current OTP');
if (!read('middleware/securityHeaders.js').includes('Content-Security-Policy')) bad('CSP header missing'); else ok('Content-Security-Policy is enabled');
if (!read('database.js').includes('fs.renameSync(tmp, DB_PATH)')) bad('database writes are not atomic'); else ok('database writes are atomic');
if (!deploy.includes('host === allowedAdminHost') || deploy.includes('startsWith(ADMIN_SUBDOMAIN)')) bad('admin host validation is not exact'); else ok('admin host validation is exact');
if (!deploy.includes('BoundedSessionStore')) bad('bounded session store missing'); else ok('bounded session store is enabled');
if (exists('server.js') || exists('admin-server.js')) bad('standalone server files should not be shipped in production final'); else ok('standalone development servers removed');
if (exists('package-lock.json')) ok('package-lock.json present'); else ok('package-lock.json not bundled; direct production dependencies are exact-pinned (generate lockfile in CI before release)');
if (String(pkg.dependencies.express || '') !== '4.22.2') bad('express must be pinned to 4.22.2'); else ok('express is pinned to 4.22.2');
if (String(pkg.dependencies['express-session'] || '') !== '1.19.0') bad('express-session must be pinned to 1.19.0'); else ok('express-session is pinned to 1.19.0');
if (String(pkg.dependencies.qrcode || '') !== '1.5.4') bad('qrcode must be pinned to 1.5.4'); else ok('qrcode is pinned to 1.5.4');
if (!pkg.overrides || String(pkg.overrides.yargs || '') !== '17.7.2') bad('qrcode/yargs transitive dependency must be overridden to yargs 17.7.2'); else ok('qrcode transitive yargs is overridden to 17.7.2');
if (!adminSrc.includes('tempPasswordNotice') || /res\.redirect\("\/admin\/admins\?tempPw=/.test(adminSrc)) bad('temporary admin passwords must not be placed in query strings'); else ok('temporary admin passwords are flashed through the session, not URLs');
if (!deploy.includes('SITE_URL must use HTTPS in production')) bad('production SITE_URL must require HTTPS'); else ok('production SITE_URL requires HTTPS');
if (!deploy.includes('TRUST_PROXY')) bad('proxy trust must be explicitly configured'); else ok('proxy trust is explicitly configured');
if (!adminSrc.includes(String.raw`facebook\.com`)) bad('company Facebook URL validation missing'); else ok('company Facebook URL is allowlisted');
if (!adminSrc.includes('cleanupUploadedFiles(req);\n        console.error')) bad('orphan upload cleanup on save failure missing'); else ok('orphan uploads are cleaned on save failure');

if (fail.length) {
  console.error('\nAUDIT FAILED:');
  for (const x of fail) console.error('✗ ' + x);
  process.exit(1);
}
console.log('\nAUDIT PASSED');
