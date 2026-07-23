const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
    const Unit = require('../models/Unit');
    const User = require('../models/User');
    const units = await Unit.find({ status: '4', ownerId: { $ne: null } });
    let fixed = 0;
    for (const unit of units) {
        if (!unit.ownerEmail) {
            const owner = await User.findById(unit.ownerId);
            if (owner) {
                unit.ownerEmail = owner.email;
                unit.ownerName = owner.name;
                unit.ownerPhone = owner.phone;
                await unit.save();
                fixed++;
            }
        }
    }
    console.log('Fixed emails for ' + fixed + ' units');
    process.exit(0);
});
