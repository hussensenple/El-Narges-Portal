const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // ضفنا الجيميل هنا ومينفعش يتكرر
  phone: { type: String, required: true, unique: true }, // رقم التليفون فريد
  password: { type: String, required: true },
  role: { type: String, default: 'user' }, // لو حابين بعدين نعمل حساب للأدمن
  ownedUnits: [{ type: String }] // مصفوفة هتشيل الـ GlobalIDs بتاعة الوحدات (عمارات أو فيلات) اللي هيشتريها
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);