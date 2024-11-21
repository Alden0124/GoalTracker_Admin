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
    required: function() {
      return !this.providers || !this.providers.includes('line');
    },
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
    default: false
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
      default: () => ({})
    },
    line: {
      type: providerTokenSchema,
      default: () => ({})
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
  if (!this.providerTokens) {
    this.providerTokens = {
      google: {},
      line: {}
    };
  }
  
  if (!this.providerTokens.google) {
    this.providerTokens.google = {};
  }
  
  if (!this.providerTokens.line) {
    this.providerTokens.line = {};
  }
  
  next();
});

const User = mongoose.model("User", userSchema);

export default User; 