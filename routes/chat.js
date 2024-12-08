import express from "express";
import { getChatHistory } from "../controllers/chatController.js";
import { verifyAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/history/:recipientId", verifyAuth, getChatHistory);

export default router;
