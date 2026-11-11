# The API (admin.edildy.com/api): NestJS + pg-boss. The same image runs the one-off `migrate` service
# (node dist/db/scripts/setup.js) and create-platform-admin (node dist/scripts/create-platform-admin.js).
# Build from the repository root so the workspace packages are in the context:
#   docker build -f apps/api/Dockerfile -t edildy-api .
FROM node:24-alpine AS build
RUN npm install -g pnpm@latest
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@edildy/api...
# A self-contained copy with production dependencies only: dist/, drizzle/ (migrations) and node_modules/.
RUN pnpm --filter @edildy/api deploy --prod --legacy /out

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "--enable-source-maps", "dist/main.js"]
