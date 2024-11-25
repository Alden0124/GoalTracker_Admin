import User from "../models/userModel.js";
import { sendVerificationEmail } from "../config/nodemailer.js";
import {
  deleteCloudinaryImage,
  handleUploadError,
  getPublicIdFromUrl,
} from "../utils/cloudinaryHelper.js";
import axios from "axios";

export const sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await User.findOneAndUpdate(
      { email },
      {
        verificationCode: {
          code: verificationCode,
          expiresAt,
        },
      },
      { upsert: true }
    );

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

    if (!user || !user.verificationCode) {
      return res.status(400).json({ message: "驗證碼無效" });
    }

    if (Date.now() > user.verificationCode.expiresAt) {
      return res.status(400).json({ message: "驗證碼已過期" });
    }

    if (user.verificationCode.code !== code) {
      return res.status(400).json({ message: "驗證碼不正確" });
    }

    user.isEmailVerified = true;
    user.verificationCode = undefined;
    await user.save();

    res.json({ message: "郵箱驗證成功" });
  } catch (error) {
    console.error("驗證碼驗證錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      await handleUploadError(req.file);
      return res.status(404).json({ message: "用戶不存在" });
    }

    // 如果用戶已有頭像，先刪除舊的
    if (user.avatar) {
      const oldPublicId = getPublicIdFromUrl(user.avatar);
      if (oldPublicId) {
        await deleteCloudinaryImage(oldPublicId);
      }
    }

    // 更新新的頭像
    user.avatar = req.file ? req.file.path : user.avatar;
    await user.save();

    res.json({
      message: "頭像更新成功",
      avatar: user.avatar,
    });
  } catch (error) {
    await handleUploadError(req.file);
    console.error("更新頭像錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 添加同步用戶資料的函數
export const syncUserProfile = async (user) => {
  try {
    // LINE 同步邏輯
    if (user.providers.includes("line")) {
      const lineTokens = user.providerTokens?.line;

      if (lineTokens && new Date(lineTokens.expiresAt) > new Date()) {
        const lineResponse = await axios.get("https://api.line.me/v2/profile", {
          headers: {
            Authorization: `Bearer ${lineTokens.accessToken}`,
          },
        });

        // 更新用戶資料
        const updates = {
          username: lineResponse.data.displayName,
        };

        // 處理頭像邏輯
        if (lineResponse.data.pictureUrl) {
          // 如果是第一次設置第三方頭像或目前沒有第三方頭像
          if (!user.thirdPartyAvatar) {
            updates.thirdPartyAvatar = lineResponse.data.pictureUrl;
            // 如果用戶沒有設置自定義頭像，使用第三方頭像
            if (!user.avatar) {
              updates.avatar = lineResponse.data.pictureUrl;
            }
          }
        }

        // 只更新有變化的欄位
        const needsUpdate = Object.keys(updates).some(
          (key) => user[key] !== updates[key]
        );

        if (needsUpdate) {
          Object.assign(user, updates);
          await user.save();
          console.log(`用戶 ${user._id} LINE 資料已更新`);
        }
      }
    }

    // Google 同步邏輯
    if (user.providers.includes("google")) {
      const googleTokens = user.providerTokens?.google;

      if (googleTokens && new Date(googleTokens.expiresAt) > new Date()) {
        try {
          const googleResponse = await axios.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            {
              headers: {
                Authorization: `Bearer ${googleTokens.accessToken}`,
              },
            }
          );

          const updates = {
            username: googleResponse.data.name,
            email: googleResponse.data.email,
          };

          // 處理頭像邏輯
          if (googleResponse.data.picture) {
            // 如果是第一次設置第三方頭像或目前沒有第三方頭像
            if (!user.thirdPartyAvatar) {
              updates.thirdPartyAvatar = googleResponse.data.picture;
              // 如果用戶沒有設置自定義頭像，使用第三方頭像
              if (!user.avatar) {
                updates.avatar = googleResponse.data.picture;
              }
            }
          }

          // 只更新有變化的欄位
          const needsUpdate = Object.keys(updates).some(
            (key) => user[key] !== updates[key]
          );

          if (needsUpdate) {
            Object.assign(user, updates);
            await user.save();
            console.log(`用戶 ${user._id} Google 資料已更新`);
          }
        } catch (error) {
          console.error("Google 資料同步錯誤:", error);
          // 如果是 token 過期，可以嘗試使用 refresh token 更新
          if (error.response?.status === 401 && googleTokens.refreshToken) {
            try {
              const refreshResponse = await axios.post(
                "https://oauth2.googleapis.com/token",
                {
                  client_id: process.env.GOOGLE_CLIENT_ID,
                  client_secret: process.env.GOOGLE_CLIENT_SECRET,
                  refresh_token: googleTokens.refreshToken,
                  grant_type: "refresh_token",
                }
              );

              // 更新 tokens
              user.providerTokens.google = {
                accessToken: refreshResponse.data.access_token,
                refreshToken: googleTokens.refreshToken,
                expiresAt: new Date(
                  Date.now() + refreshResponse.data.expires_in * 1000
                ),
              };
              await user.save();

              // 遞迴調用自己重試同步
              return await syncUserProfile(user);
            } catch (refreshError) {
              console.error("Google refresh token 更新失敗:", refreshError);
            }
          }
        }
      }
    }

    return user;
  } catch (error) {
    console.error("同步用戶資料錯誤:", error);
    return user;
  }
};

// 在 getCurrentUser 中使用
export const getCurrentUser = async (req, res) => {
  try {
    let user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "用戶不存在" });
    }

    // 同步用戶資料
    user = await syncUserProfile(user);

    res.json({
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        thirdPartyAvatar: user.thirdPartyAvatar,
        email: user.email,
        providers: user.providers,
      },
    });
  } catch (error) {
    console.error("獲取用戶資訊錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

export const syncProfile = async (req, res) => {
  try {
    let user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "用戶不存在" });
    }

    // 同步用戶資料
    user = await syncUserProfile(user);
    user.lastSyncAt = new Date();
    await user.save();

    res.json({
      message: "用戶資料同步成功",
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        thirdPartyAvatar: user.thirdPartyAvatar,
        email: user.email,
        providers: user.providers,
      },
    });
  } catch (error) {
    console.error("同步用戶資料錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

export const addEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findById(req.user.userId);

    // 檢查 email 是否已被使用
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: "此電子郵件已被使用" });
    }

    // 生成驗證碼
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.email = email;
    user.verificationCode = {
      code: verificationCode,
      expiresAt
    };
    user.isEmailVerified = false;
    await user.save();

    // 發送驗證郵件
    const isEmailSent = await sendVerificationEmail(email, verificationCode);
    if (!isEmailSent) {
      return res.status(500).json({ message: "驗證碼發送失敗" });
    }

    res.json({ 
      message: "驗證碼已發送到您的郵箱",
      email: email
    });
  } catch (error) {
    console.error("添加 email 錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};
