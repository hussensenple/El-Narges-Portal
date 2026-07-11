require('dotenv').config();
const mongoose = require('mongoose');
const Unit = require('./models/Unit');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const units = await Unit.find({ ownerId: { $ne: null } });
  for (const u of units) {
    if (!u.objectId) {
      // arcgisId for Apartments is already the OBJECTID number as a string
      u.objectId = u.arcgisId;
      await u.save();
      console.log('Backfilled objectId for unit arcgisId=', u.arcgisId, '->', u.objectId);
    }
  }
  console.log('Done');
  process.exit(0);
});
