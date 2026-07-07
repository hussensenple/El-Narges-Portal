const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  arcgisId: { 
    // بنسجل الـ ID بتاع خريطة ArcGIS مباشرة هنا عشان لما نيجي نعرضها 
    // في الـ Frontend نخلي الخريطة تعمل Zoom عليها بسهولة
    type: String, 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Resolved'], 
    default: 'Pending' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);