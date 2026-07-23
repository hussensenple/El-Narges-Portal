const axios = require('axios');
const MeterMapping = require('../models/MeterMapping');
const Unit = require('../models/Unit');

// Helper to round coordinates for graph node matching (5 decimal places ~ 1.1 meters)
const makeKey = (coord) => {
    return `${Number(coord[0]).toFixed(5)},${Number(coord[1]).toFixed(5)}`;
};

exports.performIsolationTrace = async (req, res) => {
    try {
        const { startPipeId, includeIsolatedFeatures = true } = req.body;

        if (!startPipeId) {
            return res.status(400).json({ error: 'startPipeId is required' });
        }

        console.log(`[Isolation Trace] Starting trace for pipe OBJECTID: ${startPipeId}, includeIsolated: ${includeIsolatedFeatures}`);

        // Fetch Line features (Pipes)
        const linesResponse = await axios.get('https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/UN_Map_WFL1/FeatureServer/17/query', {
            params: {
                where: '1=1',
                outFields: 'OBJECTID,ASSETGROUP',
                f: 'geojson'
            }
        });

        // Fetch Point features (Devices / Valves / Meters)
        const devicesResponse = await axios.get('https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/UN_Map_WFL1/FeatureServer/32/query', {
            params: {
                where: '1=1',
                outFields: 'OBJECTID,ASSETGROUP,ASSETTYPE,Status',
                f: 'geojson'
            }
        });

        const lines = linesResponse.data.features || [];
        const devices = devicesResponse.data.features || [];

        // 1. Build Graph
        const graph = {}; // nodeKey -> array of { edgeId, toNode, pipeProps }
        
        let startNodes = [];

        lines.forEach(line => {
            if (line.geometry && line.geometry.type === 'LineString') {
                const coords = line.geometry.coordinates;
                const startKey = makeKey(coords[0]);
                const endKey = makeKey(coords[coords.length - 1]);
                
                const edgeId = line.properties.OBJECTID;

                if (!graph[startKey]) graph[startKey] = [];
                if (!graph[endKey]) graph[endKey] = [];

                graph[startKey].push({ edgeId, toNode: endKey });
                graph[endKey].push({ edgeId, toNode: startKey });

                if (edgeId === startPipeId) {
                    startNodes.push(startKey);
                    startNodes.push(endKey);
                }
            }
        });

        if (startNodes.length === 0) {
            return res.status(404).json({ error: 'Start pipe not found in the network.' });
        }

        // 2. Identify Barriers (Valves) and Meters
        const valves = {}; // nodeKey -> {id, status, type}
        const meters = {}; // nodeKey -> OBJECTID

        devices.forEach(device => {
            if (device.geometry && device.geometry.type === 'Point') {
                const nodeKey = makeKey(device.geometry.coordinates);
                const props = device.properties;

                if (props.ASSETGROUP === 3) { // 3 is Valve
                    valves[nodeKey] = { id: props.OBJECTID, status: props.Status, type: props.ASSETTYPE, coord: device.geometry.coordinates };
                } else if (props.ASSETGROUP === 5) { // 5 is Meter
                    meters[nodeKey] = { id: props.OBJECTID, coord: device.geometry.coordinates };
                }
            }
        });

        // 3. Perform BFS Traversal
        const queue = [...startNodes];
        const visitedNodes = new Set(startNodes);
        
        let isolatedPipes = new Set([startPipeId]);
        let boundingValves = new Set();
        let affectedMeters = new Set();

        while (queue.length > 0) {
            const currNode = queue.shift();

            if (valves[currNode]) {
                boundingValves.add(valves[currNode]);
                // Stop tracing at System Valves (type 0) to isolate the main.
                // We do NOT stop at Service Valves so we can reach the downstream meters.
                if (valves[currNode].type === 0) {
                    continue; 
                }
            }

            if (meters[currNode]) {
                affectedMeters.add(meters[currNode]);
            }

            const neighbors = graph[currNode] || [];
            for (const neighbor of neighbors) {
                isolatedPipes.add(neighbor.edgeId);
                
                if (!visitedNodes.has(neighbor.toNode)) {
                    visitedNodes.add(neighbor.toNode);
                    queue.push(neighbor.toNode);
                }
            }
        }

        // Process results based on includeIsolatedFeatures
        let valvesToClose = [];
        let alreadyClosedValves = [];

        let serviceValves = [];
        Array.from(boundingValves).forEach(v => {
            // Keep track of service valves for highlighting when includeIsolatedFeatures is true
            if (v.type === 9) {
                serviceValves.push({ id: v.id, coord: v.coord });
            }

            // If includeIsolatedFeatures is false, we ONLY care about System Valves (type === 0)
            if (!includeIsolatedFeatures && v.type !== 0) {
                return;
            }

            // System Valves (0) are always added to valvesToClose. Service Valves (9) are added if includeIsolatedFeatures is true
            if (v.status === 0) {
                alreadyClosedValves.push({ id: v.id, coord: v.coord });
            } else {
                if (v.type === 0) {
                    valvesToClose.push({ id: v.id, coord: v.coord });
                }
            }
        });

        // Resolve Units from MongoDB MeterMapping
        const metersArray = Array.from(affectedMeters);
        const meterObjects = metersArray.map(m => ({ id: m.id, coord: m.coord }));
        const meterIds = metersArray.map(m => m.id);

        let affectedUnitsCount = 0;
        let ownerEmails = [];
        let affectedUnitsList = [];

        if (meterIds.length > 0) {
            const mappings = await MeterMapping.find({ meterId: { $in: meterIds } });
            const buildingGlobalIds = mappings.map(m => m.buildingGlobalId);
            
            if (buildingGlobalIds.length > 0) {
                const units = await Unit.find({ buildingIdFk: { $in: buildingGlobalIds } });
                // Sort by arcgisId
                units.sort((a, b) => {
                    const idA = parseInt(a.arcgisId) || 0;
                    const idB = parseInt(b.arcgisId) || 0;
                    return idA - idB;
                });

                affectedUnitsCount = units.length;
                ownerEmails = units.filter(u => u.ownerEmail).map(u => u.ownerEmail);
                affectedUnitsList = units.map(u => {
                    let displayName = `Unit #${u.arcgisId || '?'}`;
                    if (u.unitName === 'Villa' || u.unitName === 'فيلا') {
                        displayName = `Villa #${u.arcgisId || '?'}`;
                    }
                    return {
                        id: u._id,
                        name: displayName,
                        status: u.status,
                        ownerEmail: (u.status === '4' || u.status === 'Sold') ? u.ownerEmail : undefined
                    };
                });
            }
        }

        res.json({
            isolatedPipes: Array.from(isolatedPipes),
            valvesToClose,
            serviceValves,
            alreadyClosedValves,
            affectedMeters: meterObjects,
            affectedUnitsCount,
            affectedUnits: affectedUnitsList,
            ownerEmails
        });

    } catch (error) {
        console.error("Error performing isolation trace:", error);
        res.status(500).json({ error: 'Failed to perform isolation trace' });
    }
};

