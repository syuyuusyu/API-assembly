FROM node:18-alpine

# 创建工作目录
RUN mkdir -p /app
WORKDIR /app

# 复制 package.json 和 package-lock.json（如果存在）
COPY package.json package-lock.json* /app/

# 设置环境变量（可选，根据需要）
ENV NODE_PATH=/usr/local/bin/node

# 安装生产依赖，利用缓存
RUN npm install --omit=dev --prefer-offline --no-audit

# 复制剩余的项目文件
COPY . /app

# 暴露端口
EXPOSE 7001

# 启动命令
CMD ["npm", "start"]