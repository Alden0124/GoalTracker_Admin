FROM node:18-alpine

WORKDIR /usr/src/app

# 安裝依賴
COPY package*.json ./
RUN npm install

# 複製源代碼
COPY . .

# 設置環境變量
ENV NODE_ENV=production
ENV PORT=3001

# 暴露端口
EXPOSE 3001

# 啟動命令
CMD ["npm", "run", "start:prod"]