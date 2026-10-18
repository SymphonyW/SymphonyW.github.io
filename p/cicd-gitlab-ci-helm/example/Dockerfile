FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node server.mjs ./
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
