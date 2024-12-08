import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import ChatMessage from "../models/chatMessageModel.js";
import User from "../models/userModel.js";

// 存儲在線用戶
const onlineUsers = new Map();

// 初始化 Socket.IO
export const initializeSocketIO = (server) => {
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

  io.on("connection", (socket) => handleConnection(socket, io));

  return io;
};

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
      console.log("用戶已加入在線列表:", user.username);
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

  // 監聽斷開連接
  socket.on("disconnect", () => {
    console.log("用戶已斷開連接:", socket.userId);
    onlineUsers.delete(socket.userId);
  });
};

// 處理發送訊息
const handleSendMessage = async (socket, io, data) => {
  try {
    const { recipientId, content, timestamp } = data;
    const senderId = socket.userId;

    console.log("處理發送訊息:", {
      senderId,
      recipientId,
      content,
      timestamp
    });

    // 創建新訊息
    const message = await ChatMessage.create({
      sender: senderId,
      recipient: recipientId,
      content: content,
      createdAt: timestamp
    });

    // 獲取發送者信息 (增加 avatar 欄位)
    const sender = await User.findById(senderId).select('username avatar');

    // 構建訊息對象 (加入 avatar)
    const messageData = {
      messageId: message._id,
      sender: {
        id: senderId,
        username: sender.username,
        avatar: sender.avatar || null  // 如果沒有頭像則返回 null
      },
      content,
      timestamp: message.createdAt
    };

    // 如果接收者在線,立即發送訊息
    const recipientSocketId = onlineUsers.get(recipientId)?.socketId;
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("newMessage", messageData);
    }

    // 發送確認給發送者
    socket.emit("messageSent", {
      status: "success",
      ...messageData
    });

  } catch (error) {
    console.error("發送訊息錯誤:", error);
    socket.emit("error", {
      message: "發送訊息失敗",
      error: error.message
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
      recipientId
    });

    // 查詢雙方之間的歷史訊息
    const messages = await ChatMessage.find({
      $or: [
        { sender: userId, recipient: recipientId },
        { sender: recipientId, recipient: userId }
      ]
    })
    .sort({ createdAt: -1 }) // 按時間降序排序
    .limit(50)               // 限制返回最近的50條訊息
    .populate('sender', 'username avatar')  // 填充發送者信息
    .lean();  // 轉換為普通 JavaScript 對象

    // 格式化訊息
    const formattedMessages = messages.map(msg => ({
      messageId: msg._id,
      sender: {
        id: msg.sender._id,
        username: msg.sender.username,
        avatar: msg.sender.avatar || null
      },
      content: msg.content,
      timestamp: msg.createdAt
    }));

    // 發送歷史訊息給請求者
    socket.emit("historyMessages", {
      messages: formattedMessages.reverse(), // 反轉順序，讓最舊的訊息在前
      recipientId
    });

  } catch (error) {
    console.error("獲取歷史訊息錯誤:", error);
    socket.emit("error", {
      message: "獲取歷史訊息失敗",
      error: error.message
    });
  }
};