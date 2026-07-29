const express = require('express');
const router = express.Router();
const BookingRequest = require('../models/BookingRequest'); 

// 🚀 استيراد الكنترولر العبقري اللي تعبنا فيه وبيعمل كل حاجة صح
const { approveRequest, adminRejectRequest } = require('../controllers/bookingController');
const { getDashboardStats, getRegionsStats } = require('../controllers/adminController');

// 0. Dashboard Stats
router.get('/dashboard-stats', getDashboardStats);
router.get('/regions-stats', getRegionsStats);

// 0.5 Fetch all MongoDB units for Admin/Engineer Sidebar
router.get('/all-units', async (req, res) => {
  try {
    const Unit = require('../models/Unit');
    // populate ownerId so we can get name, email, phone on the frontend
    const units = await Unit.find().populate('ownerId', 'name email phone');
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

// 0.6 Fetch all users for chatbot mentions
router.get('/users/all', async (req, res) => {
  try {
    const User = require('../models/User');
    const users = await User.find().select('name role');
    res.json(users.map(u => ({ username: u.name, role: u.role, _id: u._id })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 1. جلب الطلبات المعلقة للوحة الأدمن
router.get('/pending', async (req, res) => {
  try {
    const requests = await BookingRequest.find({ status: 'Reserved' }).populate('userId', 'name phone');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'خطأ في جلب الطلبات' });
  }
});

// 1b. Rejection Analysis — all rejected/declined requests sorted newest first
router.get('/rejection-analysis', async (req, res) => {
  try {
    const rejections = await BookingRequest.find({
      status: { $in: ['Rejected', 'Declined'] }
    })
      .populate('userId', 'name email')
      .sort({ updatedAt: -1 });
    res.json(rejections);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rejection data' });
  }
});

// 2. 🚀 توجيه زرار الموافقة للكنترولر الصح (اللي بيحدث MongoDB و AGOL ويرقي العميل)
router.post('/approve/:requestId', async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const approvedRequest = await BookingRequest.findById(requestId);
    
    if (approvedRequest) {
      // 💡 الميزة اللي كانت في كودك القديم: رفض باقي الطلبات لنفس الوحدة عشان متتباعش لمرتين
      await BookingRequest.updateMany(
        { unitId: approvedRequest.unitId, _id: { $ne: requestId } },
        { status: 'Rejected' }
      );
    }
    
    // تمرير الطلب للكنترولر الأساسي عشان يكمل باقي الشغل النظيف
    next();
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث الطلبات الأخرى" });
  }
}, approveRequest);


// 3. مسح الطلب المرفوض (او رفضه من الادمن)
router.post('/reject/:requestId', adminRejectRequest);

// 4. مسح نهائي (لو لسه محتاجينها)
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

// 5. Update Property Price
const { updateArcGISPrice, bulkUpdateArcGISPrices } = require('../services/arcgisService');

router.post('/update-price', async (req, res) => {
  try {
    const { arcgisObjectId, newPrice, sourceLayer } = req.body;
    
    if (!arcgisObjectId || newPrice === undefined || !sourceLayer) {
      return res.status(400).json({ message: "بيانات غير مكتملة" });
    }

    const success = await updateArcGISPrice(arcgisObjectId, newPrice, sourceLayer);

    if (success) {
      res.status(200).json({ message: "تم تحديث السعر بنجاح" });
    } else {
      res.status(500).json({ message: "فشل في تحديث السعر على الخريطة" });
    }
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء تحديث السعر" });
  }
});

// 6. Bulk Update Property Prices by Model
router.post('/bulk-update-price', async (req, res) => {
  try {
    const { modelType, propertyType, newPrice } = req.body;
    if (!modelType || !propertyType || newPrice === undefined) {
      return res.status(400).json({ message: 'Incomplete data provided' });
    }

    const axios = require('axios');
    let targetIds = [];
    let sourceLayer = '';

    if (propertyType.toLowerCase() === 'villa') {
      sourceLayer = 'Villas_Global';
      const vMap = { 'StandAlone': '1', 'TwinHouse': '2', 'TownHouse': '3' };
      const modelCode = vMap[modelType] || modelType;
      
      const villasUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8/query";
      const queryRes = await axios.get(villasUrl, {
        params: { where: `VillaModel = '${modelCode}' AND (Status = 1 OR Status = 'Available')`, outFields: 'GlobalID', f: 'json' }
      });
      
      if (queryRes.data.features) {
        targetIds = queryRes.data.features.map(f => f.attributes.GlobalID);
      }
    } else if (propertyType.toLowerCase() === 'apartment') {
      sourceLayer = 'Units';
      const bMap = { 'ModelX': '1', 'ModelU': '2', 'ModelS': '3', 'ModelZ': '4' };
      const modelCode = bMap[modelType] || modelType;

      const buildingsUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1/query";
      const bRes = await axios.get(buildingsUrl, {
        params: { where: `BuildingModel = '${modelCode}'`, outFields: 'GlobalID', f: 'json' }
      });

      if (bRes.data.features && bRes.data.features.length > 0) {
        const bIds = bRes.data.features.map(f => `'${f.attributes.GlobalID}'`).join(',');
        
        const unitsUrl = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37/query";
        // To avoid extremely long URL, we can batch the BuildingID_FK queries, but for ~100 buildings it's usually fine.
        // Let's do it via POST to ArcGIS to avoid URI too long errors.
        const formData = new URLSearchParams();
        formData.append('where', `BuildingID_FK IN (${bIds}) AND (Status = 1 OR Status = 'Available')`);
        formData.append('outFields', 'OBJECTID');
        formData.append('f', 'json');

        const uRes = await axios.post(unitsUrl, formData.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        if (uRes.data.features) {
          targetIds = uRes.data.features.map(f => f.attributes.OBJECTID);
        }
      }
    }

    if (targetIds.length === 0) {
      return res.status(404).json({ message: "No matching units found" });
    }

    const success = await bulkUpdateArcGISPrices(targetIds, newPrice, sourceLayer);

    if (success) {
      res.status(200).json({ message: `Successfully updated the prices of ${targetIds.length} units.` });
    } else {
      res.status(500).json({ message: "Failed to update prices on the map." });
    }
  } catch (error) {
    console.error("Bulk Update Error:", error);
    res.status(500).json({ message: "An error occurred during bulk update." });
  }
});

module.exports = router;