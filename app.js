import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import logger from "morgan";
import swaggerUi from "swagger-ui-express";
import { connectDB } from "./config/database.js";
import { initializeMailer } from "./config/nodemailer.js";
import { specs } from "./config/swagger.js";
import authRouter from "./routes/auth.js";
import feedRoutes from "./routes/feed.js";
import goalsRouter from "./routes/goals.js";
import userRouter from "./routes/user.js";
import verificationRouter from "./routes/verification.js";

const app = express();

// CORS 配置
const allowedOrigins = [
  "http://localhost:10000",
  "https://goaltracker-frontend.onrender.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
  })
);

// 安全性配置
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "https://goaltracker-frontend.onrender.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 基本中間件
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 請求日誌（僅在開發環境）
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// API 路由
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/goals", goalsRouter);
app.use("/api/feeds", feedRoutes);

// Swagger 文檔
if (process.env.NODE_ENV !== "production") {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customCss: ".swagger-ui .topbar { display: none }",
      swaggerOptions: {
        persistAuthorization: true,
      },
    })
  );
}

// 健康檢查端點
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "路徑不存在",
      status: 404,
      path: req.originalUrl,
    },
  });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error("错误详情:", {
    message: err.message,
    stack: err.stack,
    status: err.status,
  });

  const status = err.status || 500;
  const message = err.message || "服务器错误";

  res.status(status).json({
    error: {
      message,
      status,
      timestamp: new Date().toISOString(),
    },
  });
});

// 移除立即執行的 initializeApp
const initializeApp = async () => {
  try {
    // 連接數據庫
    await connectDB();
    console.log("資料庫連接成功");

    // 初始化郵件服務
    await initializeMailer();

    return true;
  } catch (error) {
    console.error("應用初始化失敗:", error);
    throw error;
  }
};

// 導出 initializeApp 供 bin/www 使用
export { initializeApp };
export default app;
