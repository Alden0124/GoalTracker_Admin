import express from "express";
import { upload } from "../config/cloudinary.js";
import {
  signUp,
  signIn,
  signOut,
  signInWithProvider,
  googleSignIn,
  lineSignIn,
  refreshToken,
  getActiveSessions
} from "../controllers/authController.js";
import { verifyAuth } from '../middleware/auth.js';

const router = express.Router();

// 身份驗證相關路由 (/api/auth/...)
// 負責處理：
// 1. 用戶註冊和登入
// 2. 第三方登入（Google、Line）
// 3. Token 管理
router.post("/signup", upload.single("avatar"), signUp);        // 用戶註冊
router.post("/signin", signIn);                                 // 一般登入
router.post("/signin/provider", signInWithProvider);            // 通用第三方登入
router.post("/signin/google", googleSignIn);                    // Google 登入
router.post("/signin/line", lineSignIn);                        // Line 登入
router.post("/refresh-token", refreshToken);                    // 更新訪問令牌
router.post("/signout", signOut);                              // 登出
router.get("/sessions", verifyAuth, getActiveSessions);        // 獲取登入裝置列表

export default router; 