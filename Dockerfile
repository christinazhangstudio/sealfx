# Build stage

# thought this doesn't work for whatever reason (see below).
# FROM alpine:latest AS builder

# # much more minimal in size than using node: base image.
# RUN apk add --no-cache nodejs npm

# # Install build tools for native modules (lightningcss, PostCSS)
# RUN apk add --no-cache build-base python3

FROM node:24-slim AS builder

# Use a clean working dir
WORKDIR /app

# Prevents cache issues with host node_modules
COPY package.json package-lock.json* ./

# Clean fresh install + optional deps + force Linux-native rebuild
# https://github.com/parcel-bundler/lightningcss/issues/335#issuecomment-2807214863
# https://github.com/tailwindlabs/tailwindcss/issues/15806#issuecomment-2614576295
# https://github.com/tailwindlabs/tailwindcss/issues/15806#issuecomment-2626536346
RUN npm install --legacy-peer-deps --include=optional \
  && npm rebuild lightningcss

# ultimately I did npm install lightningcss --save-dev to actually fix this.
# left the above for reference (safety?)

COPY . .

RUN npm run build

# Production stage
FROM alpine:latest

# much more minimal in size than using node: base image.
RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./
RUN npm install --production
EXPOSE 9997

# choosing exec over shell format:
    # application IS PID 1, versus shell as PID 1 which spawns a child process
# kubernetes sends SIGTERM to terminate pods gracefully (e.g., during kubectl rollout restart or scaling).
# using CMD ["npm", "start"] ensures npm (and its Node.js child) receives SIGTERM directly, 
# mongoDB connections can be closed properly.
# with CMD npm start, the shell may not forward SIGTERM, 
# potentially causing a 30-second delay (Kubernetes’ default termination grace period) 
# or data loss if MongoDB writes are interrupted.
CMD ["npm", "start"]