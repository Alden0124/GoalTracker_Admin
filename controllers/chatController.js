import mongoose from "mongoose";
import ChatMessage from "../models/chatMessageModel.js";

// 獲取聊天歷史紀錄
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { recipientId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // 計算跳過的數量
    const skip = (page - 1) * limit;

    // 查詢總數
    const total = await ChatMessage.countDocuments({
      $or: [
        { sender: userId, recipient: recipientId },
        { sender: recipientId, recipient: userId },
      ],
    });

    // 查詢訊息並填充發送者資料
    const messages = await ChatMessage.find({
      $or: [
        { sender: userId, recipient: recipientId },
        { sender: recipientId, recipient: userId },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("sender", "username avatar") // 填充發送者資料
      .lean();

    // 格式化訊息
    const formattedMessages = messages.map((msg) => ({
      id: msg._id, // 訊息ID
      content: msg.content, // 訊息內容
      timestamp: msg.createdAt, // 時���戳
      sender: {
        id: msg.sender._id, // 發送者ID
        username: msg.sender.username, // 發送者名稱
        avatar: msg.sender.avatar || null, // 發送者頭像
      },
      isCurrentUser: msg.sender._id.toString() === userId, // 是否為當前用戶發送的訊息
    }));

    res.json({
      messages: formattedMessages.reverse(), // 反轉順序，最舊的訊息在前
      pagination: {
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("獲取聊天記錄錯誤:", error);
    res.status(500).json({
      message: "獲取聊天記錄失敗",
      error: error.message,
    });
  }
};

// 獲取對話列表
export const getConversationsList = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 獲取最近的對話列表
    const conversations = await ChatMessage.aggregate([
      // 匹配當前用戶的所有對話
      {
        $match: {
          $or: [
            { sender: userObjectId },
            { recipient: userObjectId }
          ]
        }
      },
      // 按照對話分組，獲取最新消息
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", userObjectId] },
              "$recipient",
              "$sender"
            ]
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$recipient", userObjectId] },
                    { $eq: ["$read", false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      // 關聯用戶信息
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          unreadCount: 1,
          userInfo: { $arrayElemAt: ["$userInfo", 0] }
        }
      },
      { $sort: { "lastMessage.createdAt": -1 } }
    ]);

    // 格式化返回數據
    const formattedConversations = conversations
      .map((conv) => {
        // 如果找不到用戶資料,使用預設值
        const userInfo = conv.userInfo || {
          username: "已刪除的用戶",
          avatar: null,
        };

        return {
          userId: conv._id,
          username: userInfo.username,
          avatar: userInfo.avatar,
          lastMessage: {
            content: conv.lastMessage.content,
            timestamp: conv.lastMessage.createdAt,
            isRead: conv.lastMessage.read,
          },
          unreadCount: conv.unreadCount,
        };
      })
      .filter((conv) => conv !== null);

    res.json({
      conversations: formattedConversations,
    });

  } catch (error) {
    console.error("獲取對話列表錯誤:", error);
    res.status(500).json({
      message: "獲取對話列表失敗",
      error: error.message
    });
  }
};

// 更新訊息已讀狀態
export const updateMessageReadStatus = async (req, res) => {
  try {
    const recipientId = req.user.userId; // 當前登入用戶（接收者）
    const { senderId } = req.params; // 發送者ID

    // 更新所有未讀訊息為已讀
    await ChatMessage.updateMany(
      {
        sender: senderId,
        recipient: recipientId,
        read: false
      },
      {
        $set: { read: true }
      }
    );

    // 獲取更新後的未讀訊息數量
    const unreadCount = await ChatMessage.countDocuments({
      recipient: recipientId,
      sender: senderId,
      read: false
    });

    res.json({
      success: true,
      message: "訊息已標記為已讀",
      unreadCount
    });

  } catch (error) {
    console.error("更新訊息已讀狀態錯誤:", error);
    res.status(500).json({
      message: "更新訊息已讀狀態失敗",
      error: error.message
    });
  }
};

// 獲取未讀訊息數量
export const getUnreadMessageCount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await ChatMessage.countDocuments({
      recipient: userId,
      read: false,
    });
    res.json({ unreadMessageCount: count });
  } catch (error) {
    console.error("獲取未讀訊息數量錯誤:", error);
    res.status(500).json({
      message: "獲取未讀訊息數量失敗",
      error: error.message,
    });
  }
};
