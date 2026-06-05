const BookingRequest = require('../models/BookingRequest');
const Unit = require('../models/Unit');
const axios = require('axios');

// دالة الموافقة على الطلب
exports.approveRequest = async (req, res) => {
  try {
    // 1. تصحيح استخراج الـ ID بتاع الطلب (بدون تحويل لرقم لأنه ObjectId)
    const { requestId } = req.params; 
    const request = await BookingRequest.findById(requestId);

    if (!request) return res.status(404).json({ msg: "الطلب غير موجود" });

    // 2. تحديث قاعدة البيانات MongoDB (مع تحويل الـ unitId لرقم صحيح)
    const numericUnitId = Number(request.unitId);

    const updatedUnit = await Unit.findOneAndUpdate(
      { arcgisObjectId: numericUnitId }, // 👈 التحويل السحري هنا
      { 
        status: 'Sold', 
        customerName: request.customerName, 
        customerPhone: request.customerPhone 
      },
      { new: true } // عشان يرجعلك الوحدة بعد التحديث تتأكد منها
    );

    // لو ملقاش الوحدة في MongoDB يوقف العملية وميكلمش الخريطة
    if (!updatedUnit) {
      return res.status(404).json({ msg: "الوحدة غير موجودة في قاعدة بيانات MongoDB" });
    }

    request.status = 'Approved';
    await request.save();

    // 3. 🚀 تحديث الخريطة في ArcGIS Online (The GIS Sync)
    const ARCGIS_URL = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Residential1/FeatureServer/0/applyEdits";
    
    const updates = [{
      attributes: {
        OBJECTID: numericUnitId, // نستخدم الرقم الصحيح هنا كمان
        Status: 'Sold',
        Customer_Name: request.customerName,
        Customer_Phone: request.customerPhone
      }
    }];

    await axios.post(ARCGIS_URL, `adds=[]&updates=${JSON.stringify(updates)}&deletes=[]&f=json`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    res.json({ msg: "تمت الموافقة وتحديث قاعدة البيانات والخريطة بنجاح ✅" });
  } catch (err) {
    console.error("Error in approveRequest:", err);
    res.status(500).json({ error: err.message });
  }
};