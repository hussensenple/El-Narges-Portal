const Unit = require('../models/Unit');
const BookingRequest = require('../models/BookingRequest');
const User = require('../models/User');
const axios = require('axios');

exports.getDashboardStats = async (req, res) => {
  try {
    const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
    const VILLAS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8';
    const BUILDINGS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1';

    const { extent } = req.query;
    let parsedExtent = null;
    if (extent) {
      try {
        parsedExtent = JSON.parse(extent);
      } catch (e) {
        console.error('Error parsing extent:', e);
      }
    }

    const baseStatsQuery = {
      groupByFieldsForStatistics: 'Status',
      outStatistics: JSON.stringify([
        {statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'count'},
        {statisticType: 'sum', onStatisticField: 'Price', outStatisticFieldName: 'totalPrice'}
      ]),
      f: 'json'
    };

    let unitsRes, villasRes;

    if (parsedExtent) {
      const geometry = JSON.stringify(parsedExtent);
      
      const villaQuery = { ...baseStatsQuery, geometry, geometryType: 'esriGeometryEnvelope', spatialRel: 'esriSpatialRelIntersects', where: '1=1' };
      
      const buildingsQuery = {
        geometry,
        geometryType: 'esriGeometryEnvelope',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'GlobalID,globalid',
        returnGeometry: false,
        where: '1=1',
        f: 'json'
      };
      
      // START VILLAS AND BUILDINGS IN PARALLEL
      const villasPromise = axios.post(`${VILLAS_URL}/query`, new URLSearchParams(villaQuery).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const buildingsPromise = axios.post(`${BUILDINGS_URL}/query`, new URLSearchParams(buildingsQuery).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      
      const buildRes = await buildingsPromise;
      const buildingIds = (buildRes.data.features || []).map(f => f.attributes.GlobalID || f.attributes.globalid).filter(id => id);
      
      let unitsWhere = '1=2'; // false condition
      if (buildRes.data.exceededTransferLimit || buildingIds.length >= 1000) {
        // If we hit the max record count, it means the user zoomed out to view almost everything.
        // Fall back to global stats for units to avoid inaccurate data and huge IN clauses.
        unitsWhere = '1=1';
      } else if (buildingIds.length > 0) {
        const idList = buildingIds.map(id => `'${id}'`).join(',');
        unitsWhere = `BuildingID_FK IN (${idList})`;
      }
      const unitQuery = { ...baseStatsQuery, where: unitsWhere };

      const unitsPromise = axios.post(`${UNITS_URL}/query`, new URLSearchParams(unitQuery).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      unitsRes = await unitsPromise;
      villasRes = await villasPromise;
    } else {
      const globalQuery = { ...baseStatsQuery, where: '1=1' };
      [unitsRes, villasRes] = await Promise.all([
        axios.get(`${UNITS_URL}/query`, { params: globalQuery }),
        axios.get(`${VILLAS_URL}/query`, { params: globalQuery })
      ]);
    }

    let aptAvailable = 0, aptReserved = 0, aptSold = 0;
    let villaAvailable = 0, villaReserved = 0, villaSold = 0;
    let totalRevenueRaw = 0;

    const parseFeatures = (features, isVilla) => {
      features.forEach(f => {
        const attrs = f.attributes;
        const status = attrs.Status ? attrs.Status.toString().toLowerCase().trim() : '';
        const count = attrs.count || 0;
        const price = attrs.totalPrice || 0;

        if (status === '1' || status === 'available') {
          if (isVilla) villaAvailable += count; else aptAvailable += count;
        } else if (status === '3' || status === 'reserved') {
          if (isVilla) villaReserved += count; else aptReserved += count;
        } else if (status === '4' || status === 'sold') {
          if (isVilla) villaSold += count; else aptSold += count;
          totalRevenueRaw += price;
        }
      });
    };

    parseFeatures(unitsRes.data.features || [], false);
    parseFeatures(villasRes.data.features || [], true);

    const totalSoldUnits = aptSold + villaSold;
    const totalAvailableUnits = aptAvailable + villaAvailable;
    const totalReservedUnits = aptReserved + villaReserved;
    const revenueMEGP = parseFloat((totalRevenueRaw / 1000000).toFixed(2));

    const barChartData = [
      { name: 'Villa', Available: villaAvailable, Sold: villaSold, Reserved: villaReserved },
      { name: 'Apartment', Available: aptAvailable, Sold: aptSold, Reserved: aptReserved }
    ];

    const pieChartData = [
      { name: 'Sold Apartments', value: aptSold },
      { name: 'Sold Villas', value: villaSold }
    ];

    // 2. Recent Sales
    const recentSalesRequests = await BookingRequest.find({ status: 'Approved' })
      .sort({ updatedAt: -1 })
      .limit(10);
    
    const recentSales = await Promise.all(recentSalesRequests.map(async (req) => {
      let price = 'N/A';
      try {
        if (req.sourceLayer === 'Units' && req.objectId) {
          const res = await axios.get(`${UNITS_URL}/query`, { params: { where: `OBJECTID=${req.objectId}`, outFields: 'Price', f: 'json' } });
          if (res.data.features && res.data.features.length > 0) {
            price = res.data.features[0].attributes.Price;
          }
        } else if (req.sourceLayer === 'Villas_Global' && req.unitId) {
          const res = await axios.get(`${VILLAS_URL}/query`, { params: { where: `GlobalID='${req.unitId}'`, outFields: 'Price', f: 'json' } });
          if (res.data.features && res.data.features.length > 0) {
            price = res.data.features[0].attributes.Price;
          }
        }
      } catch(e) { console.error('Error fetching price for recent sale'); }

      return {
        _id: req._id,
        customerName: req.customerName,
        type: req.sourceLayer === 'Units' ? 'Apartment' : 'Villa',
        unitId: req.objectId || req.unitId.substring(0, 8),
        price: price !== 'N/A' ? (price / 1000000).toFixed(2) + ' M' : 'N/A',
        date: req.updatedAt
      };
    }));

    // 3. Broker Performance Leaderboard
    const brokers = await User.find({ role: 'broker' }).select('name');
    const allUnits = await Unit.find({ brokerId: { $ne: null } }).select('brokerId arcgisId globalId status');
    const allRequests = await BookingRequest.find({}).select('unitId status');

    const [allApts, allVillas] = await Promise.all([
      axios.get(`${UNITS_URL}/query`, { params: { where: '1=1', outFields: 'OBJECTID,GlobalID,totalPrice', returnGeometry: false, f: 'json' } }),
      axios.get(`${VILLAS_URL}/query`, { params: { where: '1=1', outFields: 'OBJECTID,GlobalID,totalPrice', returnGeometry: false, f: 'json' } })
    ]);
    const agolPriceMap = {};
    [...(allApts.data.features || []), ...(allVillas.data.features || [])].forEach(f => {
      const attrs = f.attributes;
      if (attrs.OBJECTID) agolPriceMap[attrs.OBJECTID.toString()] = attrs.totalPrice || 0;
      if (attrs.GlobalID) agolPriceMap[attrs.GlobalID] = attrs.totalPrice || 0;
    });

    const topBrokers = brokers.map(broker => {
      const brokerUnits = allUnits.filter(u => u.brokerId && u.brokerId.toString() === broker._id.toString());
      const brokerUnitIds = brokerUnits.map(u => u.arcgisId).concat(brokerUnits.map(u => u.globalId).filter(id => id));

      const brokerRequests = allRequests.filter(req => brokerUnitIds.includes(req.unitId));

      let totalRequests = brokerRequests.length;
      let sold = 0;
      let brokerRevenueRaw = 0;
      let declined = 0;
      let raisedToAdmin = 0;

      brokerUnits.forEach(u => {
        if (u.status === '4') {
          sold++;
          const price = (u.arcgisId && agolPriceMap[u.arcgisId.toString()]) || (u.globalId && agolPriceMap[u.globalId]) || 0;
          brokerRevenueRaw += price;
        }
      });

      brokerRequests.forEach(r => {
        if (r.status === 'Declined') {
          declined++;
        }
        if (r.status === 'Reserved' || r.status === 'Approved' || r.status === 'Rejected') {
          raisedToAdmin++;
        }
      });

      return {
        _id: broker._id,
        name: broker.name,
        revenue: parseFloat((brokerRevenueRaw / 1000000).toFixed(2)),
        totalRequests,
        sold,
        declined,
        raisedToAdmin
      };
    }).sort((a, b) => b.revenue - a.revenue || b.sold - a.sold);

    res.status(200).json({
      indicators: {
        totalRevenue: revenueMEGP,
        totalSoldUnits,
        totalAvailableUnits,
        totalReservedUnits
      },
      barChartData,
      pieChartData,
      recentSales,
      topBrokers
    });

  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

exports.getRegionsStats = async (req, res) => {
  try {
    const raisedRequests = await BookingRequest.find({
      status: { $in: ['Reserved', 'Approved', 'Rejected'] }
    });
    const userIds = [...new Set(raisedRequests.map(r => r.userId.toString()))];

    const clients = await User.find({
      $or: [
        { role: 'owner' },
        { _id: { $in: userIds } }
      ]
    }).select('name email phone governorate countryStatus role ownedUnits').populate('ownedUnits');

    const stats = {};
    clients.forEach(client => {
      if (client.countryStatus === 'Egypt' && client.governorate) {
        const gov = client.governorate;
        if (!stats[gov]) {
          stats[gov] = { governorate: gov, count: 0, clients: [] };
        }
        stats[gov].count += 1;
        stats[gov].clients.push(client);
      }
    });

    const sortedStats = Object.values(stats).sort((a, b) => b.count - a.count);
    res.status(200).json(sortedStats);
  } catch (error) {
    console.error('getRegionsStats error:', error);
    res.status(500).json({ error: 'Failed to fetch regional stats' });
  }
};
