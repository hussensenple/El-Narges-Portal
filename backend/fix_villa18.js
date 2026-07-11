const mongoose = require('mongoose');
const Unit = require('./models/Unit');

mongoose.connect('mongodb://Se7s2245:01097043604Ss@ac-4lik2zl-shard-00-00.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-01.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-02.4rvxnvl.mongodb.net:27017/final_db?ssl=true&replicaSet=atlas-q64d2n-shard-0&authSource=admin&appName=HussienMohamed')
.then(async () => {
    try {
        const unit = await Unit.findOneAndUpdate(
            { arcgisId: 'e4c2bef5-5816-4eee-b1e9-5aff9e3ac4b2' },
            { objectId: 18, sourceLayer: 'Villas_Global' },
            { new: true }
        );
        console.log("Fixed unit:", unit);
        
        // Also fix the other villa that had arcgisId: '1d86a45d-7ca8-4f23-9972-c729b3269baa' to objectId 17 (assuming it was Villa 17 based on the screenshot, wait, let me just check if I can leave it, or if it was just an example).
        // I will just fix 'e4c2bef5-5816-4eee-b1e9-5aff9e3ac4b2'
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});
