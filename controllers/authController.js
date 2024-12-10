// authController.js
import axios from "axios";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verifyGoogleToken } from "../config/googleAuth.js";
import { getLineUserInfo } from "../config/lineAuth.js";
import { sendVerificationEmail } from "../config/nodemailer.js";
import User from "../models/userModel.js";
import { getMessage } from "../utils/i18n.js";

// Cookie 配置函數
const getCookieConfig = (req) => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true, // 只能在 HTTP 請求中使用，防止客戶端腳本訪問
    secure: isProduction, // 僅在 HTTPS 中傳遞
    sameSite: isProduction ? "none" : "lax", // 設置 SameSite 屬性
    maxAge: 7 * 24 * 60 * 60 * 1000, // Cookie 有效期（毫秒）
    path: "/", // Cookie 有效路徑
  };
};

// 處理用戶會話管理的函數
const updateUserSession = async (user, req) => {
  // 1. 獲取設備信息，用於識別不同的登入裝置
  const deviceInfo = req.headers["user-agent"] || "unknown device";

  // 2. 生成新的 refresh token，有效期 7 天
  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  // 3. 創建新的會話對象
  const newSession = {
    refreshToken,
    deviceInfo,
    lastUsed: new Date(), // 記錄最後使用時間
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天後過期
  };

  // 4. 確保 user.sessions 存在
  user.sessions = user.sessions || [];

  // 5. 查找是否存在來自相同設備的會話
  const existingSessionIndex = user.sessions.findIndex(
    (session) => session.deviceInfo === deviceInfo
  );

  if (existingSessionIndex !== -1) {
    // 6A. 如果存在相同設備的會話，更新該會話
    user.sessions[existingSessionIndex] = newSession;
  } else {
    // 6B. 如果是新設備
    if (user.sessions.length >= 5) {
      // 7. 如果會話數量達到上限（5個）
      // 按最後使用時間排序，移除最舊的會話
      user.sessions.sort((a, b) => b.lastUsed - a.lastUsed);
      user.sessions.pop(); // 移除最後一個（最舊的）會話
    }
    // 8. 添加新的會話
    user.sessions.push(newSession);
  }

  // 9. 保存更新後的用戶資料
  await user.save();
  return refreshToken;
};

// 身份驗證相關函數
const signUp = async (req, res) => {
  try {
    const { email, password, username } = req.body;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    const finalUsername = username || email.split("@")[0];

    // 檢查必要欄位
    if (!email || !password || !finalUsername) {
      return res.status(400).json({
        message: getMessage("auth.missingFields", lang),
        missingFields: {
          email: !email,
          password: !password,
          username: !finalUsername,
        },
      });
    }

    // 查找是否存在相同 email 的用戶
    let user = await User.findOne({ email });

    // 加密密碼
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (!user) {
      // 完全新用戶
      user = new User({
        username: finalUsername,
        email,
        password: hashedPassword,
        providers: ["local"],
        localEmailVerified: false, // 新用戶需要驗證
      });
    } else {
      // 已存在的用戶
      if (user.providers.includes("local")) {
        return res.status(400).json({
          message: getMessage("auth.emailRegistered", lang),
        });
      }

      // 添加本地登入方式
      user.password = hashedPassword;
      if (!user.providers.includes("local")) {
        user.providers.push("local");
        user.localEmailVerified = false; // 需要驗證 email
      }

      if (!user.username) {
        user.username = finalUsername;
      }
    }

    // 生成驗證碼
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    user.verificationCode = {
      code: verificationCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 分鐘後過期
    };

    await user.save();

    // 發送驗證郵件
    const isEmailSent = await sendVerificationEmail(email, verificationCode);
    if (!isEmailSent) {
      return res.status(500).json({
        message: getMessage("auth.verificationEmailFailed", lang),
      });
    }

    res.status(201).json({
      message: getMessage("auth.signupSuccess", lang),
      needVerification: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        localEmailVerified: user.localEmailVerified,
        providers: user.providers,
      },
    });
  } catch (error) {
    console.error("註冊錯誤:", error);
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";
    res.status(500).json({
      message: getMessage("auth.signupFailed", lang),
    });
  }
};

