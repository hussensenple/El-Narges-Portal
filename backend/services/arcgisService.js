const axios = require('axios');

async function updateArcGISStatus(arcgisObjectId, newStatus, ownerName, ownerPhone, ownerGmail, sourceLayer) {
  
  // 1. تعريف مسارات الطبقات (تأكد إن رقم لينك الفيلات صحيح، غالباً هيكون 0)
  const layerUrls = {
    "Units": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37",
    "Buildings_Global": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1",
    "Villas_Global": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/0" // 👈 لينك الفيلات
  };

  const featureLayerUrl = layerUrls[sourceLayer];

  if (!featureLayerUrl) {
    console.error("❌ الطبقة غير معروفة:", sourceLayer);
    return false;
  }

  // 2. تحويل الحالة من نص إلى رقم (Domain Codes)
  let statusCode = 1; // 1 = Available
  if (newStatus === 'Reserved') statusCode = 2;
  if (newStatus === 'Sold') statusCode = 3;

  // 1. نرجع الحالة لـ نص زي ما كانت شغالة معاك في النسخة القديمة
  // داخل updateArcGISStatus
  const updates = [{
    attributes: {
      GlobalID: arcgisObjectId,    // 👈 استخدام GlobalID (يجب أن يكون String)
      Status: statusCode,          // 👈 العودة لاستخدام الأرقام للـ Domain
      Owner_Name: ownerName,       
      Owner_Phone: ownerPhone,     
      Gmail: ownerGmail            
    }
  }];

  try {
    const response = await axios.post(`${featureLayerUrl}/applyEdits`, null, {
      params: {
        f: 'json',
        updates: JSON.stringify(updates)
      }
    });

    const result = response.data.updateResults && response.data.updateResults[0];
    
    // 🚀 السطر ده هو اللي هيجيب من الآخر ويفك لغز الـ [Object]
    if (result && result.success === false) {
       console.error("❌ سبب رفض ArcGIS بالظبط هو:", JSON.stringify(result.error, null, 2));
       return false;
    }

    console.log(`✅ تم تحديث ${sourceLayer} بنجاح في الخريطة!`); 
    return true;

  } catch (error) {
    console.error("❌ فشل الاتصال بسيرفر ArcGIS:", error.message);
    return false;
  }
}

async function checkAndUpdateBuildingCompleteness(buildingFK) {
  if (!buildingFK) return;

  const unitsLayerUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37";
  const buildingsLayerUrl = "حط_لينك_طبقة_المباني_الجديد_هنا"; // ⚠️ متنساش تحط لينك العمارات الحقيقي

  try {
    // 1. نجيب كل الشقق اللي جوه العمارة دي
    const unitsRes = await axios.get(`${unitsLayerUrl}/query`, {
      params: {
        where: `BuildingID_FK = '${buildingFK}'`,
        outFields: 'Status',
        f: 'json'
      }
    });

    const units = unitsRes.data.features;
    if (!units || units.length === 0) return;

    // 2. هل كل الشقق (الـ 5) حالتهم 3 (Sold)؟
    const allSold = units.every(u => u.attributes.Status === 3);

    if (allSold) {
      // 3. لو كلهم اتباعوا، نجيب الـ OBJECTID بتاع العمارة الأم
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

        // 4. نحدث العمارة نفسها ونخليها Sold
        console.log(`🏢 جميع الشقق في العمارة ${buildingFK} تم بيعها! تحويل العمارة لـ Sold...`);
        await updateArcGISStatus(bldgObjectId, 'Sold', 'Multiple Owners', 'N/A', 'N/A', 'Buildings_Global');
      }
    }
  } catch (err) {
    console.error("❌ فشل التحقق من حالة العمارة المكتملة:", err.message);
  }
}

// 🚀 متنساش تعمل Export للدالتين في آخر الملف
module.exports = { updateArcGISStatus, checkAndUpdateBuildingCompleteness };

module.exports = { updateArcGISStatus };