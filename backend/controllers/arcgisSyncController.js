const axios = require('axios');
const User = require('../models/User');
const Unit = require('../models/Unit');

const ARCGIS_USERS_LAYER_URL = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Users/FeatureServer/0";

const calculateUserStats = async (user) => {
  let stats = {
    unitsCount: 0,
    totalValue: 0,
    brokerTotalUnits: 0,
    brokerSoldUnits: 0,
    brokerAvailableUnits: 0,
    brokerReservedUnits: 0,
    brokerTotalValue: 0,
    brokerSoldValue: 0,
    brokerAvailableValue: 0,
    brokerReservedValue: 0
  };

  try {
    let unitsToCalculate = [];
    
    if (user.role === 'owner') {
      const ownedUnits = await Unit.find({ ownerId: user._id });
      stats.unitsCount = ownedUnits.length;
      unitsToCalculate = ownedUnits;
    } else if (user.role === 'broker') {
      const assignedUnits = await Unit.find({ brokerId: user._id });
      stats.brokerTotalUnits = assignedUnits.length;
      stats.brokerAvailableUnits = assignedUnits.filter(u => String(u.status) === '1').length;
      stats.brokerReservedUnits = assignedUnits.filter(u => String(u.status) === '3').length;
      stats.brokerSoldUnits = assignedUnits.filter(u => String(u.status) === '4').length;
      unitsToCalculate = assignedUnits;
    }

    if (unitsToCalculate.length > 0) {
      const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
      const VILLAS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8';

      const apartments = unitsToCalculate.filter(u => u.sourceLayer === 'Units');
      const villas = unitsToCalculate.filter(u => u.sourceLayer === 'Villas_Global');

      const priceMap = {};

      if (apartments.length > 0) {
        const ids = apartments.map(u => u.objectId || u.arcgisId).filter(id => id);
        if (ids.length > 0) {
          const payload = new URLSearchParams();
          payload.append('where', `OBJECTID IN (${ids.join(',')})`);
          payload.append('outFields', 'OBJECTID,Price');
          payload.append('f', 'json');
          
          const unitsRes = await axios.post(`${UNITS_URL}/query`, payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          (unitsRes.data.features || []).forEach(f => {
            if (f.attributes.Price) {
              priceMap[`Units_${f.attributes.OBJECTID}`] = Number(f.attributes.Price);
            }
          });
        }
      }

      if (villas.length > 0) {
        const ids = villas.map(u => u.arcgisId).filter(id => id);
        if (ids.length > 0) {
          const formattedIds = ids.map(id => `'${id}'`).join(',');
          const payload = new URLSearchParams();
          payload.append('where', `GlobalID IN (${formattedIds})`);
          payload.append('outFields', 'GlobalID,Price');
          payload.append('f', 'json');

          const villasRes = await axios.post(`${VILLAS_URL}/query`, payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          (villasRes.data.features || []).forEach(f => {
            if (f.attributes.Price) {
              priceMap[`Villas_Global_${f.attributes.GlobalID}`] = Number(f.attributes.Price);
            }
          });
        }
      }

      unitsToCalculate.forEach(u => {
        const id = u.sourceLayer === 'Villas_Global' ? u.arcgisId : (u.objectId || u.arcgisId);
        const price = priceMap[`${u.sourceLayer}_${id}`] || 0;

        if (user.role === 'owner') {
          stats.totalValue += price;
        } else if (user.role === 'broker') {
          stats.brokerTotalValue += price;
          if (String(u.status) === '1') stats.brokerAvailableValue += price;
          else if (String(u.status) === '3') stats.brokerReservedValue += price;
          else if (String(u.status) === '4') stats.brokerSoldValue += price;
        }
      });
    }

    return stats;
  } catch (err) {
    console.error("Error calculating user stats:", err.message);
    return stats;
  }
};

// دالة لمزامنة مستخدم جديد لحظياً (تُستدعى عند إنشاء حساب)
const syncUserToArcGIS = async (user) => {
  try {
    if (!user.coordinates || !user.coordinates.lat || !user.coordinates.lon) {
      console.log(`[ArcGIS Sync] User ${user.name} has no coordinates. Skipping sync.`);
      return;
    }

    const stats = await calculateUserStats(user);

    const feature = {
      geometry: {
        x: user.coordinates.lon,
        y: user.coordinates.lat,
        spatialReference: { wkid: 4326 }
      },
      attributes: {
        Name: user.name,
        E_Name: user.eName || '',
        Role: user.role,
        Phone: user.phone,
        JoinDate: new Date(user.createdAt || Date.now()).getTime(),
        UnitsCount: stats.unitsCount,
        TotalValue: stats.totalValue,
        BrokerTotalUnits: stats.brokerTotalUnits,
        BrokerSoldUnits: stats.brokerSoldUnits,
        BrokerAvailableUnits: stats.brokerAvailableUnits,
        BrokerReservedUnits: stats.brokerReservedUnits,
        BrokerTotalValue: stats.brokerTotalValue,
        BrokerSoldValue: stats.brokerSoldValue,
        BrokerAvailableValue: stats.brokerAvailableValue,
        BrokerReservedValue: stats.brokerReservedValue
      }
    };

    const payload = new URLSearchParams();
    payload.append('f', 'json');
    payload.append('adds', JSON.stringify([feature]));

    const response = await axios.post(`${ARCGIS_USERS_LAYER_URL}/applyEdits`, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (response.data && response.data.addResults && response.data.addResults[0].success) {
      console.log(`✅ [ArcGIS Sync] Successfully synced user ${user.name} to AGOL.`);
    } else {
      console.error(`❌ [ArcGIS Sync] Failed to sync user ${user.name}:`, response.data);
    }
  } catch (error) {
    console.error(`❌ [ArcGIS Sync] Error syncing user ${user.name}:`, error.message);
  }
};

// دالة لتحديث بيانات ودور المستخدم لحظياً (تُستدعى عند التعديل أو الترقية)
const syncUserUpdateToArcGIS = async (user) => {
  try {
    // 1. البحث عن المستخدم في ArcGIS باستخدام رقم الهاتف
    const queryPayload = new URLSearchParams();
    queryPayload.append('f', 'json');
    queryPayload.append('where', `Phone = '${user.phone}'`);
    queryPayload.append('outFields', 'OBJECTID');
    queryPayload.append('returnGeometry', 'false');

    const queryResponse = await axios.post(`${ARCGIS_USERS_LAYER_URL}/query`, queryPayload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (queryResponse.data && queryResponse.data.features && queryResponse.data.features.length > 0) {
      const objectId = queryResponse.data.features[0].attributes.OBJECTID;

      const stats = await calculateUserStats(user);

      // 2. تحديث البيانات (الـ Role والاسم ورقم الهاتف والموقع والإحصائيات)
      const feature = {
        attributes: {
          OBJECTID: objectId,
          Role: user.role,
          Name: user.name,
          E_Name: user.eName || '',
          Phone: user.phone,
          UnitsCount: stats.unitsCount,
          TotalValue: stats.totalValue,
          BrokerTotalUnits: stats.brokerTotalUnits,
          BrokerSoldUnits: stats.brokerSoldUnits,
          BrokerAvailableUnits: stats.brokerAvailableUnits,
          BrokerReservedUnits: stats.brokerReservedUnits,
          BrokerTotalValue: stats.brokerTotalValue,
          BrokerSoldValue: stats.brokerSoldValue,
          BrokerAvailableValue: stats.brokerAvailableValue,
          BrokerReservedValue: stats.brokerReservedValue
        }
      };

      if (user.coordinates && user.coordinates.lat && user.coordinates.lon) {
        feature.geometry = {
          x: user.coordinates.lon,
          y: user.coordinates.lat,
          spatialReference: { wkid: 4326 }
        };
      }

      const updatePayload = new URLSearchParams();
      updatePayload.append('f', 'json');
      updatePayload.append('updates', JSON.stringify([feature]));

      const updateResponse = await axios.post(`${ARCGIS_USERS_LAYER_URL}/applyEdits`, updatePayload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (updateResponse.data && updateResponse.data.updateResults && updateResponse.data.updateResults[0].success) {
        console.log(`✅ [ArcGIS Sync] Successfully updated role for user ${user.name} on AGOL.`);
      } else {
        console.error(`❌ [ArcGIS Sync] Failed to update role for user ${user.name}:`, updateResponse.data);
      }
    } else {
      console.log(`⚠️ [ArcGIS Sync] User ${user.name} not found on AGOL by phone. Trying to sync as new.`);
      await syncUserToArcGIS(user);
    }
  } catch (error) {
    console.error(`❌ [ArcGIS Sync] Error updating role for user ${user.name}:`, error.message);
  }
};

// مسار للتزامن الشامل لجميع المستخدمين (لتحديث الإحصائيات بأثر رجعي)
const bulkSyncUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['owner', 'broker'] } });
    
    // Process them sequentially to avoid hammering the ArcGIS API too hard
    let successCount = 0;
    for (const user of users) {
      try {
        await syncUserUpdateToArcGIS(user);
        successCount++;
      } catch (e) {
        console.error(`Failed to sync user ${user.name}`, e);
      }
    }

    res.status(200).json({ msg: `✅ Successfully synced and updated stats for ${successCount} out of ${users.length} users to ArcGIS.` });
  } catch (error) {
    console.error("Bulk Sync Error:", error);
    res.status(500).json({ msg: "حدث خطأ أثناء المزامنة الشاملة." });
  }
};

module.exports = { syncUserToArcGIS, syncUserUpdateToArcGIS, bulkSyncUsers };
