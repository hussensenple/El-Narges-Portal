const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: { type: String, required: true },
  arcgisId: { type: String, default: 'N/A' },
  type: { type: String, enum: ['internal', 'external'], default: 'internal' },
  description: { type: String, required: true },
  coordinates: {
    lat: { type: Number },
    lon: { type: Number }
  },
  status: { type: String, default: 'Pending' },
  
  // 👈 ده الحقل اللي كان عامل المشكلة، لازم يكون اسمه ownerId
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);