const mongoose = require('mongoose');
const Unit = require('./models/Unit');
const User = require('./models/User');

mongoose.connect('mongodb://Se7s2245:01097043604Ss@ac-4lik2zl-shard-00-00.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-01.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-02.4rvxnvl.mongodb.net:27017/final_db?ssl=true&replicaSet=atlas-q64d2n-shard-0&authSource=admin&appName=HussienMohamed')
.then(async () => {
    try {
        const units = await Unit.find({ ownerName: 'Mostafa Khaled' });
        console.log("Units owned by Mostafa Khaled:", units.map(u => ({ id: u._id, objectId: u.objectId, arcgisId: u.arcgisId, sourceLayer: u.sourceLayer, status: u.status })));
        
        const unit18 = await Unit.find({ objectId: 18 });
        console.log("Units with objectId 18:", unit18);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});
