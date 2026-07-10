const axios = require('axios');
const w = "Status = '1' OR Status = 'Available'";
axios.get('https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37/query', { params: { where: w, outFields: 'OBJECTID,Status', f: 'json' } }).then(r=>console.log(r.data.error || r.data.features?.length)).catch(console.error);
