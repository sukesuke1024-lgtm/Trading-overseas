# 本番（サーバー版）用。データは /data（ボリューム）に保存されます。
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production PORT=3000 PORTAL_DATA_DIR=/data
VOLUME /data
EXPOSE 3000
CMD ["npm", "run", "start"]
