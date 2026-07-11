require('dotenv').config();
const axios = require('axios');

// Check current status of unit 668 in ArcGIS
async function checkStatus() {
  const url = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37/query';
  const res = await axios.get(url, {
    params: {
      where: 'OBJECTID = 668',
      outFields: 'OBJECTID,Status,Owner_Name,Owner_Phone,Gmail',
      f: 'json'
    }
  });
  console.log('Unit 668 in ArcGIS:', JSON.stringify(res.data.features?.[0]?.attributes, null, 2));
  process.exit(0);
}
checkStatus().catch(console.error);
