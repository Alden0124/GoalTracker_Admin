import express from "express";
import {
  sendVerificationCode,
  verifyCode,
  forgotPassword,
  resetPassword
} from "../controllers/verificationController.js";

const router = express.Router();

// 驗證相關路由 (/api/verification/...)
// 負責處理：
// 1. 郵箱驗證
// 2. 密碼重置
// 3. 驗證碼管理
router.post("/send-code", sendVerificationCode);                // 發送驗證碼
router.post("/verify", verifyCode);                            // 驗證郵箱
router.post("/forgot-password", forgotPassword);               // 忘記密碼
router.post("/reset-password", resetPassword);                 // 重置密碼

export default router; 