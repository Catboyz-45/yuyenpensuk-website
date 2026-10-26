// Runtime ใช้รูปสินค้าใน uploads/products เท่านั้น; ไม่มีการดาวน์โหลดรูปภายนอก
process.env.PRODUCT_IMAGE_LOCAL_ONLY = "1";
/**
 * deploy-server.js — ไฟล์เริ่มต้นสำหรับ "deploy จริงขึ้น hosting" เท่านั้น
 * (ตอนพัฒนาที่เครื่องตัวเอง ให้ใช้ server.js + admin-server.js แยกกันตามปกติ ไม่ต้องยุ่งกับไฟล์นี้)
 *
 * ทำไมต้องมีไฟล์นี้:
 * เว็บโฮสติ้งส่วนใหญ่ (Render, Railway ฯลฯ) 1 เซอร์วิส = เปิดให้แค่ 1 พอร์ตออกอินเทอร์เน็ต
 * และ "ดิสก์เก็บข้อมูลถาวร" (persistent disk) 1 ก้อน ผูกกับได้แค่ 1 เซอร์วิสเท่านั้น
 * ถ้า deploy server.js กับ admin-server.js เป็นคนละเซอร์วิส จะได้คนละดิสก์ ข้อมูลไม่ sync กัน
 *
 * ไฟล์นี้จึงรวมทั้งสองแอปไว้ในโปรเซสเดียว (ใช้ดิสก์เดียวกัน อ่านไฟล์ data/db.json ไฟล์เดียวกันจริง ๆ)
 * แต่ยัง "แยกกันสนิท" เหมือนเดิมทุกประการโดยใช้ชื่อโดเมนเป็นตัวแบ่ง:
 *   - www.yourdomain.com หรือ yourdomain.com  -> เว็บหลัก (routes/site.js)
 *   - admin.yourdomain.com                    -> ระบบแอดมิน (routes/admin.js)
 * เว็บหลักไม่มีลิงก์หรือโค้ดใด ๆ เชื่อมไปยังแอดมินเหมือนเดิม ความปลอดภัยเท่าเดิมทุกจุด
 * (CSRF, rate limit, 2FA, session แยกคนละ cookie เพราะคนละโดเมน — เบราว์เซอร์ไม่ส่ง cookie ข้ามโดเมนกันเองอยู่แล้ว)
 */
const express = require("express");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");
const database = require("./database");
const securityHeaders = require("./middleware/securityHeaders");
const BoundedSessionStore = require("./sessionStore");

database.load();

const PORT = process.env.PORT || 3000;
// โดเมนย่อยที่ใช้แยกแอดมินออกจากเว็บหลัก ปรับได้ผ่าน env ถ้าอยากใช้ชื่ออื่น (ค่าเริ่มต้น "admin")
const ADMIN_SUBDOMAIN = (process.env.ADMIN_SUBDOMAIN || "admin").replace(/\.$/, "").toLowerCase();
const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
if (process.env.NODE_ENV === "production" && !/^https:\/\//i.test(siteUrl)) {
  throw new Error("SITE_URL must use HTTPS in production.");
}
let siteHostname;
try { siteHostname = new URL(siteUrl).hostname.toLowerCase(); }
catch { throw new Error("SITE_URL must be a valid URL."); }
const allowedAdminHost = `${ADMIN_SUBDOMAIN}.${siteHostname}`;
const allowedSiteHosts = new Set([siteHostname, `www.${siteHostname}`]);

/* ========== แอปเว็บหลัก (เหมือน server.js ทุกประการ) ========== */
const siteApp = express();
siteApp.set("view engine", "ejs");
siteApp.set("views", path.join(__dirname, "views"));
siteApp.use(securityHeaders);
siteApp.use(express.static(path.join(__dirname, "public")));
siteApp.use("/uploads", express.static(process.env.UPLOAD_DIR || path.join(__dirname, "uploads")));
siteApp.use((req, res, next) => {
  database.reloadIfChanged();
  res.locals.company = database.get().company;
  res.locals.baseUrl = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
  res.locals.path = req.path;
  next();
});
siteApp.use("/", require("./routes/site"));
siteApp.use((req, res) => res.status(404).render("site/404"));
siteApp.use((err, req, res, next) => {
  console.error("Site error:", err);
  res.status(500).render("site/404");
});

