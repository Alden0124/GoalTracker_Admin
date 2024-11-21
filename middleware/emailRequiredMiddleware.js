export const checkEmailRequired = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: "用戶不存在" });
    }

    if (user.needsEmailForOperation()) {
      return res.status(403).json({ 
        message: "此操作需要驗證電子郵件",
        needEmail: true,
        redirectTo: '/profile/email' // 導向會員中心的 email 設置頁面
      });
    }

    next();
  } catch (error) {
    console.error("檢查 email 需求時發生錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
}; 