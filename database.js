/**
 * database.js — ฐานข้อมูลแบบไฟล์ JSON (ไม่ต้องติดตั้ง Database Server)
 * ข้อมูลถูกเก็บที่ data/db.json — สำรองข้อมูลได้โดยก๊อปปี้ไฟล์นี้
 * หมายเหตุ: เหมาะกับเว็บบริษัทขนาดเล็ก ถ้าระบบโตขึ้นค่อยย้ายไป MySQL/PostgreSQL ได้
 */
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const airconCatalog = require("./catalog");

const DB_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "db.json")
  : path.join(__dirname, "data", "db.json");

let db = null;
let lastMtimeMs = 0;

/** โหลดฐานข้อมูลจากไฟล์ถาวร
 * ถ้ามี db.json อยู่แล้ว จะถือว่าเป็นข้อมูลจริงของ CMS และจะไม่ถูกเขียนทับ
 * ด้วย catalog.js ตอน startup/restart/deploy. catalog.js ใช้เฉพาะตอนสร้างฐานข้อมูลครั้งแรก
 * เท่านั้น เพื่อให้ข้อมูลที่แอดมินเพิ่ม/แก้ไข/ลบ/อัปโหลดรูปอยู่ถาวร
 */
function load() {
  if (fs.existsSync(DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    } catch (e) {
      throw new Error(`Cannot read persistent database ${DB_PATH}: ${e.message}`);
    }
    if (process.env.NODE_ENV === "production" && Array.isArray(db.admins)) {
      // A known default password must never be accepted in production.
      const hasDefaultPassword = db.admins.some((admin) => {
        try { return bcrypt.compareSync("admin123", admin.password_hash); } catch { return false; }
      });
      if (hasDefaultPassword) {
        throw new Error("A default admin password is present in data/db.json. Set a strong password before starting production.");
      }
    }

    // Existing CMS data is authoritative. Never rebuild or synchronize products
    // from catalog.js during startup. This is what makes admin edits survive
    // container restarts, VPS reboots, and application redeploys.
    if (!db || typeof db !== 'object') {
      throw new Error(`Persistent database ${DB_PATH} is not a valid JSON object`);
    }
  } else {
    db = seed();
    save();
  }

  lastMtimeMs = fs.statSync(DB_PATH).mtimeMs;
  return db;
}

/** บันทึกฐานข้อมูลลงไฟล์ */
function save() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true, mode: 0o700 });
  const tmp = `${DB_PATH}.tmp-${process.pid}-${Date.now()}`;
  const payload = JSON.stringify(db, null, 2);
  fs.writeFileSync(tmp, payload, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, DB_PATH);
  try { fs.chmodSync(DB_PATH, 0o600); } catch {}
  lastMtimeMs = fs.statSync(DB_PATH).mtimeMs;
}

/**
 * โหลดข้อมูลใหม่ถ้าไฟล์ถูกแก้ไขมาจากที่อื่น (เช่นระบบแอดมินซึ่งรันคนละโปรเซส)
 * เรียกก่อนตอบทุกคำขอของเว็บหลัก เพื่อให้เห็นข้อมูลล่าสุดเสมอ โดยไม่ต้องรีสตาร์ตเซิร์ฟเวอร์
 * ตรวจแค่เวลาที่ไฟล์แก้ไขล่าสุด (mtime) ถ้าไม่เปลี่ยนจะไม่อ่านไฟล์ซ้ำ จึงเบามาก
 */
function reloadIfChanged() {
  try {
    const stat = fs.statSync(DB_PATH);
    if (stat.mtimeMs !== lastMtimeMs) {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      lastMtimeMs = stat.mtimeMs;
    }
  } catch (e) {
    // ไฟล์ยังไม่ถูกสร้าง หรืออ่านไม่ได้ชั่วคราว — ใช้ข้อมูลใน memory เดิมไปก่อน
  }
}

