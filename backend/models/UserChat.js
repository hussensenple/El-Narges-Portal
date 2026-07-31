const mongoose = require('mongoose');

const UserChatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    default: 'New Chat'
  },
  messages: [{
    sender: {
      type: String,
      enum: ['user', 'ai', 'model'],
      required: true
    },
    text: {
      type: String,
      required: true
    },
    action: {
      type: String,
      default: null
    },
    actionUnitId: {
      type: String,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  isPinned: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('UserChat', UserChatSchema);
