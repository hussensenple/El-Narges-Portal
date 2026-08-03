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
  secondaryEmail: {
    type: String
  },
  secondaryPhone: {
    type: String
  },
  coordinates: {
    lat: { type: Number },
    lon: { type: Number }
  },
  eName: { type: String },
  role: { 
    type: String, 
    enum: ['user', 'owner', 'broker', 'engineer', 'admin'],
    default: 'user' 
  },
  ownedUnits: [{ 
    // هنخزن هنا الـ IDs بتاعت الوحدات عشان نسهل استرجاعها للمالك
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Unit' 
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);