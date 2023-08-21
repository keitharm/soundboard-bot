#        dependencies
# -------------------------
FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./

# Install prod deps and all deps separately for stage-specific usage
RUN npm ci
RUN cp -r ./node_modules ./dev_node_modules
RUN npm prune --prod

#           base
# -------------------------
FROM node:20-alpine AS base

# Prevent node/npm being run as PID 1
RUN apk add --no-cache dumb-init
ENTRYPOINT ["dumb-init"]

ENV PATH $PATH:./node_modules/.bin
WORKDIR /app

#           dev
# -------------------------
FROM base AS dev
COPY --chown=node --from=deps /app/dev_node_modules ./node_modules
CMD ["nodemon", "."]

#          release
# -------------------------
FROM base AS release
ENV NODE_ENV=production
LABEL org.opencontainers.image.source https://github.com/keitharm/soundboard-bot

COPY --chown=node --from=deps /app/node_modules ./node_modules
COPY --chown=node . .
RUN rm -rf ./test package-lock.json .eslintrc.json
USER node
CMD ["node", "./src/index.js"]
