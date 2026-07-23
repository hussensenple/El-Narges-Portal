const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
    const User = require('../models/User');
    const Unit = require('../models/Unit');
    
    const users = await User.find({ role: 'owner' });
    let fixedCount = 0;
    let downgradedCount = 0;

    for (const user of users) {
        if (!user.ownedUnits || user.ownedUnits.length === 0) continue;
        
        // Find which object IDs actually exist in Unit collection
        const validUnits = await Unit.find({ _id: { $in: user.ownedUnits } }, '_id');
        const validIds = validUnits.map(u => u._id.toString());
        
        if (validIds.length !== user.ownedUnits.length) {
            // Update user to only have valid units
            user.ownedUnits = validIds;
            await user.save();
            fixedCount++;
            
            // Auto downgrade if they now have 0 properties
            if (validIds.length === 0) {
                user.role = 'user';
                await user.save();
                downgradedCount++;
            }
        }
    }
    
    console.log(`Cleaned up invalid units for ${fixedCount} users.`);
    console.log(`Auto-downgraded ${downgradedCount} owners to user role.`);
    process.exit(0);
});
