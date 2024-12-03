import mongoose from "mongoose";

const providerTokenSchema = new mongoose.Schema({
  accessToken: String,
  refreshToken: String,
  expiresAt: Date,
  userId: String
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  refreshToken: String,
  deviceInfo: String,
  lastUsed: {
    type: Date,
    default: Date.now
  },
  expiresAt: Date
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    trim: true
  },
  oauthName: {  // 新增 oauthName 欄位
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: function() {
      return !this.providers || this.providers.length === 0;
    },
    sparse: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: function() {
      return !this.providers || this.providers.length === 0;
    }
  },
  providers: [{
    type: String,
    enum: ['line', 'google', 'local']
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  refreshToken: String,
  verificationCode: {
    code: String,
    expiresAt: Date
  },
  isEmailVerified: {
    type: Boolean,
    default: function() {
      return this.providers ? this.providers.includes('google') : false;
    }
  },
  localEmailVerified: {  // 新增欄位
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: ''
  },
  thirdPartyAvatar: {  // 新增欄位
    type: String,
    default: ''
  },
  resetPasswordCode: {
    code: String,
    expiresAt: Date
  },
  providerTokens: {
    line: {
      userId: {
        type: String,
        sparse: true,
        index: true
      },
      accessToken: String,
      refreshToken: String,
      expiresIn: Number,
      expiresAt: Date
    },
    google: {
      userId: {
        type: String,
        sparse: true,
        index: true
      },
      accessToken: String,
      refreshToken: String,
      expiresAt: Date
    }
  },
  lastSyncAt: Date,
  sessions: {
    type: [sessionSchema],
    default: []
  },
  location: {    // 新增居住地
    type: String,
    trim: true,
    default: ''
  },
  occupation: {    // 新增職稱
    type: String,
    trim: true,
    default: ''
  },
  education: {   // 新增學歷
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});


userSchema.methods.hasProvider = function(provider) {
  return this.providers.includes(provider) && 
         this.providerTokens[provider] && 
         this.providerTokens[provider].userId;
};

userSchema.methods.canResetPassword = function() {
  return !this.providers || this.providers.length === 0;
};

userSchema.methods.needsEmailVerification = function() {
  return !this.isEmailVerified && (!this.providers || !this.providers.includes('google'));
};

userSchema.methods.isThirdPartyUser = function() {
  return this.providers && 
         this.providers.length > 0 && 
         !this.providers.includes('local');
};

userSchema.statics.isThirdPartyEmail = async function(email) {
  const user = await this.findOne({ email });
  if (!user) return false;
  return user.providers.some(provider => ['google', 'line'].includes(provider));
};

userSchema.methods.needsEmail = function() {
  return !this.email && this.providers.includes('line');
};

userSchema.methods.needsEmailForOperation = function() {
  return !this.email || !this.isEmailVerified;
};

userSchema.index({ 'providerTokens.line.userId': 1 }, { 
  unique: true, 
  sparse: true,
  background: true,
});

userSchema.index({ 'providerTokens.google.userId': 1 }, { 
  unique: true,
  sparse: true,
  background: true
});

userSchema.methods.hasLineAccount = function() {
  return this.providers.includes('line') && 
         this.providerTokens?.line?.userId;
};

const User = mongoose.model("User", userSchema);

User.collection.dropIndex("username_1")
  .then(() => console.log('成功刪除 username 唯一索引'))
  .catch(err => {
    if (err.code !== 27) { // 27 是索引不存在的錯誤代碼
      console.error('刪除索引時發生錯誤:', err);
    }
  });

export default User; 