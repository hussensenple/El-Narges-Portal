const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
    const Unit = require('../models/Unit');
    const units = await Unit.find({ status: { $in: ['4', 'Sold', '3', 'Reserved'] } });
    console.log(units.map(u => ({ id: u.arcgisId, status: u.status, email: u.ownerEmail })));
    process.exit(0);
});
