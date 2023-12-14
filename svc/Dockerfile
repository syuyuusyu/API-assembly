FROM node:18-alpine

RUN mkdir /app
WORKDIR /app

COPY package.json /app/package.json
ENV NODE_PATH=/usr/local/bin/node
RUN npm install --omit=dev

COPY . /app

EXPOSE 7001
CMD ["npm", "start"]
