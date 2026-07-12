const BookingRequest = require('../models/BookingRequest');
const Unit = require('../models/Unit');
const User = require('../models/User'); 
const { updateArcGISStatus, checkAndUpdateBuildingCompleteness } = require('../services/arcgisService');
const { sendBookingEmail } = require('../utils/emailService');

exports.brokerReviewRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, reason } = req.body; // 'raise' or 'decline'
    
    const request = await BookingRequest.findById(requestId).populate('userId', 'name email');
    if (!request) return res.status(404).json({ msg: "Request not found" });

    const unitGlobalId = String(request.unitId).replace(/[{}]/g, '').trim();

    if (action === 'raise') {
      request.status = 'Reserved';
      await request.save();
      
      // Update ArcGIS to Reserved (3)
      await updateArcGISStatus(unitGlobalId, '3', '', '', '', request.sourceLayer);

      let updatedUnit = await Unit.findOne({ 
        $or: [
          { globalId: { $regex: new RegExp(`^${unitGlobalId}$`, 'i') } },
          { arcgisId: { $regex: new RegExp(`^${unitGlobalId}$`, 'i') } }
        ]
      });
      if (updatedUnit) {
          updatedUnit.status = '3';
          await updatedUnit.save();
      }
      
      const io = req.app.get('socketio');
      if (io) io.emit('newBookingRequest');

      return res.status(200).json({ msg: "Request raised to admin successfully" });
    } else if (action === 'decline') {
      request.status = 'Declined';
      await request.save();

      await sendBookingEmail(request.userId.email, request.userId.name, 'Declined', request.objectId || request.unitId, reason);

      const io = req.app.get('socketio');
      if (io) io.emit('newBookingRequest');

      return res.status(200).json({ msg: "Request declined successfully and customer notified" });
    } else {
      return res.status(400).json({ msg: "Unknown action" });
    }
  } catch (error) {
    console.error("🚨 Error in brokerReviewRequest:", error);
    return res.status(500).json({ error: error.message });
  }
};
exports.approveRequest = async (req, res) => {
  try {
    console.log("=========================================");
    console.log("🟢 1. Starting Approval Process...");
    
    const { requestId } = req.params; 
    const request = await BookingRequest.findById(requestId).populate('userId', 'name email');
    if (!request) {
      return res.status(404).json({ msg: "Request not found" });
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
        unitName: request.sourceLayer === 'Villas_Global' ? 'Villa' : 'Apartment',
        status: '4',
        ownerId: request.userId,
        ownerName: request.customerName,
        ownerEmail: request.customerGmail,
        ownerPhone: request.customerPhone,
        sourceLayer: request.sourceLayer,
        objectId: request.objectId
      });
      await updatedUnit.save();
    } else {
      updatedUnit.status = '4';
      updatedUnit.ownerId = request.userId;
      updatedUnit.ownerName = request.customerName;
      updatedUnit.ownerEmail = request.customerGmail;
      updatedUnit.ownerPhone = request.customerPhone;
      updatedUnit.sourceLayer = request.sourceLayer;
      updatedUnit.objectId = request.objectId;
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
      return res.status(500).json({ msg: "Failed to sync with live map." });
    }

    if (request.sourceLayer === 'Units' && request.buildingFK) {
      checkAndUpdateBuildingCompleteness(request.buildingFK, unitGlobalId, 'Sold'); 
    }

    // 4. تحديث حالة الطلب لـ Approved
    request.status = 'Approved';
    await request.save();
    console.log("🟢 Booking Request status updated to Approved!");

    // 5. ترقية العميل لـ Owner
    if (request.userId) {
      const user = await User.findById(request.userId._id);
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

    // 6. Send Approval Email
    await sendBookingEmail(request.userId.email, request.userId.name, 'Approved', request.objectId || request.unitId);

    // 7. Delete or Reject all other requests for this unit
    await BookingRequest.deleteMany({
      unitId: request.unitId,
      _id: { $ne: request._id }
    });
    console.log("🟢 All other requests for this unit have been removed.");

    return res.status(200).json({ msg: "Approved and synced with map successfully! 🎉" });

  } catch (error) {
    console.error("🚨 Error in approveRequest:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.adminRejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    
    const request = await BookingRequest.findById(requestId).populate('userId', 'name email');
    if (!request) return res.status(404).json({ msg: "Request not found" });

    request.status = 'Rejected';
    await request.save();

    const unitGlobalId = String(request.unitId).replace(/[{}]/g, '').trim();
    // Update ArcGIS back to Available (1)
    await updateArcGISStatus(unitGlobalId, '1', '', '', '', request.sourceLayer);

    let updatedUnit = await Unit.findOne({ 
      $or: [
        { globalId: { $regex: new RegExp(`^${unitGlobalId}$`, 'i') } },
        { arcgisId: { $regex: new RegExp(`^${unitGlobalId}$`, 'i') } }
      ]
    });
    if (updatedUnit) {
        updatedUnit.status = '1';
        await updatedUnit.save();
    }

    // Send Rejection Email
    await sendBookingEmail(request.userId.email, request.userId.name, 'Rejected', request.objectId || request.unitId, reason);

    return res.status(200).json({ msg: "Request rejected successfully and customer notified" });
  } catch (error) {
    console.error("🚨 Error in adminRejectRequest:", error);
    return res.status(500).json({ error: error.message });
  }
};