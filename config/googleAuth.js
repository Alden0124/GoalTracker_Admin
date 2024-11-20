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

export const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: config.clientId
    });
    
    const payload = ticket.getPayload();
    
    return {
      email: payload.email,
      username: payload.name,
      avatar: payload.picture,
      providerId: payload.sub,
      provider: 'google'
    };
  } catch (error) {
    console.error('Google token 驗證錯誤:', error);
    throw new Error('無效的 Google Token');
  }
}; 