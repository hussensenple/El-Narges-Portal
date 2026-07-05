const BookingRequest = require('../models/BookingRequest');
const Unit = require('../models/Unit');
// 🚀 استدعاء الدوال مرة واحدة فقط بشكل صحيح
const { updateArcGISStatus, checkAndUpdateBuildingCompleteness } = require('../services/arcgisService');

// دالة الموافقة على الطلب
exports.approveRequest = async (req, res) => {
  try {
    // 1. استخراج الـ ID بتاع الطلب من الرابط
    const { requestId } = req.params; 
    const request = await BookingRequest.findById(requestId);

    if (!request) return res.status(404).json({ msg: "الطلب غير موجود" });

    // 2. تحديث قاعدة البيانات MongoDB
    const numericUnitId = Number(request.unitId);

    const updatedUnit = await Unit.findOneAndUpdate(
      { arcgisObjectId: numericUnitId },
      { 
        status: 'Sold', 
        customerName: request.customerName, 
        customerPhone: request.customerPhone,
        customerGmail: request.customerGmail 
      },
      { new: true }
    );

    if (!updatedUnit) {
      return res.status(404).json({ msg: "الوحدة غير موجودة في قاعدة بيانات MongoDB" });
    }

    request.status = 'Approved';
    await request.save();

    // 3. تحديث حالة الوحدة أو الشقة في ArcGIS Online
    const success = await updateArcGISStatus(
      numericUnitId, 
      'Sold', 
      request.customerName, 
      request.customerPhone, 
      request.customerGmail, 
      request.sourceLayer 
    );

    if (!success) {
      return res.status(500).json({ msg: "تم التحديث محلياً ولكن فشل التزامن مع الخريطة، يرجى مراجعة روابط ArcGIS" });
    }

    // 4. 🚀 فحص اكتمال بيع العمارة (لو الطلب كان لشقة مش فيلا)
    // لاحظ إننا بنشيك على buildingFK اللي ضفناه في الـ schema
    if (request.sourceLayer === 'Units' && request.buildingFK) {
      // بتشتغل في الخلفية بدون await عشان متأخرش الـ Response للعميل
      checkAndUpdateBuildingCompleteness(request.buildingFK); 
    }

    res.json({ msg: "تمت الموافقة وتحديث قاعدة البيانات والخريطة بنجاح ✅" });
  } catch (err) {
    console.error("Error in approveRequest:", err);
    res.status(500).json({ error: err.message });
  }
};