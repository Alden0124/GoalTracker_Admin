import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import ChatMessage from "../models/chatMessageModel.js";
import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import { getNotificationContent } from "./notificationController.js";

// 存儲在線用戶
const onlineUsers = new Map();

// 初始化 Socket.IO
export const initializeSocketIO = (server) => {
  // 創建 Socket.IO 實例
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    transports: ["websocket"],
  });

  // 中間件：驗證 Socket 連接
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded) {
        return next(new Error("Invalid token"));
      }

      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  // 監聽連接事件
  io.on("connection", (socket) => handleConnection(socket, io));

  return io;
};

// 處理用戶連接
const handleConnection = async (socket, io) => {
  console.log("用戶已連接:", socket.userId);

  try {
    const user = await User.findById(socket.userId);
    if (user) {
      onlineUsers.set(socket.userId, {
        id: socket.userId,
        username: user.username,
        socketId: socket.id,
      });

      // 獲取未讀通知數量
      const unreadCount = await Notification.countDocuments({
        recipient: socket.userId,
        read: false,
      });

      // 發送未讀通知數量
      socket.emit("unreadNotifications", { count: unreadCount });
    }
  } catch (error) {
    console.error("獲取用戶信息錯誤:", error);
  }

  // 處理私人訊息
  socket.on("sendMessage", async (data) => {
    console.log("收到發送訊息請求:", data);
    await handleSendMessage(socket, io, data);
  });

  // 添加獲取歷史訊息的處理
  socket.on("getHistory", async (data) => {
    console.log("收到獲取歷史訊息請求:", data);
    await handleGetHistory(socket, data);
  });

  // 添加通知相關的事件監聽
  socket.on("getNotifications", async (data) => {
    await handleGetNotifications(socket, data);
  });

  // 添加標記通知為已讀的處理
  socket.on("markNotificationRead", async (data) => {
    await handleMarkNotificationRead(socket, data);
  });

  // 監聽斷開連接
  socket.on("disconnect", () => {
    console.log("用戶已斷開連接:", socket.userId);
    onlineUsers.delete(socket.userId);
  });
};

// 處理訊息發送&接收
const handleSendMessage = async (socket, io, data) => {
  try {
    const { recipientId, content, timestamp } = data;
    const senderId = socket.userId;

    console.log("處理發送訊息:", {
      senderId,
      recipientId,
      content,
      timestamp,
    });

    // 創建新訊息
    const message = await ChatMessage.create({
      sender: senderId,
      recipient: recipientId,
      content: content,
      createdAt: timestamp,
    });

    // 獲取發送者信息 (增加 avatar 欄位)
    const sender = await User.findById(senderId).select("username avatar");

    // 構建訊息對象 (加入 avatar)
    const messageData = {
      id: message._id,
      sender: {
        id: senderId,
        username: sender.username,
        avatar: sender.avatar || null, // 如果沒有頭像則返回 null
      },
      content,
      timestamp: message.createdAt,
    };

    // 如果接收者在線,立即發送訊息
    const recipientSocketId = onlineUsers.get(recipientId)?.socketId;
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("newMessage", messageData);
    }

    // 發送確認給發送者
    socket.emit("messageSent", {
      status: "success",
      ...messageData,
    });
  } catch (error) {
    console.error("發送訊息錯誤:", error);
    socket.emit("error", {
      message: "發送訊息失敗",
      error: error.message,
    });
  }
};

