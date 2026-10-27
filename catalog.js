/**
 * AIR-CON CATALOG — 30 products / 6 brands
 * Product photos are loaded from the model-specific product page at runtime.
 * The gallery filter only accepts clean product/indoor-unit images; it never
 * fills a model with an image from another model.
 */
// อาร์กิวเมนต์ตามลำดับ: id, brand, name, model, btu, benefits, source, extraSpec, gallery
function p(...args) {
  const [id, brand, name, model, btu, benefits, source, extraSpec = 'Inverter · R32', gallery = []] = args;
  return {
    id, name, brand, model, type: 'ติดผนัง', price: 0, priceOld: 0,
    spec: `${btu} BTU · ${extraSpec}`,
    badge: '', bestseller: id <= 106,
    description: benefits.join(' '), benefits,
    image: gallery[0] || '', gallery: [...new Set(gallery)].slice(0,5), catalog: '', source
  };
}

const airconCatalog = [
  // DAIKIN
  p(101,'DAIKIN','MAX INVERTER KF Series','FTKF-YV2S','ประมาณ 9,000–24,000',[
    'ระบบ Inverter ช่วยรักษาอุณหภูมิให้คงที่','Intelligent Eye','Coanda Airflow','แผ่นกรอง Enzyme Blue และ PM2.5','Self-Hygiene Booster'
  ],'https://www.daikin.co.th/product/FTKF-YV2S'),
  p(102,'DAIKIN','MAX INVERTER KZ Series','FTKZ-VV2S','ประมาณ 9,000–24,000',[
    'Streamer Technology','Self-Hygiene Booster','Built-in Wi-Fi','Intelligent Eye','ฉลากประหยัดไฟเบอร์ 5'
  ],'https://www.daikin.co.th/th/product/FTKZ-VV2S'),
  p(103,'DAIKIN','MAX INVERTER KM Series','FTKM-WV2S','ประมาณ 9,000–24,000',[
    'Streamer Technology','Self-Hygiene Booster','Intelligent Eye','3D Swing','สารทำความเย็น R32'
  ],'https://www.daikin.co.th/product/ftkm-wv2s/', 'Inverter · R32', [
    'https://daikin.co.th/assets/uploads/product/7/product_image_gallery/ftkm-w005.jpg',
    'https://daikin.co.th/assets/uploads/product/7/product_image_gallery/ftkm-w001.jpg',
    'https://daikin.co.th/assets/uploads/product/7/product_image_gallery/ftkm-w002.jpg',
    'https://daikin.co.th/assets/uploads/product/7/product_image_gallery/ftkm-w003.jpg',
    'https://daikin.co.th/assets/uploads/product/7/product_image_gallery/ftkm-w004.jpg'
  ]),
  p(104,'DAIKIN','MAX INVERTER KC Series','FTKC-YV2S','ประมาณ 9,000–24,000',[
    'Streamer Technology','Intelligent Eye','Self-Hygiene Booster','3D Airflow','สารทำความเย็น R32'
  ],'https://www.daikin.co.th/en/product/FTKC-YV2S'),
  p(105,'DAIKIN','MAX INVERTER Sabai Series','FTKB-ZV2S','ประมาณ 9,000–20,500',[
    'ระบบ Inverter','โหมดทำความเย็นอย่างรวดเร็ว','โหมดประหยัดพลังงาน','ปรับอุณหภูมิครั้งละ 0.5°C','สารทำความเย็น R32'
  ],'https://www.daikin.co.th/th/product/FTKB-ZV2S'),

  // MITSUBISHI ELECTRIC
  p(106,'MITSUBISHI ELECTRIC','3D Move Eye KIWAMI','MSY-AW13VF2','12,966',[
    'ประหยัดไฟเบอร์ 5 ระดับ 5 ดาว','3D Move Eye KIWAMI','Fast Cooling AI','R32','รับประกันตามเงื่อนไขผู้ผลิต'
  ],'https://www.mitsubishi-kyw.co.th/Product/For-Home/conditioner/LN-Serie/1088-%283%29.aspx'),
  p(107,'MITSUBISHI ELECTRIC','Standard Inverter JZ Series','MSY-JZ15VF','14,330',[
    'Inverter','Dual Barrier Coating','Fast Cooling','V Air Filter','PM2.5 filtration'
  ],'https://www.mitsubishi-kyw.co.th/Product/For-Home/conditioner/JS-Series/Super-Inverter-%283%29.aspx'),
  p(108,'MITSUBISHI ELECTRIC','Super Inverter GZ Series','MSY-GZ18VF','17,742',[
    'Dual Barrier Coating','Fast Cooling','Sleep Mode','V-Air Filter','PM2.5 filtration'
  ],'https://kangyong.co.th/product/msy-gz18vf/'),
  p(109,'MITSUBISHI ELECTRIC','Happy Inverter KA Series','MSY-KA15VF','15,013',[
    'Inverter','Fast Cooling','Nano Platinum Filter','Sleep Mode','R32'
  ],'https://www.mitsubishi-kyw.co.th/Product/For-Home/conditioner/KT-Series/5529.aspx'),
  p(110,'MITSUBISHI ELECTRIC','Happy Inverter KA Series','MSY-KA18VF','17,742',[
    'Inverter','Fast Cooling','Nano Platinum Filter','Sleep Mode','R32'
  ],'https://kangyong.co.th/product/msy-ka18vf/'),

  // CARRIER
  p(111,'CARRIER','XInverter Plus','42TVAB013-W-I','12,200',[
    'SEER 22.50','ฉลากประหยัดไฟเบอร์ 5 ระดับ 3 ดาว','Wi-Fi Built-in','X-IONIZER / PM2.5','Self Cleaning'
  ],'https://carrierthailand.com/xinverter-plus-/'),
  p(112,'CARRIER','XInverter Plus','42TVAB018-W-I','18,000',[
    'SEER 22.50','ฉลากประหยัดไฟเบอร์ 5 ระดับ 3 ดาว','Wi-Fi Built-in','X-IONIZER / PM2.5','Self Cleaning'
  ],'https://carrierthailand.com/xinverter-plus-/'),
  p(113,'CARRIER','XInverter Plus','42TVAB024-W-I','20,400',[
    'SEER 20.88','ฉลากประหยัดไฟเบอร์ 5 ระดับ 2 ดาว','Wi-Fi Built-in','X-IONIZER / PM2.5','Self Cleaning'
  ],'https://carrierthailand.com/xinverter-plus-/'),
  p(114,'CARRIER','Copper ION','42TVEB013','12,000',[
    'X-IONIZER','PM2.5 Filter','Self Cleaning','Copper Coil','ฉลากประหยัดไฟเบอร์ 5'
  ],'https://www.homepro.co.th/p/1314539'),
  p(115,'CARRIER','Copper SEAL','42TVDB013','12,000',[
    'Copper Coil','PCB Coating','Self Cleaning','PM2.5 Filter','R32'
  ],'https://www.homepro.co.th/p/1314548'),

  // SAIJO DENKI — exact model pages with verified model/BTU information.
  p(116,'SAIJO DENKI','Sure Inverter R32','Inverter Sure R32-12','12,644',[
    'ระบบ Inverter','R32','ประหยัดไฟเบอร์ 5','SEER 18.94','ประเภทแอร์ผนัง'
  ],'https://dasintergroup.com/product/sure-inverter/inverter-sure-r32-12/'),
  p(117,'SAIJO DENKI','Turbo A.P.S R32','TURBO APS R32-12','12,770',[
    'ระบบ Turbo A.P.S.','R32','ประหยัดไฟเบอร์ 5 ระดับ 2 ดาว','SEER 15.25','ประเภทแอร์ผนัง'
  ],'https://dasintergroup.com/product/turbo-a-p-s/turbo-a-p-s-r32-12/'),
  p(118,'SAIJO DENKI','Turbo A.P.S R32','TURBO APS R32-18','18,905',[
    'ระบบ Turbo A.P.S.','R32','ประหยัดไฟเบอร์ 5 ระดับ 2 ดาว','SEER 15.83','ประเภทแอร์ผนัง'
  ],'https://dasintergroup.com/product/turbo-a-p-s/turbo-a-p-s-r32-18/'),
  p(119,'SAIJO DENKI','Smart Cool R32','Smart Cool SWG-12','12,770',[
    'แผงฟอกอากาศ','R32','ประหยัดไฟเบอร์ 5 ระดับ 2 ดาว','SEER 15.25','ประเภทแอร์ผนัง'
  ],'https://dasintergroup.com/product/smart-cool/smart-cool-r32-12/'),
  p(120,'SAIJO DENKI','Sure Inverter R32','Inverter Sure R32-30','31,265',[
    'ระบบ Inverter','R32','ประหยัดไฟเบอร์ 5','SEER 15.02','ประเภทแอร์ผนัง'
  ],'https://dasintergroup.com/product/sure-inverter/inverter-sure-r32-30/'),

  // PANASONIC
  p(121,'PANASONIC','Premium nanoe Inverter XU Series','CS-XU13AKT/CU-XU13AKT','12,679',[
    'nanoe X Generator Mark 3','ทำความสะอาดภายในได้ตามต้องการ','Wi-Fi / Comfort Cloud','AEROWINGS','ECO A.I. + Inverter'
  ],'https://www.panasonic.com/th/air-solutions/products/air-conditioner/rac/xu-akt/cu-cs-xu13akt.html'),
  p(122,'PANASONIC','Deluxe nanoe Inverter TU Series','CS-TU13AKT/CU-TU13AKT','12,030',[
    'nanoe X Generator Mark 2','ทำความสะอาดภายในได้ตามต้องการ','Wi-Fi / Comfort Cloud','AEROWINGS','POWERFUL + ECO A.I.'
  ],'https://www.panasonic.com/th/air-solutions/products/air-conditioner/rac/tu-akt/cu-cs-tu13akt.html'),
  p(123,'PANASONIC','Standard Inverter YU Series','CS-YU13ZKT/CU-YU13ZKT','12,297',[
    'Avoid Me','Gear Mode','i-Clean','Inverter','R32'
  ],'https://www.panasonic.com/th/air-solutions/products/air-conditioner/rac/yu-zkt/cu-cs-yu13zkt.html'),
  p(124,'PANASONIC','Standard Inverter YU Series','CS-YU18ZKT/CU-YU18ZKT','18,097',[
    'Avoid Me','Gear Mode','i-Clean','Inverter','R32'
  ],'https://www.panasonic.com/th/air-solutions/products/air-conditioner/rac/yu-zkt/cu-cs-yu18zkt.html'),
  p(125,'PANASONIC','Eco Non-Inverter YN Series','CS-YN12YKT/CU-YN12YKT','ประมาณ 12,000',[
    'Eco Non-Inverter','เหมาะกับการใช้งานภายในบ้าน','มีหลายขนาด BTU','ดีไซน์ติดผนัง','สารทำความเย็นตามรุ่น'
  ],'https://www.panasonic.com/th/air-solutions/product-top/air-conditioner/rac-series.html','Non-Inverter · R32'),

  // LG
  p(126,'LG','DUALCOOL Pro','ICL13M','12,000',[
    'Dual Inverter Compressor','PM2.5 Filter','Volt Care','Real Copper + Gold Fin','คอมเพรสเซอร์รับประกัน 10 ปีตามเงื่อนไข LG'
  ],'https://www.lg.com/th/air-conditioner-inverter/icl13m/'),
  p(127,'LG','POWER COOL','ISC13E','12,000',[
    'LED Smart Display','Pre Filter','Auto Cleaning','Real Copper','R32'
  ],'https://www.lg.com/th/air-conditioner-inverter/energy-saving-air-conditioner/isc13e/'),
  p(128,'LG','POWER COOL','ISC18E','18,000',[
    'LED Smart Display','Pre Filter','Auto Cleaning','Real Copper','R32'
  ],'https://www.lg.com/th/air-conditioner-inverter/energy-saving-air-conditioner/isc18e/'),
  p(129,'LG','DUALCOOL','IXY11A','9,212',[
    'kW Manager','Auto Cleaning','PM2.5 2 ชั้น','Plasmaster Ionizer++','LG ThinQ'
  ],'https://www.lg.com/th/air-conditioner-inverter/energy-saving-air-conditioner/ixy11a/'),
  p(130,'LG','DUALCOOL Inverter','IG10R','9,200',[
    'Dual Inverter Compressor','Gold Fin','เสียงเบา','Auto Cleaning','R32'
  ],'https://www.lg.com/th/air-conditioner-inverter/ig10r/')
];

// Keep every model unique.
const seen = new Set();
for (const item of airconCatalog) {
  const key = `${item.brand}|${item.model}`;
  if (seen.has(key)) throw new Error(`Duplicate air-con model: ${key}`);
  seen.add(key);
}

module.exports = airconCatalog;
