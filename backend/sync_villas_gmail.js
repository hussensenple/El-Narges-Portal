require('dotenv').config();
const mongoose = require('mongoose');
const Unit = require('./models/Unit');
const User = require('./models/User');
const { updateArcGISStatus } = require('./services/arcgisService');

async function syncVillasGmail() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    const mongoUri = process.env.MONGO_URI || 'mongodb://Se7s2245:01097043604Ss@ac-4lik2zl-shard-00-00.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-01.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-02.4rvxnvl.mongodb.net:27017/final_db?ssl=true&replicaSet=atlas-q64d2n-shard-0&authSource=admin&appName=HussienMohamed';
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB.");

    // Find all villas in MongoDB that are sold (status '4' or have ownerId)
    const villas = await Unit.find({
      sourceLayer: 'Villas_Global',
      $or: [{ status: '4' }, { ownerId: { $ne: null } }]
    }).populate('ownerId');

    console.log(`📋 Found ${villas.length} sold/owned villas in MongoDB.`);

    let successCount = 0;
    let failCount = 0;

    for (const villa of villas) {
      const owner = villa.ownerId;
      const ownerName = owner?.name || villa.ownerName || "";
      const ownerPhone = owner?.phone || villa.ownerPhone || "";
      const ownerEmail = owner?.email || villa.ownerEmail || "";

      console.log(`\n-----------------------------------------`);
      console.log(`🏡 Villa ID: ${villa.objectId} (GlobalID: ${villa.arcgisId})`);
      console.log(`👤 Owner: ${ownerName} | 📞 Phone: ${ownerPhone} | 📧 Email: ${ownerEmail || "N/A"}`);

      if (!villa.arcgisId) {
        console.log(`⚠️ Skipping: No arcgisId found.`);
        failCount++;
        continue;
      }

      // Sync with ArcGIS
      const updated = await updateArcGISStatus(
        villa.arcgisId,
        '4',
        ownerName,
        ownerPhone,
        ownerEmail,
        'Villas_Global'
      );

      if (updated) {
        console.log(`✅ Successfully updated AGOL for Villa ${villa.objectId} with Email: ${ownerEmail}`);
        successCount++;
      } else {
        console.log(`❌ Failed to update AGOL for Villa ${villa.objectId}`);
        failCount++;
      }
    }

    console.log(`\n=========================================`);
    console.log(`🎉 Sync Complete! Success: ${successCount} | Failed: ${failCount}`);
    console.log(`=========================================\n`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal Error:", error);
    process.exit(1);
  }
}

syncVillasGmail();
