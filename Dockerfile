FROM node:20.11.1-alpine

LABEL maintainer="Ryo Ota <nwtgck@nwtgck.org>"

RUN apk add --no-cache tini

COPY . /app

# Move to /app
WORKDIR /app

# Install requirements, build and remove devDependencies
# (from: https://stackoverflow.com/a/25571391/2885946)
RUN npm ci --no-audit
RUN npm run build
RUN npm prune --production
RUN npm cache clean --force

# Run a server
ENTRYPOINT [ "tini", "--", "node", "dist/src/index.js" ]
