import Comment from "../models/commentModel.js";
import Goal from "../models/goalModel.js";
import { getMessage } from "../utils/i18n.js";

// 創建新目標
export const createGoal = async (req, res) => {
  try {
    const { title, description, startDate, endDate, isPublic } = req.body;
    const userId = req.user.userId;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    if (!title || !startDate) {
      return res.status(400).json({ message: getMessage("goal.missingFields", lang) });
    }

    const newGoal = new Goal({
      user: userId,
      title,
      description,
      startDate,
      endDate,
      isPublic: isPublic !== undefined ? isPublic : true
    });

    await newGoal.save();

    res.status(201).json({
      message: getMessage("goal.createSuccess", lang),
      goal: newGoal
    });
  } catch (error) {
    console.error('創建目標錯誤:', error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({ message: getMessage("serverError", lang) });
  }
}; 