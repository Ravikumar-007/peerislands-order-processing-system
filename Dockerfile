# ---------- Build stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including dev deps needed to build)
COPY package*.json ./
RUN npm ci

# Generate the Prisma client and compile TypeScript
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ---------- Runtime stage ----------
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the generated Prisma client, schema and compiled output
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Run as the non-root user shipped with the base image
USER node

EXPOSE 3000

# Apply pending migrations, then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
