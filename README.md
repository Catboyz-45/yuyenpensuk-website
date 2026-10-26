# อยู่เย็นเป็นสุข วิศวกรรม — Production Final

เว็บบริษัท + CMS สำหรับใช้งานจริงด้วย Docker

## Production entry point

```bash
npm start
```

Docker Compose ใช้ `deploy-server.js` เป็น entry point เดียว โดยแยกเว็บลูกค้าและ `/admin` ตาม hostname เช่น `admin.yourdomain`.

## Persistent data

ข้อมูล CMS และไฟล์ที่อัปโหลดต้องเก็บนอก container:

```text
/opt/yuyenpensuk/data    -> /app/data
/opt/yuyenpensuk/uploads -> /app/uploads
```

ห้ามลบหรือแทนที่สองโฟลเดอร์นี้ตอน deploy code ใหม่

## Security

- Multer 2.4.0
- จำกัดขนาดและจำนวน multipart fields/files พร้อม fieldArrayIndexLimit
- ตรวจ magic bytes ของไฟล์ก่อนยอมรับ
- CSRF token สำหรับ POST ของ Admin
- Session cookie: HttpOnly, SameSite=Lax, Secure ใน production
- Session regeneration หลัง login/2FA
- Login/OTP rate limit
- bcrypt password hashing
- Content-Security-Policy และ security headers
- Docker รันด้วย user `node`, drop capabilities และ `no-new-privileges`
- container filesystem เป็น read-only ยกเว้น persistent mounts และ `/tmp`

## Product images

มีรูปสินค้า Local ที่ตรวจแล้ว 111 JPG สำหรับ 30 รุ่น และ runtime ไม่ดาวน์โหลดรูปจากเว็บไซต์ภายนอก

## First production setup

1. คัดลอก `.env.example` เป็น `.env`
2. ตั้ง `SESSION_SECRET` เป็นค่าสุ่มยาวอย่างน้อย 32 ตัวอักษร
3. ตั้ง `INITIAL_ADMIN_PASSWORD` อย่างน้อย 12 ตัวอักษร
4. เตรียม `/opt/yuyenpensuk/data` และ `/opt/yuyenpensuk/uploads`
5. รัน:

```bash
docker compose up -d --build
```

ตรวจ:

```bash
docker compose ps
docker compose logs --tail=100 web
curl http://127.0.0.1:3000/healthz
```

## Deploy code ใหม่

อัปเดตเฉพาะ code ใน `/opt/yuyenpensuk/app` แล้วรัน:

```bash
docker compose up -d --build
```

อย่าลบ `/opt/yuyenpensuk/data` หรือ `/opt/yuyenpensuk/uploads`
