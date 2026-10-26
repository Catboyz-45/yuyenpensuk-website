/** routes/admin.js — ระบบจัดการเว็บไซต์ (CMS): Login → 2FA → Dashboard → CRUD */
const express = require("express");
const router = express.Router();
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const database = require("../database");
const { requireAuth, requireSuperAdmin } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");
const { getProductImages, getProductImageBinary } = require('../utils/product-images');

const fs = require("fs");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = () => database.get();
const save = () => database.save();

/* ---------- อัปโหลดไฟล์ (ตรวจ extension + magic bytes) ---------- */
const ALLOWED_UPLOADS = new Map([
  [".jpg", { mime: "image/jpeg", kind: "jpeg" }],
  [".jpeg", { mime: "image/jpeg", kind: "jpeg" }],
  [".png", { mime: "image/png", kind: "png" }],
  [".webp", { mime: "image/webp", kind: "webp" }],
  [".gif", { mime: "image/gif", kind: "gif" }],
  [".pdf", { mime: "application/pdf", kind: "pdf" }]
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
    fields: 80,
    parts: 100,
    fieldNameSize: 100,
    fieldSize: 256 * 1024,
    fieldArrayIndexLimit: 100
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = ALLOWED_UPLOADS.get(ext);
    cb(allowed ? null : new Error("รองรับเฉพาะ JPG, PNG, WEBP, GIF และ PDF"), !!allowed);
  }
});

