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

// CORS 配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://goaltracker-admin.onrender.com',  // 後端域名
        'https://goaltracker-web.onrender.com/'  // 如果有前端應用
      ]
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 安全性配置
app.use(helmet({
  contentSecurityPolicy: false,  // 為了 Swagger UI
  crossOriginEmbedderPolicy: false
}));

// 添加額外的 CORS 頭
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// 基本配置
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// API 路由
app.use("/api", indexRouter);
app.use("/api/users", usersRouter);

// Swagger UI 配置
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    url: '/api-docs/swagger.json',
    persistAuthorization: true
  }
}));

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