const nodemailer = require('nodemailer');

exports.notifyOwners = async (req, res) => {
    try {
        const { meterIds, ownerEmails, date, fromTime, toTime } = req.body;
        
        if (!meterIds || !Array.isArray(meterIds)) {
            return res.status(400).json({ error: 'meterIds array is required' });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            bcc: ownerEmails || [],
            subject: 'إشعار انقطاع المياه للصيانة',
            html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #da3633;">إشعار هام: انقطاع مؤقت للمياه</h2>
                    <p>عزيزي العميل،</p>
                    <p>نود إعلامكم بأنه نظراً لوجود كسر في إحدى خطوط المياه، سيتم قطع المياه مؤقتاً للقيام بأعمال الإصلاح والصيانة اللازمة.</p>
                    <div style="background-color: #f8f9fa; border-right: 4px solid #da3633; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; padding-bottom: 5px;"><strong>التاريخ:</strong> ${date}</p>
                        <p style="margin: 0; padding-bottom: 5px;"><strong>من الساعة:</strong> ${fromTime}</p>
                        <p style="margin: 0;"><strong>إلى الساعة:</strong> ${toTime}</p>
                    </div>
                    <p>نعتذر عن هذا الإزعاج ونعمل جاهدين لعودة الخدمة في أسرع وقت ممكن.</p>
                    <p>شكراً لتفهمكم وتعاونكم.</p>
                    <br>
                    <p><strong>إدارة المرافق - منصة النرجس</strong></p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        
        res.json({ msg: 'Owners notified successfully', count: ownerEmails?.length || 0 });
    } catch (error) {
        console.error("Error notifying owners:", error);
        res.status(500).json({ error: 'Failed to notify owners' });
    }
};
