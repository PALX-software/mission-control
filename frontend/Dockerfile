FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --omit=dev --workspace frontend

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend
COPY frontend/tsconfig.json ./frontend/tsconfig.json
COPY frontend/src ./frontend/src
COPY frontend/views ./frontend/views
RUN npm run build --workspace frontend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV API_BASE_URL=http://backend:3001/api
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/frontend/views ./frontend/views
EXPOSE 3000
CMD ["node", "frontend/dist/main.js"]
