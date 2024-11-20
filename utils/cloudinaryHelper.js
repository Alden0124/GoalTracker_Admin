import { v2 as cloudinary } from 'cloudinary';

// 設置 Cloudinary 日誌級別
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  log_level: process.env.CLOUDINARY_LOG_LEVEL || 'error'
});

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'user-avatars';

// 刪除 Cloudinary 圖片
export const deleteCloudinaryImage = async (publicId) => {
  try {
    if (!publicId) return { success: false, message: '未提供 public_id' };
    
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      return { success: true };
    } else {
      console.error('圖片刪除失敗:', result);
      return { success: false, message: '圖片刪除失敗' };
    }
  } catch (error) {
    console.error('刪除 Cloudinary 圖片時出錯:', error);
    return { success: false, message: '刪除圖片時發生錯誤', error };
  }
};

// 從 Cloudinary URL 提取 public_id
export const getPublicIdFromUrl = (url) => {
  try {
    if (!url) return null;
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const publicId = filename.split('.')[0];
    return `user-avatars/${publicId}`; // 確保與上傳時的 folder 設置一致
  } catch (error) {
    console.error('提取 public_id 時出錯:', error);
    return null;
  }
};

// 處理圖片上傳錯誤
export const handleUploadError = async (file) => {
  if (file && file.public_id) {
    const deleteResult = await deleteCloudinaryImage(file.public_id);
    if (!deleteResult.success) {
      console.error('清理失敗的上傳時出錯:', deleteResult.message);
    }
  }
}; 