const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const binaryCache = new Map();
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '..', 'uploads');
const PRODUCT_IMAGE_DIR = process.env.PRODUCT_IMAGE_DIR
  ? path.resolve(process.env.PRODUCT_IMAGE_DIR)
  : path.join(UPLOAD_ROOT, 'products');

function safeLocalPath(url) {
  if (!url || typeof url !== 'string' || !/^\/uploads\//i.test(url)) return null;
  const rel = url.replace(/^\/uploads\//i, '');
  const full = path.resolve(UPLOAD_ROOT, rel);
  if (full === UPLOAD_ROOT || !full.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return full;
}

function looksLikeImage(body, contentType = '') {
  if (!body || !body.length || body.length > MAX_IMAGE_BYTES) return false;
  if (/^image\//i.test(contentType)) return true;
  if (body.slice(0, 3).toString('hex') === 'ffd8ff') return true;
  if (body.slice(0, 8).toString('hex') === '89504e470d0a1a0a') return true;
  if (body.slice(0, 6).toString('ascii') === 'GIF87a' || body.slice(0, 6).toString('ascii') === 'GIF89a') return true;
  if (body.slice(0, 4).toString('ascii') === 'RIFF' && body.slice(8, 12).toString('ascii') === 'WEBP') return true;
  return false;
}

function contentTypeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  })[ext] || 'application/octet-stream';
}

function localUrlImages(product) {
  if (!product) return [];
  const explicit = [product.image, ...(Array.isArray(product.gallery) ? product.gallery : [])]
    .filter((u) => /^\/uploads\//i.test(String(u || '')));

  if (!fs.existsSync(PRODUCT_IMAGE_DIR)) return [...new Set(explicit)].slice(0, 5);

  const slug = String(product.model || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const productFiles = fs.readdirSync(PRODUCT_IMAGE_DIR)
    .filter((name) => name.startsWith(`${product.id}-`) && /\.(?:jpg|jpeg|png|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Prefer files matching the current model slug. If an administrator edited
  // the model text, fall back only to files with the same product ID; never
  // show another product's image.
  const exactPrefix = `${product.id}-${slug}-`;
  const exactFiles = productFiles.filter((name) => name.startsWith(exactPrefix));
  const catalogImages = (exactFiles.length ? exactFiles : productFiles)
    .map((name) => `/uploads/products/${name}`);

  // Admin-uploaded images are authoritative and come first. Catalog images are
  // used only when there is room in the gallery; no external URLs are fetched.
  return [...new Set([...explicit, ...catalogImages])].slice(0, 5);
}

function getLocalProductImages(product) {
  return localUrlImages(product);
}

async function getProductImages(product) {
  return localUrlImages(product).map((url) => url);
}


async function getProductImageBinary(product, index) {
  const images = localUrlImages(product);
  const url = images[index];
  if (!url) return null;

  const file = safeLocalPath(url);
  if (!file || !fs.existsSync(file)) return null;

  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) return null;

  const key = crypto.createHash('sha1').update(`${file}:${stat.size}:${stat.mtimeMs}`).digest('hex');
  if (binaryCache.has(key)) return binaryCache.get(key);

  const body = fs.readFileSync(file);
  const type = contentTypeFor(file);
  if (!looksLikeImage(body, type)) return null;

  const result = { body, type, etag: key };
  binaryCache.set(key, result);
  return result;
}

module.exports = {
  getProductImages,
  getProductImageBinary,
  getLocalProductImages,
  looksLikeImage
};
