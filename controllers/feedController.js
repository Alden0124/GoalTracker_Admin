import Follow from "../models/followModel.js";
import Goal from "../models/goalModel.js";
import User from "../models/userModel.js";
import { getMessage } from "../utils/i18n.js";

// 獲取動態牆
export const getFeed = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, q = "" } = req.query;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 構建基本查詢條件
    const matchStage = {
      $or: [{ user: userId }, { isPublic: true }],
      ...(status && { status: status }),
    };

    // 如果有搜尋關鍵字，添加搜尋條件
    if (q) {
      matchStage.$and = [
        {
          $or: [
            { title: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
          ],
        },
      ];
    }

    const goals = await Goal.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "goal",
          as: "allComments",
        },
      },
      {
        $addFields: {
          commentCount: {
            $size: {
              $filter: {
                input: "$allComments",
                as: "comment",
                cond: { $eq: ["$$comment.type", "comment"] },
              },
            },
          },
          progressCommentCount: {
            $size: {
              $filter: {
                input: "$allComments",
                as: "comment",
                cond: { $eq: ["$$comment.type", "progress"] },
              },
            },
          },
          popularityScore: {
            $add: [
              { $size: "$likes" },
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: "$allComments",
                        as: "comment",
                        cond: { $eq: ["$$comment.type", "comment"] },
                      },
                    },
                  },
                  2,
                ],
              },
              {
                $multiply: [
                  {
                    $size: {
                      $filter: {
                        input: "$allComments",
                        as: "comment",
                        cond: { $eq: ["$$comment.type", "progress"] },
                      },
                    },
                  },
                  3,
                ],
              },
            ],
          },
          timeScore: {
            $divide: [
              { $subtract: ["$createdAt", new Date(0)] },
              1000 * 60 * 60 * 24 * 7,
            ],
          },
        },
      },
      {
        $addFields: {
          finalScore: {
            $add: ["$popularityScore", "$timeScore"],
          },
        },
      },
      { $sort: { finalScore: -1 } },
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) },
      {
        $project: {
          _id: 1,
          user: 1,
          title: 1,
          description: 1,
          status: 1,
          startDate: 1,
          endDate: 1,
          isPublic: 1,
          likes: 1,
          commentCount: 1,
          progressCommentCount: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    // 填充用戶資料
    const populatedGoals = await Goal.populate(goals, {
      path: "user",
      select: "username avatar",
    });

    // 處理每個目標的額外資訊
    const goalsWithDetails = populatedGoals.map((goal) => ({
      ...goal,
      isLiked: goal.likes.some((likeId) => likeId.toString() === userId),
      likeCount: goal.likes?.length || 0,
    }));

    const total = await Goal.countDocuments(matchStage);

    res.json({
      goals: goalsWithDetails,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      message: getMessage("goal.fetchSuccess", lang),
    });
  } catch (error) {
    console.error("獲取動態牆錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 獲取推薦用戶列表
export const getRecommendedUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, excludeFollowing = true } = req.query;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 獲取當前用戶信息
    const currentUser = await User.findById(userId).select("following");
    const followingIds = currentUser?.following || [];

    // 基本查詢條件
    const query = {
      _id: { $ne: userId }, // 排除自己
    };

    // 如果需要排除已關注的用戶
    if (excludeFollowing && followingIds.length > 0) {
      query._id = { $nin: followingIds };
    }

    // 獲取用戶列表
    const users = await User.find(query)
      .select("username avatar bio")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // 處理每個用戶的額外信息
    const usersWithExtra = await Promise.all(
      users.map(async (user) => {
        // 獲取用戶的目標數量和其他統計
        const [goalCount, followerCount, followingCount, isFollowing] =
          await Promise.all([
            Goal.countDocuments({ user: user._id }),
            Follow.countDocuments({ following: user._id }),
            Follow.countDocuments({ follower: user._id }),
            Follow.exists({ follower: userId, following: user._id }),
          ]);

        // 計算推薦分數
        const score = goalCount + followerCount + followingCount * 0.5;

        return {
          _id: user._id,
          username: user.username,
          avatar: user.avatar,
          bio: user.bio,
          followerCount,
          followingCount,
          goalCount,
          score,
          isFollowing: !!isFollowing,
        };
      })
    );

    // 根據分數排序
    usersWithExtra.sort((a, b) => b.score - a.score);

    // 獲取總數
    const total = await User.countDocuments(query);

    res.json({
      users: usersWithExtra,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      message: getMessage("feed.recommendedUsersSuccess", lang),
    });
  } catch (error) {
    console.error("獲取推薦用戶列表錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 搜尋自動完成
export const getSearchSuggestions = async (req, res) => {
  try {
    const { q = "", limit = 5, type = "all" } = req.query;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 初始化返回結構，確保包含空陣列
    let suggestions = {
      goals: [],
      users: [],
    };

    // 清理搜索關鍵字
    const cleanQuery = q.replace(/['"]+/g, "");

    // 根據type參數決定搜索範圍
    if (type === "all" || type === "goal") {
      const goals = await Goal.find({
        isPublic: true,
        title: { $regex: cleanQuery, $options: "i" },
      })
        .select("title")
        .limit(limit);

      suggestions.goals = goals.map((goal) => ({
        type: "goal",
        id: goal._id,
        title: goal.title,
      }));
    }

    if (type === "all" || type === "user") {
      const users = await User.find({
        username: { $regex: cleanQuery, $options: "i" },
      })
        .select("username avatar")
        .limit(limit);

      suggestions.users = users.map((user) => ({
        type: "user",
        id: user._id,
        username: user.username,
        avatar: user.avatar,
      }));
    }

    res.json({
      suggestions,
      message: getMessage("feed.suggestionsSuccess", lang),
    });
  } catch (error) {
    console.error("獲取搜尋建議錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};
