require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Unit = require('./models/Unit'); 

// ⚠️ حط لينك الـ Feature Layer بتاعك هنا (اللي آخره /FeatureServer/0)
const FEATURE_LAYER_URL = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Residential1/FeatureServer/0";

const syncUnitsFromArcGIS = async () => {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/elnarges_db");
    console.log("✅ Connected to MongoDB!");

    console.log(`⏳ Fetching data from ArcGIS Feature Layer...`);
    const response = await axios.get(`${FEATURE_LAYER_URL}/query`, {
      params: {
        where: "1=1", 
        // 👇 ضفنا الحقول الجديدة هنا بالظبط زي ما هي مكتوبة في الصورة
        outFields: "OBJECTID,Unit_Type,Floor,Status,Total_Price,Customer_Name,Customer_Phone", 
        returnGeometry: false, 
        f: "json"
      }
    });

    const features = response.data.features;
    if (!features || features.length === 0) {
      console.log("❌ No features found in ArcGIS Layer.");
      process.exit(1);
    }
    
    console.log(`🚀 Found ${features.length} units in ArcGIS. Starting Sync...`);

    let addedCount = 0;
    let updatedCount = 0;

    for (let feature of features) {
      const attrs = feature.attributes;
      
      const result = await Unit.updateOne(
        { arcgisObjectId: attrs.OBJECTID }, 
        {
          $set: {
            unitType: attrs.Unit_Type || 'Building',
            floor: attrs.Floor || 0,
            status: attrs.Status || 'Available',
            totalPrice: attrs.Total_Price || null,
            // 👇 سحب وتخزين بيانات العميل لو موجودة
            customerName: attrs.Customer_Name || null,
            customerPhone: attrs.Customer_Phone || null
          }
        },
        { upsert: true } 
      );

      if (result.upsertedCount > 0) addedCount++;
      else if (result.modifiedCount > 0) updatedCount++;
    }

    console.log("==================================");
    console.log(`🎉 Sync Completed Successfully!`);
    console.log(`✅ Added New Units: ${addedCount}`);
    console.log(`🔄 Updated Existing Units: ${updatedCount}`);
    console.log("==================================");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Sync Error:", error.message);
    process.exit(1);
  }
};

syncUnitsFromArcGIS();