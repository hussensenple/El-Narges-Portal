const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  // 1. دي الحقول اللي كانت بتترمي عشان مش متعرفة
  globalId: { type: String }, 
  arcgisId: { type: String },
  unitName: { type: String },
  status: { type: String, default: "1" }, 
  ownerName: { type: String },  
  ownerEmail: { type: String }, 
  ownerPhone: { type: String }, 
  buildingIdFk: { type: String },
  sourceLayer: { type: String },
  objectId: { type: Number },
  floorNumber: { type: Number },
  
  // 2. ودي الحقول القديمة بتاعتك زي ما هي
  ownerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  brokerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  }
}, { 
  timestamps: true, 
  strict: false // 🚀 السحر كله هنا: هيخلي الداتا بيز تقبل أي حقل وتخزنه فوراً
}); 

module.exports = mongoose.model('Unit', unitSchema);