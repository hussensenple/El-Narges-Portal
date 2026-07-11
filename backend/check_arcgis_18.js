const axios = require('axios');

async function checkArcGIS() {
    try {
        const VILLAS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8';
        const res = await axios.get(`${VILLAS_URL}/query`, {
            params: {
                where: "OBJECTID = 18",
                outFields: '*',
                f: 'json'
            }
        });
        console.log(res.data.features[0].attributes);
    } catch (e) {
        console.error(e);
    }
}

checkArcGIS();
