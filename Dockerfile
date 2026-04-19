# syntax=docker/dockerfile:1.7
# FINVANTA CBS -- Next.js BFF image. Multi-stage, non-root runtime.

FROM node:20-alpine AS deps
WORKDIR /app
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN addgroup -S cbs && adduser -S cbs -G cbs
COPY --from=build --chown=cbs:cbs /app/.next/standalone ./
COPY --from=build --chown=cbs:cbs /app/.next/static ./.next/static
COPY --from=build --chown=cbs:cbs /app/public ./public
USER cbs
EXPOSE 3000
CMD ["node", "server.js"]
