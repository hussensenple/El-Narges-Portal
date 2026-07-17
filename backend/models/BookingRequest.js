const mongoose = require('mongoose');

const bookingRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  unitId: { type: String, required: true },
  objectId: { type: Number },
  sourceLayer: { type: String, required: true },
  buildingFK: { type: String, default: null },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerGmail: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Reserved', 'Approved', 'Rejected', 'Declined'], default: 'Pending' },
  rejectionReason: { type: String },
  rejectionNotes: { type: String }
}, { timestamps: true });

// منع العميل يحجز نفس الوحدة مرتين وهي لسه قيد المراجعة
bookingRequestSchema.index({ userId: 1, unitId: 1 }, { unique: true });

module.exports = mongoose.model('BookingRequest', bookingRequestSchema);