import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import { sendVerificationEmail, sendResetPasswordEmail } from "../config/nodemailer.js";
import { getMessage } from "../utils/i18n.js";

export const sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    
    // 先檢查用戶是否存在
    const existingUser = await User.findOne({ email });
    
    // 生成驗證碼和過期時間
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let user;

    if (!existingUser) {
      // 完全新用戶
      user = new User({
        email,
        providers: [],
        verificationCode: {
          code: verificationCode,
          expiresAt
        }
      });
    } else {
      // 現有用戶
      user = existingUser;

      // 如果不是本地登入用戶，且只有第三方登入方式
      if (!user.providers.includes('local') && 
          user.providers.some(provider => ['google', 'line'].includes(provider))) {
        return res.status(403).json({ 
          message: "此信箱已被第三方登入使用，無需驗證",
          isThirdPartyEmail: true,
          providers: user.providers
        });
      }

      // 更新驗證碼
      user.verificationCode = {
        code: verificationCode,
        expiresAt
      };
    }

    await user.save();

    // 發送驗證郵件
    const isEmailSent = await sendVerificationEmail(email, verificationCode);

    if (!isEmailSent) {
      return res.status(500).json({ message: "驗證碼發送失敗" });
    }

    res.json({ 
      message: "驗證碼已發送到您的郵箱",
      providers: user.providers
    });

  } catch (error) {
    console.error("發送驗證碼錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

export const verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "用戶不存在" });
    }

    if (!user.verificationCode) {
      return res.status(400).json({ message: "驗證碼無效" });
    }

    if (user.verificationCode.code !== code) {
      return res.status(400).json({ message: "驗證碼不正確" });
    }

    if (new Date() > new Date(user.verificationCode.expiresAt)) {
      return res.status(400).json({ message: "驗證碼已過期" });
    }

    // 更新用戶狀態
    const updateFields = {
      $unset: { verificationCode: "" },
      $set: { isEmailVerified: true }
    };

    // 如果是本地用戶，同時更新 localEmailVerified
    if (user.providers.includes('local')) {
      updateFields.$set.localEmailVerified = true;
    }

    // 更新用戶狀態並獲取更新後的文檔
    const updatedUser = await User.findOneAndUpdate(
      { email },
      updateFields,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(500).json({ message: "更新用戶狀態失敗" });
    }

    res.json({ 
      message: "驗證成功",
      user: {
        email: updatedUser.email,
        isEmailVerified: updatedUser.isEmailVerified,
        localEmailVerified: updatedUser.localEmailVerified,
        providers: updatedUser.providers
      }
    });
  } catch (error) {
    console.error("驗證碼驗證錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        message: "此信箱尚未註冊"
      });
    }

    // 檢查是否有本地登入方式
    if (!user.providers.includes('local')) {
      const providerNames = user.providers
        .filter((p) => ["google", "line"].includes(p))
        .map((p) => (p === "line" ? "LINE" : "Google"))
        .join("或");

      return res.status(403).json({
        message: `此帳號使用 ${providerNames} 登入，請使用對應的服務重置密碼`,
        isThirdPartyUser: true,
        providers: user.providers
      });
    }

    // 生成重置密碼的驗證碼
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10分鐘後過期

    // 更新用戶的重置密碼驗證碼
    user.resetPasswordCode = {
      code: resetCode,
      expiresAt: resetCodeExpires
    };
    await user.save();

    // 發送重置密碼郵件
    const isEmailSent = await sendResetPasswordEmail(email, resetCode);
    
    if (!isEmailSent) {
      return res.status(500).json({ 
        message: "驗證碼發送失敗"
      });
    }

    res.json({ 
      message: "重置密碼驗證碼已發送到您的信箱",
      providers: user.providers
    });
  } catch (error) {
    console.error("忘記密碼處理錯誤:", error);
    res.status(500).json({ 
      message: "伺服器錯誤，請稍後再試"
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        message: "找不到此用戶"
      });
    }

    // 檢查是否有本地登入方式
    if (!user.providers.includes('local')) {
      const providerNames = user.providers
        .filter((p) => ["google", "line"].includes(p))
        .map((p) => (p === "line" ? "LINE" : "Google"))
        .join("或");

      return res.status(403).json({
        message: `此帳號使用 ${providerNames} 登入，請使用對應的服務重置密碼`,
        isThirdPartyUser: true,
        providers: user.providers
      });
    }

    if (!user.resetPasswordCode) {
      return res.status(400).json({ 
        message: "無效的重置碼"
      });
    }

    if (user.resetPasswordCode.code !== code) {
      return res.status(400).json({ 
        message: "驗證碼不正確"
      });
    }

    if (new Date() > new Date(user.resetPasswordCode.expiresAt)) {
      return res.status(400).json({ 
        message: "驗證碼已過期"
      });
    }

    // 加密新密碼
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 更新密碼並清除重置碼
    user.password = hashedPassword;
    user.resetPasswordCode = undefined;
    await user.save();

    res.json({ 
      message: "密碼重置成功",
      providers: user.providers
    });
  } catch (error) {
    console.error("重置密碼錯誤:", error);
    res.status(500).json({ 
      message: "伺服器錯誤，請稍後再試"
    });
  }
};
