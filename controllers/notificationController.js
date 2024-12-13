import Notification from "../models/notificationModel.js";
import { handleMarkNotificationRead } from "./socketController.js";

// 獲取用戶的通知列表
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const notifications = await Notification.find({ recipient: userId })
      .populate("sender", "username avatar")
      .populate("goal", "title")
      .populate({
        path: "comment",
        populate: {
          path: "parentId", // 添加這行來獲取父評論
          select: "content",
        },
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // 格式化通知數據
    const formattedNotifications = notifications.map((notification) => ({
      id: notification._id,
      type: notification.type,
      sender: {
        id: notification.sender._id,
        username: notification.sender.username,
        avatar: notification.sender.avatar,
      },
      goal: notification.goal
        ? {
            id: notification.goal._id,
            title: notification.goal.title,
          }
        : null,
      content: getNotificationContent(notification),
      read: notification.read,
      createdAt: notification.createdAt,
    }));

    const total = await Notification.countDocuments({ recipient: userId });
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });

    res.json({
      notifications: formattedNotifications,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      unreadCount,
    });
  } catch (error) {
    console.error("獲取通知列表錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 標記通知為已讀
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: userId,
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "通知不存在" });
    }

    res.json({ message: "已標記為已讀" });
    // 創建並發送通知
    await handleMarkNotificationRead(req.app.get("io"), {
      notificationId: notificationId,
    });
  } catch (error) {
    console.error("標記通知已讀錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 標記所有通知為已讀
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    await Notification.updateMany({ recipient: userId }, { read: true });

    res.json({ message: "所有通知已標記為已讀" });
  } catch (error) {
    console.error("標記所有通知已讀錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 創建通知的輔助函數
export const createNotification = async (data) => {
  try {
    const notification = await Notification.create(data);
    return notification;
  } catch (error) {
    console.error("創建通知錯誤:", error);
    return null;
  }
};

// 為每個通知添加內容
export const getNotificationContent = (notification) => {
  switch (notification.type) {
    case "follow":
      return `${notification.sender.username} 開始追蹤你`;
    case "like":
      return `${notification.sender.username} 對你的目標「${notification.goal.title}」按讚`;
    case "comment": {
      const commentData = JSON.parse(notification.comment.content);
      return `${notification.sender.username} 在你的目標「${notification.goal.title}」發表評論: ${commentData.content}`;
    }
    case "reply": {
      const commentData = JSON.parse(notification.comment.content);
      const parentCommentData = JSON.parse(
        notification.comment.parentId.content
      );
      return `${notification.sender.username} 回覆了你的評論「${parentCommentData.content}」: ${commentData.content}`;
    }
    case "deadline":
      return `你的目標「${notification.goal.title}」即將到期`;
    default:
      return "";
  }
};

// 獲取未讀通知數量
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error("獲取未讀通知數量錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};
