import express from "express";
import { verifyAuth } from '../middleware/auth.js';
import { upload } from "../config/cloudinary.js";
import {
  getCurrentUser,
  updateAvatar,
  syncProfile
} from "../controllers/userController.js";

const router = express.Router();

// 用戶資料管理路由 (/api/users/...)
// 負責處理：
// 1. 用戶資料的讀取和更新
// 2. 用戶頭像管理
// 3. 用戶資料同步
router.get("/current", verifyAuth, getCurrentUser);             // 獲取當前用戶資料
router.put("/:userId/avatar", verifyAuth, upload.single("avatar"), updateAvatar);              // 更新用戶頭像
router.get("/sync", verifyAuth, syncProfile);                   // 同步用戶資料

export default router;
