import Comment from "../models/commentModel.js";
import Goal from "../models/goalModel.js";
import { getMessage } from "../utils/i18n.js";

// 獲取動態牆
export const getFeed = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "latest", // latest, popular, mostProgress, mostActive
      status, // 可選的狀態篩選
      startDate, // 可選的開始時間篩選
      endDate, // 可選的結束時間篩選
    } = req.query;

    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    const skip = (Number(page) - 1) * Number(limit);

    // 構建篩選條件
    const filter = {
      isPublic: true,
      ...(status && { status }),
      ...(startDate && { startDate: { $gte: new Date(startDate) } }),
      ...(endDate && { endDate: { $lte: new Date(endDate) } }),
    };

    // 構建排序條件
    const sortOptions = {
      latest: { updatedAt: -1 },
      popular: { likeCount: -1 },
      mostProgress: { progressCount: -1 },
      mostActive: { commentCount: -1 },
    };

    // 獲取目標列表
    const goals = await Goal.find(filter)
      .populate("user", "username avatar")
      .populate({
        path: "progress",
        options: {
          limit: 1,
          sort: { createdAt: -1 },
        },
        populate: { path: "user", select: "username avatar" },
      })
      .select("-privateNotes")
      .sort(sortOptions[sort] || sortOptions.latest)
      .skip(skip)
      .limit(Number(limit));

    // 為每個目標添加互動狀態和最新留言
    const goalsWithStatus = await Promise.all(
      goals.map(async (goal) => {
        const goalObj = goal.toObject();

        // 獲取最新留言
        const recentComments = await Comment.find({
          goal: goal._id,
          type: "comment",
          parentId: null,
        })
          .populate("user", "username avatar")
          .sort("-createdAt")
          .limit(2);

        return {
          ...goalObj,
          isLiked: goal.likes.includes(userId),
          likeCount: goal.likes.length,
          recentComments,
          // 計算完成進度
          progress: {
            total: goalObj.progress?.length || 0,
            percentage: calculateProgress(goal),
          },
        };
      })
    );

    const total = await Goal.countDocuments(filter);

    res.json({
      goals: goalsWithStatus,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      message: getMessage("feed.fetchSuccess", lang),
    });
  } catch (error) {
    console.error("獲取動態牆錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 獲取關注用戶的動態
export const getFollowingFeed = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 獲取用戶關注的人列表
    const user = await User.findById(userId).select("following");
    const followingIds = user.following || [];

    // 獲取關注用戶的目標
    const goals = await Goal.find({
      user: { $in: followingIds },
      isPublic: true,
    })
      .populate("user", "username avatar")
      .populate({
        path: "progress",
        options: {
          limit: 1,
          sort: { createdAt: -1 },
        },
        populate: { path: "user", select: "username avatar" },
      })
      .select("-privateNotes")
      .sort("-updatedAt")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // 處理互動狀態
    const goalsWithStatus = await Promise.all(
      goals.map(async (goal) => {
        const goalObj = goal.toObject();
        const recentComments = await Comment.find({
          goal: goal._id,
          type: "comment",
          parentId: null,
        })
          .populate("user", "username avatar")
          .sort("-createdAt")
          .limit(2);

        return {
          ...goalObj,
          isLiked: goal.likes.includes(userId),
          likeCount: goal.likes.length,
          recentComments,
        };
      })
    );

    const total = await Goal.countDocuments({
      user: { $in: followingIds },
      isPublic: true,
    });

    res.json({
      goals: goalsWithStatus,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      message: getMessage("feed.fetchSuccess", lang),
    });
  } catch (error) {
    console.error("獲取關注動態錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 獲取熱門目標
export const getTrendingGoals = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 計算熱門分數：likes + comments * 2 + progress * 3
    const goals = await Goal.aggregate([
      { $match: { isPublic: true } },
      {
        $addFields: {
          score: {
            $add: [
              { $size: "$likes" },
              { $multiply: ["$commentCount", 2] },
              { $multiply: ["$progressCount", 3] },
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) },
    ]);

    // 填充關聯數據
    const populatedGoals = await Goal.populate(goals, [
      { path: "user", select: "username avatar" },
      {
        path: "progress",
        options: { limit: 1, sort: { createdAt: -1 } },
        populate: { path: "user", select: "username avatar" },
      },
    ]);

    // 處理互動狀態
    const goalsWithStatus = await Promise.all(
      populatedGoals.map(async (goal) => {
        const recentComments = await Comment.find({
          goal: goal._id,
          type: "comment",
          parentId: null,
        })
          .populate("user", "username avatar")
          .sort("-createdAt")
          .limit(2);

        return {
          ...goal,
          isLiked: goal.likes.includes(userId),
          likeCount: goal.likes.length,
          recentComments,
        };
      })
    );

    const total = await Goal.countDocuments({ isPublic: true });

    res.json({
      goals: goalsWithStatus,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      message: getMessage("feed.fetchSuccess", lang),
    });
  } catch (error) {
    console.error("獲取熱門目標錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 計算目標完成進度的輔助函數
const calculateProgress = (goal) => {
  if (!goal.progressCount || !goal.startDate) return 0;

  const totalDays = goal.endDate
    ? Math.ceil((goal.endDate - goal.startDate) / (1000 * 60 * 60 * 24))
    : 30; // 如果沒有結束日期，預設為30天

  const progressPercentage = (goal.progressCount / totalDays) * 100;
  return Math.min(Math.round(progressPercentage), 100);
};
