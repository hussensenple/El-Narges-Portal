require('dotenv').config();
const mongoose = require('mongoose');
const Unit = require('./models/Unit');
const axios = require('axios');

const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
const VILLAS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  // Get all units with ownerId/brokerId but no sourceLayer
  const units = await Unit.find({ 
    $or: [{ ownerId: { $ne: null } }, { brokerId: { $ne: null } }],
    sourceLayer: { $exists: false }
  });
  
  console.log(`Found ${units.length} units missing sourceLayer`);

  // Get all OBJECTID values from the Units (Apartments) layer
  const unitsLayerRes = await axios.get(`${UNITS_URL}/query`, {
    params: { where: '1=1', outFields: 'OBJECTID', f: 'json' }
  });
  const apartmentIds = new Set((unitsLayerRes.data.features || []).map(f => String(f.attributes.OBJECTID)));
  
  // Get all GlobalIDs from the Villas layer
  const villasLayerRes = await axios.get(`${VILLAS_URL}/query`, {
    params: { where: '1=1', outFields: 'GlobalID', f: 'json' }
  });
  const villaIds = new Set((villasLayerRes.data.features || []).map(f => f.attributes.GlobalID));

  let fixed = 0;
  for (const unit of units) {
    let layer = null;
    if (apartmentIds.has(unit.arcgisId)) {
      layer = 'Units';
    } else if (villaIds.has(unit.arcgisId)) {
      layer = 'Villas_Global';
    }
    if (layer) {
      unit.sourceLayer = layer;
      await unit.save();
      console.log(`Fixed unit ${unit.arcgisId} -> ${layer}`);
      fixed++;
    } else {
      console.log(`Could not determine layer for unit ${unit.arcgisId}`);
    }
  }
  
  console.log(`\nFixed ${fixed}/${units.length} units.`);
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
