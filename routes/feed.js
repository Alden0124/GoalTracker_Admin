import express from "express";
import {
  getFeed,
  getFollowingFeed,
  getTrendingGoals,
} from "../controllers/feedController.js";
import { verifyAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", verifyAuth, getFeed); // 獲取動態牆
router.get("/following", verifyAuth, getFollowingFeed); // 獲取關注用戶的動態
router.get("/trending", verifyAuth, getTrendingGoals); // 獲取熱門目標

export default router;
