const mongoose = require('mongoose');
const User = require('./models/User');
const Unit = require('./models/Unit');

mongoose.connect('mongodb://Se7s2245:01097043604Ss@ac-4lik2zl-shard-00-00.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-01.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-02.4rvxnvl.mongodb.net:27017/final_db?ssl=true&replicaSet=atlas-q64d2n-shard-0&authSource=admin&appName=HussienMohamed')
.then(async () => {
    try {
        const userId = '6a4d61eb6d547052475e9264'; // Mostafa Khaled

        // Fix the unit with ownerId = null
        const unit1 = await Unit.findByIdAndUpdate(
            '6a514b415ec1ce2cca641589',
            { ownerId: userId },
            { new: true }
        );
        console.log("Fixed unit 1 (ownerId):", unit1);

        // Fix the unit with missing sourceLayer
        const unit2 = await Unit.findByIdAndUpdate(
            '6a516ed9f93ffaff541ab95a',
            { sourceLayer: 'Villas_Global' },
            { new: true }
        );
        console.log("Fixed unit 2 (sourceLayer):", unit2);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});
