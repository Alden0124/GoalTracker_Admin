import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "GoalTracker-avatars", // 圖片存儲的文件夾名稱
    allowed_formats: ["jpg", "jpeg", "png"], // 允許的文件格式
    transformation: [{ width: 500, height: 500, crop: "limit" }], // 圖片尺寸限制
  },
});

export const upload = multer({ storage: storage });
export { cloudinary };
