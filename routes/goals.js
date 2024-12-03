import express from "express";
import {
  createComment,
  deleteComment,
  getComments,
  toggleCommentLike,
  updateComment,
} from "../controllers/commentController.js";
import {
  createGoal,
  deleteGoal,
  getGoals,
  getUserGoals,
  toggleGoalLike,
  updateGoal,
} from "../controllers/goalController.js";
import { verifyAuth } from "../middleware/auth.js";

const router = express.Router();

// 目標相關路由
router.post("/createGoal", verifyAuth, createGoal); // 創建新目標
router.get("/", verifyAuth, getGoals); // 獲取目標列表
router.get("/user/:userId", verifyAuth, getUserGoals); // 獲取特定用戶的目標列表
router.put("/updateGoal/:goalId", verifyAuth, updateGoal); // 更新目標
router.delete("/deleteGoal/:goalId", verifyAuth, deleteGoal); // 刪除目標

// 點讚相關路由
router.post("/likeGoal/:goalId", verifyAuth, toggleGoalLike); // 新增：切換目標的點讚狀態
router.post("/likeComment/:commentId", verifyAuth, toggleCommentLike); // 新增：切換留言的點讚狀態

// 留言相關路由
router.post("/createComment/:goalId", verifyAuth, createComment); // 創建留言或回覆
router.get("/getComments/:goalId", verifyAuth, getComments); // 獲取留言列表
router.put("/updateComment/:commentId", verifyAuth, updateComment); // 更新留言
router.delete("/deleteComment/:commentId", verifyAuth, deleteComment); // 刪除留言

export default router;
