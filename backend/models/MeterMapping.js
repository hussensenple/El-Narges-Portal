const mongoose = require('mongoose');

const meterMappingSchema = new mongoose.Schema({
  meterId: { 
    type: Number, 
    required: true, 
    unique: true 
  }, // The OBJECTID of the meter in ArcGIS Water Devices Layer
  buildingGlobalId: { 
    type: String, 
    required: true 
  }, // The GlobalID of the intersecting building/villa in ArcGIS
  buildingType: { 
    type: String, 
    enum: ['building', 'villa'] 
  }
}, { timestamps: true });

module.exports = mongoose.model('MeterMapping', meterMappingSchema);
