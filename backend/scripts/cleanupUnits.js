const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const Unit = require('../models/Unit');
    
    const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37/query';
    
    try {
        const res = await axios.get(UNITS_URL, {
            params: {
                where: "1=1",
                outFields: "*",
                f: "json"
            }
        });
        
        const features = res.data.features;
        console.log(`Fetched ${features.length} units from ArcGIS.`);
        
        let linkedCount = 0;
        let mergedCount = 0;

        for (const feature of features) {
            const arcgisId = String(feature.attributes.OBJECTID);
            const buildingFk = feature.attributes.BuildingID_FK;
            const floor = feature.attributes.Floor ?? feature.attributes.FloorNumber ?? feature.attributes.floor;
            const status = String(feature.attributes.Status);

            if (!buildingFk) continue;

            const soldUnit = await Unit.findOne({ arcgisId: arcgisId });
            
            if (soldUnit) {
                soldUnit.buildingIdFk = buildingFk;
                if (floor != null) soldUnit.floorNumber = floor;
                await soldUnit.save();
                
                // Now delete any OLD dummy unit for this building & floor
                if (floor != null) {
                    const deleted = await Unit.deleteMany({
                        _id: { $ne: soldUnit._id },
                        buildingIdFk: buildingFk,
                        floorNumber: floor
                    });
                    if (deleted.deletedCount > 0) mergedCount += deleted.deletedCount;
                }
            } else {
                const existingDummy = await Unit.findOne({
                    buildingIdFk: buildingFk,
                    floorNumber: floor
                });
                
                if (existingDummy) {
                    existingDummy.arcgisId = arcgisId;
                    existingDummy.status = status;
                    await existingDummy.save();
                    linkedCount++;
                } else {
                    await Unit.create({
                        arcgisId: arcgisId,
                        buildingIdFk: buildingFk,
                        floorNumber: floor,
                        status: status,
                        unitType: 'Apartment'
                    });
                    linkedCount++;
                }
            }
        }
        
        console.log(`Linked/Created ${linkedCount} available units.`);
        console.log(`Merged and deleted ${mergedCount} old dummy duplicates.`);
        
        // Final cleanup: delete ANY units that lack an arcgisId (they are orphaned dummies)
        const deletedOrphans = await Unit.deleteMany({ arcgisId: null });
        const deletedOrphans2 = await Unit.deleteMany({ arcgisId: { $exists: false } });
        console.log(`Deleted ${deletedOrphans.deletedCount + deletedOrphans2.deletedCount} orphaned dummy units.`);
        
    } catch (e) {
        console.error("Error", e);
    }
    
    process.exit(0);
});