// 處理獲取歷史訊息
const handleGetHistory = async (socket, data) => {
  try {
    const { recipientId } = data;
    const userId = socket.userId;

    console.log("獲取歷史訊息:", {
      userId,
      recipientId,
    });

    // 查詢雙方之間的歷史訊息
    const messages = await ChatMessage.find({
      $or: [
        { sender: userId, recipient: recipientId },
        { sender: recipientId, recipient: userId },
      ],
    })
      .sort({ createdAt: -1 }) // 按時間降序排序
      .limit(50) // 限制返回最近的50條訊息
      .populate("sender", "username avatar") // 填充發送者信息
      .lean(); // 轉換為普通 JavaScript 對象

    // 格式化訊息
    const formattedMessages = messages.map((msg) => ({
      messageId: msg._id,
      sender: {
        id: msg.sender._id,
        username: msg.sender.username,
        avatar: msg.sender.avatar || null,
      },
      content: msg.content,
      timestamp: msg.createdAt,
    }));

    // 發送歷史訊息給請求者
    socket.emit("historyMessages", {
      messages: formattedMessages.reverse(), // 反轉順序，讓最舊的訊息在前
      recipientId,
    });
  } catch (error) {
    console.error("獲取歷史訊息錯誤:", error);
    socket.emit("error", {
      message: "獲取歷史訊息失敗",
      error: error.message,
    });
  }
};

// 發送通知的函數
export const sendNotification = async (io, notification) => {
  try {
    // 創建通知記錄
    const newNotification = await Notification.create(notification);

    // 獲取完整的通知信息（包含關聯數據）
    const populatedNotification = await Notification.findById(
      newNotification._id
    )
      .populate("sender", "username avatar")
      .populate("goal", "title")
      .populate("comment", "content");


    // 格式化通知數據
    const formattedNotification = {
      id: populatedNotification._id,
      type: populatedNotification.type,
      sender: {
        id: populatedNotification.sender._id,
        username: populatedNotification.sender.username,
        avatar: populatedNotification.sender.avatar
      },
      goal: populatedNotification.goal ? {
        id: populatedNotification.goal._id,
        title: populatedNotification.goal.title
      } : null,
      content: getNotificationContent(populatedNotification),
      read: populatedNotification.read,
      createdAt: populatedNotification.createdAt
    };


    // 檢查接收者是否在線
    const recipientSocket = onlineUsers.get(notification.recipient.toString());
    if (recipientSocket) {
      // 發送新通知,包含生成的內容
      io.to(recipientSocket.socketId).emit("newNotification", {
        notification: formattedNotification,
        unreadCount: await Notification.countDocuments({
          recipient: notification.recipient,
          read: false,
        }),
      });
    }

    return formattedNotification;
  } catch (error) {
    console.error("發送通知錯誤:", error);
    return null;
  }
};

// 處理獲取通知列表
const handleGetNotifications = async (socket, data) => {
  try {
    const { page = 1, limit = 10 } = data;
    const userId = socket.userId;

    const notifications = await Notification.find({ recipient: userId })
      .populate("sender", "username avatar")
      .populate("goal", "title")
      .populate("comment", "content")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // 為每個通知添加內容
    const notificationsWithContent = notifications.map((notification) => {
      let content = "";
      switch (notification.type) {
        case "follow":
          content = `${notification.sender.username} 開始追蹤你`;
          break;
        // ... 其他類型的處理
      }
      return {
        ...notification.toObject(),
        content,
      };
    });

    const total = await Notification.countDocuments({ recipient: userId });
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });

    socket.emit("notifications", {
      notifications: notificationsWithContent,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      unreadCount,
    });
  } catch (error) {
    console.error("獲取通知列表錯誤:", error);
    socket.emit("error", {
      message: "獲取通知列表失敗",
      error: error.message,
    });
  }
};

// 處理標記通知為已讀
// 修改 handleMarkNotificationRead 函數
export const handleMarkNotificationRead = async (io, data) => {
  try {
    const { notificationId } = data;

    // 更新通知的 read 欄位為 true
    const notification = await Notification.findById(notificationId);
    
    if (notification) {
      notification.read = true;
      await notification.save();

      // 獲取最新的未讀數量
      const unreadCount = await Notification.countDocuments({
        recipient: notification.recipient,
        read: false,
      });

      // 檢查用戶是否在線
      const recipientSocket = onlineUsers.get(notification.recipient.toString());
      if (recipientSocket) {
        // 使用 io.to() 發送到特定用戶
        io.to(recipientSocket.socketId).emit("notificationUpdate", {
          notificationId,
          read: true,
          unreadCount,
        });
      }
    }
  } catch (error) {
    console.error("標記通知已讀錯誤:", error);
  }
};
    