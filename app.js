// 導入必要的套件和模組
import "dotenv/config"; // 載入環境變數配置
import express from "express"; // 導入 Express 框架
import path from "path"; // 處理文件路徑
import cookieParser from "cookie-parser"; // 解析 Cookie
import logger from "morgan"; // HTTP 請求日誌記錄器
import { fileURLToPath } from "url"; // 用於處理文件 URL
import swaggerUi from "swagger-ui-express"; // API 文檔界面
import { specs } from "./config/swagger.js"; // Swagger 配置
import cors from "cors"; // 跨域資源共享
import helmet from "helmet"; // 安全性中間件

// 導入路由和數據庫配置
import indexRouter from "./routes/index.js"; // 主路由
import usersRouter from "./routes/users.js"; // 用戶路由
import { connectDB } from "./config/database.js"; // 數據庫連接函數

// 初始化 Express 應用和文件路徑
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS 跨域配置
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://goaltracker-admin.onrender.com", // 生產環境允許的後端域名
            "https://goaltracker-web.onrender.com/", // 生產環境允許的前端域名
          ]
        : ["http://localhost:3000", "http://localhost:3001"], // 開發環境允許的域名
    credentials: true, // 允許攜帶認證信息
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // 允許的 HTTP 方法
    allowedHeaders: ["Content-Type", "Authorization"], // 允許的請求頭
  })
);

// Helmet 安全配置
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], // 默認資源來源限制為同源
        imgSrc: ["'self'", "data:", "https:"], // 圖片來源限制為同源、data URI 和 https
        connectSrc: ["'self'", "https://goaltracker-web.onrender.com"], // 允許從 goaltracker-web.onrender.com 發送 API 請求
      }
    },
    crossOriginEmbedderPolicy: false // 禁用跨來源嵌入政策
  })
);


// 額外的 CORS 請求頭配置
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // 允許所有來源
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"); // 允許的方法
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  ); // 允許的請求頭
  next();
});

// 基本中間件配置
app.use(logger("dev")); // 開發環境日誌
app.use(express.json()); // 解析 JSON 請求體
app.use(express.urlencoded({ extended: false })); // 解析 URL 編碼的請求體
app.use(cookieParser()); // 解析 Cookie

// API 路由配置
app.use("/api", indexRouter); // 設置主路由路徑
app.use("/api/users", usersRouter); // 設置用戶路由路徑

// Swagger UI 文檔配置
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true, // 啟用探索功能
    customCss: ".swagger-ui .topbar { display: none }", // 自定義 CSS
    swaggerOptions: {
      url: "/api-docs/swagger.json", // API 文檔 JSON 路徑
      persistAuthorization: true, // 保持授權狀態
    },
  })
);

// 404 錯誤處理中間件
app.use(function (req, res, next) {
  res.status(404).json({
    error: {
      message: "Not Found",
      status: 404,
    },
  });
});

// 全局錯誤處理中間件
app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
    },
  });
});

// 初始化數據庫連接
connectDB()
  .then(() => {
    console.log("資料庫連接已初始化");
  })
  .catch((err) => {
    console.error("資料庫連接失敗:", err);
  });

export default app; // 導出 Express 應用實例
