import express from "express";
import {
  getChatHistory,
  getConversationsList,
  getUnreadMessageCount,
  updateMessageReadStatus,
} from "../controllers/chatController.js";
import { verifyAuth } from "../middleware/auth.js";

const router = express.Router();

// 獲取聊天歷史紀錄
router.get("/history/:recipientId", verifyAuth, getChatHistory);
// 取得使用者聊天紀錄列表
router.get("/conversations", verifyAuth, getConversationsList);
// 更新訊息已讀狀態
router.put("/read/:senderId", verifyAuth, updateMessageReadStatus);
// 獲取未讀訊息數量
router.get("/unread-count", verifyAuth, getUnreadMessageCount);

export default router;
