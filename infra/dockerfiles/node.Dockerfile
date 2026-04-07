FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY . .
{{BUILD_COMMAND}}
EXPOSE {{PORT}}
CMD {{START_COMMAND}}
