import mongoose from "mongoose";

const goalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ["進行中", "已完成", "已放棄"],
    default: "進行中",
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: Date,
  isPublic: {
    type: Boolean,
    default: true,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  likeCount: {
    type: Number,
    default: 0,
  },
  progressCommentCount: {
    type: Number,
    default: 0,
  },
  commentCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  lastProgress: {
    type: Date,
  },
  progress: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Progress",
    },
  ],
});

const Goal = mongoose.model("Goal", goalSchema);
export default Goal;
