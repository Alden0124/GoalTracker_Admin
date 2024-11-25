import express from "express";
import { verifyAuth } from "../middleware/auth.js";

import {
  getCurrentUser,
  updateUserProfile,
  updateAvatar,
} from "../controllers/userController.js";

const router = express.Router();

// 用戶資料管理路由
router.get("/profile", verifyAuth, getCurrentUser);
router.patch("/profile", verifyAuth, updateAvatar, updateUserProfile);

export default router;
