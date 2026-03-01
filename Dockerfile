FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN node --max-old-space-size=1024 node_modules/typescript/bin/tsc -p tsconfig.json
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
