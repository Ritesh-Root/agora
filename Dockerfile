FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && ./node_modules/.bin/esbuild server/prod.ts --bundle --platform=node --format=esm --outfile=dist/server.mjs --packages=external
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server.mjs"]
