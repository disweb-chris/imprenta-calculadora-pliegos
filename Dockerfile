FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

# Capa de dependencias aparte para aprovechar la caché de Cloud Build.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 8080
CMD ["node", "src/api/server.js"]
