/** routes/site.js — หน้าเว็บไซต์ส่วนแสดงผล (Frontend) */
const express = require("express");
const router = express.Router();
const database = require("../database");

const db = () => database.get();

/* หน้าแรก */
router.get("/", (req, res) => {
  const d = db();
  const banners = d.banners.filter((b) => b.active).sort((a, b) => a.sort - b.sort);
  // สไลด์ Hero: สไลด์แรกเป็นข้อความแนะนำบริษัท ตามด้วยโปรโมชันจากแบนเนอร์ (เลื่อนอัตโนมัติ)
  const heroSlides = [
    {
      main: true,
      title: "ติดตั้ง ล้าง ซ่อม และจำหน่ายเครื่องปรับอากาศ",
      desc: "ดูแลเครื่องปรับอากาศครบวงจร ตั้งแต่เลือกซื้อ ติดตั้ง ดูแลรักษา จนถึงงานไฟฟ้าที่เกี่ยวข้อง โดยทีมช่างผู้ชำนาญ",
      image: d.services[0]?.image || ""
    },
    ...banners.map((b) => ({ main: false, title: b.title, image: b.image }))
  ];
  res.render("site/home", {
    active: "home",
    banners,
    heroSlides,
    homeContent: d.company || {},
    homeFeatures: Array.isArray(d.homeFeatures) ? d.homeFeatures.filter(x => x.active !== false).sort((a,b)=>(a.sort||0)-(b.sort||0)) : null,
    services: d.services,
    products: (d.products.filter((p) => p.bestseller).length ? d.products.filter((p) => p.bestseller) : d.products.slice(0, 4)).slice(0, 4),
    projects: d.projects.slice(0, 3),
    productCount: d.products.length,
    projectCount: d.projects.length,
    brands: [...new Set(db().products.map((p) => p.brand))]
  });
});

/* บริการ */
router.get("/services", (req, res) => {
  const q = (req.query.q || "").trim();
  let list = db().services;
  if (q) list = list.filter((s) => (s.title + s.description).includes(q));
  res.render("site/services", { active: "services", services: list, q });
});
router.get("/services/:id", (req, res) => {
  const s = db().services.find((x) => x.id === +req.params.id);
  if (!s) return res.status(404).render("site/404");
  const others = db().services.filter((x) => x.id !== s.id).slice(0, 3);
  res.render("site/service-detail", { active: "services", s, others });
});


/* รูปสินค้า: ใช้เฉพาะไฟล์ Local ที่อยู่ในพื้นที่ uploads ถาวร */
const { getProductImages, getProductImageBinary } = require('../utils/product-images');

router.get('/api/product-gallery/:id', async (req,res) => {
  const product = db().products.find(x => x.id === +req.params.id);
  if (!product) return res.status(404).json({images: []});
  res.json({images: await getProductImages(product)});
});

router.get('/api/product-image/:id/:index', async (req,res) => {
  const product = db().products.find(x => x.id === +req.params.id);
  const index = Number(req.params.index);
  if (!product || !Number.isInteger(index) || index < 0 || index > 4) return res.sendStatus(404);
  const image = await getProductImageBinary(product, index);
  if (!image) return res.sendStatus(404);
  res.set('Content-Type', image.type);
  res.set('Cache-Control', 'public, max-age=2592000, immutable');
  res.set('ETag', image.etag);
  res.send(image.body);
});

/* สินค้า */
router.get("/products", (req, res) => {
  const q = (req.query.q || "").trim();
  const brand = req.query.brand || "";
  let list = db().products;
  if (brand) list = list.filter((p) => p.brand === brand);
  if (q) list = list.filter((p) => (p.name + p.brand + p.model + p.spec).toLowerCase().includes(q.toLowerCase()));
  const brands = [...new Set(db().products.map((p) => p.brand))];
  res.render("site/products", { active: "products", products: list, brands, q, brand });
});
router.get("/products/:id", (req, res) => {
  const p = db().products.find((x) => x.id === +req.params.id);
  if (!p) return res.status(404).render("site/404");
  const related = db().products.filter((x) => x.brand === p.brand && x.id !== p.id).slice(0, 4);
  res.render("site/product-detail", { active: "products", p, related });
});

