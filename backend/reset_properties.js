require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('./models/User');
const Unit = require('./models/Unit');

async function resetArcGISLayer(url, layerName, exceptionIds, isGuid) {
  try {
    const res = await axios.get(`${url}/query`, {
      params: { where: '1=1', outFields: isGuid ? 'GlobalID' : 'OBJECTID', f: 'json' }
    });
    const features = res.data.features;
    if (!features) return;

    let updates = [];
    for (const f of features) {
      const id = isGuid ? f.attributes.GlobalID : f.attributes.OBJECTID;
      // Skip if this unit is owned by the exception user
      if (exceptionIds.includes(String(id))) continue;

      updates.push({
        attributes: {
          [isGuid ? 'GlobalID' : 'OBJECTID']: id,
          Status: 1, // Available
          Owner_Name: null,
          Owner_Phone: null,
          Gmail: null
        }
      });
    }

    if (updates.length === 0) return;

    // ArcGIS updateFeatures/applyEdits has limits, but let's try pushing all at once
    const formData = new URLSearchParams();
    formData.append('f', 'json');
    if (layerName === 'Units') {
        formData.append('features', JSON.stringify(updates));
        const updateRes = await axios.post(`${url}/updateFeatures`, formData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (updateRes.data.error) console.error(`Error updating ${layerName}:`, updateRes.data.error);
        else console.log(`Successfully reset ${updates.length} items in ${layerName}`);
    } else {
        formData.append('updates', JSON.stringify(updates));
        if (isGuid) formData.append('useGlobalIds', 'true');
        const updateRes = await axios.post(`${url}/applyEdits`, formData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (updateRes.data.error) console.error(`Error updating ${layerName}:`, updateRes.data.error);
        else console.log(`Successfully reset ${updates.length} items in ${layerName}`);
    }

  } catch (err) {
    console.error(`Error resetting layer ${layerName}:`, err.message);
  }
}

async function runReset() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // 1. Find the target owner
  const amgad = await User.findOne({ name: 'Amgad Ashraf Hamed' }).populate('ownedUnits');
  if (!amgad) {
    console.log('Could not find user Amgad Ashraf Hamed');
    process.exit(1);
  }

  const exceptionArcgisIds = (amgad.ownedUnits || []).map(u => String(u.arcgisId));
  console.log(`Found ${exceptionArcgisIds.length} properties owned by Amgad`);

  // 2. Reset MongoDB
  const result = await Unit.updateMany(
    { arcgisId: { $nin: exceptionArcgisIds } },
    { $set: { status: '1', ownerId: null, brokerId: null } }
  );
  console.log(`Reset ${result.modifiedCount} units in MongoDB`);
  
  // 3. Cleanup other users' ownedUnits array
  const allUsers = await User.find({ _id: { $ne: amgad._id }, role: { $in: ['owner', 'user'] } });
  for (const u of allUsers) {
      if (u.ownedUnits && u.ownedUnits.length > 0) {
          await User.findByIdAndUpdate(u._id, { ownedUnits: [], role: 'user' });
      }
  }
  console.log('Cleaned up other users in MongoDB');

  // 4. Reset ArcGIS Layers
  const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
  const VILLAS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8';
  
  console.log('Resetting ArcGIS Units...');
  await resetArcGISLayer(UNITS_URL, 'Units', exceptionArcgisIds, false);
  
  console.log('Resetting ArcGIS Villas...');
  await resetArcGISLayer(VILLAS_URL, 'Villas_Global', exceptionArcgisIds, true);

  console.log('Reset complete!');
  process.exit(0);
}

runReset().catch(console.error);
