FROM node:20-alpine
WORKDIR /app

# Only copy what's needed
COPY package.json ./
RUN npm install --no-audit --no-fund || true

COPY src ./src

EXPOSE 3001
ENV PORT=3001
CMD ["npm", "start"]

