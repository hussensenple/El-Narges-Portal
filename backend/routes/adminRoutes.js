const express = require('express');
const router = express.Router();
const BookingRequest = require('../models/BookingRequest'); 
const axios = require('axios');

// 1. قاموس اللينكات (حط اللينكات اللي جبتها من الأونلاين هنا)
const LAYER_URLS = {
  "Villas_Global": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8", 
  "Units": "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37" 
};

router.get('/pending', async (req, res) => {
  try {
    const requests = await BookingRequest.find({ status: 'Pending' }).populate('userId', 'name phone');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب الطلبات' });
  }
});

router.post('/approve/:requestId', async (req, res) => {
  const { requestId } = req.params;
  
  try {
    const approvedRequest = await BookingRequest.findById(requestId).populate('userId');
    if (!approvedRequest) return res.status(404).json({ msg: "الطلب غير موجود" });

    const { unitId, sourceLayer, userId } = approvedRequest;

    // 1. تحديث الطلب في MongoDB
    approvedRequest.status = 'Approved';
    await approvedRequest.save();

    // 2. رفض باقي الطلبات لنفس الوحدة
    await BookingRequest.updateMany(
      { unitId, _id: { $ne: requestId } },
      { status: 'Rejected' }
    );

    // 3. تحديد اللينك الصح بناءً على الطبقة
    const featureLayerUrl = LAYER_URLS[sourceLayer];
    if (!featureLayerUrl) {
       return res.status(400).json({ msg: "اسم الطبقة غير معروف للسيرفر" });
    }

    // 4. تحديث الخريطة في ArcGIS Online باستخدام الـ GlobalID
    const updates = [{
      attributes: {
        GlobalID: unitId, 
        Status: 'Sold', // تأكد إن القيمة دي مطابقة للـ Domain عندك (لو أرقام خليها 2 مثلاً)
        Owner_Name: userId.name,  // أسماء الحقول بناءً على هيكل بيانات الفيلات
        Owner_Phone: userId.phone 
      }
    }];

    // إرسال الطلب لـ Esri مع تفعيل useGlobalIds
    const arcgisPayload = `useGlobalIds=true&adds=[]&updates=${JSON.stringify(updates)}&deletes=[]&f=json`;

    const arcgisResponse = await axios.post(`${featureLayerUrl}/applyEdits`, arcgisPayload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (arcgisResponse.data.updateResults && arcgisResponse.data.updateResults[0].success) {
      console.log(`✅ تم تحديث الوحدة ${unitId} في طبقة ${sourceLayer} بنجاح`);
    } else {
      console.log(`⚠️ فشل التحديث في الخريطة:`, arcgisResponse.data);
    }

    res.json({ msg: "تمت الموافقة وتحديث الخريطة بنجاح ✅" });
  } catch (error) {
    console.error("خطأ في عملية الموافقة:", error);
    res.status(500).json({ error: "فشل في إتمام العملية" });
  }
});

router.delete('/request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRequest = await BookingRequest.findByIdAndDelete(id);
    if (!deletedRequest) {
      return res.status(404).json({ message: "الطلب غير موجود أصلاً" });
    }
    res.status(200).json({ message: "تم مسح الطلب بنجاح" });
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء محاولة المسح" });
  }
});

module.exports = router;