/**
 * syncBookingPrices.js
 * ─────────────────────────────────────────────────────────────────
 * One-time script: Fetches real unit prices from ArcGIS and
 * updates every BookingRequest in MongoDB with the correct price.
 *
 * Run with:  node scripts/syncBookingPrices.js
 * ─────────────────────────────────────────────────────────────────
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');

const MONGO_URI = process.env.MONGO_URI;

const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37/query';
const VILLAS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8/query';

async function fetchArcGISPrices(url, objectIds) {
  if (!objectIds.length) return {};
  const priceMap = {};
  try {
    const res = await axios.get(url, {
      params: {
        where: `OBJECTID IN (${objectIds.join(',')})`,
        outFields: 'OBJECTID,Price',
        f: 'json'
      }
    });
    (res.data.features || []).forEach(f => {
      priceMap[f.attributes.OBJECTID] = Number(f.attributes.Price) || 0;
    });
  } catch (e) {
    console.error('ArcGIS fetch error:', e.message);
  }
  return priceMap;
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const BR = mongoose.model(
    'BookingRequest',
    new mongoose.Schema({}, { strict: false }),
    'bookingrequests'
  );

  const allRequests = await BR.find({}, { objectId: 1, sourceLayer: 1, price: 1, customerName: 1 });
  console.log(`📋 Found ${allRequests.length} booking requests`);

  // Separate Units vs Villas
  const unitRequests = allRequests.filter(r => r.sourceLayer === 'Units');
  const villaRequests = allRequests.filter(r => r.sourceLayer !== 'Units');

  const unitIds = [...new Set(unitRequests.map(r => r.objectId).filter(Boolean))];
  const villaIds = [...new Set(villaRequests.map(r => r.objectId).filter(Boolean))];

  console.log(`🏢 Units to look up: ${unitIds.length}`);
  console.log(`🏡 Villas to look up: ${villaIds.length}`);

  // Fetch prices from ArcGIS
  const unitPriceMap = await fetchArcGISPrices(UNITS_URL, unitIds);
  const villaPriceMap = await fetchArcGISPrices(VILLAS_URL, villaIds);

  console.log(`\n🔄 Updating requests...`);
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const req of allRequests) {
    const priceMap = req.sourceLayer === 'Units' ? unitPriceMap : villaPriceMap;
    const correctPrice = priceMap[req.objectId];

    if (!correctPrice) {
      console.warn(`  ⚠️  No ArcGIS price found for objectId=${req.objectId} (${req.customerName})`);
      notFound++;
      continue;
    }

    if (req.price === correctPrice) {
      skipped++;
      continue;
    }

    await BR.updateOne({ _id: req._id }, { price: correctPrice });
    console.log(`  ✔  Updated [${req.customerName}] unit #${req.objectId}: ${req.price?.toLocaleString() || 'N/A'} → ${correctPrice.toLocaleString()}`);
    updated++;
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated : ${updated}`);
  console.log(`   Skipped (already correct): ${skipped}`);
  console.log(`   Not found in ArcGIS: ${notFound}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
