const axios = require('axios');

// دالة تحديث حالة المبنى وبيانات العميل في ArcGIS Online
async function updateArcGISStatus(arcgisObjectId, newStatus, ownerName, ownerPhone) {
  
  // 1. اللينك الحقيقي بتاعك (لاحظ إضافة /0 في النهاية لاستهداف الطبقة مباشرة)
  const featureLayerUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Residential1/FeatureServer/0";

  // 2. تجهيز البيانات بأسماء الحقول المطابقة للصورة بالظبط
  const updates = [{
    attributes: {
      OBJECTID: arcgisObjectId,
      Status: newStatus,          // تأكد إن حقل الحالة اسمه Status
      Customer_Name: ownerName,   // 👈 اتعدلت حسب الداتا بيز بتاعتك
      Customer_Phone: ownerPhone  // 👈 اتعدلت حسب الداتا بيز بتاعتك
    }
  }];

  try {
    const response = await axios.post(`${featureLayerUrl}/applyEdits`, null, {
      params: {
        f: 'json',
        updates: JSON.stringify(updates)
      }
    });

    // بنطبع الرد بالكامل عشان نتأكد إن مفيش إيرور داخلي من Esri
    console.log("✅ رد سيرفر ArcGIS:", JSON.stringify(response.data)); 
    return true;

  } catch (error) {
    console.error("❌ فشل في تحديث ArcGIS:", error.message);
    return false;
  }
}

module.exports = { updateArcGISStatus };