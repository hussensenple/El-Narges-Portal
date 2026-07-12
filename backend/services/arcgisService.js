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

  let statusCode = String(newStatus);
  if (statusCode.toLowerCase() === 'available') statusCode = '1';
  if (statusCode.toLowerCase() === 'interested') statusCode = '2';
  if (statusCode.toLowerCase() === 'reserved') statusCode = '3';
  if (statusCode.toLowerCase() === 'sold') statusCode = '4';
  try {
    if (cleanSourceLayer === "Units") {
      const numericId = Number(arcgisObjectId);
      
      console.log(`\n========================================`);
      console.log(`🚨 مسار التحديث: updateFeatures (للشقق فقط)`);
      console.log(`🚨 الطبقة: ${cleanSourceLayer} | ID: ${numericId}`);
      console.log(`========================================\n`);
      
      const attributes = {
        OBJECTID: numericId,         
        Status: statusCode
      };
      if (ownerName !== undefined) attributes.Owner_Name = ownerName === null ? "" : ownerName;
      if (ownerPhone !== undefined) attributes.Owner_Phone = ownerPhone === null ? "" : ownerPhone;
      if (ownerGmail !== undefined) attributes.Gmail = ownerGmail === null ? "" : ownerGmail;

      const featuresPayload = [{ attributes }];

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
      if (response.data.updateResults && response.data.updateResults.length > 0) {
          const res = response.data.updateResults[0];
          if (res.success === false) {
              console.error(`❌ ArcGIS Update Failed (Units):`, JSON.stringify(res.error));
              return false;
          }
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
      const attributes = {
        [isGuid ? "GlobalID" : "OBJECTID"]: isGuid ? String(arcgisObjectId) : Number(arcgisObjectId),
        Status: statusCode
      };
      if (ownerName !== undefined) attributes.Owner_Name = ownerName === null ? "" : ownerName;
      if (ownerPhone !== undefined) attributes.Owner_Phone = ownerPhone === null ? "" : ownerPhone;
      if (ownerGmail !== undefined) attributes.Owner_Gmail = ownerGmail === null ? "" : ownerGmail;

      const updatesPayload = [{ attributes }];

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
      if (response.data.updateResults && response.data.updateResults.length > 0) {
          const res = response.data.updateResults[0];
          if (res.success === false) {
              console.error(`❌ ArcGIS Update Failed (${cleanSourceLayer}):`, JSON.stringify(res.error));
              return false;
          }
      }
      console.log(`✅ ArcGIS Updated Successfully: ${cleanSourceLayer}`); 
      return true;
    }

  } catch (error) {
    console.error("❌ Request Crashed:", error.message);
    return false;
  }
}

async function updateArcGISPrice(arcgisObjectId, newPrice, sourceLayer) {
  const layerUrls = {
    "Units": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37",
    "Buildings_Global": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1",
    "Villas_Global": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8" 
  };

  const cleanSourceLayer = String(sourceLayer).trim();
  const featureLayerUrl = layerUrls[cleanSourceLayer];
  
  if (!featureLayerUrl) {
    console.error(`❌ الطبقة غير معروفة: '${cleanSourceLayer}'`);
    return false;
  }

  try {
    if (cleanSourceLayer === "Units") {
      const numericId = Number(arcgisObjectId);
      const attributes = {
        OBJECTID: numericId,         
        Price: Number(newPrice)
      };

      const featuresPayload = [{ attributes }];

      const formData = new URLSearchParams();
      formData.append('f', 'json');
      formData.append('features', JSON.stringify(featuresPayload));

      const response = await axios.post(`${featureLayerUrl}/updateFeatures`, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data.error) return false;
      return true;
    } else {
      const isGuid = String(arcgisObjectId).includes('-');
      const attributes = {
        [isGuid ? "GlobalID" : "OBJECTID"]: isGuid ? String(arcgisObjectId) : Number(arcgisObjectId),
        Price: Number(newPrice)
      };

      const updatesPayload = [{ attributes }];

      const formData = new URLSearchParams();
      formData.append('f', 'json');
      formData.append('updates', JSON.stringify(updatesPayload));
      
      if (isGuid) formData.append('useGlobalIds', 'true');

      const response = await axios.post(`${featureLayerUrl}/applyEdits`, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data.error) return false;
      return true;
    }
  } catch (error) {
    console.error("❌ Request Crashed:", error.message);
    return false;
  }
}

async function checkAndUpdateBuildingCompleteness(buildingFK, changedUnitId = null, changedUnitNewStatus = null) {
  if (!buildingFK) return;

  const unitsLayerUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37";
  const buildingsLayerUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1"; 

  try {
    const unitsRes = await axios.get(`${unitsLayerUrl}/query`, {
      params: {
        where: `BuildingID_FK = '${buildingFK}'`,
        outFields: 'OBJECTID,Status',
        f: 'json'
      }
    });

    const units = unitsRes.data.features;
    if (!units || units.length === 0) return;

    // Apply the override for the recently changed unit to bypass ArcGIS index delay
    if (changedUnitId !== null && changedUnitNewStatus !== null) {
      const targetUnit = units.find(u => Number(u.attributes.OBJECTID) === Number(changedUnitId));
      if (targetUnit) {
        targetUnit.attributes.Status = changedUnitNewStatus;
      }
    }

    const allSold = units.every(u => u.attributes.Status === 'Sold' || u.attributes.Status === '4' || u.attributes.Status === 4 || u.attributes.Status === 3);

    const bldgRes = await axios.get(`${buildingsLayerUrl}/query`, {
      params: {
        where: `GlobalID = '${buildingFK}'`,
        outFields: 'OBJECTID,Status',
        f: 'json'
      }
    });

    const bldgFeatures = bldgRes.data.features;
    if (bldgFeatures && bldgFeatures.length > 0) {
      const bldgObjectId = bldgFeatures[0].attributes.OBJECTID;
      const bldgStatus = bldgFeatures[0].attributes.Status;
      
      console.log(`[checkAndUpdateBuildingCompleteness] Building ${bldgObjectId} | allSold=${allSold} | current bldgStatus=${bldgStatus}`);

      if (allSold) {
        await updateArcGISStatus(bldgObjectId, 'Sold', 'Multiple Owners', 'N/A', 'N/A', 'Buildings_Global');
      } else {
        // Revert to Available if it was Sold
        if (bldgStatus === 'Sold' || bldgStatus === '4' || bldgStatus == 4 || bldgStatus === '3' || bldgStatus == 3) {
          console.log(`[checkAndUpdateBuildingCompleteness] Reverting building ${bldgObjectId} to Available...`);
          await updateArcGISStatus(bldgObjectId, 'Available', null, null, null, 'Buildings_Global');
        } else {
          console.log(`[checkAndUpdateBuildingCompleteness] Building is already not sold (${bldgStatus}), skipping revert.`);
        }
      }
    }
  } catch (err) {
    console.error("❌ فشل التحقق من حالة العمارة:", err.message);
  }
}

module.exports = {
  updateArcGISStatus,
  checkAndUpdateBuildingCompleteness,
  updateArcGISPrice
};