/* ========== แอปแอดมิน (เหมือน admin-server.js ทุกประการ) ========== */
const adminApp = express();
adminApp.set("view engine", "ejs");
adminApp.set("views", path.join(__dirname, "views"));
adminApp.use(securityHeaders);
adminApp.use(express.urlencoded({ extended: true, limit: "256kb" }));
adminApp.use(express.static(path.join(__dirname, "public")));
adminApp.use("/uploads", express.static(process.env.UPLOAD_DIR || path.join(__dirname, "uploads")));

const SESSION_SECRET = process.env.SESSION_SECRET || "";
if (process.env.NODE_ENV === "production") {
  if (SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters in production.");
  }
  if (!process.env.INITIAL_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD.length < 12) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be set and at least 12 characters for the first production startup.");
  }
}
adminApp.set("trust proxy", process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true");
adminApp.get("/", (req, res) => res.redirect(302, "/admin"));
adminApp.use(
  session({
    name: "yy_admin_sid", // ตั้งชื่อ cookie แยกชัดเจนจากเว็บหลัก กันสับสน
    secret: SESSION_SECRET || crypto.randomBytes(48).toString("hex"),
    store: new BoundedSessionStore({ maxSessions: 2000, ttlMs: 8 * 60 * 60 * 1000 }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/admin"
    }
  })
);
adminApp.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  database.reloadIfChanged();
  res.locals.company = database.get().company;
  res.locals.session = req.session;
  next();
});
adminApp.use((req, res, next) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  res.locals.csrfToken = req.session.csrfToken;
  next();
});
adminApp.use((req, res, next) => {
  if (req.method !== "POST") return next();
  const ct = req.headers["content-type"] || "";
  if (ct.startsWith("multipart/form-data")) return next();
  const sent = req.body && req.body._csrf;
  if (sent && sent === req.session.csrfToken) return next();
  console.warn("CSRF token ไม่ถูกต้องหรือไม่มี — ปฏิเสธคำขอจาก", req.ip, req.originalUrl);
  return res.status(403).render("admin/error", {
    title: "คำขอไม่ผ่านการตรวจสอบความปลอดภัย",
    message: "อาจเป็นเพราะฟอร์มหมดอายุ (เปิดค้างไว้นานเกินไป) กรุณากลับไปหน้าเดิมแล้วลองใหม่อีกครั้ง"
  });
});
adminApp.use("/admin", require("./routes/admin"));

adminApp.use((req, res) => res.status(404).render("admin/error", {
  title: "ไม่พบหน้าที่ต้องการ",
  message: "หน้านี้อาจถูกลบหรือย้ายไปแล้ว"
}));
adminApp.use((err, req, res, next) => {
  console.error("Admin error:", err);
  res.status(500).render("admin/error", {
    title: "เกิดข้อผิดพลาด",
    message: "ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง หรือย้อนกลับไปหน้าก่อนหน้า"
  });
});

/* ========== ตัวจ่ายงาน: ดูชื่อโดเมนที่เข้ามาแล้วส่งไปแอปที่ถูกต้อง ========== */
const root = express();
root.disable("x-powered-by");
root.set("trust proxy", process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true");
root.get("/healthz", (req, res) => res.status(200).json({ ok: true }));
root.use((req, res, next) => {
  // FORCE_APP=admin ใช้ตอนทดสอบในเครื่องตัวเองก่อน deploy จริง (ยังไม่มีโดเมนย่อยให้ใช้)
  // เช่น: FORCE_APP=admin node deploy-server.js  แล้วเปิด http://localhost:3000 จะเจอแอดมินเลย
  if (process.env.FORCE_APP === "admin") return adminApp(req, res, next);
  if (process.env.FORCE_APP === "site") return siteApp(req, res, next);
  const host = (req.hostname || "").toLowerCase().replace(/\.$/, "");
  if (host === allowedAdminHost) return adminApp(req, res, next);
  if (allowedSiteHosts.has(host)) return siteApp(req, res, next);
  return res.status(421).send("Misdirected Request");
});

root.listen(PORT, () =>
  console.log(`✅ พร้อมใช้งานที่พอร์ต ${PORT} — เว็บหลัก: โดเมนหลัก · แอดมิน: ${ADMIN_SUBDOMAIN}โดเมนหลัก`)
);
