import express from "express";
import Todo from "../models/Todo.js";

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Todo:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         _id:
 *           type: string
 *           description: Todo 的自動生成 ID
 *         title:
 *           type: string
 *           description: Todo 的標題
 *         description:
 *           type: string
 *           description: Todo 的詳細描述
 *         completed:
 *           type: boolean
 *           description: Todo 是否完成
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Todo 的創建時間
 */

/**
 * @swagger
 * /todos:
 *   get:
 *     summary: 獲取所有待辦事項
 *     tags: [Todos]
 *     responses:
 *       200:
 *         description: 成功獲取待辦事項列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Todo'
 */
router.get("/todos", async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /todos/{id}:
 *   get:
 *     summary: 獲取單個待辦事項
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Todo ID
 *     responses:
 *       200:
 *         description: 成功獲取待辦事項
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 *       404:
 *         description: 找不到待辦事項
 */
router.get("/todos/:id", async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) {
      return res.status(404).json({ message: "找不到該待辦事項" });
    }
    res.json(todo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @swagger
 * /todos:
 *   post:
 *     summary: 創建新的待辦事項
 *     tags: [Todos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: 成功創建待辦事項
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 */
router.post("/todos", async (req, res) => {
  try {
    const todo = new Todo({
      title: req.body.title,
      description: req.body.description,
    });
    const newTodo = await todo.save();
    res.status(201).json(newTodo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /todos/{id}:
 *   put:
 *     summary: 更新待辦事項
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Todo ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 成功更新待辦事項
 *       404:
 *         description: 找不到待辦事項
 */
router.put("/todos/:id", async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) {
      return res.status(404).json({ message: "找不到該待辦事項" });
    }

    todo.title = req.body.title || todo.title;
    todo.description = req.body.description || todo.description;
    todo.completed = req.body.completed ?? todo.completed;

    const updatedTodo = await todo.save();
    res.json(updatedTodo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /todos/{id}:
 *   delete:
 *     summary: 刪除待辦事項
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Todo ID
 *     responses:
 *       200:
 *         description: 成功刪除待辦事項
 *       404:
 *         description: 找不到待辦事項
 */
router.delete("/todos/:id", async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) {
      return res.status(404).json({ message: "找不到該待辦事項" });
    }
    await todo.deleteOne();
    res.json({ message: "待辦事項已刪除" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