const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;
    const lang = req.headers["accept-language"]?.split(",")[0] || "zh-TW";

    if (!email || !password) {
      return res.status(400).json({
        message: getMessage("auth.missingCredentials", lang),
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: getMessage("auth.emailNotRegistered", lang),
        notRegistered: true,
      });
    }

    // 檢查是否有本地登入方式
    if (!user.providers.includes("local")) {
      const providerNames = user.providers
        .filter((p) => ["google", "line"].includes(p))
        .map((p) => (p === "line" ? "LINE" : "Google"))
        .join("或");

      return res.status(403).json({
        message: getMessage("auth.thirdPartyLoginRequired", lang, {
          provider: providerNames,
        }),
        isThirdPartyUser: true,
        providers: user.providers,
      });
    }

    // 檢查本地登入的 email 是否已驗證
    if (!user.localEmailVerified) {
      return res.status(403).json({
        message: getMessage("auth.emailNotVerified", lang),
        needVerification: true,
        email: user.email,
      });
    }

    // 驗證密碼
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: getMessage("auth.invalidPassword", lang),
      });
    }

    // 處理 session
    const refreshToken = await updateUserSession(user, req);

    // 設置 cookie
    res.cookie("refreshToken", refreshToken, getCookieConfig(req));

    // 生成 access token
    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // 返回成功響應
    res.json({
      message: getMessage("auth.loginSuccess", lang),
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        providers: user.providers,
      },
    });
  } catch (error) {
    console.error("登入錯誤:", error);
    res.status(500).json({
      message: getMessage("auth.loginFailed", lang),
    });
  }
};

const lineSignIn = async (req, res) => {
  try {
    const { code } = req.body;
    const lineUserInfo = await getLineUserInfo(code);
    const {
      sub: lineUserId,
      name: displayName,
      picture: pictureUrl,
      email,
    } = lineUserInfo;

    // 1. 先用 LINE userId 查找用戶
    let user = await User.findOne({
      "providerTokens.line.userId": lineUserId,
    });

    // 2. 如果沒找到用戶但有 email，嘗試用 email 查找
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      // 3A. 完全新用戶：創建新帳戶
      user = new User({
        username: displayName,
        oauthName: displayName,
        email: email || "",
        avatar: pictureUrl,
        isEmailVerified: !!email,
        providers: ["line"],
        providerTokens: {
          line: {
            userId: lineUserId,
            displayName: displayName,
            accessToken: lineUserInfo.accessToken,
            refreshToken: lineUserInfo.refreshToken,
            expiresIn: lineUserInfo.expiresIn,
            expiresAt: new Date(Date.now() + lineUserInfo.expiresIn * 1000),
          },
        },
      });
    } else {
      // 3B. 現有用戶：更新或添 LINE 登入資訊
      if (!user.providerTokens) {
        user.providerTokens = {};
      }

      // 更新 LINE 登入資訊
      user.providerTokens.line = {
        userId: lineUserId,
        displayName: displayName,
        accessToken: lineUserInfo.accessToken,
        refreshToken: lineUserInfo.refreshToken,
        expiresIn: lineUserInfo.expiresIn,
        expiresAt: new Date(Date.now() + lineUserInfo.expiresIn * 1000),
      };

      // 確保 providers 包含 LINE
      if (!user.providers.includes("line")) {
        user.providers.push("line");
      }

      // 如果用戶沒有頭像，使用 LINE 頭像
      if (!user.avatar) {
        user.avatar = pictureUrl;
      }
    }

    await user.save();

    const refreshToken = await updateUserSession(user, req);
    res.cookie("refreshToken", refreshToken, getCookieConfig(req));

    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      message: "登入成功",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        oauthName: user.oauthName,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        providers: user.providers,
      },
    });
  } catch (error) {
    console.error("LINE 登入錯誤:", error);
    res.status(500).json({ message: "登入失敗，請稍後再試" });
  }
};

const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        message: "請重新登入",
        code: "TOKEN_MISSING",
      });
    }

    const user = await User.findOne({
      "sessions.refreshToken": refreshToken,
    });

    if (!user) {
      return res.status(403).json({
        message: "您的登入已在其他裝置登入而被終止",
        code: "SESSION_TERMINATED",
      });
    }

    const session = user.sessions.find((s) => s.refreshToken === refreshToken);

    if (new Date() > session.expiresAt) {
      user.sessions = user.sessions.filter(
        (s) => s.refreshToken !== refreshToken
      );
      await user.save();
      return res.status(403).json({ message: "更新令牌已過期" });
    }

    session.lastUsed = new Date();
    await user.save();

    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ accessToken });
  } catch (error) {
    console.error("更新令牌錯誤:", error);
    res.status(500).json({
      message: "伺服器錯誤",
      code: "SERVER_ERROR",
    });
  }
};

