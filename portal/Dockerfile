# 本番（サーバー版）用。データは /data（ボリューム）に保存されます。
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# 勤怠を外部の勤怠SaaSに任せる場合:  --build-arg NEXT_PUBLIC_ATTENDANCE=off --build-arg NEXT_PUBLIC_ATTENDANCE_URL=https://...
ARG NEXT_PUBLIC_ATTENDANCE=""
ARG NEXT_PUBLIC_ATTENDANCE_URL=""
ENV NEXT_PUBLIC_ATTENDANCE=$NEXT_PUBLIC_ATTENDANCE NEXT_PUBLIC_ATTENDANCE_URL=$NEXT_PUBLIC_ATTENDANCE_URL
RUN npm run build
ENV NODE_ENV=production PORT=3000 PORTAL_DATA_DIR=/data
VOLUME /data
EXPOSE 3000
CMD ["npm", "run", "start"]