function uploadedFiles(req) { return Array.isArray(req.files) ? req.files : []; }
function cleanupUploadedFiles(req) {
  for (const file of uploadedFiles(req)) {
    try { if (file.path) fs.unlinkSync(file.path); } catch {}
  }
}
function detectUploadKind(filePath) {
  const b = fs.readFileSync(filePath);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "png";
  if (b.length >= 6 && (b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a")) return "gif";
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (b.length >= 5 && b.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  return null;
}
function validateUploadedFiles(req) {
  const extByKind = { jpeg: ".jpg", png: ".png", webp: ".webp", gif: ".gif", pdf: ".pdf" };
  for (const file of uploadedFiles(req)) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const declared = ALLOWED_UPLOADS.get(ext);
    const actual = detectUploadKind(file.path);
    if (!declared || actual !== declared.kind) {
      cleanupUploadedFiles(req);
      throw new Error("ชนิดไฟล์ไม่ตรงกับไฟล์จริง");
    }
    const canonicalExt = extByKind[actual];
    const canonical = file.path.replace(/\.[^.]+$/, canonicalExt);
    if (canonical !== file.path) {
      fs.renameSync(file.path, canonical);
      file.path = canonical;
      file.filename = path.basename(canonical);
    }
  }
}

/* ---------- helper ---------- */
// สุ่มรหัสผ่านชั่วคราวที่คาดเดาไม่ได้ (ใช้ตอนสร้างแอดมินใหม่/รีเซ็ตรหัสผ่าน แทนค่าคงที่เดิม)
const genTempPassword = () => crypto.randomBytes(12).toString("base64url").slice(0, 16);

function flashTempPassword(req, username, password) {
  req.session.tempPasswordNotice = { username, password, createdAt: Date.now() };
}

// ตรวจ CSRF token สำหรับ route ที่อัปโหลดไฟล์ (multipart) — เช็คทีหลัง middleware กลาง
// เพราะตอนนั้น req.body ยังไม่พร้อมจนกว่า multer จะ parse เสร็จก่อน
function csrfOk(req) {
  return !!(req.body && req.body._csrf && req.body._csrf === req.session.csrfToken);
}
function csrfFail(res) {
  return res.status(403).render("admin/error", {
    title: "คำขอไม่ผ่านการตรวจสอบความปลอดภัย",
    message: "อาจเป็นเพราะฟอร์มหมดอายุ (เปิดค้างไว้นานเกินไป) กรุณากลับไปหน้าเดิมแล้วลองใหม่อีกครั้ง"
  });
}
const me = (req) => db().admins.find((a) => a.id === req.session.adminId);
const fileOf = (req, field) => {
  const f = (req.files || []).find((x) => x.fieldname === field);
  return f ? "/uploads/" + f.filename : "";
};
// เหมือน fileOf แต่คืนทุกไฟล์ที่ชื่อ field เดียวกัน (สำหรับอัปโหลดหลายรูป เช่น แกลเลอรีสินค้า)
const filesOf = (req, field) =>
  (req.files || []).filter((x) => x.fieldname === field).map((f) => "/uploads/" + f.filename);

function localUploadPath(url) {
  if (!url || typeof url !== "string" || !/^\/uploads\//i.test(url)) return null;
  const root = path.resolve(UPLOAD_DIR);
  const full = path.resolve(root, url.replace(/^\/uploads\//i, ""));
  if (full === root || !full.startsWith(root + path.sep)) return null;
  return full;
}

function removeReplacedFile(url, keep = new Set()) {
  const full = localUploadPath(url);
  if (!full || keep.has(full)) return;
  try { if (fs.existsSync(full)) fs.unlinkSync(full); } catch {}
}

// Delete a local upload only if no CMS record still refers to its URL.
// Covers both shared images and cover/gallery swaps.
function removeIfUnreferenced(url) {
  if (!localUploadPath(url)) return;
  const data = db();
  const referenced = Object.values(data).some((table) =>
    Array.isArray(table) && table.some((record) => record && typeof record === "object" &&
      (record.image === url || record.logo === url || record.catalog === url ||
       (Array.isArray(record.gallery) && record.gallery.includes(url))))
  );
  if (!referenced) removeReplacedFile(url);
}

// แปลง textarea (บรรทัดละ 1 รายการ) <-> array ของ string เช่น ขั้นตอนงาน, สิ่งที่รวมในราคา
const parseList = (text) => (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
const listToText = (list) => (list || []).join("\n");
// แปลง textarea (บรรทัดละ 1 แถว คั่นคอลัมน์ด้วย " | ") <-> array ของ array เช่น ตารางราคา
const parseRows = (text) =>
  (text || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.split("|").map((c) => c.trim()));
const rowsToText = (rows) => (rows || []).map((r) => r.join(" | ")).join("\n");

/* ==================================================
 * เข้าสู่ระบบ + 2FA
 * ================================================== */
router.get("/login", (req, res) => {
  if (req.session.adminId) return res.redirect("/admin");
  res.render("admin/login", { error: null });
});

router.post("/login", rateLimit.checkLimit("login"), (req, res) => {
  const { username, password } = req.body;
  const admin = db().admins.find((a) => a.username === (username || "").trim());
  if (!admin || !bcrypt.compareSync(password || "", admin.password_hash)) {
    rateLimit.recordFailure(req, "login");
    return res.render("admin/login", { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  }
  rateLimit.recordSuccess(req, "login");
  req.session.regenerate((err) => {
    if (err) return res.status(500).render("admin/login", { error: "ไม่สามารถเริ่มเซสชันได้ กรุณาลองใหม่" });
    if (admin.twofa_enabled) {
      req.session.pendingId = admin.id;
      return res.redirect("/admin/otp");
    }
    req.session.adminId = admin.id;
    res.redirect("/admin");
  });
});

router.get("/otp", (req, res) => {
  if (!req.session.pendingId) return res.redirect("/admin/login");
  res.render("admin/otp", { error: null });
});

router.post("/otp", rateLimit.checkLimit("otp"), (req, res) => {
  const admin = db().admins.find((a) => a.id === req.session.pendingId);
  if (!admin) return res.redirect("/admin/login");
  const token = (req.body.token || "").replace(/\s/g, "");
  if (authenticator.check(token, admin.twofa_secret)) {
    rateLimit.recordSuccess(req, "otp");
    return req.session.regenerate((err) => {
      if (err) return res.status(500).render("admin/otp", { error: "ไม่สามารถเริ่มเซสชันได้ กรุณาลองใหม่" });
      req.session.adminId = admin.id;
      res.redirect("/admin");
    });
  }
  rateLimit.recordFailure(req, "otp");
  res.render("admin/otp", { error: "รหัส OTP ไม่ถูกต้อง ลองใหม่อีกครั้ง" });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

/* ==================================================
 * Dashboard
 * ================================================== */
router.get("/", requireAuth, (req, res) => {
  const d = db();
  res.render("admin/dashboard", {
    me: me(req), page: "dash",
    stats: { services: d.services.length, products: d.products.length, projects: d.projects.length, news: d.news.length },
    latestNews: [...d.news].sort((a, b) => b.id - a.id).slice(0, 3)
  });
});

/* ==================================================
 * จุดเด่นบริษัท — CMS (แยกจากข้อมูลบริษัทเดิม)
 * ================================================== */
function ensureHomeFeatures() {
  const d = db();
  if (!Array.isArray(d.homeFeatures)) {
    const c = d.company || {};
    d.homeFeatures = [
      { id: 1, title: "ทีมช่างมืออาชีพ", subtitle: "PROFESSIONAL TEAM", description: "ชำนาญงานเครื่องปรับอากาศโดยเฉพาะ ให้ความสำคัญกับความเรียบร้อยและความปลอดภัยในทุกขั้นตอน", points: ["ตรวจสอบหน้างานก่อนเริ่มงาน", "อธิบายขั้นตอนให้เข้าใจก่อนดำเนินการ"], image: c.homepage_team_image || "https://images.pexels.com/photos/8065903/pexels-photo-8065903.jpeg?auto=compress&cs=tinysrgb&w=1200", sort: 1, active: true },
      { id: 2, title: "แอร์ของแท้ 100%", subtitle: "GENUINE PRODUCTS", description: "คัดสรรเครื่องปรับอากาศจากแบรนด์ชั้นนำ พร้อมข้อมูลสินค้าและเงื่อนไขการรับประกันจากศูนย์", points: ["แบรนด์ชั้นนำ 6 ยี่ห้อ", "แจ้งรายละเอียดและการรับประกันชัดเจน"], image: c.homepage_product_image || "/uploads/products/101-ftkf-yv2s-1.jpg", sort: 2, active: true },
      { id: 3, title: "บริการรวดเร็ว", subtitle: "FAST RESPONSE", description: "ประสานงานนัดหมายเข้าหน้างานภายใน 24 ชั่วโมง พร้อมแจ้งรายละเอียดและราคาก่อนเริ่มงานทุกครั้ง", points: ["นัดหมายและประสานงานชัดเจน", "สอบถามรายละเอียดก่อนตัดสินใจได้"], image: c.homepage_service_image || "https://images.pexels.com/photos/30572791/pexels-photo-30572791.jpeg?auto=compress&cs=tinysrgb&w=1200", sort: 3, active: true }
    ];
    save();
  }
  return d.homeFeatures;
}
router.get("/home-features", requireAuth, (req, res) => {
  const rows = ensureHomeFeatures();
  const editing = req.query.edit ? rows.find(x => x.id === Number(req.query.edit)) : null;
  res.render("admin/home-features", { me: me(req), page: "home-features", rows: [...rows].sort((a,b)=>(a.sort||0)-(b.sort||0)), editing, err: req.query.err || null });
});
router.post("/home-features/save", requireAuth, (req, res) => {
  upload.any()(req, res, (uploadErr) => {
    if (uploadErr) { cleanupUploadedFiles(req); return res.redirect("/admin/home-features?err=" + encodeURIComponent(uploadErr.message)); }
    if (!csrfOk(req)) { cleanupUploadedFiles(req); return csrfFail(res); }
    try {
      validateUploadedFiles(req);
      const files = uploadedFiles(req);
      if (files.some(f => f.fieldname !== "image" || !["jpeg","png","webp"].includes(detectUploadKind(f.path)))) {
        cleanupUploadedFiles(req);
        return res.redirect("/admin/home-features?err=" + encodeURIComponent("รูปภาพต้องเป็น JPG, PNG หรือ WebP เท่านั้น"));
      }
      const rows = ensureHomeFeatures();
      const id = Number(req.body.id) || 0;
      const old = id ? rows.find(x => x.id === id) : null;
      if (id && !old) { cleanupUploadedFiles(req); return res.redirect("/admin/home-features?err=not-found"); }
      const title = String(req.body.title || "").trim().slice(0,120);
      if (!title) { cleanupUploadedFiles(req); return res.redirect("/admin/home-features?err=required-title"); }
      const image = fileOf(req, "image") || (old ? old.image : "");
      const row = {
        title, subtitle: String(req.body.subtitle || "").trim().slice(0,80),
        description: String(req.body.description || "").trim().slice(0,800),
        points: parseList(String(req.body.points || "")).slice(0,8).map(x=>x.slice(0,180)),
        image, sort: Math.max(1, Math.min(9999, Number(req.body.sort) || rows.length+1)),
        active: req.body.active === "on"
      };
      if (old) Object.assign(old, row);
      else rows.push({ id: database.nextId(rows), ...row });
      save();
      // ไม่ลบไฟล์รูปเดิมอัตโนมัติ: อาจมีส่วนอื่นอ้างอิงรูปเดียวกัน
      res.redirect("/admin/home-features");
    } catch (e) {
      cleanupUploadedFiles(req);
      console.error("home-features save error:", e);
      res.redirect("/admin/home-features?err=save-failed");
    }
  });
});
router.post("/home-features/delete/:id", requireAuth, (req, res) => {
  if (!csrfOk(req)) return csrfFail(res);
  const rows = ensureHomeFeatures();
  const id = Number(req.params.id);
  const idx = rows.findIndex(x => x.id === id);
  if (idx >= 0) { rows.splice(idx, 1); save(); }
  // ไม่ลบไฟล์รูปที่อัปโหลดไว้ เพื่อป้องกันกระทบส่วนอื่น
  res.redirect("/admin/home-features");
});

/* ==================================================
 * ข้อมูลบริษัท
 * ================================================== */
router.get("/company", requireAuth, (req, res) =>
  res.render("admin/company", { me: me(req), page: "company", c: db().company, saved: req.query.saved, err: req.query.err || null })
);
router.post("/company", requireAuth, (req, res) => {
  upload.any()(req, res, (uploadErr) => {
    if (uploadErr) {
      cleanupUploadedFiles(req);
      const msg =
        uploadErr.code === "LIMIT_FILE_SIZE"
          ? "ไฟล์มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 10MB)"
          : uploadErr.message || "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
      return res.redirect("/admin/company?err=" + encodeURIComponent(msg));
    }
    if (!csrfOk(req)) { cleanupUploadedFiles(req); return csrfFail(res); }
    try { validateUploadedFiles(req); } catch (e) { cleanupUploadedFiles(req); return res.redirect("/admin/company?err=" + encodeURIComponent(e.message)); }
    const c = db().company;
    ["name", "tax_id", "address", "phone", "email", "facebook", "line", "history", "vision", "mission"].forEach(
      (k) => (c[k] = req.body[k] || "")
    );
    // ตรวจสอบ maps_url ว่าเป็นลิงก์ https จริง ก่อนบันทึก (จะถูกฝังลง <iframe> ในหน้าเว็บสาธารณะ)
    const mapsUrl = (req.body.maps_url || "").trim();
    c.maps_url = mapsUrl && /^https:\/\//i.test(mapsUrl) ? mapsUrl : "";
    const facebook = (req.body.facebook || "").trim();
    c.facebook = facebook && /^https:\/\/(?:www\.)?facebook\.com\//i.test(facebook) ? facebook : "";
    const logo = fileOf(req, "logo");
    if (logo) { removeReplacedFile(c.logo); c.logo = logo; }
    if (c.facebook && !/^https:\/\//i.test(c.facebook)) c.facebook = "";

    const homepageFields = [
      "homepage_team_image",
      "homepage_product_image",
      "homepage_service_image"
    ];
    const homepageUploads = (req.files || []).filter(
      f => homepageFields.includes(f.fieldname)
    );

    if (homepageUploads.some(f => !["jpeg", "png", "webp"].includes(detectUploadKind(f.path)))) {
      cleanupUploadedFiles(req);
      return res.redirect("/admin/company?err=" +
        encodeURIComponent("รูปหน้าแรกต้องเป็น JPG, PNG หรือ WebP เท่านั้น"));
    }

    for (const field of homepageFields) {
      const newImage = fileOf(req, field);
      if (newImage) c[field] = newImage;
    }

    const heroTitle = (req.body.homepage_hero_title || "").trim();
    const heroDesc = (req.body.homepage_hero_description || "").trim();
    c.homepage_hero_title = heroTitle.slice(0, 160);
    c.homepage_hero_description = heroDesc.slice(0, 600);

    save();
    res.redirect("/admin/company?saved=1");
  });
});

/* ==================================================
 * โรงงาน CRUD ใช้ร่วมกัน (banner/service/product/project/news)
 * ================================================== */

function crud(name, table, view, mapBody) {
  // รายการ + ฟอร์ม (แก้ไขผ่าน ?edit=id)
  router.get("/" + name, requireAuth, (req, res) => {
    const editing = req.query.edit ? db()[table].find((r) => r.id === +req.query.edit) : null;
    res.render("admin/" + view, { me: me(req), page: name, rows: db()[table], editing, presetBrand: req.query.brand || "", brandList: brandCategories(), err: req.query.err || null });
  });
  // บันทึก (สร้าง/แก้ไข) — ดักข้อผิดพลาดจากการอัปโหลดไฟล์ (ประเภทผิด/ขนาดเกิน) ไม่ให้ขึ้นจอขาว
  router.post("/" + name + "/save", requireAuth, (req, res) => {
    upload.any()(req, res, (uploadErr) => {
      if (uploadErr) {
        cleanupUploadedFiles(req);
        const msg =
          uploadErr.code === "LIMIT_FILE_SIZE"
            ? "ไฟล์มีขนาดใหญ่เกินไป (จำกัดไม่เกิน 10MB ต่อไฟล์)"
            : uploadErr.message || "อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
        return res.redirect("/admin/" + name + "?err=" + encodeURIComponent(msg));
      }
      if (!csrfOk(req)) { cleanupUploadedFiles(req); return csrfFail(res); }
      try {
        validateUploadedFiles(req);
        const t = db()[table];
        const id = +req.body.id || 0;
        const row = id ? t.find((r) => r.id === id) : null;
        const data = mapBody(req, row);
        // Persist first. Never delete a referenced upload before the database commit.
        const previous = row ? { ...row, gallery: Array.isArray(row.gallery) ? row.gallery.slice() : row.gallery } : null;
        const created = !row;
        const next = created ? { id: database.nextId(t), ...data } : null;
        if (row) Object.assign(row, data);
        else t.push(next);
        try {
          save();
        } catch (persistErr) {
          if (row) {
            for (const key of Object.keys(row)) delete row[key];
            Object.assign(row, previous);
          } else {
            const index = t.indexOf(next);
            if (index !== -1) t.splice(index, 1);
          }
          throw persistErr;
        }
        // Cleanup is best-effort and runs only AFTER a successful commit.
        // Avoid deleting shared files still referenced elsewhere in the CMS.
        if (previous) {
          const before = [previous.image, previous.logo, previous.catalog, ...(Array.isArray(previous.gallery) ? previous.gallery : [])];
          for (const url of new Set(before)) removeIfUnreferenced(url);
        }
        res.redirect("/admin/" + name);
      } catch (e) {
        cleanupUploadedFiles(req);
        console.error("บันทึกข้อมูลผิดพลาด:", e);
        res.redirect("/admin/" + name + "?err=" + encodeURIComponent("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง"));
      }
    });
  });
  // ลบ
  router.post("/" + name + "/delete/:id", requireAuth, (req, res) => {
    const t = db()[table];
    const index = t.findIndex((r) => r.id === +req.params.id);
    if (index < 0) return res.redirect("/admin/" + name);
    const old = t[index];
    t.splice(index, 1);
    try {
      save();
    } catch (err) {
      t.splice(index, 0, old);
      console.error("ลบข้อมูลไม่สำเร็จ:", err);
      return res.redirect("/admin/" + name + "?err=" + encodeURIComponent("บันทึกการลบไม่สำเร็จ กรุณาลองใหม่"));
    }
    const oldUrls = [old.image, old.logo, old.catalog, ...(Array.isArray(old.gallery) ? old.gallery : [])];
    for (const url of new Set(oldUrls)) removeIfUnreferenced(url);
    res.redirect("/admin/" + name);
  });
}

/* Banner (+ เปิด/ปิดการแสดงผล) */
crud("banners", "banners", "banners", (req, row) => ({
  title: req.body.title || "",
  sort: +req.body.sort || 1,
  active: req.body.active === "on",
  image: fileOf(req, "image") || (row ? row.image : "")
}));
router.post("/banners/toggle/:id", requireAuth, (req, res) => {
  const b = db().banners.find((r) => r.id === +req.params.id);
  if (b) { b.active = !b.active; save(); }
  res.redirect("/admin/banners");
});

/* บริการ */
crud("services", "services", "services", (req, row) => ({
  title: req.body.title || "",
  icon: req.body.icon || "mdi:air-conditioner",
  description: req.body.description || "",
  long: req.body.long || req.body.description || "",
  steps: parseList(req.body.steps).length ? parseList(req.body.steps) : row ? row.steps : [],
  image: fileOf(req, "image") || (row ? row.image : ""),
  updated_at: new Date().toISOString()
}));

/* แกลเลอรีรูปสินค้า Local — ใช้ดูรูปในหลังบ้านจากพื้นที่ uploads ถาวร */
router.get('/api/product-gallery/:id', requireAuth, async (req, res) => {
  const product = db().products.find(x => x.id === +req.params.id);
  if (!product) return res.status(404).json({ images: [] });
  res.json({ images: await getProductImages(product) });
});

router.get('/api/product-image/:id/:index', requireAuth, async (req, res) => {
  const product = db().products.find(x => x.id === +req.params.id);
  const index = Number(req.params.index);
  if (!product || !Number.isInteger(index) || index < 0 || index > 4) return res.sendStatus(404);
  const image = await getProductImageBinary(product, index);
  if (!image) return res.sendStatus(404);
  res.set('Content-Type', image.type);
  res.set('Cache-Control', 'private, max-age=2592000, immutable');
  res.set('ETag', image.etag);
  res.send(image.body);
});


/* Brand category manager: persisted in existing JSON DB; protects products on delete. */
const DEFAULT_BRANDS = ["DAIKIN", "MITSUBISHI ELECTRIC", "CARRIER", "SAIJO DENKI", "PANASONIC", "LG"];
function brandCategories() {
  const data = db();
  if (!Array.isArray(data.productBrands)) {
    data.productBrands = [];
    for (const name of [...DEFAULT_BRANDS, ...data.products.map(p => String(p.brand || "").trim()).filter(Boolean)]) {
      if (!data.productBrands.some(b => b.name.toUpperCase() === name.toUpperCase()))
        data.productBrands.push({ id: database.nextId(data.productBrands), name, logo: DEFAULT_BRANDS.includes(name) ? "/images/brand-logos/" + DEFAULT_BRANDS.indexOf(name) + ".svg" : "" });
    }
    save();
  }
  return data.productBrands;
}
router.get('/product-brands', requireAuth, (req,res) => {
  res.render('admin/product-brands', {me:me(req),page:'products',brands:brandCategories(),products:db().products,csrfToken:req.session.csrfToken,err:req.query.err||'',ok:req.query.ok||''});
});
router.post('/product-brands/save', requireAuth, (req,res) => {
  upload.single('logo')(req,res,(uploadErr) => {
    if (uploadErr) { cleanupUploadedFiles(req); return res.redirect('/admin/product-brands?err='+encodeURIComponent(uploadErr.message)); }
    // multer.single sets req.file, while shared cleanup expects req.files
    req.files = req.file ? [req.file] : [];
    if (!csrfOk(req)) { cleanupUploadedFiles(req); return csrfFail(res); }
    try {
      validateUploadedFiles(req);
      if (req.file && !['jpeg','png','webp'].includes(detectUploadKind(req.file.path))) throw Error('รองรับโลโก้ JPG PNG WEBP เท่านั้น');
      const name=String(req.body.name||'').trim().replace(/\s+/g,' ');
      if (!name || name.length>80) throw Error('กรุณาระบุชื่อแบรนด์ไม่เกิน 80 ตัวอักษร');
      const list=brandCategories(), id=Number(req.body.id)||0;
      const existing=id?list.find(b=>b.id===id):null;
      if (id&&!existing) throw Error('ไม่พบแบรนด์ที่แก้ไข');
      if (list.some(b=>b!==existing && b.name.toUpperCase()===name.toUpperCase())) throw Error('ชื่อแบรนด์ซ้ำ');
      const oldName=existing?existing.name:null,oldLogo=existing?existing.logo:'';
      const logo=req.file?fileOf(req,'logo'):'';
      // fileOf reads req.files set above
      if (existing) { existing.name=name; if (logo) existing.logo=logo; }
      else list.push({id:database.nextId(list),name,logo});
      const changed=[];
      if (oldName && oldName!==name) for(const p of db().products) if(p.brand===oldName){changed.push(p);p.brand=name;}
      try { save(); } catch(e) { if(existing){existing.name=oldName;existing.logo=oldLogo;}else list.pop();for(const p of changed)p.brand=oldName;throw e; }
      if(oldLogo && logo) removeIfUnreferenced(oldLogo);
      res.redirect('/admin/product-brands?ok=1');
    } catch(e) { cleanupUploadedFiles(req); res.redirect('/admin/product-brands?err='+encodeURIComponent(e.message)); }
  });
});
router.post('/product-brands/delete/:id',requireAuth,(req,res)=>{
  if(!csrfOk(req))return csrfFail(res);
  const list=brandCategories(),i=list.findIndex(b=>b.id===Number(req.params.id));
  if(i<0)return res.redirect('/admin/product-brands?err=not-found');
  const brand=list[i];
  if(db().products.some(p=>String(p.brand||'').toUpperCase()===brand.name.toUpperCase()))return res.redirect('/admin/product-brands?err='+encodeURIComponent('ไม่สามารถลบแบรนด์ที่ยังมีสินค้าอยู่'));
  list.splice(i,1);
  try { save(); } catch(e) {list.splice(i,0,brand);return res.redirect('/admin/product-brands?err=save-failed');}
  removeIfUnreferenced(brand.logo);
  res.redirect('/admin/product-brands?ok=1');
});

/* สินค้า (รูปหลัก + แกลเลอรีหลายรูป + PDF Catalog) */
crud("products", "products", "products", (req, row) => {
  const newGallery = filesOf(req, "gallery");
  const uploadedCover = fileOf(req, "image");
  const oldGallery = row && Array.isArray(row.gallery) ? row.gallery : [];
  const clear = req.body.clearGallery === "on";
  const requestedCover = String(req.body.coverFromGallery || "");
  const orderRaw = String(req.body.galleryOrder || "");
  let gallery = newGallery.length ? newGallery : clear ? [] : oldGallery.slice();
  let image = uploadedCover || (row ? row.image : "");

  if (orderRaw && !newGallery.length && !clear) {
    let order;
    try { order = JSON.parse(orderRaw); } catch { throw new Error("galleryOrder is not JSON"); }
    if (!Array.isArray(order) || order.length !== oldGallery.length ||
        order.some(x => typeof x !== "string") ||
        new Set(order).size !== order.length ||
        order.some(x => !oldGallery.includes(x))) {
      throw new Error("Invalid saved gallery order");
    }
    gallery = order;
  }

  if (requestedCover) {
    if (!row || !oldGallery.includes(requestedCover) || newGallery.length || clear || uploadedCover) {
      throw new Error("Invalid gallery cover selection");
    }
    // Move the previous cover into the gallery; do not delete either image.
    gallery = gallery.filter(url => url !== requestedCover);
    if (image && image !== requestedCover) gallery.unshift(image);
    image = requestedCover;
  }
  if (gallery.length > 5) throw new Error("Gallery exceeds five images");

  return {
    name: req.body.name || "",
    brand: (req.body.brand || "").toUpperCase(),
    model: req.body.model || "",
    type: req.body.type || "",
    spec: req.body.spec || "",
    price: +req.body.price || 0,
    priceOld: +req.body.priceOld || 0,
    badge: req.body.badge || "",
    bestseller: req.body.bestseller === "on",
    description: req.body.description || "",
    image,
    gallery,
    catalog: fileOf(req, "catalog") || (row ? row.catalog : "")
  };
});

/* ผลงาน */
crud("projects", "projects", "projects", (req, row) => ({
  title: req.body.title || "",
  year: req.body.year || "",
  category: req.body.category || "",
  place: req.body.place || "",
  description: req.body.description || "",
  image: fileOf(req, "image") || (row ? row.image : "")
}));

/* ข่าวสาร (+ สถานะเผยแพร่) */
crud("news", "news", "news", (req, row) => ({
  title: req.body.title || "",
  body: req.body.body || "",
  published_at: req.body.published_at || new Date().toISOString().slice(0, 10),
  published: req.body.published === "on",
  image: fileOf(req, "image") || (row ? row.image : "")
}));

/* ==================================================
 * ค่าบริการ (ติดตั้งแอร์ + ล้างแอร์)
 * ================================================== */
router.get("/pricing", requireAuth, (req, res) => {
  const d = db();
  res.render("admin/pricing", {
    me: me(req), page: "pricing", saved: req.query.saved,
    installRowsText: rowsToText(d.pricingInstall.rows),
    installIncludedText: listToText(d.pricingInstall.included),
    installExtraText: listToText(d.pricingInstall.extra),
    cleanRowsText: rowsToText(d.pricingClean.rows),
    cleanStepsText: listToText(d.pricingClean.steps),
    cleanPromoText: listToText(d.pricingClean.promo)
  });
});
router.post("/pricing", requireAuth, (req, res) => {
  const d = db();
  d.pricingInstall.rows = parseRows(req.body.installRows);
  d.pricingInstall.included = parseList(req.body.installIncluded);
  d.pricingInstall.extra = parseList(req.body.installExtra);
  d.pricingClean.rows = parseRows(req.body.cleanRows);
  d.pricingClean.steps = parseList(req.body.cleanSteps);
  d.pricingClean.promo = parseList(req.body.cleanPromo);
  save();
  res.redirect("/admin/pricing?saved=1");
});

/* ==================================================
 * การชำระเงิน
 * ================================================== */
router.get("/payment", requireAuth, (req, res) => {
  const d = db();
  res.render("admin/payment", {
    me: me(req), page: "payment", saved: req.query.saved,
    methodsText: (d.payment.methods || []).map((m) => [m.no, m.icon, m.title, m.desc].join(" | ")).join("\n"),
    termsText: rowsToText(d.payment.terms)
  });
});
router.post("/payment", requireAuth, (req, res) => {
  const d = db();
  d.payment.methods = parseRows(req.body.methods).map((c) => ({
    no: c[0] || "", icon: c[1] || "mdi:cash-multiple", title: c[2] || "", desc: c[3] || ""
  }));
  d.payment.terms = parseRows(req.body.terms);
  save();
  res.redirect("/admin/payment?saved=1");
});

/* ==================================================
 * ผู้ดูแลระบบ (เฉพาะ Super Admin)
 * ================================================== */
router.get("/admins", requireAuth, requireSuperAdmin, (req, res) => {
  const editing = req.query.edit ? db().admins.find((a) => a.id === +req.query.edit) : null;
  const notice = req.session.tempPasswordNotice || null;
  delete req.session.tempPasswordNotice;
  res.render("admin/admins", {
    me: me(req), page: "admins", rows: db().admins, editing, error: null,
    tempPw: notice && Date.now() - notice.createdAt < 5 * 60 * 1000 ? notice.password : null,
    tempUser: notice && Date.now() - notice.createdAt < 5 * 60 * 1000 ? notice.username : null
  });
});
router.post("/admins/save", requireAuth, requireSuperAdmin, (req, res) => {
  const t = db().admins;
  const id = +req.body.id || 0;
  const row = id ? t.find((r) => r.id === id) : null;
  const uname = (req.body.username || "").trim();
  if (!row && t.some((a) => a.username === uname)) {
    return res.render("admin/admins", { me: me(req), page: "admins", rows: t, editing: null, error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });
  }
  if (!/^[A-Za-z0-9_.-]{3,40}$/.test(uname)) {
    return res.status(400).render("admin/admins", { me: me(req), page: "admins", rows: t, editing: row, error: "Username ต้องมี 3–40 ตัวอักษร และใช้ได้เฉพาะ A-Z, a-z, 0-9, _ . -" });
  }
  if (req.body.password && req.body.password.length < 12) {
    return res.status(400).render("admin/admins", { me: me(req), page: "admins", rows: t, editing: row, error: "รหัสผ่านต้องยาวอย่างน้อย 12 ตัวอักษร" });
  }
  const data = {
    username: uname,
    name: req.body.name || "",
    email: req.body.email || "",
    role: req.body.role === "superadmin" ? "superadmin" : "editor"
  };
  let tempPw = "";
  if (req.body.password) {
    data.password_hash = bcrypt.hashSync(req.body.password, 10);
  } else if (!row) {
    tempPw = genTempPassword(); // แอดมินใหม่ที่ไม่ได้กำหนดรหัสผ่านเอง -> สุ่มให้แทน "changeme123" เดิม
    data.password_hash = bcrypt.hashSync(tempPw, 10);
  }
  if (row) Object.assign(row, data);
  else t.push({ id: database.nextId(t), phone: "", twofa_enabled: false, twofa_secret: "", ...data });
  save();
  if (tempPw) flashTempPassword(req, uname, tempPw);
  res.redirect("/admin/admins");
});
router.post("/admins/delete/:id", requireAuth, requireSuperAdmin, (req, res) => {
  const id = +req.params.id;
  if (id !== req.session.adminId) { // ห้ามลบตัวเอง
    database.get().admins = db().admins.filter((a) => a.id !== id);
    save();
  }
  res.redirect("/admin/admins");
});
router.post("/admins/reset/:id", requireAuth, requireSuperAdmin, (req, res) => {
  const a = db().admins.find((r) => r.id === +req.params.id);
  if (!a) return res.redirect("/admin/admins");
  const tempPw = genTempPassword();
  a.password_hash = bcrypt.hashSync(tempPw, 10);
  save();
  flashTempPassword(req, a.username, tempPw);
  res.redirect("/admin/admins");
});

/* ==================================================
 * โปรไฟล์ + เปลี่ยนรหัสผ่าน + ตั้งค่า 2FA
 * ================================================== */
router.get("/profile", requireAuth, async (req, res) => {
  const m = me(req);
  let qr = null;
  // ถ้ากำลังตั้งค่า 2FA อยู่ ให้แสดง QR
  if (req.session.setupSecret) {
    const otpauth = authenticator.keyuri(m.username, "Yuyenpensuk CMS", req.session.setupSecret);
    qr = await QRCode.toDataURL(otpauth);
  }
  res.render("admin/profile", { me: m, page: "profile", qr, msg: req.query.msg || null, err: req.query.err || null });
});
router.post("/profile", requireAuth, (req, res) => {
  const m = me(req);
  m.name = req.body.name || m.name;
  m.email = req.body.email || "";
  m.phone = req.body.phone || "";
  save();
  res.redirect("/admin/profile?msg=บันทึกข้อมูลแล้ว");
});
router.post("/profile/password", requireAuth, (req, res) => {
  const m = me(req);
  if (!bcrypt.compareSync(req.body.current || "", m.password_hash))
    return res.redirect("/admin/profile?err=รหัสผ่านปัจจุบันไม่ถูกต้อง");
  if ((req.body.password || "").length < 12)
    return res.redirect("/admin/profile?err=รหัสผ่านใหม่ต้องยาวอย่างน้อย 12 ตัวอักษร");
  m.password_hash = bcrypt.hashSync(req.body.password, 10);
  save();
  req.session.regenerate((err) => {
    if (err) return res.status(500).render("admin/error", { title: "เกิดข้อผิดพลาด", message: "ไม่สามารถเริ่มเซสชันใหม่ได้ กรุณาเข้าสู่ระบบอีกครั้ง" });
    req.session.adminId = m.id;
    res.redirect("/admin/profile?msg=เปลี่ยนรหัสผ่านแล้ว");
  });
});
/* เริ่มตั้งค่า 2FA → สร้าง secret + แสดง QR */
router.post("/profile/2fa/setup", requireAuth, (req, res) => {
  req.session.setupSecret = authenticator.generateSecret();
  res.redirect("/admin/profile");
});
/* ยืนยัน OTP จากแอปเพื่อเปิดใช้ 2FA */
router.post("/profile/2fa/confirm", requireAuth, (req, res) => {
  const m = me(req);
  const token = (req.body.token || "").replace(/\s/g, "");
  if (req.session.setupSecret && authenticator.check(token, req.session.setupSecret)) {
    m.twofa_enabled = true;
    m.twofa_secret = req.session.setupSecret;
    delete req.session.setupSecret;
    save();
    return res.redirect("/admin/profile?msg=เปิดใช้ 2FA แล้ว");
  }
  res.redirect("/admin/profile?err=รหัส OTP ไม่ถูกต้อง");
});
router.post("/profile/2fa/disable", requireAuth, (req, res) => {
  const m = me(req);
  const currentPassword = req.body.current || "";
  const token = (req.body.token || "").replace(/\s/g, "");
  if (!bcrypt.compareSync(currentPassword, m.password_hash))
    return res.redirect("/admin/profile?err=รหัสผ่านปัจจุบันไม่ถูกต้อง");
  if (!m.twofa_enabled || !m.twofa_secret || !/^\d{6}$/.test(token) || !authenticator.check(token, m.twofa_secret))
    return res.redirect("/admin/profile?err=ต้องยืนยันรหัส OTP ปัจจุบันก่อนปิดใช้ 2FA");
  m.twofa_enabled = false;
  m.twofa_secret = "";
  delete req.session.setupSecret;
  save();
  req.session.regenerate((err) => {
    if (err) return res.status(500).render("admin/error", { title: "เกิดข้อผิดพลาด", message: "ไม่สามารถเริ่มเซสชันใหม่ได้ กรุณาเข้าสู่ระบบอีกครั้ง" });
    res.redirect("/admin/login");
  });
});

module.exports = router;
