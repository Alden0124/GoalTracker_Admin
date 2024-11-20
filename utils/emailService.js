import nodemailer from 'nodemailer';

// 創建一個獲取 transporter 的函數
const getTransporter = () => {
  // 每次調用時重新檢查環境變數
  console.log('郵件服務配置：', {
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '已設置' : '未設置'
  });

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    debug: true, // 開啟調試模式
    logger: true // 啟用日誌
  });
};

export const sendResetPasswordEmail = async (email, code) => {
  try {
    // 確保環境變數存在
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('郵件配置缺失:', {
        EMAIL_USER: process.env.EMAIL_USER,
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '已設置' : '未設置'
      });
      return false;
    }

    const transporter = getTransporter();

    const mailOptions = {
      from: {
        name: 'Goal Tracker',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: '重置密碼驗證碼',
      html: `
        <h1>重置密碼驗證碼</h1>
        <p>您的重置密碼驗證碼是：<strong>${code}</strong></p>
        <p>此驗證碼將在10分鐘後過期。</p>
        <p>如果這不是您本人的操作，請忽略此郵件。</p>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('發送重置密碼郵件錯誤:', error);
    return false;
  }
}; 