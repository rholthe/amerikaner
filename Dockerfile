# Prisma trenger openssl i alle tre stegene. Node 22 fordi Prisma 7 krever det
# (@prisma/streams-local advarer på node 20).
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# next build leser ikke databasen, men Prisma-klienten må finnes for typene.
RUN npm run build

FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV TZ=Europe/Oslo
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/app/generated ./app/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Containeren kjører som uid 1000, ikke root: det bind-monterte data/ eies da av
# ragnar på hosten, og backup-scriptet kan lese SQLite-fila uten sudo.
RUN mkdir -p /app/data && chown -R 1000:1000 /app
USER 1000:1000

EXPOSE 3000
CMD ["npm", "run", "start"]
