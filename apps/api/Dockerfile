FROM node:22-slim AS base
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/ packages/
COPY apps/api/ apps/api/
COPY tsconfig.base.json ./
RUN pnpm --filter @nexus/api build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./
COPY --from=build /app/packages/shared/dist ./node_modules/@nexus/shared/dist
COPY --from=build /app/packages/shared/package.json ./node_modules/@nexus/shared/
COPY --from=build /app/packages/db/dist ./node_modules/@nexus/db/dist
COPY --from=build /app/packages/db/package.json ./node_modules/@nexus/db/
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
