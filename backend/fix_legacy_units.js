require('dotenv').config();
const User = require('./models/User');
const Unit = require('./models/Unit');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const users = await User.find({ 'ownedUnits.0': { $exists: true } });
  let fixed = 0;
  for (const u of users) {
    for (const uid of u.ownedUnits) {
      const unit = await Unit.findById(uid);
      if (unit && !unit.ownerId) {
        unit.ownerId = u._id;
        await unit.save();
        fixed++;
      }
    }
  }
  console.log('Fixed', fixed, 'legacy units');
  process.exit(0);
});
