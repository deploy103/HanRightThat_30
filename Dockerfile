# --- 빌드 스테이지: 클라이언트(Vite) + 서버(tsc) 빌드 ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- 실행 스테이지: 프로덕션 의존성만 설치, 빌드 산출물만 복사 ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 8787

CMD ["node", "dist-server/server/index.js"]
