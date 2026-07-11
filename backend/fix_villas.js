const mongoose = require('mongoose');
const Unit = require('./models/Unit');
const User = require('./models/User');

mongoose.connect('mongodb://Se7s2245:01097043604Ss@ac-4lik2zl-shard-00-00.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-01.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-02.4rvxnvl.mongodb.net:27017/final_db?ssl=true&replicaSet=atlas-q64d2n-shard-0&authSource=admin&appName=HussienMohamed')
.then(async () => {
    try {
        const userId = '6a4d61eb6d547052475e9264'; // Mostafa Khaled

        // 1. Fix Villa 16 (which I mistakenly labeled as 18)
        const villa16 = await Unit.findOneAndUpdate(
            { arcgisId: 'e4c2bef5-5816-4eee-b1e9-5aff9e3ac4b2' },
            { objectId: 16, sourceLayer: 'Villas_Global', status: '4', ownerId: userId },
            { new: true }
        );
        console.log("Fixed Villa 16:", villa16);

        // 2. Fix the REAL Villa 18 (which was disconnected in MongoDB)
        const villa18 = await Unit.findOneAndUpdate(
            { arcgisId: 'a2a9a4da-bb51-4d2b-906e-0639fb92462c' },
            { objectId: 18, sourceLayer: 'Villas_Global', status: '4', ownerId: userId },
            { new: true }
        );
        console.log("Fixed Villa 18:", villa18);

        // 3. Ensure both are in the user's ownedUnits array
        await User.findByIdAndUpdate(userId, {
            $addToSet: { ownedUnits: { $each: [villa16._id, villa18._id] } }
        });
        console.log("Added both to Mostafa Khaled's ownedUnits");

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});
