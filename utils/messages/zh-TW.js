export default {
  auth: {
    // 註冊相關
    signupSuccess: "註冊成功",
    signupFailed: "註冊失敗，請稍後再試",
    emailRegistered: "此電子郵件已被註冊",
    missingFields: "請提供完整的註冊資訊",
    missingUsername: "請提供使用者名稱",
    missingEmail: "請提供電子郵件",
    missingPassword: "請提供密碼",
    invalidEmail: "無效的電子郵件格式",
    invalidPassword: "密碼長度必須至少為 6 個字符",
    invalidUsername: "使用者名稱只能包含字母、數字和底線",
    emailNotVerified: "此信箱尚未驗證",
    // 登入相關
    loginSuccess: "登入成功",
    loginFailed: "登入失敗，請稍後再試",
    emailNotRegistered: "此信箱尚未註冊",
    invalidPassword: "密碼錯誤",
    missingCredentials: "請提供電子郵件和密碼",
    accountPasswordError: "帳號或密碼錯誤",
    thirdPartyLoginRequired: "此信箱使用{provider}登入，請使用對應的第三方服務登入",
    
    // 第三方登入
    googleLoginSuccess: "Google 登入成功",
    lineLoginSuccess: "LINE 登入成功",
    unsupportedProvider: "不支援的登入方式",
    missingProviderParams: "缺少必要參數",
    
    // 登出相關
    logoutSuccess: "登出成功",
    logoutError: "登出時發生錯誤",
    missingLogoutToken: "未提供登出令牌",
    userNotFound: "找不到使用者"
  },
  validation: {
    required: "{field}為必填項目",
    invalidFormat: "{field}格式不正確"
    
  },
  goal: {
    missingFields: "請提供目標標題和開始日期",
    createSuccess: "目標創建成功",
    fetchSuccess: "獲取目標列表成功",
    notFound: "找不到該目標",
    unauthorized: "您沒有權限執行此操作",
    updateSuccess: "目標更新成功",
    deleteSuccess: "目標刪除成功",
    likeSuccess: "目標點讚成功",
    unlikeSuccess: "目標取消點讚成功"
  },
  error: {
    serverError: "伺服器錯誤",
    unauthorized: "未授權的請求"
  },
}; 