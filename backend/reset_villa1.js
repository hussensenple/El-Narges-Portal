require('dotenv').config();
const mongoose = require('mongoose');
const Unit = require('./models/Unit');
const User = require('./models/User');
const { updateArcGISStatus } = require('./services/arcgisService');

const VILLA_GLOBALID = '783fc9a6-66e4-4a38-9945-d7d00807d2bb';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to MongoDB');

  // 1. Find who owns this villa to remove it from their ownedUnits
  const unit = await Unit.findOne({ arcgisId: VILLA_GLOBALID });
  if (unit) {
    console.log('Found unit in MongoDB:', unit._id, '| ownerId:', unit.ownerId);
    if (unit.ownerId) {
      await User.findByIdAndUpdate(unit.ownerId, { $pull: { ownedUnits: unit._id } });
      // Check if they still have other properties
      const owner = await User.findById(unit.ownerId);
      if (owner && (!owner.ownedUnits || owner.ownedUnits.length === 0)) {
        await User.findByIdAndUpdate(unit.ownerId, { role: 'user' });
        console.log('Owner downgraded to user (no more properties)');
      }
    }
    // 2. Reset MongoDB unit
    await Unit.findByIdAndUpdate(unit._id, {
      ownerId: null,
      status: '1',
      ownerName: null,
      ownerEmail: null,
      ownerPhone: null
    });
    console.log('MongoDB unit reset to Available');
  } else {
    console.log('Villa not found in MongoDB (no action needed there)');
  }

  // 3. Reset ArcGIS
  console.log('Updating ArcGIS...');
  const success = await updateArcGISStatus(VILLA_GLOBALID, '1', null, null, null, 'Villas_Global');
  if (success) {
    console.log('ArcGIS updated to Available successfully!');
  } else {
    console.error('ArcGIS update failed!');
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
