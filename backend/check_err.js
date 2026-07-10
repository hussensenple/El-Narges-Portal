require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    const User = require('./models/User');
    const Unit = require('./models/Unit');
    const user = await User.findOne();
    if(!user) { console.log('no user found'); process.exit(0); }
    const updatedUnit = await Unit.findOneAndUpdate(
      { arcgisId: 'test_unit_999' },
      { ownerId: user._id, status: '4' },
      { upsert: true, new: true }
    );
    await User.findByIdAndUpdate(user._id, { $addToSet: { ownedUnits: updatedUnit._id } });
    console.log('Success 1');
    const updatedUnit2 = await Unit.findOneAndUpdate(
      { arcgisId: 'test_unit_888' },
      { ownerId: user._id, status: '4' },
      { upsert: true, new: true }
    );
    await User.findByIdAndUpdate(user._id, { $addToSet: { ownedUnits: updatedUnit2._id } });
    console.log('Success 2');
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
});
