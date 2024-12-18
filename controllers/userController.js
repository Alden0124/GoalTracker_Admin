import axios from "axios";
import { upload } from "../config/cloudinary.js";
import { handleMulterError } from "../middleware/errorHandler.js";
import Follow from "../models/followModel.js";
import User from "../models/userModel.js";
import {
  deleteCloudinaryImage,
  getPublicIdFromUrl,
  handleUploadError,
} from "../utils/cloudinaryHelper.js";

export const updateUserProfile = async (req, res) => {
  try {
    // 詳細的請求日誌
    console.log("===== 開始更新用戶資料 =====");
    console.log("請求體:", {
      username: req.body.username,
      location: req.body.location,
      occupation: req.body.occupation,
      education: req.body.education,
    });
    console.log(
      "文件信息:",
      req.file
        ? {
            fieldname: req.file.fieldname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : "No file uploaded"
    );
    console.log("用戶ID:", req.user?.userId);

    // 檢查必要的參數
    if (!req.user?.userId) {
      console.error("缺少用戶ID");
      return res.status(400).json({ message: "缺少用戶ID" });
    }

    // 從請求體中解構需要更新的欄位
    const { username, location, occupation, education } = req.body;
    const userId = req.user.userId;

    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      console.error(`用戶不存在: ${userId}`);
      if (req.file) await handleUploadError(req.file);
      return res.status(404).json({ message: "用戶不存在" });
    }

    // 處理頭像上傳
    if (req.file) {
      try {
        console.log("開始處理頭像上傳:", {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
        });

        if (user.avatar && user.avatar !== user.thirdPartyAvatar) {
          const oldPublicId = getPublicIdFromUrl(user.avatar);
          if (oldPublicId) {
            console.log("刪除舊頭像:", oldPublicId);
            await deleteCloudinaryImage(oldPublicId);
          }
        }
        user.avatar = req.file.path;
        console.log("新頭像設置成功:", req.file.path);
      } catch (uploadError) {
        console.error("頭像處理錯誤:", {
          error: uploadError,
          stack: uploadError.stack,
          file: req.file,
        });
        await handleUploadError(req.file);
        return res.status(500).json({
          message: "頭像上傳失敗",
          error: uploadError.message,
        });
      }
    }

    // 準備要更新的欄位
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (location !== undefined) updates.location = location;
    if (occupation !== undefined) updates.occupation = occupation;
    if (education !== undefined) updates.education = education;
    if (user.avatar) updates.avatar = user.avatar;

    console.log("準備更新的欄位:", updates);

    // 執行資料庫更新操作
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    );

    if (!updatedUser) {
      throw new Error("更新用戶資料失敗");
    }

    res.json({
      message: "用戶資料更新成功",
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        location: updatedUser.location,
        occupation: updatedUser.occupation,
        education: updatedUser.education,
        avatar: updatedUser.avatar,
        thirdPartyAvatar: updatedUser.thirdPartyAvatar,
        email: updatedUser.email,
        providers: updatedUser.providers,
      },
    });
  } catch (error) {
    // 改進錯誤處理
    console.error("更新用戶資料錯誤:", {
      message: error.message,
      stack: error.stack,
      details: error,
    });

    if (req.file) {
      try {
        await handleUploadError(req.file);
      } catch (cleanupError) {
        console.error("清理上傳文件失敗:", cleanupError);
      }
    }

    res.status(500).json({
      message: "更新用戶資料失敗",
      error: error.message,
    });
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
          oauthName: lineResponse.data.displayName,
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
            oauthName: googleResponse.data.name,
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

    // 獲取粉絲和追蹤數
    const followersCount = await Follow.countDocuments({ following: user._id });
    const followingCount = await Follow.countDocuments({ follower: user._id });

    res.json({
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        location: user.location || "",
        occupation: user.occupation || "",
        education: user.education || "",
        thirdPartyAvatar: user.thirdPartyAvatar,
        email: user.email,
        providers: user.providers,
        followersCount,
        followingCount,
      },
    });
  } catch (error) {
    console.error("獲取用戶資訊錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 更新avater
export const updateAvatar = async (req, res, next) => {
  upload.single("avatar")(req, res, (err) => {
    if (err) {
      console.error("Multer 錯誤:", err);
      return handleMulterError(err, req, res, next);
    }
    next();
  });
};

// 新增：根據userId獲取用戶資料
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.userId;

    // 添加 ObjectId 格式驗證
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "無效的用戶ID格式" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "用戶不存在" });
    }

    // 獲取粉絲和追蹤數
    const followersCount = await Follow.countDocuments({ following: userId });
    const followingCount = await Follow.countDocuments({ follower: userId });

    // 檢查當前用戶是否已追蹤此用戶
    let isFollowing = false;
    if (currentUserId) {
      const followExists = await Follow.findOne({
        follower: currentUserId,
        following: userId,
      });
      isFollowing = !!followExists;
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        location: user.location || "",
        occupation: user.occupation || "",
        education: user.education || "",
        followersCount,
        followingCount,
        isFollowing, // 新增欄位
      },
    });
  } catch (error) {
    console.error("獲取用戶資訊錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 追蹤用戶
export const followUser = async (req, res) => {
  try {
    const followerId = req.user.userId; // 當前登入用戶
    const followingId = req.params.userId; // 要追蹤的用戶

    // 檢查是否追蹤自己
    if (followerId === followingId) {
      return res.status(400).json({ message: "不能追蹤自己" });
    }

    // 檢查要追蹤的用戶是否存在
    const followingUser = await User.findById(followingId);
    if (!followingUser) {
      return res.status(404).json({ message: "用戶不存在" });
    }

    // 創建追蹤關係
    await Follow.create({
      follower: followerId,
      following: followingId,
    });

    res.status(200).json({ message: "追蹤成功" });
  } catch (error) {
    if (error.code === 11000) {
      // MongoDB 重複鍵錯誤
      return res.status(400).json({ message: "已經追蹤過此用戶" });
    }
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 取消追蹤
export const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user.userId;
    const followingId = req.params.userId;

    await Follow.findOneAndDelete({
      follower: followerId,
      following: followingId,
    });

    res.status(200).json({ message: "取消追蹤成功" });
  } catch (error) {
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 獲取用戶的追蹤者列表
export const getFollowers = async (req, res) => {
  try {
    const userId = req.params.userId;

    const followers = await Follow.find({ following: userId })
      .populate("follower", "username avatar _id")
      .sort({ createdAt: -1 });

    const followersList = followers.map((f) => ({
      id: f.follower._id,
      username: f.follower.username,
      avatar: f.follower.avatar,
    }));

    res.json({
      followers: followersList,
      total: followersList.length,
    });
  } catch (error) {
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 獲取用戶的追蹤列表
export const getFollowing = async (req, res) => {
  try {
    const userId = req.params.userId;

    const following = await Follow.find({ follower: userId })
      .populate("following", "username avatar _id")
      .sort({ createdAt: -1 });

    const followingList = following.map((f) => ({
      id: f.following._id,
      username: f.following.username,
      avatar: f.following.avatar,
    }));

    res.json({
      following: followingList,
      total: followingList.length,
    });
  } catch (error) {
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 移除粉絲
export const removeFollower = async (req, res) => {
  try {
    const currentUserId = req.user.userId; // 當前登入的用戶
    const targetUserId = req.params.userId; // 要操作的用戶頁面
    const followerId = req.params.followerId; // 要移除的粉絲

    // 檢查是否有權限（只能在自己的頁面移除粉絲）
    if (currentUserId !== targetUserId) {
      return res.status(403).json({ message: "您沒有權限執行此操作" });
    }

    console.log("正在檢查追蹤關係:", {
      follower: followerId,
      following: currentUserId,
    });

    const followRelation = await Follow.findOne({
      follower: followerId,
      following: currentUserId,
    });

    console.log("查詢結果:", followRelation);

    if (!followRelation) {
      return res.status(400).json({ message: "此用戶並不是您的粉絲" });
    }

    // 移除追蹤關係
    await Follow.findOneAndDelete({
      follower: followerId,
      following: currentUserId,
    });

    res.status(200).json({ message: "已成功移除粉絲" });
  } catch (error) {
    console.error("移除粉絲錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};
