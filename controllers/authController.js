// authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { handleUploadError } from "../utils/cloudinaryHelper.js";
import { verifyGoogleToken } from "../config/googleAuth.js";
import axios from "axios";

// Cookie 配置函數
const getCookieConfig = (req) => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: isProduction ? ".onrender.com" : "localhost",
    path: "/",
  };
};

// 新增一個輔助函數來處理 session
const updateUserSession = async (user, req) => {
  const deviceInfo = req.headers['user-agent'] || 'unknown device';
  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  const newSession = {
    refreshToken,
    deviceInfo,
    lastUsed: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };

  user.sessions = user.sessions || [];
  
  // 查找是否存在相同裝置的 session
  const existingSessionIndex = user.sessions.findIndex(
    session => session.deviceInfo === deviceInfo
  );

  if (existingSessionIndex !== -1) {
    // 更新現有 session
    user.sessions[existingSessionIndex] = newSession;
  } else {
    // 檢查是否達到最大 session 數量
    if (user.sessions.length >= 5) {
      // 移除最舊的 session
      user.sessions.sort((a, b) => b.lastUsed - a.lastUsed);
      user.sessions.pop();
    }
    // 添加新的 session
    user.sessions.push(newSession);
  }

  await user.save();
  return refreshToken;
};

// 身份驗證相關函數
const signUp = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, ...(username ? [{ username }] : [])],
    });

    if (existingUser) {
      await handleUploadError(req.file);
      return res.status(400).json({
        message: username ? "用戶名或電子郵件已被使用" : "電子郵件已被使用",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      ...(username && { username }),
      email,
      password: hashedPassword,
      avatar: req.file ? req.file.path : "",
      isEmailVerified: false,
    });

    await user.save();

    res.status(201).json({
      message: "註冊成功，請驗證您的郵箱",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: false,
      },
    });
  } catch (error) {
    await handleUploadError(req.file);
    console.error("註冊錯誤:", error);
    res.status(500).json({ message: "註冊時發生錯誤" });
  }
};

const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "請提供電子郵件和密碼" });
    }

    // 檢查是否是第三方登入的 email
    const isThirdPartyEmail = await User.isThirdPartyEmail(email);
    if (isThirdPartyEmail) {
      return res.status(403).json({ 
        message: "此信箱已使用第三方服務登入，請使用對應的第三方服務登入",
        isThirdPartyEmail: true
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "此信箱尚未註冊，或信箱輸入錯誤" });
    }

    // 檢查是否為第三方登入用戶
    if (user.isThirdPartyUser()) {
      return res.status(403).json({ 
        message: "此帳號使用第三方服務登入，請使用對應的第三方服務登入",
        isThirdPartyUser: true
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "密碼錯誤" });
    }

    // 使用輔助函數處理 session
    const refreshToken = await updateUserSession(user, req);
    
    res.cookie('refreshToken', refreshToken, getCookieConfig(req));

    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: "登入成功",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        providers: user.providers
      }
    });
  } catch (error) {
    console.error("登入錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

const lineSignIn = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'LINE 授權碼不能為空' });
    }

    // 獲取 LINE access token
    const tokenResponse = await axios.post('https://api.line.me/oauth2/v2.1/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.LINE_REDIRECT_URI,
        client_id: process.env.LINE_CHANNEL_ID,
        client_secret: process.env.LINE_CHANNEL_SECRET
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // 獲取用戶資料
    const profileResponse = await axios.get('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const { userId: lineUserId, displayName, pictureUrl } = profileResponse.data;

    // 查找或創建用戶
    let user = await User.findOne({
      'providerTokens.line.userId': lineUserId
    });

    const lineTokenData = {
      userId: lineUserId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + expires_in * 1000)
    };

    if (!user) {
      // 創建新用戶
      user = new User({
        username: displayName,
        avatar: pictureUrl,
        providers: ['line'],
        providerTokens: {
          line: lineTokenData
        }
      });
    } else {
      // 更新現有用戶的 token
      user.providerTokens.line = lineTokenData;
    }

    await user.save();

    // 處理 session
    const refreshToken = await updateUserSession(user, req);
    
    // 設置 cookie
    res.cookie('refreshToken', refreshToken, getCookieConfig(req));

    // 生成 access token
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: "登入成功",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        providers: user.providers
      }
    });

  } catch (error) {
    console.error('LINE 登入錯誤:', error);
    res.status(500).json({ message: '登入失敗，請稍後再試' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ message: '未提供更新令牌' });
    }

    // 查找對應的 session
    const user = await User.findOne({
      'sessions.refreshToken': refreshToken
    });

    if (!user) {
      return res.status(403).json({ message: '更新令牌無效' });
    }

    const session = user.sessions.find(s => s.refreshToken === refreshToken);
    
    if (new Date() > session.expiresAt) {
      // 移除過期的 session
      user.sessions = user.sessions.filter(s => s.refreshToken !== refreshToken);
      await user.save();
      return res.status(403).json({ message: '更新令牌已過期' });
    }

    // 更新 session 的最後使用時間
    session.lastUsed = new Date();
    await user.save();

    // 生成新的 accessToken
    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ accessToken });
  } catch (error) {
    console.error('更新令牌錯誤:');
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

const googleSignIn = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Google Token 不能為空' });
    }

    const payload = await verifyGoogleToken(token);
    if (!payload) {
      return res.status(401).json({ message: 'Google 驗證失敗' });
    }

    // 只通過 Google ID 或 email 查找 Google 登入的用戶
    let user = await User.findOne({
      $and: [
        { 
          $or: [
            { 'providerTokens.google.userId': payload.sub },
            { email: payload.email }
          ]
        },
        { providers: 'google' } // 確保只查找 Google 登入的用戶
      ]
    });

    const googleTokenData = {
      userId: payload.sub,
      accessToken: token,
      expiresAt: new Date(Date.now() + 3600 * 1000)
    };

    if (!user) {
      // 創建新的 Google 用戶
      user = new User({
        username: payload.name,
        email: payload.email,
        avatar: payload.picture,
        isEmailVerified: true,
        providers: ['google'],
        providerTokens: {
          google: googleTokenData
        }
      });
    } else {
      // 更新現有 Google 用戶的資訊
      user.providerTokens.google = googleTokenData;
      user.isEmailVerified = true;
    }

    await user.save();
    // 處理 session 和 token
    const refreshToken = await updateUserSession(user, req);
    res.cookie('refreshToken', refreshToken, getCookieConfig(req));

    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Google 登入成功',
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: true,
        providers: user.providers
      }
    });
  } catch (error) {
    console.error('Google 登入錯誤:', error);
    res.status(500).json({ message: '登入失敗，請稍後再試' });
  }
};

