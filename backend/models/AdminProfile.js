const mongoose = require('mongoose');

const adminProfileSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  manualId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  age: { 
    type: Number 
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminProfile', adminProfileSchema);
