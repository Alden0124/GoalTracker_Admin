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
    unique: true,
    trim: true,
    sparse: true
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    trim: true,
  },
  password: {
    type: String,
    required: function() {
      return !this.providers || this.providers.length === 0;
    }
  },
  providers: {
    type: [String],
    enum: ['google', 'line'],
    default: []
  },
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
  avatar: {
    type: String,
    default: ''
  },
  resetPasswordCode: {
    code: String,
    expiresAt: Date
  },
  providerTokens: {
    google: {
      type: providerTokenSchema,
      required: false
    },
    line: {
      type: providerTokenSchema,
      required: false
    }
  },
  lastSyncAt: Date,
  sessions: {
    type: [sessionSchema],
    default: []
  }
}, {
  timestamps: true
});

userSchema.pre('save', function(next) {
  if (this.providers && this.providers.length > 0) {
    this.providers.forEach(provider => {
      if (!this.providerTokens[provider]) {
        this.providerTokens[provider] = {};
      }
    });
  }
  next();
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
  return this.providers && this.providers.length > 0;
};

userSchema.statics.isThirdPartyEmail = async function(email) {
  const user = await this.findOne({ email });
  return user ? user.isThirdPartyUser() : false;
};

userSchema.methods.needsEmail = function() {
  return !this.email && this.providers.includes('line');
};

userSchema.methods.needsEmailForOperation = function() {
  return !this.email || !this.isEmailVerified;
};

const User = mongoose.model("User", userSchema);

export default User; 