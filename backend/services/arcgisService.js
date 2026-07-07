const axios = require('axios');

async function updateArcGISStatus(arcgisObjectId, newStatus, ownerName, ownerPhone, ownerGmail, sourceLayer) {
  
  const layerUrls = {
    "Units": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37",
    "Buildings_Global": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1",
    "Villas_Global": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8" 
  };

  // تنظيف اسم الطبقة من أي مسافات أو أخطاء إملائية ممكن تيجي من الفرونت إند
  const cleanSourceLayer = String(sourceLayer).trim();
  const featureLayerUrl = layerUrls[cleanSourceLayer];
  
  if (!featureLayerUrl) {
    console.error(`❌ الطبقة غير معروفة: '${cleanSourceLayer}'`);
    return false;
  }

  let statusCode = (newStatus === 'Sold' || newStatus === '4') ? 4 : parseInt(newStatus);

  try {
    if (cleanSourceLayer === "Units") {
      const numericId = Number(arcgisObjectId);
      
      console.log(`\n========================================`);
      console.log(`🚨 مسار التحديث: updateFeatures (للشقق فقط)`);
      console.log(`🚨 الطبقة: ${cleanSourceLayer} | ID: ${numericId}`);
      console.log(`========================================\n`);
      
      const featuresPayload = [{
        attributes: {
          OBJECTID: numericId,         
          Status: statusCode,          
          Owner_Name: ownerName,       
          Owner_Phone: ownerPhone,     
          Gmail: ownerGmail            
        }
      }];

      const formData = new URLSearchParams();
      formData.append('f', 'json');
      formData.append('features', JSON.stringify(featuresPayload));

      const response = await axios.post(`${featureLayerUrl}/updateFeatures`, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data.error) {
          console.error(`❌ ArcGIS Error (Units):`, JSON.stringify(response.data.error));
          return false;
      }
      console.log(`✅ ArcGIS Updated Successfully: Units`); 
      return true;
    } 
    else {
      console.log(`\n========================================`);
      console.log(`🚨 مسار التحديث: applyEdits (للفلل والمباني)`);
      console.log(`🚨 الطبقة: ${cleanSourceLayer}`);
      console.log(`========================================\n`);
      
      const isGuid = String(arcgisObjectId).includes('-');
      const updatesPayload = [{
        attributes: {
          [isGuid ? "GlobalID" : "OBJECTID"]: isGuid ? String(arcgisObjectId) : Number(arcgisObjectId),
          Status: statusCode,          
          Owner_Name: ownerName,       
          Owner_Phone: ownerPhone,     
          Gmail: ownerGmail            
        }
      }];

      const formData = new URLSearchParams();
      formData.append('f', 'json');
      formData.append('updates', JSON.stringify(updatesPayload));
      
      if (isGuid) {
        formData.append('useGlobalIds', 'true');
      }

      const response = await axios.post(`${featureLayerUrl}/applyEdits`, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data.error) {
          console.error(`❌ ArcGIS Error (${cleanSourceLayer}):`, JSON.stringify(response.data.error));
          return false;
      }
      console.log(`✅ ArcGIS Updated Successfully: ${cleanSourceLayer}`); 
      return true;
    }

  } catch (error) {
    console.error("❌ Request Crashed:", error.message);
    return false;
  }
}

async function checkAndUpdateBuildingCompleteness(buildingFK) {
  if (!buildingFK) return;

  const unitsLayerUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37";
  const buildingsLayerUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1"; 

  try {
    const unitsRes = await axios.get(`${unitsLayerUrl}/query`, {
      params: {
        where: `BuildingID_FK = '${buildingFK}'`,
        outFields: 'Status',
        f: 'json'
      }
    });

    const units = unitsRes.data.features;
    if (!units || units.length === 0) return;

    const allSold = units.every(u => u.attributes.Status === 'Sold' || u.attributes.Status === '4' || u.attributes.Status === 4 || u.attributes.Status === 3);

    if (allSold) {
      const bldgRes = await axios.get(`${buildingsLayerUrl}/query`, {
        params: {
          where: `GlobalID = '${buildingFK}'`,
          outFields: 'OBJECTID',
          f: 'json'
        }
      });

      const bldgFeatures = bldgRes.data.features;
      if (bldgFeatures && bldgFeatures.length > 0) {
        const bldgObjectId = bldgFeatures[0].attributes.OBJECTID;
        await updateArcGISStatus(bldgObjectId, 'Sold', 'Multiple Owners', 'N/A', 'N/A', 'Buildings_Global');
      }
    }
  } catch (err) {
    console.error("❌ فشل التحقق من حالة العمارة:", err.message);
  }
}

module.exports = {
  updateArcGISStatus,
  checkAndUpdateBuildingCompleteness
};