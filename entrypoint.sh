#!/usr/bin/dumb-init /bin/sh

# Set owner of cache to node for downloading Mimics
chown -R node:node /app/cache

# Then execute the Docker CMD as the intended user
exec su-exec node "$@"