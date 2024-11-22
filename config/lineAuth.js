import axios from 'axios';

export const getLineUserInfo = async (code) => {
  try {
    const tokenData = await getLineAccessToken(code);
    
    const userResponse = await axios.get('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    console.log('LINE API 返回的用戶資料:', {
      userId: userResponse.data.userId,
      displayName: userResponse.data.displayName,
      hasAvatar: !!userResponse.data.pictureUrl
    });

    return {
      sub: userResponse.data.userId,
      name: userResponse.data.displayName,
      picture: userResponse.data.pictureUrl,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in
    };
  } catch (error) {
    console.error('獲取 LINE 用戶信息錯誤:', error);
    throw error;
  }
};

// 添加獲取 LINE access token 的輔助函數
const getLineAccessToken = async (code) => {
  const tokenResponse = await axios.post('https://api.line.me/oauth2/v2.1/token', 
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.LINE_REDIRECT_URI,
      client_id: process.env.LINE_CHANNEL_ID,
      client_secret: process.env.LINE_CHANNEL_SECRET
    }), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return tokenResponse.data;
}; 