const signInWithProvider = async (req, res) => {
  try {
    const { provider, token } = req.body;
    
    if (!provider || !token) {
      return res.status(400).json({ message: '缺少必要參數' });
    }

    let userData;
    switch (provider) {
      case 'google':
        return await googleSignIn(req, res);
      case 'line':
        return await lineSignIn(req, res);
      default:
        return res.status(400).json({ message: '不支援的登入方式' });
    }
  } catch (error) {
    console.error('第三方登入錯誤:', error);
    res.status(500).json({ message: '登入失敗，請稍後再試' });
  }
};

// 新增登出相關函數
const signOut = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const { allDevices } = req.query; // 是否登出所有裝置

    if (!refreshToken) {
      return res.status(400).json({ message: '未提供登出令牌' });
    }

    const user = await User.findOne({
      'sessions.refreshToken': refreshToken
    });

    if (!user) {
      return res.status(404).json({ message: '找不到使用者' });
    }

    if (allDevices === 'true') {
      // 登出所有裝置
      user.sessions = [];
    } else {
      // 只登出當前裝置
      user.sessions = user.sessions.filter(
        session => session.refreshToken !== refreshToken
      );
    }

    // 如果用戶有第三方登入，處理第三方登出
    if (user.providers?.length > 0) {
      await handleThirdPartySignOut(user);
    }

    await user.save();

    // 清除 cookie
    res.clearCookie('refreshToken', getCookieConfig(req));
    
    res.json({ message: '登出成功' });
  } catch (error) {
    console.error('登出錯誤:', error);
    res.status(500).json({ message: '登出時發生錯誤' });
  }
};

// 處理第三方登出
const handleThirdPartySignOut = async (user) => {
  try {
    for (const provider of user.providers) {
      switch (provider) {
        case 'google':
          await handleGoogleSignOut(user);
          break;
        case 'line':
          await handleLineSignOut(user);
          break;
      }
    }
  } catch (error) {
    console.error('第三方登出錯誤:', error);
  }
};

// 處理 Google 登出
const handleGoogleSignOut = async (user) => {
  try {
    const googleToken = user.providerTokens?.google?.accessToken;
    if (googleToken) {
      await axios.post('https://oauth2.googleapis.com/revoke', null, {
        params: { token: googleToken },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    }
    // 清除 Google 令牌
    user.providerTokens.google = {};
  } catch (error) {
    console.error('Google 登出錯誤:', error);
  }
};

// 處理 LINE 登出
const handleLineSignOut = async (user) => {
  try {
    const lineToken = user.providerTokens?.line?.accessToken;
    if (lineToken) {
      await axios.post('https://api.line.me/oauth2/v2.1/revoke', 
        new URLSearchParams({
          access_token: lineToken,
          client_id: process.env.LINE_CHANNEL_ID,
          client_secret: process.env.LINE_CHANNEL_SECRET
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    }
    // 清除 LINE 令牌
    user.providerTokens.line = {};
  } catch (error) {
    console.error('LINE 登出錯誤:', error);
  }
};

// 獲取使用者的所有登入裝置
const getActiveSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '找不到使用者' });
    }

    const currentRefreshToken = req.cookies.refreshToken;
    const sessions = user.sessions.map(session => ({
      deviceInfo: session.deviceInfo,
      lastUsed: session.lastUsed,
      isCurrent: session.refreshToken === currentRefreshToken
    }));

    res.json({ sessions });
  } catch (error) {
    console.error('獲取登入裝置錯誤:', error);
    res.status(500).json({ message: '獲取登入裝置時發生錯誤' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "此信箱尚未註冊" });
    }

    if (user.isThirdPartyUser()) {
      return res.status(403).json({ 
        message: "第三方登入用戶不能使用密碼重置功能，請使用對應的第三方服務重置密碼",
        isThirdPartyUser: true
      });
    }

    // ... 其餘代碼保持不變 ...
  } catch (error) {
    console.error("忘記密碼錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "用戶不存在" });
    }

    if (user.isThirdPartyUser()) {
      return res.status(403).json({ 
        message: "第三方登入用戶不能重置密碼，請使用對應的第三方服務重置密碼",
        isThirdPartyUser: true
      });
    }

    // ... 其餘代碼保持不變 ...
  } catch (error) {
    console.error("重置密碼錯誤:", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

export {
  signUp,
  signIn,
  signInWithProvider,
  googleSignIn,
  lineSignIn,
  refreshToken,
  signOut,
  getActiveSessions,
};
