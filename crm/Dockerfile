# H-LINK CRM を、社内ポータルとは別のURL（別ドメイン）で公開するためのコンテナ。
# ビルド：docker build -t hlink-crm --build-arg NEXT_PUBLIC_PORTAL_URL=https://portal.example.co.jp/ .
# 起動：  docker run -p 8080:80 hlink-crm   → http://localhost:8080/
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_PORTAL_URL=""
ARG NEXT_PUBLIC_OS_URL=""
ARG NEXT_PUBLIC_BASE_PATH=""
ENV STATIC=1 NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL NEXT_PUBLIC_OS_URL=$NEXT_PUBLIC_OS_URL NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
RUN npx next build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
