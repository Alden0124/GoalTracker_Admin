import multer from "multer";

// Multer 錯誤處理中間件
export const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: '文件大小不能超過 5MB' });
    }
    return res.status(400).json({ message: '文件上傳錯誤' });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// 可以添加其他錯誤處理中間件
export const handleGeneralError = (err, req, res, next) => {
  console.error('一般錯誤:', err);
  res.status(500).json({ message: '伺服器錯誤' });
}; 