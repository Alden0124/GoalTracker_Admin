import express from "express";
import { verifyAuth } from "../middleware/auth.js";
import {
  createGoal,
  // updateGoal,
  // deleteGoal,
  // getGoal,
  // getUserGoals,
  // getFeedGoals,
  // createProgress,
  // updateProgress,
  // deleteProgress,
  // createComment,
  // updateComment,
  // deleteComment
} from "../controllers/goalController.js";

const router = express.Router();

// 目標相關路由
router.post("/createGoal", verifyAuth, createGoal);
// router.get("/feed", verifyAuth, getFeedGoals);
// router.get("/user/:userId", verifyAuth, getUserGoals);
// router.get("/:goalId", verifyAuth, getGoal);
// router.patch("/:goalId", verifyAuth, updateGoal);
// router.delete("/:goalId", verifyAuth, deleteGoal);

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