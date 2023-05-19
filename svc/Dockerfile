FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --production
EXPOSE 7001
CMD ["npm", "run", "start"]