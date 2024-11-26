import express from "express";
import { verifyAuth } from "../middleware/auth.js";

import {
  getCurrentUser,
  updateUserProfile,
  updateAvatar,
  getUserById,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} from "../controllers/userController.js";

const router = express.Router();

// 用戶資料管理路由
router.get("/profile", verifyAuth, getCurrentUser);
router.get("/profile/:userId", verifyAuth, getUserById);
router.patch("/profile", verifyAuth, updateAvatar, updateUserProfile);

// 追蹤相關路由
router.post("/follow/:userId", verifyAuth, followUser);
router.delete("/follow/:userId", verifyAuth, unfollowUser);
router.get("/followers/:userId", getFollowers);
router.get("/following/:userId", getFollowing);

export default router;
