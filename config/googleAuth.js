import { OAuth2Client } from 'google-auth-library';

const getGoogleConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    // 可以添加其他環境特定的配置
  };
};

const config = getGoogleConfig();
const client = new OAuth2Client(
  config.clientId,
  config.clientSecret,
  config.callbackURL
);

export const verifyGoogleToken = async (accessToken) => {
  try {
    // 使用 access token 獲取用戶信息
    const response = await client.getTokenInfo(accessToken);
    
    // 如果需要更詳細的用戶信息，可以調用 Google People API
    const url = `https://www.googleapis.com/oauth2/v3/userinfo`;
    const userInfoResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info');
    }
    
    const userData = await userInfoResponse.json();
    
    return {
      email: userData.email,
      username: userData.name,
      avatar: userData.picture,
      providerId: userData.sub,
      provider: 'google'
    };
  } catch (error) {
    console.error('Google token 驗證錯誤:', error);
    throw new Error('無效的 Google Access Token');
  }
};