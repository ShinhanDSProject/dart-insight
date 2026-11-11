FROM node:22-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_API_BASE_URL=""
# 검증(lint·test)은 CI 단계에서 완료되므로, 프로덕션 빌드만 신속하게 실행
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