const googleSignIn = async (req, res) => {
  try {
    const { token } = req.body;
    const googleUserInfo = await verifyGoogleToken(token);
    const { providerId, email, username, avatar } = googleUserInfo;

    // 1. 先用 Google ID 查找用戶
    let user = await User.findOne({
      "providerTokens.google.userId": providerId,
    });

    // 2. 如果沒找到用戶但有 email，嘗試用 email 查找
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      // 3A. 完全新用戶：創建新帳戶
      const oauthName = username || email.split("@")[0];
      user = new User({
        username: oauthName,
        oauthName: oauthName,
        email: email,
        avatar: avatar,
        isEmailVerified: true,
        providers: ["google"],
        providerTokens: {
          google: {
            userId: providerId,
            accessToken: token,
          },
        },
      });
    } else {
      // 3B. 現有用戶：更新或添加 Google 登入資訊
      if (!user.providerTokens) {
        user.providerTokens = {};
      }

      // 更新 Google 登入資訊
      user.providerTokens.google = {
        userId: providerId,
        accessToken: token,
      };

      // 確保 providers 包含 Google
      if (!user.providers.includes("google")) {
        user.providers.push("google");
      }

      // 如果用戶沒有頭像，使用 Google 頭像
      if (!user.avatar) {
        user.avatar = avatar;
      }

      // 如果是通過 email 找到的用戶，確保 email 已驗證
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
      }
    }

    await user.save();
    const refreshToken = await updateUserSession(user, req);
    res.cookie("refreshToken", refreshToken, getCookieConfig(req));

    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      message: "Google 登入成功",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        oauthName: user.oauthName,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: true,
        providers: user.providers,
      },
    });
  } catch (error) {
    console.error("Google 登入錯誤:", error);
    res.status(500).json({ message: "登入失敗，請稍後再試" });
  }
};

const signInWithProvider = async (req, res) => {
  try {
    const { provider, token } = req.body;

    if (!provider || !token) {
      return res.status(400).json({ message: "缺必要參數" });
    }

    let userData;
    switch (provider) {
      case "google":
        return await googleSignIn(req, res);
      case "line":
        return await lineSignIn(req, res);
      default:
        return res.status(400).json({ message: "不支援的登入方式" });
    }
  } catch (error) {
    console.error("第三方登入錯誤:", error);
    res.status(500).json({ message: "登入失敗，請稍後再試" });
  }
};

// 新增登出相關函數
const signOut = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const { allDevices } = req.query; // 是否登出所有裝置

    if (!refreshToken) {
      return res.status(400).json({ message: "未提供登出令牌" });
    }

    const user = await User.findOne({
      "sessions.refreshToken": refreshToken,
    });

    if (!user) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    if (allDevices === "true") {
      user.sessions = [];
    } else {
      user.sessions = user.sessions.filter(
        (session) => session.refreshToken !== refreshToken
      );
    }

    if (user.providers?.length > 0) {
      await handleThirdPartySignOut(user);
    }

    await user.save();

    res.clearCookie("refreshToken", getCookieConfig(req));

    res.json({ message: "登出成功" });
  } catch (error) {
    console.error("登出錯誤:", error);
    res.status(500).json({ message: "登出時發生錯誤" });
  }
};

// 處理第三方登出
const handleThirdPartySignOut = async (user) => {
  try {
    for (const provider of user.providers) {
      switch (provider) {
        case "google":
          await handleGoogleSignOut(user);
          break;
        case "line":
          await handleLineSignOut(user);
          break;
      }
    }
  } catch (error) {
    console.error("第三方登出錯誤:", error);
  }
};

// 處理 Google 登出
const handleGoogleSignOut = async (user) => {
  try {
    const googleToken = user.providerTokens?.google?.accessToken;
    if (googleToken) {
      await axios.post("https://oauth2.googleapis.com/revoke", null, {
        params: { token: googleToken },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
    }
    user.providerTokens.google = {};
  } catch (error) {
    console.error("Google 登出錯誤:", error);
  }
};

// 處理 LINE 登出
const handleLineSignOut = async (user) => {
  try {
    const lineToken = user.providerTokens?.line?.accessToken;
    if (lineToken) {
      await axios.post(
        "https://api.line.me/oauth2/v2.1/revoke",
        new URLSearchParams({
          access_token: lineToken,
          client_id: process.env.LINE_CHANNEL_ID,
          client_secret: process.env.LINE_CHANNEL_SECRET,
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
    }
    if (user.providerTokens?.line) {
      const userId = user.providerTokens.line.userId;
      user.providerTokens.line = {
        userId: userId,
      };
    }
  } catch (error) {
    console.error("LINE 登出錯誤:", error);
  }
};

// 獲取使用者的所有登入裝置
const getActiveSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "找不到使用者" });
    }

    const currentRefreshToken = req.cookies.refreshToken;
    const sessions = user.sessions.map((session) => ({
      deviceInfo: session.deviceInfo,
      lastUsed: session.lastUsed,
      isCurrent: session.refreshToken === currentRefreshToken,
    }));

    res.json({ sessions });
  } catch (error) {
    console.error("獲取登入裝置錯誤:", error);
    res.status(500).json({ message: "獲取登入裝置時發生錯誤" });
  }
};

export {
  getActiveSessions,
  googleSignIn,
  lineSignIn,
  refreshToken,
  signIn,
  signInWithProvider,
  signOut,
  signUp,
};
