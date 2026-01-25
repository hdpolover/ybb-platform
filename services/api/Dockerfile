FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Copy source code
COPY src ./src

# Build the application
RUN npm run build
RUN npm run build:seed

# Production Stage
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma (needed for runtime)
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Update package.json to use compiled seed script in production
RUN sed -i 's|npx ts-node prisma/seeds/main.ts|node dist/prisma/seeds/main.js|g' package.json

# Install only production dependencies
RUN npm ci --only=production

# Generate Prisma Client (needed for runtime)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 4000

# Use entrypoint to run migrations before starting app
ENTRYPOINT ["/bin/sh", "/docker-entrypoint.sh"]
CMD ["node", "dist/main"]
