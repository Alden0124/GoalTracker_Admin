import ChatMessage from "../models/chatMessageModel.js";

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
      .populate("sender", "username avatar")  // 填充發送者資料
      .lean();

    // 格式化訊息
    const formattedMessages = messages.map((msg) => ({
      id: msg._id,                // 訊息ID
      content: msg.content,       // 訊息內容
      timestamp: msg.createdAt,   // 時間戳
      sender: {
        id: msg.sender._id,       // 發送者ID
        username: msg.sender.username,  // 發送者名稱
        avatar: msg.sender.avatar || null,  // 發送者頭像
      },
      isCurrentUser: msg.sender._id.toString() === userId  // 是否為當前用戶發送的訊息
    }));

    res.json({
      messages: formattedMessages.reverse(),  // 反轉順序，最舊的訊息在前
      pagination: {
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("獲取聊天記錄錯誤:", error);
    res.status(500).json({
      message: "獲取聊天記錄失敗",
      error: error.message,
    });
  }
};
