FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
{{BUILD_COMMAND}}
EXPOSE {{PORT}}
CMD {{START_COMMAND}}
