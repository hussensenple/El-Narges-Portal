const axios = require('axios');
async function test() {
  try {
    const meters = await axios.get('https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/UN_Map_WFL1/FeatureServer/32/query?where=ASSETGROUP=5&resultRecordCount=1&outSR=4326&f=json');
    const geom = meters.data.features[0].geometry;
    console.log('Meter Geom:', geom);
    
    const query = `geometryType=esriGeometryPoint&geometry={"x":${geom.x},"y":${geom.y},"spatialReference":{"wkid":4326}}&spatialRel=esriSpatialRelIntersects&distance=50&units=esriSRUnit_Meter&inSR=4326&outSR=4326&f=json`;
    
    const bRes = await axios.post('https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1/query', query, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log('Buildings Response:', bRes.data);
  } catch(e) {
    console.log(e);
  }
}
test();
