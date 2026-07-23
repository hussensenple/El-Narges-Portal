const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const Unit = require('./models/Unit');
    const unit = await Unit.findOne({ arcgisId: '575' });
    console.log("UNIT 575 DATA:", JSON.stringify(unit, null, 2));
    process.exit(0);
});
