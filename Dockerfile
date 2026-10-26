FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

RUN mkdir -p /app/data /app/uploads \
    && chown -R node:node /app

USER node
EXPOSE 3000

CMD ["npm", "run", "start:deploy"]
