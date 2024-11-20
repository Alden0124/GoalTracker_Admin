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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "此信箱尚未註冊，或信箱輸入錯誤" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "密碼錯誤" });
    }

    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, getCookieConfig(req));

    res.json({
      message: "登入成功",
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("登入錯誤:");
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
        code,
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

    // 獲取用戶信息
    const userResponse = await axios.get('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const { userId: lineUserId, displayName, pictureUrl } = userResponse.data;

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
          line: lineTokenData,
          google: {} // 明確設置空對象
        }
      });
    } else {
      // 更新現有用戶
      if (!user.providers.includes('line')) {
        user.providers.push('line');
      }
      
      // 保留現有的 Google 令牌（如果有的話）
      const existingProviderTokens = user.providerTokens || {};
      
      user.providerTokens = {
        ...existingProviderTokens,
        line: lineTokenData
      };

      // 如果用戶沒有頭像，使用 LINE 頭像
      if (!user.avatar && pictureUrl) {
        user.avatar = pictureUrl;
      }
    }

    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    user.refreshToken = refreshToken;
    
    // 使用 markModified 確保 Mongoose 知道 providerTokens 已被修改
    user.markModified('providerTokens');
    await user.save();

    res.cookie('refreshToken', refreshToken, getCookieConfig(req));

    res.json({
      message: 'LINE 登入成功',
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        providers: user.providers
      }
    });
  } catch (error) {
    console.error('LINE 登入錯誤:', error.response?.data || error);
    console.log(process.env.LINE_REDIRECT_URI)
    // 更詳細的錯誤處理
    if (error.response) {
      // LINE API 返回的錯誤
      return res.status(error.response.status).json({
        message: '登入失敗',
        error: error.response.data
      });
    }
    
    res.status(500).json({ 
      message: '登入失敗，請稍後再試',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: '未提供更新令牌' });
    }

    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res.status(403).json({ message: '更新令牌無效' });
    }

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err) {
          return res.status(403).json({ message: '更新令牌無效' });
        }

        const accessToken = jwt.sign(
          { userId: user._id },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        res.json({ accessToken });
      }
    );
  } catch (error) {
    console.error('更新令牌錯誤:');
    res.status(500).json({ message: '伺服器錯誤' });
  }
};

const googleSignIn = async (req, res) => {
  try {
    const { token } = req.body;
    const payload = await verifyGoogleToken(token);
    
    if (!payload) {
      return res.status(401).json({ message: 'Google 驗證失敗' });
    }

    let user = await User.findOne({
      $or: [
        { email: payload.email },
        { 'providerTokens.google.userId': payload.sub }
      ]
    });

    const googleTokenData = {
      userId: payload.sub,
      accessToken: token,
      expiresAt: new Date(Date.now() + 3600 * 1000)
    };

    if (!user) {
      // 創建新用戶
      user = new User({
        username: payload.name,
        email: payload.email,
        avatar: payload.picture,
        isEmailVerified: true,
        providers: ['google'],
        providerTokens: {
          google: googleTokenData,
          line: {} // 明確設置空對象
        }
      });
    } else {
      // 更新現有用戶
      if (!user.providers.includes('google')) {
        user.providers.push('google');
      }
      
      // 保留現有的 LINE 令牌（如果有的話）
      const existingProviderTokens = user.providerTokens || {};
      
      user.providerTokens = {
        ...existingProviderTokens,
        google: googleTokenData
      };

      // 如果用戶沒有頭像，使用 Google 頭像
      if (!user.avatar && payload.picture) {
        user.avatar = payload.picture;
      }
    }

    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    user.refreshToken = refreshToken;
    
    // 使用 markModified 確保 Mongoose 知道 providerTokens 已被修改
    user.markModified('providerTokens');
    await user.save();

    res.cookie('refreshToken', refreshToken, getCookieConfig(req));

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

export {
  signUp,
  signIn,
  signInWithProvider,
  googleSignIn,
  lineSignIn,
  refreshToken,
};
