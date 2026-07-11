const mongoose = require('mongoose');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Unit = require('./models/Unit');
require('dotenv').config();

const DB_URI = process.env.MONGO_URI || 'mongodb://Se7s2245:01097043604Ss@ac-4lik2zl-shard-00-00.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-01.4rvxnvl.mongodb.net:27017,ac-4lik2zl-shard-00-02.4rvxnvl.mongodb.net:27017/elnarges?ssl=true&replicaSet=atlas-2l7i9z-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

const names = ["Mahmoud", "Mohamed", "Sara", "Khaled", "Mariam", "Rawan", "Abdelrahman", "Rafat", "Ahmed", "Reem", "Hassan", "Mostafa", "Ayman", "Waleed", "Zyad"];
const maleNames = ["Mahmoud", "Mohamed", "Khaled", "Abdelrahman", "Rafat", "Ahmed", "Hassan", "Mostafa", "Ayman", "Waleed", "Zyad"];

const getRandomMaleName = () => maleNames[Math.floor(Math.random() * maleNames.length)];
const getRandomName = () => names[Math.floor(Math.random() * names.length)];

async function fetchArcGISData(url, outFields, returnGeometry = true) {
    const res = await axios.get(`${url}/query`, {
        params: {
            where: '1=1',
            outFields,
            returnGeometry,
            f: 'json'
        }
    });
    return res.data.features || [];
}

// Simple K-Means Clustering implementation for 2D points
function kMeans(points, k, maxIter = 100) {
    // Initialize centroids randomly
    let centroids = [];
    for (let i = 0; i < k; i++) {
        centroids.push(points[Math.floor(Math.random() * points.length)]);
    }

    let clusters = new Array(k).fill(0).map(() => []);

    for (let iter = 0; iter < maxIter; iter++) {
        clusters = new Array(k).fill(0).map(() => []);
        
        // Assign points to nearest centroid
        for (const p of points) {
            let minDist = Infinity;
            let clusterIdx = 0;
            for (let i = 0; i < k; i++) {
                const c = centroids[i];
                if (!c) continue;
                const dist = Math.sqrt(Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2));
                if (dist < minDist) {
                    minDist = dist;
                    clusterIdx = i;
                }
            }
            clusters[clusterIdx].push(p);
        }

        // Update centroids
        let changed = false;
        for (let i = 0; i < k; i++) {
            if (clusters[i].length === 0) continue;
            const sumX = clusters[i].reduce((sum, p) => sum + p.x, 0);
            const sumY = clusters[i].reduce((sum, p) => sum + p.y, 0);
            const newX = sumX / clusters[i].length;
            const newY = sumY / clusters[i].length;
            if (Math.abs(centroids[i].x - newX) > 0.0001 || Math.abs(centroids[i].y - newY) > 0.0001) {
                changed = true;
            }
            centroids[i] = { x: newX, y: newY };
        }
        if (!changed) break;
    }
    return clusters;
}

async function seedBrokersAndAssignUnits() {
    try {
        await mongoose.connect(DB_URI);
        console.log("Connected to MongoDB.");

        // 1. Generate 10 Brokers
        await User.deleteMany({ role: 'broker' });
        const brokers = [];
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        for (let i = 0; i < 10; i++) {
            const firstName = getRandomName();
            const lastName = getRandomMaleName();
            const fullName = `${firstName} ${lastName}`;
            
            const newBroker = new User({
                name: fullName,
                email: `broker${i+1}@elnarges.com`,
                password: hashedPassword,
                phone: `0100000000${i}`,
                role: 'broker',
                ownedUnits: []
            });
            await newBroker.save();
            brokers.push(newBroker);
            console.log(`Created Broker: ${fullName} (broker${i+1}@elnarges.com)`);
        }

        // 2. Fetch Units and Villas from ArcGIS
        console.log("Fetching Units from ArcGIS...");
        const UNITS_URL = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37";
        const units = await fetchArcGISData(UNITS_URL, 'OBJECTID,Status,BuildingID_FK', false);
        
        console.log("Fetching Buildings for Unit geometries...");
        const BUILDINGS_URL = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/1";
        const buildings = await fetchArcGISData(BUILDINGS_URL, 'GlobalID', true);

        const buildingMap = {};
        for (const b of buildings) {
            let geometry = b.geometry;
            if (!geometry && b.centroid) geometry = b.centroid;
            if (geometry && geometry.rings) {
                geometry = { x: geometry.rings[0][0][0], y: geometry.rings[0][0][1] };
            }
            if (geometry) {
                buildingMap[b.attributes.GlobalID] = geometry;
            }
        }

        console.log("Fetching Villas from ArcGIS...");
        const VILLAS_URL = "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8";
        const villas = await fetchArcGISData(VILLAS_URL, 'OBJECTID,GlobalID,Status', true);

        console.log(`Fetched ${units.length} units and ${villas.length} villas.`);

        // 3. Prepare data for clustering
        const allProperties = [];
        
        for (const u of units) {
            let geometry = buildingMap[u.attributes.BuildingID_FK];
            // fallback generic coordinate if building not found
            if (!geometry) geometry = { x: 31.5, y: 30.0 }; 
            
            allProperties.push({
                id: String(u.attributes.OBJECTID),
                arcgisId: String(u.attributes.OBJECTID),
                objectId: u.attributes.OBJECTID,
                status: String(u.attributes.Status),
                sourceLayer: 'Units',
                x: geometry.x,
                y: geometry.y
            });
        }

        for (const v of villas) {
            let geometry = v.geometry;
            if (geometry && geometry.rings) {
                geometry = { x: geometry.rings[0][0][0], y: geometry.rings[0][0][1] };
            }
            if (geometry) {
                allProperties.push({
                    id: v.attributes.GlobalID || String(v.attributes.OBJECTID),
                    arcgisId: v.attributes.GlobalID || String(v.attributes.OBJECTID),
                    objectId: v.attributes.OBJECTID,
                    status: String(v.attributes.Status),
                    sourceLayer: 'Villas_Global',
                    x: geometry.x,
                    y: geometry.y
                });
            }
        }

        console.log(`Clustering ${allProperties.length} properties for 10 brokers...`);
        const clusters = kMeans(allProperties, 10);

        // 4. Update MongoDB Unit collection
        let updatedCount = 0;
        for (let i = 0; i < 10; i++) {
            const broker = brokers[i];
            const cluster = clusters[i] || [];
            console.log(`Assigning ${cluster.length} properties to Broker ${broker.name}`);

            for (const p of cluster) {
                let unitDoc = await Unit.findOne({ 
                    $or: [
                        { globalId: p.arcgisId },
                        { arcgisId: p.arcgisId }
                    ]
                });

                if (!unitDoc) {
                    unitDoc = new Unit({
                        globalId: p.arcgisId,
                        arcgisId: p.arcgisId,
                        unitName: p.sourceLayer === 'Villas_Global' ? 'فيلا' : 'شقة',
                        status: p.status || '1',
                        sourceLayer: p.sourceLayer,
                        objectId: p.objectId,
                        brokerId: broker._id
                    });
                } else {
                    unitDoc.brokerId = broker._id;
                }
                await unitDoc.save();
                updatedCount++;
            }
        }

        console.log(`Successfully assigned ${updatedCount} properties in MongoDB!`);
        console.log("NOTE: ArcGIS does not have a native 'Broker' field, so no direct batch update was sent to ArcGIS for broker mapping. Data is safely stored in MongoDB and linked in the system.");
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedBrokersAndAssignUnits();
