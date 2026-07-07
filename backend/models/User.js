const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  phone: { 
    type: String, 
    required: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['user', 'owner', 'broker', 'admin'], 
    default: 'user' 
  },
  ownedUnits: [{ 
    // هنخزن هنا الـ IDs بتاعت الوحدات عشان نسهل استرجاعها للمالك
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Unit' 
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);