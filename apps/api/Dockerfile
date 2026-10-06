FROM node:26-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @saas/api...

FROM deps AS build
COPY . .
RUN pnpm --filter @saas/database generate
RUN pnpm --filter @saas/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