/* ผลงาน */
router.get("/projects", (req, res) => {
  const q = (req.query.q || "").trim();
  let list = db().projects;
  if (q) list = list.filter((p) => (p.title + p.category + p.description).includes(q));
  res.render("site/projects", { active: "projects", projects: list, q });
});
router.get("/projects/:id", (req, res) => {
  const p = db().projects.find((x) => x.id === +req.params.id);
  if (!p) return res.status(404).render("site/404");
  const others = db().projects.filter((x) => x.id !== p.id).slice(0, 3);
  res.render("site/project-detail", { active: "projects", p, others });
});

/* ค่าบริการติดตั้งแอร์ */
router.get("/pricing-install", (req, res) => {
  res.render("site/pricing-install", { active: "pricing", pricing: db().pricingInstall });
});

/* ค่าบริการล้างแอร์ */
router.get("/pricing-clean", (req, res) => {
  res.render("site/pricing-clean", { active: "pricing", pricing: db().pricingClean });
});

/* การชำระเงิน */
router.get("/payment", (req, res) => {
  res.render("site/payment", { active: "payment", payment: db().payment });
});

/* ยี่ห้อสินค้า — ดูแยกแต่ละยี่ห้อ */
router.get("/brands/:brand", (req, res) => {
  const brandName = req.params.brand;
  const all = db().products;
  const brands = [...new Set(all.map((p) => p.brand))];
  if (!brands.includes(brandName)) return res.status(404).render("site/404");
  const list = all.filter((p) => p.brand === brandName);
  res.render("site/brand", { active: "products", brandName, products: list, brands });
});

