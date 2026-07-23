const mongoose = require('mongoose');

const technicianSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  age: { type: Number, required: true },
  specialization: { 
    type: String, 
    enum: [
      'Plumbing (سباكة)', 
      'Electrical (كهرباء)', 
      'Carpentry (نجارة)', 
      'HVAC / Air Conditioning (تكييف وتبريد)', 
      'Landscaping / Agriculture (زراعة ولاند سكيب)', 
      'Structural / Construction (إنشاءات ومباني)', 
      'Sanitation / Cleaning (نظافة وصرف صحي)',
      'Elevators (مصاعد)',
      'Infrastructure (بنية تحتية / شبكات المياه)',
      'Other (أخرى)'
    ],
    required: true 
  },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Technician', technicianSchema);
