const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  arcgisObjectId: { type: Number, required: true, unique: true },
  unitType: { type: String, default: 'Building' },
  floor: { type: Number, default: 0 },
  status: { type: String, default: 'Available' },
  totalPrice: { type: Number, default: null },
  // 👇 الحقول الجديدة اللي اكتشفناها
  customerName: { type: String, default: null },
  customerPhone: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Unit', unitSchema);