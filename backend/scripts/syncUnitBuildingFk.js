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
        
        if (res.data.error) {
            console.error("ArcGIS Error:", res.data.error);
            process.exit(1);
        }
        
        const features = res.data.features;
        console.log(`Fetched ${features.length} units from ArcGIS.`);
        
        let linkedCount = 0;
        let mergedCount = 0;

        for (const feature of features) {
            const arcgisId = String(feature.attributes.OBJECTID);
            const buildingFk = feature.attributes.BuildingID_FK;
            const floor = feature.attributes.Floor;
            const status = String(feature.attributes.Status);

            if (!buildingFk) continue;

            // 1. Find if a Unit with this arcgisId already exists (e.g. from a booking)
            const soldUnit = await Unit.findOne({ arcgisId: arcgisId });
            
            if (soldUnit) {
                // It was sold/booked. Make sure it has buildingIdFk and floorNumber
                soldUnit.buildingIdFk = buildingFk;
                if (floor != null) soldUnit.floorNumber = floor;
                await soldUnit.save();
                
                // Now delete any OLD dummy unit for this building & floor so we don't have duplicates
                const deleted = await Unit.deleteMany({
                    _id: { $ne: soldUnit._id },
                    buildingIdFk: buildingFk,
                    floorNumber: floor
                });
                if (deleted.deletedCount > 0) mergedCount++;
            } else {
                // 2. No booked unit exists. Update the dummy unit in MongoDB to have this arcgisId and status
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
                    // 3. Create a new dummy unit so it exists in MongoDB
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
        console.log(`Merged ${mergedCount} sold units, replacing dummy duplicates.`);
        
    } catch (e) {
        console.error("Error", e);
    }
    
    process.exit(0);
});
