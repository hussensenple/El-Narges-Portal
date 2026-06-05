const mongoose = require('mongoose');

const bookingRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 👈 مربوط بالعميل
  unitId: { type: Number, required: true }, // 👈 رقم المبنى
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

// 🚀 السحر هنا: امنع نفس العميل (userId) إنه يحجز نفس المبنى (unitId) مرتين
bookingRequestSchema.index({ userId: 1, unitId: 1 }, { unique: true });

module.exports = mongoose.model('BookingRequest', bookingRequestSchema);