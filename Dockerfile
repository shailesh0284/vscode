# Set default values for build arguments
ARG NODE_VERSION=18.17.1
ARG ALPINE_VERSION=3.17.2

# Build Node.js stage
FROM node:${NODE_VERSION}-alpine AS node

# Build final image with Alpine Linux
FROM alpine:${ALPINE_VERSION}

# Copy Node.js binaries from the build stage
COPY --from=node /usr/lib /usr/lib
COPY --from=node /usr/local/lib /usr/local/lib
COPY --from=node /usr/local/include /usr/local/include
COPY --from=node /usr/local/bin /usr/local/bin

RUN apk add --no-cache bash

# Set the default shell to Bash
SHELL ["/bin/bash", "-c"]

# Verify Node.js version
RUN node -v

# Install Yarn
RUN npm install -g yarn --force

# Install Git
RUN apk --no-cache add git

# Install Python and required dependencies
RUN apk --no-cache add build-base g++ libx11-dev libxkbfile-dev libsecret-dev krb5-dev python3

# Install fakeroot and rpm
RUN apk --no-cache add fakeroot rpm

# Clean up caches
RUN rm -rf ~/.cache/node-gyp

# Set working directory
WORKDIR /vscode

# Copy remaining project files
COPY . .

# Install dependencies
RUN yarn

EXPOSE 9888

# Run VS Code build with Bash
CMD ["./scripts/code-server.sh", "--bind", "0.0.0.0"]
