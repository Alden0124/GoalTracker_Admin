import express from "express";
import { verifyAuth } from "../middleware/auth.js";
import {
  createGoal,
  getGoals,
  getUserGoals,
  updateGoal,
  deleteGoal,
  toggleGoalLike
} from "../controllers/goalController.js";

const router = express.Router();

// 目標相關路由
router.post("/createGoal", verifyAuth, createGoal);         // 創建新目標
router.get("/", verifyAuth, getGoals);                      // 獲取目標列表
router.get("/user/:userId", verifyAuth, getUserGoals);      // 獲取特定用戶的目標列表
router.put("/updateGoal/:goalId", verifyAuth, updateGoal);  // 更新目標
router.delete("/deleteGoal/:goalId", verifyAuth, deleteGoal); // 刪除目標

// 添加點讚相關路由
router.post("/likeGoal/:goalId", verifyAuth, toggleGoalLike);    // 新增：切換目標的點讚狀態

// 進度相關路由
// router.post("/:goalId/progress", verifyAuth, createProgress);
// router.patch("/:goalId/progress/:progressId", verifyAuth, updateProgress);
// router.delete("/:goalId/progress/:progressId", verifyAuth, deleteProgress);

// 留言相關路由
// router.post("/:goalId/comments", verifyAuth, createComment);
// router.post("/:goalId/progress/:progressId/comments", verifyAuth, createComment);
// router.patch("/comments/:commentId", verifyAuth, updateComment);
// router.delete("/comments/:commentId", verifyAuth, deleteComment);
  
export default router; 