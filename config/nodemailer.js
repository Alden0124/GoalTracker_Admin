import nodemailer from 'nodemailer';

let transporter = null;

export const initializeMailer = async () => {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.error('郵件配置缺失: 請檢查 EMAIL_USER 和 EMAIL_APP_PASSWORD 環境變量');
    return null;
  }

  console.log('郵件配置信息:', {
    hasUser: !!process.env.EMAIL_USER,
    hasPassword: !!process.env.EMAIL_APP_PASSWORD,
    userLength: process.env.EMAIL_USER?.length,
    passwordLength: process.env.EMAIL_APP_PASSWORD?.length
  });

  try {
    await transporter.verify();
    console.log('郵件服務器連接成功!');
    console.log('使用的郵件帳號:', process.env.EMAIL_USER);
    return transporter;
  } catch (error) {
    console.error('SMTP 連接錯誤:', error);
    console.error('當前郵件配置:', {
      user: process.env.EMAIL_USER,
      hasPassword: !!process.env.EMAIL_APP_PASSWORD
    });
    return null;
  }
};

export const sendVerificationEmail = async (email, verificationCode) => {
  if (!transporter) {
    await initializeMailer();
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '電子郵件驗證碼',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">電子郵件驗證</h2>
          <p>您的驗證碼是：</p>
          <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${verificationCode}</h1>
          <p>此驗證碼將在 10 分鐘後過期。</p>
          <p>如果這不是您的操作，請忽略此郵件。</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('發送郵件錯誤:', error);
    return false;
  }
};

export const sendResetPasswordEmail = async (email, resetCode) => {
  if (!transporter) {
    await initializeMailer();
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '重置密碼驗證碼',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">重置密碼</h2>
          <p>您的重置密碼驗證碼是：</p>
          <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${resetCode}</h1>
          <p>此驗證碼將在 10 分鐘後過期。</p>
          <p>如果這不是您的操作，請立即聯繫我們。</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('發送重置密碼郵件錯誤:', error);
    return false;
  }
}; 