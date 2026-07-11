const mongoose = require('mongoose');
const User = require('./models/User');
const Unit = require('./models/Unit');

mongoose.connect('mongodb://Se7s2245:01097043604Ss@ac-4lik2zl-shard-00-00.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-01.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-02.4rvxnvl.mongodb.net:27017/final_db?ssl=true&replicaSet=atlas-q64d2n-shard-0&authSource=admin&appName=HussienMohamed')
.then(async () => {
    try {
        const unit1 = await Unit.findById('6a514b415ec1ce2cca641589');
        console.log("Unit 1:", unit1);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});
