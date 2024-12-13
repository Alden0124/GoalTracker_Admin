import Comment from "../models/commentModel.js";
import Goal from "../models/goalModel.js";
import { getMessage } from "../utils/i18n.js";
import { sendNotification } from "./socketController.js";
// 創建新目標
export const createGoal = async (req, res) => {
  try {
    const { title, description, startDate, endDate, isPublic } = req.body;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    if (!title || !startDate) {
      return res
        .status(400)
        .json({ message: getMessage("goal.missingFields", lang) });
    }

    const newGoal = new Goal({
      user: userId,
      title,
      description,
      startDate,
      endDate,
      isPublic: isPublic !== undefined ? isPublic : true,
    });

    await newGoal.save();

    res.status(201).json({
      message: getMessage("goal.createSuccess", lang),
      goal: newGoal,
    });
  } catch (error) {
    console.error("創建目標錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 獲取目標列表
export const getGoals = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, sort = "-createdAt" } = req.query;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 構建查詢條件
    const query = {
      $or: [
        { user: userId }, // 用戶自己的目標
        { isPublic: true }, // 其他用戶的公開目標
      ],
    };

    // 如果有指定狀態進行過濾
    if (status) {
      query.status = status;
    }

    // 計算分頁
    const skip = (Number(page) - 1) * Number(limit);

    // 獲取目標列表
    let goals = await Goal.find(query)
      .populate("user", "username avatar")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    // 為每個目標添加點讚狀態
    goals = goals.map((goal) => {
      const goalObj = goal.toObject();
      delete goalObj.__v;

      return {
        ...goalObj,
        isLiked: goal.likes.includes(userId),
        likeCount: goal.likes.length,
      };
    });

    // 獲取總數
    const total = await Goal.countDocuments(query);

    res.json({
      goals,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      message: getMessage("goal.fetchSuccess", lang),
    });
  } catch (error) {
    console.error("獲取目標列表錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 獲取用戶的目標列表
export const getUserGoals = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status, sort = "-createdAt" } = req.query;
    const currentUserId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 構建查詢條件
    const query = {
      user: userId,
      $or: [
        { isPublic: true },
        { user: currentUserId }, // 如果是查看自己的目標，顯示所有目標
      ],
    };

    // 如果有指定狀態進行過濾
    if (status) {
      query.status = status;
    }

    // 計算分頁
    const skip = (Number(page) - 1) * Number(limit);

    // 獲取目標列表
    let goals = await Goal.find(query)
      .populate("user", "username avatar")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    // 為每個目標添加點讚狀態
    goals = goals.map((goal) => {
      const goalObj = goal.toObject();
      delete goalObj.__v;

      return {
        ...goalObj,
        isLiked: goal.likes.includes(currentUserId),
        likeCount: goal.likes.length,
      };
    });

    // 獲取總數
    const total = await Goal.countDocuments(query);

    res.json({
      goals,
      pagination: {
        current: Number(page),
        size: Number(limit),
        total,
      },
      message: getMessage("goal.fetchSuccess", lang),
    });
  } catch (error) {
    console.error("獲取用戶目標列表錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 更新目標
export const updateGoal = async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.userId;
    const { title, description, startDate, endDate, isPublic, status } =
      req.body;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 檢查目標是否存在
    const goal = await Goal.findById(goalId);
    if (!goal) {
      return res
        .status(404)
        .json({ message: getMessage("goal.notFound", lang) });
    }

    // 檢查是否為目標創建者
    if (goal.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: getMessage("goal.unauthorized", lang) });
    }

    // 更新目標
    const updatedGoal = await Goal.findByIdAndUpdate(
      goalId,
      {
        $set: {
          title: title || goal.title,
          description: description || goal.description,
          startDate: startDate || goal.startDate,
          endDate: endDate || goal.endDate,
          isPublic: isPublic !== undefined ? isPublic : goal.isPublic,
          status: status || goal.status,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    res.json({
      message: getMessage("goal.updateSuccess", lang),
      goal: updatedGoal,
    });
  } catch (error) {
    console.error("更新目標錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 刪除目標
export const deleteGoal = async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 檢查目標是否存在
    const goal = await Goal.findById(goalId);
    if (!goal) {
      return res
        .status(404)
        .json({ message: getMessage("goal.notFound", lang) });
    }

    // 檢查是否為目標創建者
    if (goal.user.toString() !== userId) {
      return res
        .status(403)
        .json({ message: getMessage("goal.unauthorized", lang) });
    }

    // 刪除相關的進度和評論
    await Promise.all([
      // 如果有 Progress model，需要刪除相關進度
      // Progress.deleteMany({ goal: goalId }),
      Comment.deleteMany({ goal: goalId }),
      Goal.findByIdAndDelete(goalId),
    ]);

    res.json({ message: getMessage("goal.deleteSuccess", lang) });
  } catch (error) {
    console.error("刪除目標錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
};

// 切換目標點讚狀態
export const toggleGoalLike = async (req, res) => {
  try {
    const { goalId } = req.params;
    const { isLiked } = req.body; // 從請求體中獲取目標狀態
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    // 檢查目標是否存在
    const goal = await Goal.findById(goalId);
    if (!goal) {
      return res
        .status(404)
        .json({ message: getMessage("goal.notFound", lang) });
    }

    // 檢查當前點讚狀態
    const hasLiked = goal.likes.includes(userId);

    // 根據請求的狀態進行更新
    if (isLiked && !hasLiked) {
      // 添加點讚
      goal.likes.push(userId);
      await goal.save();
      // 點讚通知
      await sendNotification(req.app.get("io"), {
        recipient: goal.user, // 目標擁有者的ID
        sender: userId, // 點讚者的ID
        type: "like",
        goal: goalId, // 被點讚的目標ID
      });
      res.json({
        message: getMessage("goal.likeSuccess", lang),
        liked: true,
        likeCount: goal.likes.length,
      });
    } else if (!isLiked && hasLiked) {
      // 取消點讚
      goal.likes = goal.likes.filter((id) => id.toString() !== userId);
      await goal.save();
      res.json({
        message: getMessage("goal.unlikeSuccess", lang),
        liked: false,
        likeCount: goal.likes.length,
      });
    } else {
      // 當前狀態已經符合請求，直接返回
      res.json({
        message: getMessage("goal.noChange", lang),
        liked: isLiked,
        likeCount: goal.likes.length,
      });
    }
  } catch (error) {
    console.error("切換點讚狀態錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
}; 