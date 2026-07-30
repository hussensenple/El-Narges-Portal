const mongoose = require('mongoose');

const AdminChatSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: 'New Chat'
  },
  messages: [{
    sender: {
      type: String,
      enum: ['user', 'ai'],
      required: true
    },
    text: {
      type: String,
      required: true
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

module.exports = mongoose.model('AdminChat', AdminChatSchema);
