import express from "express";
import {
  getChatHistory,
  getConversationsList,
} from "../controllers/chatController.js";
import { verifyAuth } from "../middleware/auth.js";

const router = express.Router();

// 獲取聊天歷史紀錄
router.get("/history/:recipientId", verifyAuth, getChatHistory);
// 取得使用者聊天紀錄列表
router.get("/conversations", verifyAuth, getConversationsList);

export default router;
