import jwt from "jsonwebtoken";
import User from '../models/userModel.js';

// 將 verifyJWT 函數導出
export const verifyJWT = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const verifyAuth = async (req, res, next) => {
  try {
    // 從 header 獲取 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: '未提供訪問令牌' });
    }

    const token = authHeader.split(' ')[1];

    try {
      // 驗證 token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // 檢查用戶是否存在
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ message: '用戶不存在' });
      }

      // 將用戶信息添加到請求對象中
      req.user = {
        userId: decoded.userId
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: '訪問令牌已過期',
          expired: true 
        });
      }
      return res.status(401).json({ message: '無效的訪問令牌' });
    }
  } catch (error) {
    console.error('驗證錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤' });
  }
}; 