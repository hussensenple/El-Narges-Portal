require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const turf = require('@turf/turf');
const MeterMapping = require('../models/MeterMapping');

const METERS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/UN_Map_WFL1/FeatureServer/32/query';
const BUILDINGS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1/query';
const VILLAS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8/query';

async function fetchAllFeatures(url, where = '1=1') {
  let features = [];
  let offset = 0;
  const limit = 2000;
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching from ${url} (offset: ${offset})...`);
    const res = await axios.get(url, {
      params: {
        where,
        outFields: 'OBJECTID,GlobalID',
        f: 'geojson',
        resultOffset: offset,
        resultRecordCount: limit,
        outSR: 4326
      }
    });

    if (res.data && res.data.features && res.data.features.length > 0) {
      features = features.concat(res.data.features);
      offset += limit;
      if (res.data.exceededTransferLimit !== true) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  return features;
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Fetch data
    console.log('Fetching Meters...');
    const meters = await fetchAllFeatures(METERS_URL, 'ASSETGROUP=5'); // Only Meters
    
    console.log('Fetching Buildings...');
    const buildings = await fetchAllFeatures(BUILDINGS_URL);
    
    console.log('Fetching Villas...');
    const villas = await fetchAllFeatures(VILLAS_URL);

    console.log(`Loaded ${meters.length} meters, ${buildings.length} buildings, ${villas.length} villas.`);

    // Clear existing mappings
    await MeterMapping.deleteMany({});
    console.log('Cleared existing MeterMapping collection.');

    let matchCount = 0;
    const batch = [];

    // Process intersections
    for (const meter of meters) {
      const meterId = meter.properties.OBJECTID;
      
      let matchedBuilding = null;
      let buildingType = null;
      let minDistance = Infinity;

      // Find closest building
      for (const bldg of buildings) {
        const centroid = turf.centroid(bldg);
        const distance = turf.distance(meter, centroid, { units: 'meters' });
        if (distance < minDistance) {
          minDistance = distance;
          matchedBuilding = bldg;
          buildingType = 'building';
        }
      }

      // Check villas
      for (const villa of villas) {
        const centroid = turf.centroid(villa);
        const distance = turf.distance(meter, centroid, { units: 'meters' });
        if (distance < minDistance) {
          minDistance = distance;
          matchedBuilding = villa;
          buildingType = 'villa';
        }
      }

      // Only match if within a reasonable distance (e.g. 50 meters)
      if (matchedBuilding && minDistance <= 50) {
        batch.push({
          meterId: meterId,
          buildingGlobalId: matchedBuilding.properties.GlobalID,
          buildingType: buildingType
        });
        matchCount++;
      }
    }

    if (batch.length > 0) {
      await MeterMapping.insertMany(batch);
      console.log(`Successfully mapped ${matchCount} meters to buildings/villas.`);
    } else {
      console.log('No intersections found. Adjust buffer size if needed.');
    }

  } catch (err) {
    console.error('Error during spatial join:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

run();
