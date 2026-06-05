const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // رقم التليفون فريد عشان ميعملش أكتر من حساب
  password: { type: String, required: true },
  role: { type: String, default: 'user' } // لو حابين بعدين نعمل حساب للأدمن
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);