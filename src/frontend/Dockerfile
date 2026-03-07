FROM node:22-alpine

WORKDIR /app/src/frontend

COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci

COPY src/frontend ./

EXPOSE 5555

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5555"]
