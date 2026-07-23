const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
    const User = require('../models/User');
    const result = await User.updateMany(
        { role: 'owner', $or: [{ ownedUnits: { $exists: false } }, { ownedUnits: { $size: 0 } }] },
        { $set: { role: 'user' } }
    );
    console.log('Downgraded owners:', result.modifiedCount);
    process.exit(0);
});
