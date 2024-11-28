import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  commentType: {
    type: String,
    required: true,
    enum: ['progress', 'comment']
  },
  goal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Goal",
    required: true
  },
  progress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Progress"
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment"
  },
  depth: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

commentSchema.index({ goal: 1, commentType: 1 });
commentSchema.index({ progress: 1, commentType: 1 });
commentSchema.index({ parentComment: 1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment; 