/** id ถัดไปของตาราง */
function nextId(table) {
  return table.length ? Math.max(...table.map((r) => r.id)) + 1 : 1;
}

/** ข้อมูลตั้งต้น */
function seed() {
  const now = new Date().toISOString();
  return {
    company: {
      name: "บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด (สำนักงานใหญ่)",
      tax_id: "0105569026761",
      address: "594/151 ถนนหทัยราษฎร์ แขวงบางชัน เขตคลองสามวา กรุงเทพมหานคร 10510",
      phone: "02-000-0000",
      email: "contact@yuyenpensuk.co.th",
      facebook: "https://facebook.com/yuyenpensuk",
      line: "@yuyenpensuk",
      maps_url: "",
      logo: "",
      history:
        "บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด ดำเนินธุรกิจติดตั้ง ล้าง ซ่อม และจำหน่ายเครื่องปรับอากาศทุกยี่ห้อ พร้อมงานไฟฟ้าที่เกี่ยวข้องกับระบบปรับอากาศ ให้บริการทั้งบ้านพักอาศัย อาคารสำนักงาน ร้านค้า และโรงงาน โดยทีมช่างผู้ชำนาญงานแอร์โดยเฉพาะ",
      vision: "เป็นร้านแอร์ที่ลูกค้าในเขตกรุงเทพมหานครและปริมณฑลนึกถึงเป็นอันดับแรก ทั้งเรื่องติดตั้ง ดูแลรักษา และซ่อมบำรุง",
      mission: "ติดตั้งและดูแลเครื่องปรับอากาศอย่างได้มาตรฐาน ราคาเป็นธรรม ตรงเวลา และให้บริการหลังการขายที่ติดต่อได้จริง"
    },
    banners: [
      { id: 1, title: "โปรโมชันล้างแอร์กลางปี 2569", image: "https://images.pexels.com/photos/8065903/pexels-photo-8065903.jpeg?auto=compress&cs=tinysrgb&w=1200", sort: 1, active: true },
      { id: 2, title: "แอร์ Inverter รุ่นใหม่ เบอร์ 5", image: "https://images.pexels.com/photos/3964341/pexels-photo-3964341.jpeg?auto=compress&cs=tinysrgb&w=1200", sort: 2, active: true },
      { id: 3, title: "บริการติดตั้ง–ซ่อมแอร์ครบวงจร", image: "https://images.pexels.com/photos/6033459/pexels-photo-6033459.jpeg?auto=compress&cs=tinysrgb&w=1200", sort: 3, active: false }
    ],
    services: [
      { id: 1, slug: "install", icon: "mdi:air-conditioner", title: "ติดตั้งเครื่องปรับอากาศ", image: "https://images.pexels.com/photos/3964341/pexels-photo-3964341.jpeg?auto=compress&cs=tinysrgb&w=1200",
        description: "สำรวจหน้างาน คำนวณขนาดทำความเย็นที่เหมาะสม เดินท่อน้ำยาและติดตั้งตามมาตรฐาน พร้อมรับประกันงานติดตั้ง",
        long: "ให้บริการติดตั้งเครื่องปรับอากาศทุกยี่ห้อ ตั้งแต่สำรวจหน้างาน คำนวณขนาด BTU ที่เหมาะกับพื้นที่ แนะนำรุ่นที่ประหยัดไฟ เดินท่อน้ำยาและติดตั้งอย่างเรียบร้อย เมื่อติดตั้งเสร็จจะทดสอบการทำงาน ตรวจรอยรั่วของน้ำยา และแนะนำวิธีใช้งานกับการดูแลรักษาเบื้องต้น พร้อมรับประกันงานติดตั้ง",
        steps: ["สำรวจหน้างานและวัดพื้นที่", "แนะนำรุ่นและเสนอราคา", "ติดตั้งตามนัดหมาย", "ทดสอบและส่งมอบงาน", "รับประกันและดูแลหลังการขาย"],
        updated_at: now },
      { id: 2, slug: "clean", icon: "mdi:air-filter", title: "ล้าง ซ่อม และเติมน้ำยาแอร์", image: "https://images.pexels.com/photos/6471911/pexels-photo-6471911.jpeg?auto=compress&cs=tinysrgb&w=1200",
        description: "ล้างเครื่อง เติมน้ำยา ตรวจเช็กและซ่อมทุกอาการ ทั้งแอร์บ้านและแอร์อาคาร นัดหมายเข้าหน้างานภายใน 24 ชั่วโมง",
        long: "บริการล้างทำความสะอาดเครื่องปรับอากาศ เติมน้ำยา ตรวจเช็กและซ่อมทุกอาการ ทั้งแอร์บ้านและแอร์อาคาร โดยทีมช่างที่ชำนาญงานแอร์โดยเฉพาะ รับนัดหมายเข้าหน้างานภายใน 24 ชั่วโมง พร้อมแจ้งราคาก่อนเริ่มงานทุกครั้ง",
        steps: ["รับแจ้งอาการและนัดหมาย", "เข้าตรวจเช็กหน้างาน", "แจ้งราคาก่อนเริ่มงาน", "ล้าง / ซ่อม / เติมน้ำยา", "ทดสอบและรับประกันงาน"],
        updated_at: now },
      { id: 3, slug: "sell", icon: "mdi:cart-outline", title: "จำหน่ายแอร์และอะไหล่", image: "https://images.pexels.com/photos/8496404/pexels-photo-8496404.jpeg?auto=compress&cs=tinysrgb&w=1200",
        description: "จำหน่ายเครื่องปรับอากาศของแท้ทุกยี่ห้อ พร้อมอะไหล่และอุปกรณ์ประกอบการติดตั้ง ในราคาตัวแทนจำหน่าย",
        long: "จำหน่ายเครื่องปรับอากาศของแท้ทุกยี่ห้อ ทั้งแอร์ติดผนัง แอร์ฝังฝ้า และระบบรวมศูนย์ พร้อมอะไหล่และอุปกรณ์ประกอบการติดตั้ง ในราคาตัวแทนจำหน่าย แนะนำรุ่นที่เหมาะกับขนาดห้องและงบประมาณ พร้อมบริการติดตั้งโดยช่างประจำบริษัท",
        steps: ["ปรึกษาเลือกรุ่นที่เหมาะสม", "เสนอราคารวมค่าติดตั้ง", "ยืนยันคำสั่งซื้อ", "ติดตั้งและส่งมอบ", "รับประกันสินค้าและงาน"],
        updated_at: now },
      { id: 4, slug: "electric", icon: "mdi:flash-outline", title: "งานไฟฟ้าที่เกี่ยวกับระบบแอร์", image: "https://images.pexels.com/photos/14319099/pexels-photo-14319099.jpeg?auto=compress&cs=tinysrgb&w=1200",
        description: "เดินสายไฟ ติดตั้งเบรกเกอร์ และแก้ไขระบบไฟฟ้าสำหรับเครื่องปรับอากาศให้ปลอดภัยและได้มาตรฐาน",
        long: "ดูแลงานไฟฟ้าที่เกี่ยวข้องกับระบบปรับอากาศ ทั้งเดินสายไฟ ติดตั้งเบรกเกอร์ และแก้ไขระบบไฟฟ้าสำหรับเครื่องปรับอากาศให้ปลอดภัยและได้มาตรฐาน ตรวจสอบขนาดสายไฟและอุปกรณ์ป้องกันให้เหมาะกับกำลังไฟของเครื่อง ลดความเสี่ยงไฟฟ้าลัดวงจร",
        steps: ["ตรวจระบบไฟฟ้าหน้างาน", "ประเมินขนาดสายและเบรกเกอร์", "เสนอแนวทางและราคา", "ดำเนินการติดตั้ง / แก้ไข", "ทดสอบความปลอดภัย"],
        updated_at: now }
    ],
    products: airconCatalog,
    projects: [
      { id: 1, title: "ติดตั้งแอร์ VRF อาคารสำนักงาน 8 ชั้น", year: "2568", category: "งานติดตั้งแอร์", place: "พระราม 9 กรุงเทพมหานคร", description: "ติดตั้งเครื่องปรับอากาศแบบ VRF ขนาดรวม 96 ตันความเย็น ครอบคลุมพื้นที่สำนักงานทั้ง 8 ชั้น พร้อมงานเดินท่อน้ำยาและงานไฟฟ้าความยาวรวมกว่า 600 เมตร ควบคุมการทำงานผ่านระบบส่วนกลาง แยกโซนตามชั้นและช่วงเวลาทำงาน ส่งมอบภายใน 60 วัน พร้อมสัญญาดูแลรักษารายปี", image: "https://images.pexels.com/photos/8065903/pexels-photo-8065903.jpeg?auto=compress&cs=tinysrgb&w=1200" },
      { id: 2, title: "ติดตั้งแอร์ร้านค้าปลีก 12 สาขา", year: "2568", category: "งานติดตั้งแอร์", place: "กรุงเทพฯ และปริมณฑล", description: "ติดตั้งเครื่องปรับอากาศให้ร้านค้าปลีก 12 สาขาทั่วกรุงเทพฯ–ปริมณฑล เลือกรุ่นและขนาดให้เหมาะกับพื้นที่ขายแต่ละสาขา ดูแลบำรุงรักษาต่อเนื่องหลังส่งมอบ", image: "https://images.pexels.com/photos/1567355/pexels-photo-1567355.jpeg?auto=compress&cs=tinysrgb&w=1200" },
      { id: 3, title: "ติดตั้งแอร์โรงงานพร้อมระบบไฟฟ้า", year: "2567", category: "งานติดตั้งแอร์", place: "คลองสามวา กรุงเทพมหานคร", description: "ติดตั้งเครื่องปรับอากาศพร้อมงานเดินสายไฟและเบรกเกอร์สำหรับโรงงานย่านคลองสามวา ออกแบบระบบไฟฟ้าให้รองรับกำลังไฟของเครื่องอย่างปลอดภัย", image: "https://images.pexels.com/photos/28726413/pexels-photo-28726413.jpeg?auto=compress&cs=tinysrgb&w=1200" },
      { id: 4, title: "ล้างและบำรุงรักษาแอร์อาคารพักอาศัย", year: "2567", category: "งานล้างและซ่อมบำรุง", place: "มีนบุรี กรุงเทพมหานคร", description: "บริการล้างทำความสะอาดและตรวจเช็กเครื่องปรับอากาศประจำอาคารพักอาศัย ตามรอบเวลาที่กำหนด ลดปัญหาเครื่องเสียกะทันหันและยืดอายุการใช้งาน", image: "https://images.pexels.com/photos/30572791/pexels-photo-30572791.jpeg?auto=compress&cs=tinysrgb&w=1200" },
      { id: 5, title: "สัญญาดูแลแอร์โรงแรมรายปี", year: "2567", category: "งานบำรุงรักษา", place: "สุขุมวิท กรุงเทพมหานคร", description: "สัญญาบำรุงรักษารายปีเครื่องปรับอากาศ 120 เครื่อง โรงแรมย่านสุขุมวิท ตรวจเช็กตามรอบ ลดค่าไฟและความเสี่ยงเครื่องเสียกะทันหัน", image: "https://images.pexels.com/photos/34687846/pexels-photo-34687846.jpeg?auto=compress&cs=tinysrgb&w=1200" },
      { id: 6, title: "ย้ายและติดตั้งแอร์ใหม่ทั้งชั้น", year: "2566", category: "งานติดตั้งแอร์", place: "ลาดพร้าว กรุงเทพมหานคร", description: "ย้ายจุดติดตั้งและเปลี่ยนเครื่องปรับอากาศใหม่ทั้งชั้นของอาคารสำนักงานให้เช่าย่านลาดพร้าว วางแผนงานให้กระทบผู้เช่าน้อยที่สุด", image: "https://images.pexels.com/photos/33689718/pexels-photo-33689718.jpeg?auto=compress&cs=tinysrgb&w=1200" }
    ],
    news: [
      { id: 1, title: "เปิดตัวแอร์ Inverter รุ่นใหม่ ประหยัดไฟเบอร์ 5", body: "บริษัทฯ มีความยินดีที่จะแนะนำเครื่องปรับอากาศซีรีส์ใหม่ล่าสุด ระบบ Inverter พร้อมน้ำยา R32 ช่วยลดค่าไฟฟ้าได้สูงสุดถึง 30% เมื่อเทียบกับรุ่นเดิม เหมาะสำหรับบ้านและอาคารที่ต้องการลดต้นทุนพลังงานระยะยาว\n\nสินค้าพร้อมจำหน่ายแล้ววันนี้ พร้อมบริการสำรวจหน้างานและคำนวณขนาด BTU ที่เหมาะสมโดยไม่มีค่าใช้จ่าย", image: "https://images.pexels.com/photos/3964617/pexels-photo-3964617.jpeg?auto=compress&cs=tinysrgb&w=1200", published_at: "2569-07-12", published: true },
      { id: 2, title: "ร่วมออกบูธงานสถาปนิก’69", body: "พบกับบูธของบริษัทได้ที่งานสถาปนิก’69 อิมแพ็ค เมืองทองธานี บูธ A-23 พบโปรโมชันพิเศษเฉพาะในงาน", image: "https://images.pexels.com/photos/6033459/pexels-photo-6033459.jpeg?auto=compress&cs=tinysrgb&w=1200", published_at: "2569-06-28", published: true },
      { id: 3, title: "โปรโมชันล้างแอร์กลางปี เริ่มต้น 500.-", body: "ล้างแอร์ครบ 3 เครื่องขึ้นไป รับส่วนลดเพิ่ม 10% ตั้งแต่วันนี้ถึง 31 กรกฎาคม 2569", image: "https://images.pexels.com/photos/30572791/pexels-photo-30572791.jpeg?auto=compress&cs=tinysrgb&w=1200", published_at: "2569-06-10", published: true },
      { id: 4, title: "อบรมการดูแลรักษาแอร์เบื้องต้นให้ลูกค้าอาคาร", body: "กิจกรรม Workshop ประจำไตรมาสสำหรับลูกค้าสัญญาบำรุงรักษา สอนการดูแลเครื่องปรับอากาศเบื้องต้นด้วยตนเอง", image: "https://images.pexels.com/photos/8297856/pexels-photo-8297856.jpeg?auto=compress&cs=tinysrgb&w=1200", published_at: "2569-05-22", published: false }
    ],
    pricingInstall: {
      rows: [
        ["ติดผนัง (Wall Type)", "9,000 – 12,000 BTU", "฿2,500"],
        ["ติดผนัง (Wall Type)", "18,000 – 24,000 BTU", "฿3,000"],
        ["ติดผนัง (Wall Type)", "30,000 – 36,000 BTU", "฿3,500"],
        ["แขวน / ตั้งพื้น", "ทุกขนาด", "฿3,500 เป็นต้นไป"],
        ["ฝังฝ้า 4 ทิศทาง", "ทุกขนาด", "฿4,500 เป็นต้นไป"]
      ],
      included: ["ท่อน้ำยาความยาว 4 เมตร", "สายไฟและเบรกเกอร์พื้นฐาน", "ขายึดและรางครอบท่อ", "ทดสอบระบบและรับประกันงานติดตั้ง"],
      extra: ["ท่อน้ำยาส่วนเกิน เมตรละ ฿350", "เจาะผนังปูนหรือกระเบื้อง", "เดินท่อน้ำทิ้งเพิ่มเติม", "ขาแขวนหรืออุปกรณ์พิเศษ"]
    },
    pricingClean: {
      rows: [
        ["ติดผนัง (Wall Type)", "ไม่เกิน 18,000 BTU", "฿500"],
        ["ติดผนัง (Wall Type)", "18,001 – 36,000 BTU", "฿700"],
        ["แขวน / ตั้งพื้น", "ทุกขนาด", "฿800"],
        ["ฝังฝ้า 4 ทิศทาง", "ทุกขนาด", "฿1,200"]
      ],
      steps: ["ล้างแผงคอยล์เย็นและคอยล์ร้อน", "ล้างแผ่นกรองอากาศ", "ตรวจวัดปริมาณน้ำยาและแรงดัน", "ตรวจระบบไฟและจุดรั่วซึม"],
      promo: ["ล้างตั้งแต่ 3 เครื่องขึ้นไป ลด 10%", "ลูกค้าสัญญาบำรุงรักษารายปี ราคาพิเศษ", "นัดล้างตามรอบ 6 เดือน มีส่วนลดต่อเนื่อง", "พื้นที่นอกเขต คิดค่าเดินทางตามระยะ"]
    },
    payment: {
      methods: [
        { no: "01", icon: "mdi:bank-outline", title: "โอนผ่านธนาคาร", desc: "ธนาคารกสิกรไทย · ไทยพาณิชย์ · กรุงเทพ  ชื่อบัญชี บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด (เลขบัญชีแจ้งเมื่อยืนยันการสั่งซื้อ)" },
        { no: "02", icon: "mdi:qrcode", title: "พร้อมเพย์ (PromptPay)", desc: "ชำระผ่านเลขประจำตัวผู้เสียภาษี 0105569026761 สแกน QR ได้จากใบเสนอราคา" },
        { no: "03", icon: "mdi:cash-multiple", title: "เงินสด", desc: "ชำระกับทีมช่างเมื่อส่งมอบงานหรือติดตั้งเสร็จ" },
        { no: "04", icon: "mdi:credit-card-outline", title: "บัตรเครดิต / ผ่อน 0%", desc: "ผ่อนชำระนานสูงสุด 10 เดือน สำหรับการซื้อแอร์พร้อมติดตั้ง (เงื่อนไขตามธนาคาร)" }
      ],
      terms: [
        ["งานติดตั้งแอร์", "มัดจำ 50% ก่อนเริ่มงาน ส่วนที่เหลือชำระเมื่อส่งมอบและทดสอบระบบเรียบร้อย"],
        ["งานล้างและซ่อม", "ชำระเต็มจำนวนเมื่อทำงานเสร็จ"],
        ["งานโครงการ", "แบ่งชำระเป็นงวดตามข้อตกลงในสัญญา"],
        ["เอกสาร", "ออกใบเสร็จรับเงินและใบกำกับภาษีได้ทุกงาน"],
        ["ส่งหลักฐานการโอน", "ส่งสลิปผ่าน Line @yuyenpensuk เพื่อยืนยันการชำระ"]
      ]
    },
    admins: [
      {
        id: 1,
        username: process.env.INITIAL_ADMIN_USERNAME || "admin",
        password_hash: bcrypt.hashSync(
          process.env.INITIAL_ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? (() => { throw new Error("INITIAL_ADMIN_PASSWORD is required before creating the production database."); })() : "admin123"),
          10
        ),
        name: "สมชาย ใจดี",
        email: "somchai@yuyenpensuk.co.th",
        phone: "081-000-0000",
        role: "superadmin",
        twofa_enabled: false,
        twofa_secret: ""
      }
    ]
  };
}

module.exports = { load, save, nextId, reloadIfChanged, get: () => db };
