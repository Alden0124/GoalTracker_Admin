import Comment from "../models/commentModel.js";
import Goal from "../models/goalModel.js";
import { getMessage } from "../utils/i18n.js";

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

    // 更新計數
    if (parentId) {
      // 更新父留言的回覆計數
      await Comment.findByIdAndUpdate(parentId, {
        $inc: { replyCount: 1 },
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
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    const query = {
      goal: goalId,
      type,
      parentId: parentId || null,
    };

    const comments = await Comment.find(query)
      .populate("user", "username avatar")
      .populate("parentId", "content user")
      .select("content createdAt updatedAt user parentId type replyCount")
      .sort("-createdAt")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Comment.countDocuments(query);

    res.json({
      comments,
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

    // 如果有子回覆，不允許刪除
    if (comment.replyCount > 0) {
      return res
        .status(400)
        .json({ message: getMessage("comment.hasReplies", lang) });
    }

    await comment.deleteOne();

    // 如果是回覆，更新父留言的回覆計數
    if (comment.parentId) {
      await Comment.findByIdAndUpdate(comment.parentId, {
        $inc: { replyCount: -1 },
      });
    }

    // 更新目標的留言計數
    await Goal.findByIdAndUpdate(comment.goal, {
      $inc:
        comment.type === "progress"
          ? { progressCommentCount: -1 }
          : { commentCount: -1 },
    });

    res.json({ message: getMessage("comment.deleteSuccess", lang) });
  } catch (error) {
    console.error("刪除留言錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};
