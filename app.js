import "dotenv/config";
import createError from "http-errors";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import { fileURLToPath } from "url";
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.js';
import cors from 'cors';
import helmet from 'helmet';

import indexRouter from "./routes/index.js";
import usersRouter from "./routes/users.js";
import { connectDB } from "./config/database.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 添加 CORS 配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://你的前端域名'] 
    : ['http://localhost:3000'],
  credentials: true
}));

// 安全性配置
app.use(helmet());

// 基本配置
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// API 路由
app.use("/api", indexRouter);
app.use("/api/users", usersRouter);

// Swagger 文檔
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// 錯誤處理
app.use(function (req, res, next) {
  res.status(404).json({
    error: {
      message: "Not Found",
      status: 404
    }
  });
});

app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500
    }
  });
});

// 連接資料庫
connectDB()
  .then(() => {
    console.log("資料庫連接已初始化");
  })
  .catch((err) => {
    console.error("資料庫連接失敗:", err);
  });

export default app;
