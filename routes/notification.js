import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "../controllers/notificationController.js";
import { verifyAuth } from "../middleware/auth.js";

const router = express.Router();

// 取得通知列表
router.get("/", verifyAuth, getNotifications);

// 標記通知為已讀
router.put("/read/:notificationId", verifyAuth, markAsRead);

// 標記所有通知為已讀
router.put("/read-all", verifyAuth, markAllAsRead);

// 獲取未讀通知數量
router.get("/unread-count", verifyAuth, getUnreadCount);

export default router;
