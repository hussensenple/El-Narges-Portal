const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  title: { type: String, required: true },
  arcgisId: { type: String, default: 'N/A' },
  type: { type: String, enum: ['internal', 'external'], default: 'internal' },
  images: [{ type: String }],
  priority: { type: String, enum: ['Normal', 'High'], default: 'Normal' },
  description: { type: String, required: true },
  coordinates: {
    lat: { type: Number },
    lon: { type: Number }
  },
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Solved', 'Resolved', 'Dismissed'],
    default: 'Pending' 
  },
  problemName: { type: String },
  messages: [{
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderRole: { type: String },
    senderName: { type: String },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // 👈 ده الحقل اللي كان عامل المشكلة، لازم يكون اسمه ownerId
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  assignedSpecialization: { type: String },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' }
  
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);