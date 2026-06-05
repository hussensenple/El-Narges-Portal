const express = require('express');
const router = express.Router();
const BookingRequest = require('../models/BookingRequest'); 
const { updateArcGISStatus } = require('../services/arcgisService'); // 👈 استدعاء دالة ArcGIS
const Unit = require('../models/Unit'); // 👈 استدعاء موديل الوحدات

// 1. راوت جلب كل الطلبات المعلقة (عشان نعرضها في جدول الأدمن)
router.get('/pending', async (req, res) => {
  try {
    const requests = await BookingRequest.find({ status: 'Pending' }).populate('userId', 'name phone');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب الطلبات' });
  }
});

// 2. راوت الموافقة على الطلب
router.post('/approve/:requestId', async (req, res) => {
  const { requestId } = req.params;
  
  try {
    const approvedRequest = await BookingRequest.findById(requestId).populate('userId');
    if (!approvedRequest) return res.status(404).json({ msg: "الطلب غير موجود" });

    const { unitId, userId } = approvedRequest;

    // أ. تحديث الطلب الحالي لـ Approved
    approvedRequest.status = 'Approved';
    await approvedRequest.save();

    // ب. رفض باقي الطلبات لنفس الوحدة
    await BookingRequest.updateMany(
      { unitId, _id: { $ne: requestId } },
      { status: 'Rejected' }
    );

    // ج. إرسال التحديث لـ ArcGIS Online 
    await updateArcGISStatus(unitId, "Sold", userId.name, userId.phone); 

    // 🚀 د. التعديل الجديد: تحديث حالة الوحدة لـ Sold في MongoDB مع تحويل نوع البيانات
    const updatedUnit = await Unit.findOneAndUpdate(
      { arcgisObjectId: Number(unitId) }, // 👈 التحويل لرقم Number() عشان يطابق الداتا بيز
      { 
        status: 'Sold',
        customerName: userId.name,  // تأكد إن ده مش undefined
        customerPhone: userId.phone // تأكد إن ده مش undefined
      }, 
      { new: true, runValidators: true }
    );

    // التحقق من التحديث في الـ Terminal
    if(!updatedUnit) {
        console.log(`⚠️ تحذير: لم يتم العثور على الوحدة رقم ${unitId} في MongoDB لتحديثها!`);
    } else {
        console.log(`✅ تم تحديث حالة الوحدة ${unitId} إلى Sold في MongoDB بنجاح`);
    }

    res.json({ msg: "تمت الموافقة وتحديث الخريطة وقاعدة البيانات بنجاح" });
  } catch (error) {
    console.error("خطأ في عملية الموافقة:", error);
    res.status(500).json({ error: "فشل في إتمام العملية" });
  }
});

// 3. 🗑️ راوت مسح الطلب نهائياً من قاعدة البيانات
router.delete('/request/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // بندور على الطلب بالـ ID وبنمسحه
    const deletedRequest = await BookingRequest.findByIdAndDelete(id);
    
    if (!deletedRequest) {
      return res.status(404).json({ message: "الطلب غير موجود أصلاً" });
    }

    res.status(200).json({ message: "تم مسح الطلب بنجاح" });
  } catch (error) {
    console.error("خطأ في مسح الطلب:", error);
    res.status(500).json({ message: "حدث خطأ أثناء محاولة المسح" });
  }
});

module.exports = router;