/* คู่มือเลือกและดูแลแอร์: เนื้อหาสำหรับผู้ที่กำลังตัดสินใจซื้อหรือใช้บริการ */
const airGuides = {
  'choose-aircon': {
    title: 'เลือกซื้อแอร์อย่างไรให้เหมาะกับห้อง',
    fullTitle: 'แนะนำแอร์ เลือกซื้อแอร์กี่ BTU ดี | อยู่เย็นเป็นสุข',
    description: 'แนะนำวิธีเลือกซื้อแอร์บ้าน ดูขนาด BTU ความประหยัดไฟ อินเวอร์เตอร์ และสิ่งที่ควรถามก่อนซื้อแอร์พร้อมติดตั้งในกรุงเทพฯ',
    sections: [
      {heading:'เริ่มจากขนาดห้องและการใช้งาน', body:'จดพื้นที่ห้องโดยประมาณ ความสูงฝ้า จำนวนคน และช่วงเวลาที่เปิดแอร์ ห้องโดนแดดจัดหรือมีเครื่องใช้ไฟฟ้าหลายชิ้นอาจต้องพิจารณาภาระความร้อนเพิ่ม'},
      {heading:'BTU ต้องพอดีกับห้อง', body:'BTU เป็นค่าความสามารถในการทำความเย็น ไม่ควรเลือกรุ่นจากราคาเพียงอย่างเดียว เพราะขนาดที่ไม่เหมาะสมอาจทำให้เย็นช้า สิ้นเปลือง หรือควบคุมความชื้นได้ไม่ดี ควรให้ช่างประเมินสภาพห้องจริง'},
      {heading:'เปรียบเทียบค่าไฟและการรับประกัน', body:'ตรวจฉลากประหยัดไฟ ค่าประสิทธิภาพพลังงาน เงื่อนไขรับประกันอะไหล่และคอมเพรสเซอร์ รวมถึงค่าใช้จ่ายในการติดตั้งและดูแลระยะยาว'},
      {heading:'ซื้อแอร์พร้อมติดตั้งต้องถามอะไร', body:'สอบถามว่าราคาครอบคลุมท่อทองแดง สายไฟ ขายึด ท่อน้ำทิ้ง การเดินระบบ และงานเพิ่มเติมหรือไม่ ขอใบเสนอราคาที่ระบุรายการชัดเจนก่อนตัดสินใจ'}
    ]
  },
  'clean-aircon': {
    title: 'ล้างแอร์บ่อยแค่ไหน และควรล้างเมื่อไร',
    fullTitle: 'ล้างแอร์บ่อยแค่ไหน สัญญาณที่ควรล้างแอร์ | อยู่เย็นเป็นสุข',
    description: 'วิธีสังเกตว่าแอร์ควรล้างเมื่อไร ปัจจัยที่ทำให้แอร์สกปรกเร็ว และสิ่งที่ควรถามก่อนนัดช่างล้างแอร์ในกรุงเทพฯ',
    sections: [
      {heading:'ความถี่ขึ้นกับการใช้งาน', body:'ห้องที่เปิดแอร์ทุกวัน มีฝุ่นมาก หรือมีสัตว์เลี้ยง อาจต้องตรวจและทำความสะอาดบ่อยกว่าห้องที่ใช้งานน้อย ควรอ้างอิงคู่มือของผู้ผลิตและสภาพเครื่องจริง'},
      {heading:'สัญญาณที่ควรตรวจแอร์', body:'ลมออกน้อย มีกลิ่นอับ น้ำหยด หรือเย็นช้ากว่าปกติอาจเกี่ยวข้องกับความสกปรกหรือปัญหาอื่น ควรให้ช่างตรวจหาสาเหตุ ไม่ควรสรุปว่าล้างอย่างเดียวจะแก้ได้ทุกกรณี'},
      {heading:'ก่อนนัดล้างแอร์', body:'แจ้งชนิดเครื่อง ขนาด BTU จำนวนเครื่อง ชั้นที่ติดตั้ง และอาการผิดปกติ เพื่อให้ประเมินงานและแจ้งค่าใช้จ่ายได้เหมาะสม'},
      {heading:'หลังล้างแอร์', body:'ตรวจการระบายน้ำ การทำงานและเสียงผิดปกติ หากมีน้ำรั่วหรือกลิ่นกลับมา ควรติดต่อช่างเพื่อตรวจเพิ่มเติม'}
    ]
  }
};
router.get('/guides/:slug', (req, res) => {
  const guide = airGuides[req.params.slug];
  if (!guide) return res.status(404).render('site/404');
  res.render('site/guide', {active:'', guide});
});

/* ---------- SEO: sitemap.xml + robots.txt ---------- */
router.get("/sitemap.xml", (req, res) => {
  const base = res.locals.baseUrl;
  const d = db();
  const urls = ["/", "/services", "/pricing-install", "/pricing-clean", "/products", "/projects", "/payment", "/contact", "/guides/choose-aircon", "/guides/clean-aircon"];
  d.services.forEach((s) => urls.push("/services/" + s.id));
  d.products.forEach((p) => urls.push("/products/" + p.id));
  [...new Set(d.products.map((p) => p.brand))].forEach((b) => urls.push("/brands/" + encodeURIComponent(b)));
  d.projects.forEach((p) => urls.push("/projects/" + p.id));
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join("\n") +
    "\n</urlset>";
  res.type("application/xml").send(xml);
});

router.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
    `User-agent: *\nAllow: /\n\nSitemap: ${res.locals.baseUrl}/sitemap.xml`
  );
});

/* ติดต่อเรา */
router.get("/contact", (req, res) => {
  const c = db().company;
  const q = encodeURIComponent(c.address || c.name);
  // ถ้าแอดมินใส่ลิงก์ Google Maps เอง (แม่นยำกว่า) ให้ใช้อันนั้น
  // ถ้ายังไม่ได้ใส่ ให้สร้างแผนที่อัตโนมัติจาก "ที่อยู่" ทันที ไม่ต้องตั้งค่าอะไรเพิ่ม
  const mapEmbedUrl = c.maps_url || `https://www.google.com/maps?q=${q}&output=embed`;
  const mapDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  res.render("site/contact", { active: "contact", mapEmbedUrl, mapDirectionsUrl });
});

module.exports = router;
