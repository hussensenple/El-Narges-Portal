import { useState, useRef } from 'react';
import SceneView from '@arcgis/core/views/SceneView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Point from '@arcgis/core/geometry/Point';
import * as closestFacility from '@arcgis/core/rest/closestFacility';
import ClosestFacilityParameters from '@arcgis/core/rest/support/ClosestFacilityParameters';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import esriId from "@arcgis/core/identity/IdentityManager";
import esriConfig from "@arcgis/core/config";
import axios from 'axios';
import AuthModal from './AuthModal'; 

interface AIAdvisorProps {
  view: SceneView | null;
}

const AIAdvisor = ({ view }: AIAdvisorProps) => {
  const [isOpen, setIsOpen] = useState(false); 
  
  const [messages, setMessages] = useState<{sender: string, text: string, action?: string, actionUnitId?: number}[]>([
    { sender: 'ai', text: 'Welcome to GeoTwin! How can I assist you in exploring real estate and spatial data?' }
  ]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFilterActive, setIsFilterActive] = useState(false);
  const highlightHandleRef = useRef<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<number | null>(null);

  const userToken = localStorage.getItem('token'); 
  const isUserLoggedIn = !!userToken;

  const TARGET_LAYERS = ["Villas_Global", "Units"];

  const handleResetFilter = () => {
    if (view && view.map) {
      const SAFE_LAYERS = ["Villas_Global", "roads_Global", "Trees", "Trees_Global", "Landscape_Global", "Landscape"];
      const allVisualLayers = view.map.allLayers.filter((l:any) => 
        l.title === "Villas_Global" || (!SAFE_LAYERS.includes(l.title) && (l.type === "feature" || l.type === "scene" || l.type === "building-scene" || l.type === "integrated-mesh"))
      ).toArray();
      
      allVisualLayers.forEach(async layer => {
        (layer as any).definitionExpression = "1=1"; 
        (layer as any).visible = true;
      });
      const hl = view.map.layers.find((l:any) => l.title === "AIHighlightsLayer") as GraphicsLayer;
      if (hl) hl.removeAll();
      setIsFilterActive(false);
      if (highlightHandleRef.current) {
        highlightHandleRef.current.remove();
        highlightHandleRef.current = null;
      }
    }
  };

  const executeBooking = async (objectId: number) => {
    try {
      let targetGlobalId = null;
      let targetSourceLayer = null;

      if (view && view.map) {
        for (const title of TARGET_LAYERS) {
          const layer = view.map.allLayers.find(l => l.title === title) as FeatureLayer;
          if (layer) {
            const query = layer.createQuery();
            query.where = `OBJECTID = ${objectId}`;
            query.outFields = ["GlobalID"];
            const results = await layer.queryFeatures(query);
            
            if (results.features.length > 0) {
              targetGlobalId = results.features[0].attributes.GlobalID;
              targetSourceLayer = title;
              break; 
            }
          }
        }
      }

      if (!targetGlobalId || !targetSourceLayer) {
        setMessages(prev => [...prev, { sender: 'ai', text: '❌ Sorry, unit details could not be found on the map.' }]);
        return;
      }

      await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/request`, { 
        unitId: targetGlobalId,
        sourceLayer: targetSourceLayer
      }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });

      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: `✅ Booking request for unit #${objectId} has been successfully sent! We will contact you soon.` 
      }]);

    } catch (error) {
      console.error("Booking error:", error);
      setMessages(prev => [...prev, { sender: 'ai', text: '❌ Sorry, an error occurred while trying to book.' }]);
    }
  };

  const handleConfirmBooking = (unitId: number) => {
    if (!isUserLoggedIn) {
      setPendingBookingId(unitId);
      setIsAuthModalOpen(true);
    } else {
      executeBooking(unitId);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthModalOpen(false);
    if (pendingBookingId !== null) {
      executeBooking(pendingBookingId);
      setPendingBookingId(null); 
    }
  };
  
  const handleSend = async (overrideInput?: string) => {
    const userMsg = overrideInput || input;
    if (!userMsg.trim()) return;

    if (isFilterActive) {
      handleResetFilter();
    }

    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    if (!overrideInput) setInput('');
    setIsLoading(true);

    try {
      let contextData: any[] = [];
      
      if (view && view.map) {
        const villasLayer = view.map.allLayers.find((l:any) => l.title === "Villas_Global") as FeatureLayer;
        if (villasLayer) {
          const q = villasLayer.createQuery(); q.where = "1=1"; q.outFields = ["*"];
          const res = await villasLayer.queryFeatures(q);
          const uniqueTypes = [...new Set(res.features.map(f => f.attributes.BuildingType))];
          console.log("VILLAS_GLOBAL UNIQUE BUILDING TYPES:", uniqueTypes);
          
          contextData.push(...res.features.map(f => ({
            id: `Villas_Global-${f.attributes.OBJECTID}`,
            originalId: f.attributes.OBJECTID,
            layer: "Villas_Global",
            type: Number(f.attributes.BuildingType) === 1 ? "Villa" :
                  Number(f.attributes.BuildingType) === 2 ? "TwinHouse" :
                  "Apartment",
            price: f.attributes.Total_Price || f.attributes.Price,
            status: String(f.attributes.Status).toLowerCase(),
            ownerName: f.attributes.Owner_Name || null,
            ownerPhone: f.attributes.Owner_Phone || null,
            ownerEmail: f.attributes.Owner_Gmail || null
          })));
        }

        const unitsTable = view.map.tables?.find((t:any) => t.title === "Units") as FeatureLayer || view.map.allLayers.find((l:any) => l.title === "Units") as FeatureLayer;
        if (unitsTable) {
          const q = unitsTable.createQuery(); q.where = "1=1"; q.outFields = ["*"];
          const res = await unitsTable.queryFeatures(q);
          contextData.push(...res.features.map(f => ({
            id: `Units-${f.attributes.OBJECTID}`,
            originalId: f.attributes.OBJECTID,
            layer: "Units",
            buildingFK: f.attributes.BuildingID_FK || f.attributes.BuildingID_FK || f.attributes.GlobalID_FK, 
            type: "Apartment",
            price: f.attributes.Price,
            status: String(f.attributes.Status || 'available').toLowerCase(),
            ownerName: f.attributes.Owner_Name || null,
            ownerPhone: f.attributes.Owner_Phone || null,
            ownerEmail: f.attributes.Gmail || null
          })));
        }
      }

      const availableOnly = contextData.filter(u => u.status === 'available' || u.status === '1');
      
      const chatHistory = messages
        .filter(m => m.text && !m.text.includes('Welcome to GeoTwin'))
        .slice(-6)
        .map(m => ({
            role: m.sender === 'ai' ? 'model' : 'user',
            text: m.text
        }));

      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/ai/ask`, { 
        question: userMsg,
        history: chatHistory,
        contextData: contextData // Send ALL units to the backend
      });
      
      const { reply, isFilterQuery, filteredIds, nearTo, maxWalkingMinutes, action, actionUnitId } = res.data; 

      let finalReplyText = reply;

      if (view && view.map) {
        if (isFilterQuery && filteredIds && filteredIds.length > 0) {
          
          let filteredItems = availableOnly.filter(u => filteredIds.includes(u.id));
          
          // 🚀 Proximity filtering: if nearTo is specified, filter by walking distance
          if (nearTo && maxWalkingMinutes) {
            const AMENITY_TYPE_MAP: Record<string, number> = { 'School': 1, 'Hospital': 2, 'GYM': 3, 'Commercial': 4 };
            const amenityTypeId = AMENITY_TYPE_MAP[nearTo];
            if (amenityTypeId) {
              const servicesLayer = view.map.allLayers.find((l:any) => l.title === 'Services_Global') as FeatureLayer;
              if (servicesLayer) {
                const sq = servicesLayer.createQuery();
                sq.where = `Type = ${amenityTypeId}`;
                sq.returnGeometry = true;
                sq.outFields = ['OBJECTID', 'Type'];
                const sRes = await servicesLayer.queryFeatures(sq);
                
                if (sRes.features.length > 0) {
                  // Get centroids of all matching amenities
                  const amenityCentroids = sRes.features.map((f: any) => {
                    const center = f.geometry.centroid || f.geometry.extent?.center;
                    return center ? { lon: center.longitude, lat: center.latitude } : null;
                  }).filter(Boolean);
                  
                  // Walking speed ~80m/min, so maxDistance = maxWalkingMinutes * 80
                  const maxDistMeters = maxWalkingMinutes * 80;
                  
                  // Haversine distance function
                  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                    const R = 6371000; // Earth radius in meters
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
                              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                              Math.sin(dLon/2) * Math.sin(dLon/2);
                    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  };
                  
                  // We need geometry for each filtered item to calculate distance
                  // For Villas_Global items, query their geometry
                  const villasInFilter = filteredItems.filter(u => u.layer === 'Villas_Global');
                  const unitsInFilter = filteredItems.filter(u => u.layer === 'Units');
                  
                  const nearbyIds: string[] = [];
                  
                  // Check villas proximity
                  if (villasInFilter.length > 0) {
                    const vLayer = view.map.allLayers.find((l:any) => l.title === 'Villas_Global') as FeatureLayer;
                    if (vLayer) {
                      const vq = vLayer.createQuery();
                      vq.where = `OBJECTID IN (${villasInFilter.map(u => u.originalId).join(',')})`;
                      vq.returnGeometry = true;
                      const vRes = await vLayer.queryFeatures(vq);
                      vRes.features.forEach((f: any) => {
                        const center = f.geometry.centroid || f.geometry.extent?.center;
                        if (center) {
                          const minDist = Math.min(...amenityCentroids.map((ac: any) => 
                            haversine(center.latitude, center.longitude, ac.lat, ac.lon)
                          ));
                          if (minDist <= maxDistMeters) {
                            nearbyIds.push(`Villas_Global-${f.attributes.OBJECTID}`);
                          }
                        }
                      });
                    }
                  }
                  
                  // Check apartments proximity (use building geometry)
                  if (unitsInFilter.length > 0) {
                    const rawFKs: string[] = [];
                    unitsInFilter.filter(u => u.buildingFK).forEach(u => {
                      const cleanId = String(u.buildingFK).replace(/[{}]/g, '').trim();
                      rawFKs.push(
                        `'{${cleanId.toUpperCase()}}'`, `'${cleanId.toUpperCase()}'`,
                        `'{${cleanId.toLowerCase()}}'`, `'${cleanId.toLowerCase()}'`,
                        `'{${cleanId}}'`, `'${cleanId}'`
                      );
                    });
                    const buildingFKs = [...new Set(rawFKs)];
                    if (buildingFKs.length > 0) {
                      const SAFE_LAYERS = ['Villas_Global', 'roads_Global', 'Trees', 'Trees_Global', 'Landscape_Global', 'Landscape', 'Services_Global', 'Service_Territory_Global', 'LandUse_Global'];
                      const bLayers = view.map.allLayers.filter((l:any) => {
                        if (!l.title) return false;
                        return !SAFE_LAYERS.includes(l.title) && (l.type === 'scene' || l.type === 'feature');
                      }).toArray();
                      
                      for (const bLayer of bLayers) {
                        try {
                          const bq = (bLayer as any).createQuery();
                          bq.where = `GlobalID IN (${buildingFKs.join(',')})`;
                          bq.returnGeometry = true;
                          const bRes = await (bLayer as any).queryFeatures(bq);
                          bRes.features.forEach((bf: any) => {
                            const center = bf.geometry.centroid || bf.geometry.extent?.center;
                            if (center) {
                              const minDist = Math.min(...amenityCentroids.map((ac: any) => 
                                haversine(center.latitude, center.longitude, ac.lat, ac.lon)
                              ));
                              if (minDist <= maxDistMeters) {
                                // Find all units that belong to this building
                                const bGlobalId = String(bf.attributes.GlobalID || bf.attributes.globalid).replace(/[{}]/g, '').trim().toLowerCase();
                                unitsInFilter.forEach(u => {
                                  const uFK = String(u.buildingFK).replace(/[{}]/g, '').trim().toLowerCase();
                                  if (uFK === bGlobalId) nearbyIds.push(u.id);
                                });
                              }
                            }
                          });
                        } catch (err) {
                          console.error('Proximity query error:', err);
                        }
                      }
                    }
                  }
                  
                  // Filter down to only nearby items
                  filteredItems = filteredItems.filter(u => nearbyIds.includes(u.id));
                  // Update reply with the real proximity-filtered count
                  finalReplyText = `${reply}\n\n📍 Showing ${filteredItems.length} properties near the ${nearTo}.`;
                  console.log(`Proximity filter: ${nearbyIds.length} properties within ${maxWalkingMinutes} min walk of ${nearTo}`);
                }
              }
            }
          }
          
          setMessages(prev => [...prev, { sender: 'ai', text: finalReplyText, action: action, actionUnitId: actionUnitId }]); 
          
          const villaIds = filteredItems.filter(u => u.layer === 'Villas_Global').map(u => u.originalId);
          
          const rawBuildingFKs: string[] = [];
          filteredItems.filter(u => u.layer === "Units" && u.buildingFK).forEach(u => {
              const cleanId = String(u.buildingFK).replace(/[{}]/g, '').trim();
              rawBuildingFKs.push(
                  `'{${cleanId.toUpperCase()}}'`, `'${cleanId.toUpperCase()}'`, 
                  `'{${cleanId.toLowerCase()}}'`, `'${cleanId.toLowerCase()}'`, 
                  `'{${cleanId}}'`, `'${cleanId}'`
              );
          });
          const apartmentBuildingFKs = [...new Set(rawBuildingFKs)]; 

          let allVisualFeatures: any[] = [];

          // 1. Filter Villas
          const villasLayer = view.map.allLayers.find((l:any) => l.title === "Villas_Global") as FeatureLayer;
          if (villasLayer) {
            villasLayer.visible = true;
            if (villaIds.length > 0) {
              const expr = `OBJECTID IN (${villaIds.join(',')})`;
              villasLayer.definitionExpression = expr; // ✨ HIDE non-matching villas
              const q = villasLayer.createQuery(); q.where = expr; q.returnGeometry = true;
              const vRes = await villasLayer.queryFeatures(q);
              allVisualFeatures.push(...vRes.features);
            } else {
              villasLayer.definitionExpression = "1=0"; // HIDE all villas if none match
            }
          }

          // 2. فلترة العمارات باحترافية
          const SAFE_LAYERS = ["Villas_Global", "roads_Global", "Trees", "Trees_Global", "Landscape_Global", "Landscape", "Services_Global", "Service_Territory_Global", "LandUse_Global"];
          const buildingLayers = view.map.allLayers.filter((l:any) => {
            if (!l.title) return false;
            // If it is NOT a safe layer, and it is a 3D/Feature layer, we treat it as a building layer to hide
            return !SAFE_LAYERS.includes(l.title) && (l.type === "feature" || l.type === "scene" || l.type === "building-scene" || l.type === "integrated-mesh");
          }).toArray();
          
          if (buildingLayers.length > 0) {
            buildingLayers.forEach((l:any) => l.visible = true);
            if (apartmentBuildingFKs.length > 0) {
              for (const targetLayerToQuery of buildingLayers) {
                  try {
                    const expr = `GlobalID IN (${apartmentBuildingFKs.join(',')})`;
                    (targetLayerToQuery as any).definitionExpression = expr; // ✨ HIDE non-matching buildings
                    
                    const bQuery = (targetLayerToQuery as any).createQuery();
                    bQuery.where = expr;
                    bQuery.outFields = ["OBJECTID"];
                    bQuery.returnGeometry = true;

                    const bRes = await (targetLayerToQuery as any).queryFeatures(bQuery);
                    const bObjectIds = bRes.features.map((f:any) => f.attributes.OBJECTID);
                    if (bObjectIds.length > 0) allVisualFeatures.push(...bRes.features);
                  } catch (err) {
                    console.error("Error applying filter to layer:", (targetLayerToQuery as any).title, err);
                  }
              }
            } else {
              buildingLayers.forEach((l:any) => l.definitionExpression = "1=0"); // HIDE all buildings if none match
            }
          }

          setIsFilterActive(true); 
          if (allVisualFeatures.length > 0) {
            view.goTo(allVisualFeatures, { animate: true, duration: 2000 });
            
            // Clear any old pins if they existed previously
            let hl = view.map.layers.find((l:any) => l.title === "AIHighlightsLayer") as GraphicsLayer;
            if (hl) {
                hl.removeAll();
            }
          }

        } else if (action === 'CLOSEST_SERVICE') {
          // 📍 Closest Service Analysis from chatbot (Using actual road network routing!)
          const targetUnitId = actionUnitId;
          let unitPoint: any = null;
          
          if (targetUnitId) {
            // Try finding in Villas_Global first
            const villasLayer = view.map.allLayers.find((l:any) => l.title === 'Villas_Global') as FeatureLayer;
            if (villasLayer) {
              const vq = villasLayer.createQuery();
              vq.where = `OBJECTID = ${targetUnitId}`;
              vq.returnGeometry = true;
              const vRes = await villasLayer.queryFeatures(vq);
              if (vRes.features.length > 0) {
                const geom = vRes.features[0].geometry as any;
                unitPoint = geom.centroid || geom.extent?.center;
              }
            }
            
            // If not found in villas, try buildings via Units table
            if (!unitPoint) {
              const unitsTable = view.map.tables?.find((t:any) => t.title === 'Units') as FeatureLayer || view.map.allLayers.find((l:any) => l.title === 'Units') as FeatureLayer;
              if (unitsTable) {
                const uq = unitsTable.createQuery();
                uq.where = `OBJECTID = ${targetUnitId}`;
                uq.outFields = ['*'];
                const uRes = await unitsTable.queryFeatures(uq);
                if (uRes.features.length > 0) {
                  const buildingFK = uRes.features[0].attributes.BuildingID_FK;
                  if (buildingFK) {
                    const cleanFK = String(buildingFK).replace(/[{}]/g, '').trim();
                    const bLayers = view.map.allLayers.filter((l:any) => l.title && (l.title.includes('Buildings') || l.title.includes('WSL'))).toArray();
                    for (const bl of bLayers) {
                      const bq = (bl as any).createQuery();
                      bq.where = `GlobalID IN ('{${cleanFK}}', '${cleanFK}', '{${cleanFK.toUpperCase()}}', '${cleanFK.toUpperCase()}')`;
                      bq.returnGeometry = true;
                      try {
                        const bRes = await (bl as any).queryFeatures(bq);
                        if (bRes.features.length > 0) {
                          const geom = bRes.features[0].geometry as any;
                          unitPoint = geom.centroid || geom.extent?.center;
                          break;
                        }
                      } catch (e) { /* skip */ }
                    }
                  }
                }
              }
            }
          }
          
          if (unitPoint) {
            // Find or create Routes / Highlights layer
            let routeLayer = view.map.layers.find((l:any) => l.title === "Closest Facilities Routes") as GraphicsLayer;
            if (!routeLayer) {
              routeLayer = new GraphicsLayer({
                title: "Closest Facilities Routes",
                elevationInfo: { mode: "relative-to-ground", offset: 6 }
              });
              view.map.add(routeLayer);
            }
            routeLayer.removeAll();

            const serviceGroups: { [key: string]: { color: number[], solidColor: number[], features: Graphic[] } } = {
              "school": { color: [134, 214, 100, 1], solidColor: [134, 214, 100], features: [] },
              "gym": { color: [248, 113, 113, 1], solidColor: [248, 113, 113], features: [] },
              "commercial": { color: [96, 165, 250, 1], solidColor: [96, 165, 250], features: [] },
              "hospital": { color: [250, 204, 21, 1], solidColor: [250, 204, 21], features: [] }
            };

            const servicesLayer = view.map.allLayers.find((l:any) => l.title === "Services_Global") as FeatureLayer;
            if (servicesLayer) {
              const query = servicesLayer.createQuery();
              query.where = "1=1";
              query.returnGeometry = true;
              query.outFields = ["*"];
              
              try {
                const featureSet = await servicesLayer.queryFeatures(query);
                featureSet.features.forEach((feature: any) => {
                  let matchedType: string | null = null;
                  const typeCode = feature.attributes.Type;

                  if (typeCode === 1) matchedType = "school";
                  else if (typeCode === 2) matchedType = "hospital";
                  else if (typeCode === 3) matchedType = "gym";
                  else if (typeCode === 4) matchedType = "commercial";

                  if (matchedType && serviceGroups[matchedType]) {
                    const geom = feature.geometry as any;
                    const centerPt = geom.extent ? geom.extent.center : geom;
                    serviceGroups[matchedType].features.push(new Graphic({ geometry: centerPt }));
                  }
                });
              } catch (error) {
                console.error("Failed to query services geometry:", error);
              }
            }

            const routingServiceUrl = "https://route.arcgis.com/arcgis/rest/services/World/ClosestFacility/NAServer/ClosestFacility_World";
            const incidents = new FeatureSet({ features: [new Graphic({ geometry: new Point({ longitude: unitPoint.longitude, latitude: unitPoint.latitude }) })] });
            
            const currentGlobalKey = esriConfig.apiKey;
            esriConfig.apiKey = "";

            try {
              await esriId.getCredential(routingServiceUrl);

              const routePromises = Object.keys(serviceGroups).map(async (typeKey) => {
                const typeData = serviceGroups[typeKey];
                if (typeData.features.length === 0) return null;

                const facilities = new FeatureSet({ features: typeData.features });
                const params = new ClosestFacilityParameters({
                  incidents: incidents,
                  facilities: facilities,
                  returnRoutes: true,
                  defaultTargetFacilityCount: 1
                });

                try {
                  const results = await closestFacility.solve(routingServiceUrl, params, {} as any);
                  const features = results?.routes?.features;

                  if (features && features.length > 0) {
                    const routeGraphic = features[0];
                    const totalKm = routeGraphic.attributes.Total_Kilometers || 0;
                    const totalMinsFloat = routeGraphic.attributes.Total_Minutes || routeGraphic.attributes.Total_TravelTime || 0;
                    const meters = Math.round(totalKm * 1000);
                    let minutes = Math.floor(totalMinsFloat);
                    let seconds = Math.round((totalMinsFloat - minutes) * 60);

                    if (seconds === 60) { minutes += 1; seconds = 0; }
                    let timeString = `${minutes} min`;
                    if (seconds > 0) timeString += ` ${seconds} sec`;
                    const formattedInfo = `${meters} m | ${timeString}`;

                    routeGraphic.symbol = {
                      type: "line-3d",
                      symbolLayers: [{
                        type: "path", profile: "circle", width: 4, material: { color: typeData.color }
                      }]
                    } as any;

                    const routeGeom = routeGraphic.geometry as any;
                    const lastPath = routeGeom.paths[routeGeom.paths.length - 1];
                    const endPointCoords = lastPath[lastPath.length - 1];

                    const targetFacilityPoint = new Point({
                      x: endPointCoords[0], y: endPointCoords[1], z: endPointCoords.length > 2 ? endPointCoords[2] : 0,
                      spatialReference: routeGeom.spatialReference
                    });

                    const facilityPin = new Graphic({
                      geometry: targetFacilityPoint,
                      symbol: {
                        type: "point-3d",
                        symbolLayers: [{
                          type: "object", resource: { primitive: "inverted-cone" }, height: 40, width: 15, material: { color: typeData.solidColor }
                        }]
                      } as any
                    });

                    return { routeGraphic, facilityPin, typeKey, infoText: formattedInfo };
                  }
                } catch (error) {
                  console.error(`Route failed for ${typeKey}:`, error);
                }
                return null;
              });

              const routeResults = await Promise.all(routePromises);
              const validResults = routeResults.filter(r => r !== null);

              if (validResults.length > 0) {
                const graphicsToAdd: any[] = [];
                const lines: string[] = [`📍 Closest Services to Unit #${targetUnitId} (via Road Network):\n`];

                validResults.forEach(res => {
                  if (res) {
                    graphicsToAdd.push(res.routeGraphic);
                    graphicsToAdd.push(res.facilityPin);
                    
                    const emoji = res.typeKey === 'school' ? '🏫' : res.typeKey === 'hospital' ? '🏥' : res.typeKey === 'gym' ? '💪' : '🏪';
                    lines.push(`${emoji} ${res.typeKey.toUpperCase()}: ${res.infoText}`);
                  }
                });

                routeLayer.addMany(graphicsToAdd);
                routeLayer.listMode = "show";
                
                // Zoom map to show all route lines
                view.goTo(graphicsToAdd, { animate: true, duration: 2000 });

                finalReplyText = lines.join('\n');
                setMessages(prev => [...prev, { sender: 'ai', text: finalReplyText, action: action, actionUnitId: actionUnitId }]);
              }
            } catch (err) {
              console.warn("Sign-in cancelled or failed:", err);
              finalReplyText = "ArcGIS Login is required to calculate the real road routes. Please log in when prompted.";
              setMessages(prev => [...prev, { sender: 'ai', text: finalReplyText, action: action, actionUnitId: actionUnitId }]);
            } finally {
              esriConfig.apiKey = currentGlobalKey;
            }
          } else {
            finalReplyText = `Could not find unit #${targetUnitId} on the map. Please check the ID and try again.`;
            setMessages(prev => [...prev, { sender: 'ai', text: finalReplyText, action: action, actionUnitId: actionUnitId }]);
          }

        } else if (!isFilterQuery) {
          setMessages(prev => [...prev, { sender: 'ai', text: finalReplyText, action: action, actionUnitId: actionUnitId }]);
          const SAFE_LAYERS = ["Villas_Global", "roads_Global", "Trees", "Trees_Global", "Landscape_Global", "Landscape"];
          const allVisualLayers = view.map.allLayers.filter((l:any) => 
            l.title === "Villas_Global" || (!SAFE_LAYERS.includes(l.title) && (l.type === "feature" || l.type === "scene" || l.type === "building-scene" || l.type === "integrated-mesh"))
          ).toArray();
          
          allVisualLayers.forEach(async layer => {
            (layer as any).definitionExpression = "1=1"; 
            (layer as any).visible = true;
          });
          const hl = view.map.layers.find((l:any) => l.title === "AIHighlightsLayer") as GraphicsLayer;
          if (hl) hl.removeAll();
          setIsFilterActive(false);
        } else {
          setMessages(prev => [...prev, { sender: 'ai', text: finalReplyText, action: action, actionUnitId: actionUnitId }]);
        }
      } else {
        setMessages(prev => [...prev, { sender: 'ai', text: finalReplyText, action: action, actionUnitId: actionUnitId }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, an error occurred while connecting to the servers.' }]); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isAuthModalOpen && (
        <AuthModal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
          onSuccess={handleLoginSuccess} 
        />
      )}

      <div id="tour-ai-advisor" style={{ position: 'absolute', bottom: '30px', right: '30px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        
        {isOpen && (
          <div style={{ width: '350px', height: '450px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', color: 'var(--text-secondary)', overflow: 'hidden', marginBottom: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            
            <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-tertiary)', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🤖 GeoTwin AI Advisor</span> 
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✖</button>
            </div>
            
            {isFilterActive && (
              <div style={{ padding: '8px', backgroundColor: '#1f2428', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                <button 
                  onClick={handleResetFilter}
                  style={{ backgroundColor: 'var(--accent-gold)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', width: '100%', transition: 'background-color 0.2s' }}
                >
                  🔄 Reset Filtering
                </button>
              </div>
            )}

            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', padding: '0 4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Suggested Questions (أسئلة مقترحة):</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    "We are a family of 5, what do you recommend? (نحن أسرة من 5 أفراد، بماذا تنصحني؟)",
                    "My salary is 30000, what can I afford? (راتبي 30 ألف، ماذا أستطيع الشراء؟)",
                    "I want an investment plan (أريد خطة استثمارية للعقارات)",
                    "Show me villas near the gym (أظهر لي الفيلات القريبة من الجيم)"
                  ].map((q, idx) => (
                    <button 
                      key={idx}
                      onClick={() => handleSend(q.split(' (')[0])}
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--accent-blue)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '16px',
                        padding: '6px 12px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        textAlign: 'left'
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.sender === 'user' ? 'var(--accent-blue-bg)' : 'var(--border-color)', padding: '10px 14px', borderRadius: '12px', borderBottomRightRadius: m.sender === 'user' ? '2px' : '12px', borderBottomLeftRadius: m.sender === 'ai' ? '2px' : '12px', maxWidth: '85%', fontSize: '14px', lineHeight: '1.5', direction: 'ltr', whiteSpace: 'pre-wrap' }}>
                  {m.text}
                  
                  {m.action === 'BOOK_UNIT' && m.actionUnitId && (
                    <button 
                      onClick={() => handleConfirmBooking(m.actionUnitId as number)}
                      style={{ 
                        display: 'block', marginTop: '10px', backgroundColor: 'var(--accent-green-bg)', 
                        color: 'var(--text-primary)', border: 'none', padding: '8px 12px', 
                        borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: '100%',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      ✅ Confirm Booking for Unit #{m.actionUnitId}
                    </button>
                  )}
                </div>
              ))}
              {isLoading && <div style={{ fontSize: '13px', color: 'var(--text-muted)', alignSelf: 'flex-start' }}>Thinking...</div>}
            </div>
            
            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', backgroundColor: 'var(--bg-primary)' }}>
              <input 
                value={input} 
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', direction: 'ltr' }}
                placeholder="Search for an apartment, ask about prices..." 
              />
              <button onClick={() => handleSend()} style={{ padding: '10px 16px', backgroundColor: 'var(--accent-green-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
            </div>
          </div>
        )}

        {!isOpen && (
          <button 
            onClick={() => setIsOpen(true)}
            style={{
              width: '60px', height: '60px', borderRadius: '30px',
              backgroundColor: 'var(--accent-blue-bg)', color: 'var(--text-primary)', border: 'none',
              fontSize: '28px', cursor: 'pointer', boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              transition: 'transform 0.2s'
            }}
          >
            💬
          </button>
        )}
      </div>
    </>
  );
};

export default AIAdvisor;