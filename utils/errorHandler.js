import debug from 'debug';
const debugLog = debug('app:error');

// 未捕獲的 Promise 異常處理
process.on('unhandledRejection', (reason, promise) => {
  debugLog('未處理的 Promise 拒絕:', reason);
  // 記錄錯誤，但不中止程序
});

// 未捕獲的異常處理
process.on('uncaughtException', (error) => {
  debugLog('未捕獲的異常:', error);
  // 記錄錯誤後優雅地關閉應用
  gracefulShutdown();
});

// 優雅關閉
const gracefulShutdown = async () => {
  debugLog('開始優雅關閉程序...');
  try {
    // 關閉資料庫連接
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      debugLog('資料庫連接已關閉');
    }
    
    // 設定超時強制關閉
    setTimeout(() => {
      debugLog('強制關閉程序');
      process.exit(1);
    }, 10000).unref();

    // 正常關閉
    process.exit(0);
  } catch (error) {
    debugLog('關閉過程發生錯誤:', error);
    process.exit(1);
  }
}; 