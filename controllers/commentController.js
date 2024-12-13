import Comment from "../models/commentModel.js";
import Goal from "../models/goalModel.js";
import { getMessage } from "../utils/i18n.js";
import { sendNotification } from "./socketController.js";

// 創建留言（支援一般留言、進度記錄和回覆）
export const createComment = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { content, parentId } = req.body;
    let { type = "comment" } = req.body;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    if (!content) {
      return res
        .status(400)
        .json({ message: getMessage("comment.contentRequired", lang) });
    }

    // 檢查目標是否存在
    const goal = await Goal.findById(goalId);
    if (!goal) {
      return res
        .status(404)
        .json({ message: getMessage("goal.notFound", lang) });
    }

    // 如果是回覆，檢查父留言是否存在
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        return res
          .status(404)
          .json({ message: getMessage("comment.parentNotFound", lang) });
      }
      // 確保回覆的類型與父留言一致
      type = parentComment.type;
    }

    // 創建留言
    const newComment = new Comment({
      user: userId,
      goal: goalId,
      content,
      type,
      parentId: parentId || null,
    });

    await newComment.save();

    // 評論通知
    if (!parentId) {
      await sendNotification(req.app.get("io"), {
        recipient: goal.user, // 目標擁有者的ID
        sender: userId, // 評論者的ID
        type: "comment",
        goal: goalId, // 被評論的目標ID
        comment: newComment._id, // 評論的ID
      });
    }

    // 更新計數
    if (parentId) {
      const parentComment = await Comment.findById(parentId);

      // 更新父留言的回覆計數
      await Comment.findByIdAndUpdate(parentId, {
        $inc: { replyCount: 1 },
      });
      // 回覆通知
      await sendNotification(req.app.get("io"), {
        recipient: parentComment.user, // 原評論者的ID
        sender: userId, // 回覆者的ID
        type: "reply",
        goal: goalId, // 相關目標ID
        comment: newComment._id, // 回覆評論的ID
      });
    }

    // 更新目標的留言計數
    await Goal.findByIdAndUpdate(goalId, {
      $inc:
        type === "progress" ? { progressCommentCount: 1 } : { commentCount: 1 },
    });

    // 填充用戶資訊後返回
    const populatedComment = await Comment.findById(newComment._id)
      .populate("user", "username avatar")
      .populate("parentId", "content user");

    res.status(201).json({
      message: getMessage("comment.createSuccess", lang),
      comment: populatedComment,
    });
  } catch (error) {
    console.error("創建留言錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 獲取留言列表
export const getComments = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { page = 1, limit = 10, parentId, type = "comment" } = req.query;
    const userId = req.user.userId; // 獲取當前用戶ID
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 修改查询条件，确保能正确获取所有评论或回复
    const query = {
      goal: goalId,
      type,
    };

    // 如果指定了 parentId，则获取该评论的所有回复
    // 如果没有指定 parentId，则只获取顶层评论（parentId 为 null 的评论）
    if (parentId) {
      query.parentId = parentId;
    } else {
      query.parentId = null;
    }

    const comments = await Comment.find(query)
      .populate("user", "username avatar")
      .populate("parentId", "content user")
      .select("content createdAt updatedAt user parentId type replyCount likes")
      .sort("createdAt")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // 添加 isLiked 和 likeCount 信息
    const commentsWithLikes = comments.map((comment) => {
      const commentObj = comment.toObject();
      return {
        ...commentObj,
        isLiked: comment.likes.includes(userId),
        likeCount: comment.likes.length,
      };
    });

    const total = await Comment.countDocuments(query);

    res.json({
      comments: commentsWithLikes,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      message: getMessage("comment.fetchSuccess", lang),
    });
  } catch (error) {
    console.error("獲取留言列表錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 更新留言
export const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    if (!content) {
      return res
        .status(400)
        .json({ message: getMessage("comment.contentRequired", lang) });
    }

    // 檢查留言是否存在
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ message: getMessage("comment.notFound", lang) });
    }

    // 檢查是否為留言作者
    if (comment.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: getMessage("comment.unauthorized", lang) });
    }

    // 更新留言
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        content,
        updatedAt: new Date(),
      },
      { new: true }
    )
      .populate("user", "username avatar")
      .populate("parentId", "content user");

    res.json({
      message: getMessage("comment.updateSuccess", lang),
      comment: updatedComment,
    });
  } catch (error) {
    console.error("更新留言錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 刪除留言
export const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ message: getMessage("comment.notFound", lang) });
    }

    // 檢查是否為留言作者
    if (comment.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: getMessage("comment.unauthorized", lang) });
    }

    // 開始事務處理
    const session = await Comment.startSession();
    await session.withTransaction(async () => {
      let totalDeletedCount = 0; // 追踪被刪除的評論總數

      // 如果是父留言且有回覆，先刪除所有子回覆
      if (comment.replyCount > 0) {
        // 獲取所有子回覆
        const replies = await Comment.find({ parentId: commentId });
        totalDeletedCount += replies.length;

        // 刪除所有子回覆
        await Comment.deleteMany({ parentId: commentId });
      }

      // 刪除當前留言
      await comment.deleteOne();
      totalDeletedCount += 1; // 加上當前被刪除的評論

      // 如果是回覆，更新父留言的回覆計數
      if (comment.parentId) {
        await Comment.findByIdAndUpdate(comment.parentId, {
          $inc: { replyCount: -1 },
        });
      }

      // 一次性更新目標的留言計數（包含所有被刪除的評論）
      await Goal.findByIdAndUpdate(comment.goal, {
        $inc:
          comment.type === "progress"
            ? { progressCommentCount: -totalDeletedCount }
            : { commentCount: -totalDeletedCount },
      });
    });

    await session.endSession();

    res.json({ message: getMessage("comment.deleteSuccess", lang) });
  } catch (error) {
    console.error("刪除留言錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 切換留言點讚狀態
export const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { isLiked } = req.body; // 從請求體中獲取點讚狀態
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 檢查留言是否存在
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ message: getMessage("comment.notFound", lang) });
    }

    // 檢查當前點讚狀態
    const hasLiked = comment.likes.includes(userId);

    // 根據請求的狀態進行更新
    if (isLiked && !hasLiked) {
      // 添加點讚
      comment.likes.push(userId);
      await comment.save();
      res.json({
        message: getMessage("comment.likeSuccess", lang),
        liked: true,
        likeCount: comment.likes.length,
      });
    } else if (!isLiked && hasLiked) {
      // 取消點讚
      comment.likes = comment.likes.filter((id) => id.toString() !== userId);
      await comment.save();
      res.json({
        message: getMessage("comment.unlikeSuccess", lang),
        liked: false,
        likeCount: comment.likes.length,
      });
    } else {
      // 當前狀態已經符合請求，直接返回
      res.json({
        message: getMessage("comment.noChange", lang),
        liked: isLiked,
        likeCount: comment.likes.length,
      });
    }
  } catch (error) {
    console.error("切換留言點讚狀態錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};
