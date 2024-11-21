import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import { sendVerificationEmail, sendResetPasswordEmail } from "../config/nodemailer.js";

export const sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    
    // 檢查 email 是否已被第三方登入使用
    const isThirdPartyEmail = await User.isThirdPartyEmail(email);
    if (isThirdPartyEmail) {
      return res.status(403).json({ 
        message: "此信箱已被第三方登入使用，無需驗證",
        isThirdPartyEmail: true
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isThirdPartyUser()) {
      return res.status(403).json({ 
        message: "第三方登入用戶無需驗證郵箱",
        isThirdPartyUser: true
      });
    }

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let user = existingUser;
    
    if (!user) {
      // 如果用戶不存在，創建新用戶
      user = new User({
        email,
        providers: [],
        verificationCode: {
          code: verificationCode,
          expiresAt
        }
      });
    } else {
      // 如果用戶存在，更新驗證碼
      user.verificationCode = {
        code: verificationCode,
        expiresAt
      };
    }

    await user.save();

    const isEmailSent = await sendVerificationEmail(email, verificationCode);

    if (!isEmailSent) {
      return res.status(500).json({ message: "驗證碼發送失敗" });
    }

    res.json({ message: "驗證碼已發送到您的郵箱" });
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

    if (user.isThirdPartyUser()) {
      return res.status(403).json({ 
        message: "第三方登入用戶無需驗證郵箱",
        isThirdPartyUser: true
      });
    }

    if (!user || !user.verificationCode) {
      return res.status(400).json({ message: "驗證碼無效" });
    }

    if (user.verificationCode.code !== code) {
      return res.status(400).json({ message: "驗證碼不正確" });
    }

    if (new Date() > new Date(user.verificationCode.expiresAt)) {
      return res.status(400).json({ message: "驗證碼已過期" });
    }

    // 更新用戶狀態並獲取更新後的文檔
    const updatedUser = await User.findOneAndUpdate(
      { email },
      {
        $unset: { verificationCode: "" },
        $set: { isEmailVerified: true },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(500).json({ message: "更新用戶狀態失敗" });
    }

    res.json({ message: "驗證成功" });
  } catch (error) {
    console.error("驗證碼驗證錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // 檢查 email 是否已被第三方登入使用
    const isThirdPartyEmail = await User.isThirdPartyEmail(email);
    if (isThirdPartyEmail) {
      return res.status(403).json({ 
        message: "此信箱已被第三方登入使用，請使用對應的第三方服務重置密碼",
        isThirdPartyEmail: true
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "找不到該郵箱對應的用戶" });
    }

    // 檢查是否為第三方登入用戶
    if (user.provider && user.provider !== 'local') {
      return res.status(400).json({ 
        message: "此帳號使用第三方登入，無法使用重置密碼功能" 
      });
    }

    // 生成重置密碼的驗證碼
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10分鐘後過期

    // 更新用戶的重置密碼驗證碼
    await User.findOneAndUpdate(
      { email },
      {
        resetPasswordCode: {
          code: resetCode,
          expiresAt: resetCodeExpires
        }
      }
    );

    // 發送重置密碼郵件
    const isEmailSent = await sendResetPasswordEmail(email, resetCode);
    
    if (!isEmailSent) {
      return res.status(500).json({ message: "重置密碼郵件發送失敗" });
    }

    res.json({ message: "重置密碼驗證碼已發送到您的郵箱" });
  } catch (error) {
    console.error("忘記密碼處理錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    // 檢查 email 是否已被第三方登入使用
    const isThirdPartyEmail = await User.isThirdPartyEmail(email);
    if (isThirdPartyEmail) {
      return res.status(403).json({ 
        message: "此信箱已被第三方登入使用，請使用對應的第三方服務重置密碼",
        isThirdPartyEmail: true
      });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetPasswordCode) {
      return res.status(400).json({ message: "重置密碼驗證碼無效" });
    }

    if (user.resetPasswordCode.code !== code) {
      return res.status(400).json({ message: "重置密碼驗證碼不正確" });
    }

    if (new Date() > new Date(user.resetPasswordCode.expiresAt)) {
      return res.status(400).json({ message: "重置密碼驗證碼已過期" });
    }

    // 加密新密碼
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 更新密碼並清除重置碼
    await User.findOneAndUpdate(
      { email },
      {
        $set: { password: hashedPassword },
        $unset: { resetPasswordCode: "" }
      }
    );

    res.json({ message: "密碼重置成功" });
  } catch (error) {
    console.error("重置密碼錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};
