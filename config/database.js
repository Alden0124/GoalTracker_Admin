import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`MongoDB 連接成功: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB 連接失敗:", error);
    process.exit(1);
  }
};

// 監聽數據庫連接事件
mongoose.connection.on("connected", () => {
  console.log("Mongoose 已連接");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose 連接錯誤:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose 連接中斷");
});

// 程序終止時關閉數據庫連接
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("應用程序終止，關閉數據庫連接");
  process.exit(0);
});

export default connectDB;
