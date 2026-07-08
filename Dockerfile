FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_URL=/app/data/wishlist.db

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["node", "src/index.ts"]
