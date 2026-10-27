FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# คัดลอกเฉพาะไฟล์ที่ระบบใช้ทำงาน (ไม่คัดลอกทั้งโฟลเดอร์ เพื่อกันไฟล์ลับหรือข้อมูลจริงหลุดเข้า image)
COPY deploy-server.js database.js catalog.js sessionStore.js ./
COPY middleware ./middleware
COPY routes ./routes
COPY utils ./utils
COPY views ./views
COPY public ./public
COPY scripts ./scripts

RUN mkdir -p /app/data /app/uploads \
    && chown -R node:node /app

USER node
EXPOSE 3000

CMD ["npm", "run", "start:deploy"]
