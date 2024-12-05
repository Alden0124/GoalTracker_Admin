import express from "express";
import {
  getFeed,
  getRecommendedUsers,
  getSearchSuggestions,
} from "../controllers/feedController.js";
import { verifyAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/getFeeds", verifyAuth, getFeed); // 獲取動態牆
router.get("/recommended-users", verifyAuth, getRecommendedUsers); // 獲取推薦用戶列表
router.get("/search/autocomplete", verifyAuth, getSearchSuggestions); // 搜尋自動完成 GET /api/feed/search/autocomplete?q=運動&limit=5

export default router;
