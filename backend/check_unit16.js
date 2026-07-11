const mongoose = require('mongoose');
const Unit = require('./models/Unit');
const BookingRequest = require('./models/BookingRequest');

mongoose.connect('mongodb://Se7s2245:01097043604Ss@ac-4lik2zl-shard-00-00.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-01.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-02.4rvxnvl.mongodb.net:27017/final_db?ssl=true&replicaSet=atlas-q64d2n-shard-0&authSource=admin&appName=HussienMohamed')
.then(async () => {
    try {
        const units = await Unit.find({ objectId: 16 });
        console.log("Unit 16 in DB:", units);
        
        const bookingReq = await BookingRequest.find({ objectId: 16 });
        console.log("BookingRequest for 16:", bookingReq);
        
        const unitsByName = await Unit.find({ ownerName: 'Mostafa Khaled' });
        console.log("All Mostafa Khaled units:", unitsByName.map(u => ({ id: u._id, objectId: u.objectId, arcgisId: u.arcgisId, status: u.status, ownerId: u.ownerId })));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});
