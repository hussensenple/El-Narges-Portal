const BookingRequest = require('../models/BookingRequest');
const Unit = require('../models/Unit');
const User = require('../models/User'); 
const { updateArcGISStatus, checkAndUpdateBuildingCompleteness } = require('../services/arcgisService');

exports.approveRequest = async (req, res) => {
  try {
    console.log("=========================================");
    console.log("🟢 1. Starting Approval Process...");
    
    const { requestId } = req.params; 
    const request = await BookingRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ msg: "الطلب غير موجود" });
    }

    const unitGlobalId = String(request.unitId).replace(/[{}]/g, '').trim();

    // 1. تحديث الداتا بيز (MongoDB)
    let updatedUnit = await Unit.findOne({ 
      $or: [
        { globalId: { $regex: new RegExp(`^${unitGlobalId}$`, 'i') } },
        { arcgisId: { $regex: new RegExp(`^${unitGlobalId}$`, 'i') } }
      ]
    });

    if (!updatedUnit) {
      updatedUnit = new Unit({
        globalId: unitGlobalId,
        arcgisId: unitGlobalId,
        unitName: request.sourceLayer === 'Villas_Global' ? 'فيلا' : 'شقة',
        status: '4',
        ownerName: request.customerName,
        ownerEmail: request.customerGmail,
        ownerPhone: request.customerPhone
      });
      await updatedUnit.save();
    } else {
      updatedUnit.status = '4';
      updatedUnit.ownerName = request.customerName;
      updatedUnit.ownerEmail = request.customerGmail;
      updatedUnit.ownerPhone = request.customerPhone;
      await updatedUnit.save();
    }
    console.log("✅ Unit data updated in MongoDB!");

    // 2. 🚀 تحديث الخريطة (ArcGIS) - ده اللي كان متعطل وشغلناه!
    const success = await updateArcGISStatus(
      unitGlobalId, 
      '4', 
      request.customerName, 
      request.customerPhone, 
      request.customerGmail, 
      request.sourceLayer 
    );

    if (!success) {
      console.log("🔴 Error: ArcGIS update failed!");
      return res.status(500).json({ msg: "فشل التزامن مع الخريطة الحية." });
    }

    // 3. التحقق من اكتمال العمارة (لو شقة)
    if (request.sourceLayer === 'Units' && request.buildingFK) {
      checkAndUpdateBuildingCompleteness(request.buildingFK); 
    }

    // 4. تحديث حالة الطلب لـ Approved
    request.status = 'Approved';
    await request.save();
    console.log("🟢 Booking Request status updated to Approved!");

    // 5. ترقية العميل لـ Owner
    if (request.userId) {
      const user = await User.findById(request.userId);
      if (user) {
        if (user.role === 'user') {
          user.role = 'owner';
        }
        if (!user.ownedUnits.includes(updatedUnit._id)) {
          user.ownedUnits.push(updatedUnit._id);
        }
        await user.save();
        console.log("🟢 User promoted to Owner successfully!");
      }
    }

    return res.status(200).json({ msg: "تمت الموافقة وتحديث الخريطة والداتا بيز بنجاح! 🎉" });

  } catch (error) {
    console.error("🚨 Error in approveRequest:", error);
    return res.status(500).json({ error: error.message });
  }
};