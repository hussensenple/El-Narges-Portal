import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';

import WebMap from '@arcgis/core/WebMap';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Query from '@arcgis/core/rest/support/Query';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import LayerList from '@arcgis/core/widgets/LayerList';
import Legend from '@arcgis/core/widgets/Legend';
import Expand from '@arcgis/core/widgets/Expand';


interface UtilityNetworkModalProps {
  complaintCoordinates?: { lat: number; lon: number } | null;
}

const UtilityNetworkModal: React.FC<UtilityNetworkModalProps> = ({ complaintCoordinates }) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [snappedPipeId, setSnappedPipeId] = useState<number | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [traceType, setTraceType] = useState<'isolation' | 'connected'>('isolation');
  const [traceResults, setTraceResults] = useState<{ pipes: number[], valvesToClose: { id: number, coord: [number, number] }[], serviceValves: { id: number, coord: [number, number] }[], alreadyClosedValves: { id: number, coord: [number, number] }[], meters: { id: number, coord: [number, number] }[], unitsCount?: number, affectedUnits?: { id: string, name: string, status: string, ownerEmail?: string }[], ownerEmails?: string[] } | null>(null);
  const [connectedTraceResults, setConnectedTraceResults] = useState<{ connectedPipes: number[], openValves: { id: number, coord: [number, number], type: number }[], closedValves: { id: number, coord: [number, number], type: number }[], connectedMeters: { id: number, coord: [number, number] }[] } | null>(null);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyDate, setNotifyDate] = useState('');
  const [notifyFromTime, setNotifyFromTime] = useState('');
  const [notifyToTime, setNotifyToTime] = useState('');
  const [isNotifying, setIsNotifying] = useState(false);

  const [showUnitsModal, setShowUnitsModal] = useState(false);
  const [includeIsolated, setIncludeIsolated] = useState(true);
  
  const [isSelectingPoint, setIsSelectingPoint] = useState(false);
  const isSelectingRef = useRef(false);
  const [graphicsLayer, setGraphicsLayer] = useState<GraphicsLayer | null>(null);

  const [valvesModalOpen, setValvesModalOpen] = useState(false);
  const [valveDetails, setValveDetails] = useState<any[]>([]);
  const [selectedMapValve, setSelectedMapValve] = useState<any>(null);
  const waterDevicesUrl = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/UN_Map_WFL1/FeatureServer/32';
  
  // Feature Layers
  const waterLinesUrl = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/UN_Map_WFL1/FeatureServer/17';

  useEffect(() => {
    if (!mapDiv.current) return;

    const webmap = new WebMap({
      portalItem: {
        id: '4571998c4e82444188cb2a9a6736049f'
      }
    });

    const gLayer = new GraphicsLayer();
    // We add this later inside mapView.when to ensure it renders on top of portal layers
    setGraphicsLayer(gLayer);

    const mapView = new MapView({
      container: mapDiv.current,
      map: webmap,
      extent: {
        xmin: 3504688.3876,
        ymin: 3511125.3373,
        xmax: 3505717.2253,
        ymax: 3511896.4716,
      },
      padding: { top: 70, bottom: 0, left: 0, right: 0 } // Push ArcGIS UI down below the login header
    });

    setView(mapView);

    mapView.when(() => {
      webmap.add(gLayer, 0); // Put pipe selection at the bottom, UNDER the original features
      
      // Add Layer List Widget
      const layerList = new LayerList({ view: mapView });
      const layerListExpand = new Expand({
        view: mapView,
        content: layerList,
        expanded: false,
        expandTooltip: "Layers",
        expandIcon: "layers"
      });
      mapView.ui.add(layerListExpand, "top-right");

      // Add Legend Widget
      const legend = new Legend({ view: mapView });
      const legendExpand = new Expand({
        view: mapView,
        content: legend,
        expanded: false,
        expandTooltip: "Legend",
        expandIcon: "legend"
      });
      mapView.ui.add(legendExpand, "top-right");
      const performSnap = async (mapPoint: any) => {
        gLayer.removeAll(); // clear previous lines
        mapView.graphics.removeAll(); // clear previous points from view

        const layer = new FeatureLayer({ url: waterLinesUrl });
        const query = new Query();
        query.geometry = mapPoint;
        query.distance = 20; // 20 meters tolerance
        query.units = 'meters';
        query.spatialRelationship = 'intersects';
        query.returnGeometry = true;
        query.outFields = ['OBJECTID', 'ASSETGROUP'];

        try {
          const results = await layer.queryFeatures(query);
          if (results.features.length > 0) {
            const feature = results.features[0];
            const objectId = feature.attributes.OBJECTID;
            setSnappedPipeId(objectId);

            const clickGraphic = new Graphic({
              geometry: mapPoint,
              symbol: new SimpleMarkerSymbol({ 
                color: '#3fb950', 
                size: '18px',
                outline: { color: 'white', width: 3 } 
              })
            });
            mapView.graphics.add(clickGraphic);
          } else {
            setSnappedPipeId(null);
            alert("No water pipes found near this location.");
            gLayer.removeAll();
            mapView.graphics.removeAll();
          }
        } catch (error) {
          console.error("Error querying pipes:", error);
        }
      };

      mapView.goTo({ center: [31.492, 30.062], zoom: 15 });

      // Handle map clicks for snapping
      mapView.on('click', async (event) => {
        if (isSelectingRef.current) {
          await performSnap(event.mapPoint);
          setIsSelectingPoint(false);
          isSelectingRef.current = false;
          return;
        }

        const layer = new FeatureLayer({ url: 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/UN_Map_WFL1/FeatureServer/32' });
        const query = new Query();
        query.geometry = event.mapPoint;
        query.distance = 10;
        query.units = 'meters';
        query.spatialRelationship = 'intersects';
        query.outFields = ['OBJECTID', 'ASSETGROUP', 'ASSETTYPE', 'Status'];
        
        try {
          const res = await layer.queryFeatures(query);
          const valveFeature = res.features.find((f: any) => f.attributes.ASSETGROUP === 3);
          
          if (valveFeature) {
            setSelectedMapValve({
              ...valveFeature.attributes,
              screenX: event.x,
              screenY: event.y
            });
          } else {
            setSelectedMapValve(null);
          }
        } catch (err) {
          console.error("Map click query error:", err);
        }
      });

      mapView.on('drag', () => {
        setSelectedMapValve(null);
      });
      mapView.on('mouse-wheel', () => {
        setSelectedMapValve(null);
      });
    });

    return () => {
      if (mapView) {
        mapView.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (!view || !graphicsLayer || !complaintCoordinates) return;

    const pt = new Point({
      longitude: complaintCoordinates.lon,
      latitude: complaintCoordinates.lat
    });

    const querySnap = async () => {
      graphicsLayer.removeAll();
      view.graphics.removeAll();
      
      // Navigate to the complaint point
      view.goTo({ target: pt, zoom: 19 });

      const layer = new FeatureLayer({ url: waterLinesUrl });
      const query = new Query();
      query.geometry = pt;
      query.distance = 20; // 20 meters tolerance
      query.units = 'meters';
      query.spatialRelationship = 'intersects';
      query.returnGeometry = true;
      query.outFields = ['OBJECTID', 'ASSETGROUP'];

      try {
        const results = await layer.queryFeatures(query);
        if (results.features.length > 0) {
          const feature = results.features[0];
          const objectId = feature.attributes.OBJECTID;
          setSnappedPipeId(objectId);

          const clickGraphic = new Graphic({
            geometry: pt,
            symbol: new SimpleMarkerSymbol({ 
              color: '#3fb950', 
              size: '18px',
              outline: { color: 'white', width: 3 } 
            })
          });
          view.graphics.add(clickGraphic);
        } else {
          setSnappedPipeId(null);
          // If no pipe nearby, still show the point where the complaint was made
          const clickGraphic = new Graphic({
            geometry: pt,
            symbol: new SimpleMarkerSymbol({ 
              color: 'var(--accent-red-bg)', 
              size: '18px',
              outline: { color: 'white', width: 3 } 
            })
          });
          view.graphics.add(clickGraphic);
        }
      } catch (error) {
        console.error("Error querying pipes:", error);
      }
    };

    // Wait until the view is fully ready before trying to query and draw
    view.when(() => {
      querySnap();
    });

  }, [complaintCoordinates, view, graphicsLayer]);

  const handleOpenValvesModal = async (type: 'system' | 'service' | 'all' = 'all') => {
    if (!traceResults) return;
    setValvesModalOpen(true);
    
    let allValveIds: number[] = [];
    
    if (type === 'system') {
      allValveIds = [
        ...traceResults.valvesToClose.map((v: any) => v.id),
        ...(traceResults.alreadyClosedValves?.map((v: any) => v.id) || [])
      ];
    } else if (type === 'service') {
      allValveIds = [
        ...(traceResults.serviceValves?.map((v: any) => v.id) || [])
      ];
    } else {
      allValveIds = [
        ...traceResults.valvesToClose.map((v: any) => v.id),
        ...(traceResults.serviceValves?.map((v: any) => v.id) || []),
        ...(traceResults.alreadyClosedValves?.map((v: any) => v.id) || [])
      ];
    }
    
    if (allValveIds.length === 0) {
      setValveDetails([]);
      return;
    }
    
    const layer = new FeatureLayer({ url: waterDevicesUrl });
    const query = new Query();
    query.objectIds = allValveIds;
    query.outFields = ['OBJECTID', 'ASSETGROUP', 'ASSETTYPE', 'Status'];
    
    try {
      const res = await layer.queryFeatures(query);
      setValveDetails(res.features.map(f => f.attributes));
    } catch (error) {
      console.error("Failed to query valve details", error);
    }
  };

  const handleToggleValveStatus = async (objectId: number, currentStatus: number) => {
    const newStatus = (currentStatus === 1 || currentStatus == null) ? 0 : 1;
    const layer = new FeatureLayer({ url: waterDevicesUrl });
    
    const graphic = new Graphic({
      attributes: {
        OBJECTID: objectId,
        Status: newStatus
      }
    });

    try {
      const editResult = await layer.applyEdits({ updateFeatures: [graphic] });
      if (editResult.updateFeatureResults.length > 0 && !editResult.updateFeatureResults[0].error) {
        setValveDetails(prev => prev.map(v => v.OBJECTID === objectId ? { ...v, Status: newStatus } : v));
        if (selectedMapValve && selectedMapValve.OBJECTID === objectId) {
          setSelectedMapValve({ ...selectedMapValve, Status: newStatus });
        }
      } else {
        alert("Failed to update valve status.");
      }
    } catch (error) {
      console.error("Error updating valve status:", error);
      alert("Error updating valve status.");
    }
  };

  const handleTrace = async () => {
    if (!snappedPipeId) return;
    setIsTracing(true);
    setTraceResults(null);
    setConnectedTraceResults(null);

    try {
      const token = localStorage.getItem('token');
      
      if (traceType === 'isolation') {
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/utility-network/trace`, {
          startPipeId: snappedPipeId,
          includeIsolatedFeatures: includeIsolated
        }, {
          headers: { 'x-auth-token': token }
        });

        const { isolatedPipes, valvesToClose, serviceValves, alreadyClosedValves, affectedMeters, affectedUnitsCount, affectedUnits, ownerEmails } = res.data;

        setTraceResults({ 
          pipes: isolatedPipes, 
          valvesToClose, 
          serviceValves,
          alreadyClosedValves, 
          meters: affectedMeters, 
          unitsCount: affectedUnitsCount,
          affectedUnits,
          ownerEmails 
        });

        // Render the results on the map
        if (graphicsLayer && view) {
          graphicsLayer.removeAll(); // Clear existing

          // Fetch geometries for isolated pipes
          if (includeIsolated && isolatedPipes.length > 0) {
            const linesLayer = new FeatureLayer({ url: waterLinesUrl });
            const linesQuery = new Query();
            linesQuery.objectIds = isolatedPipes;
            linesQuery.returnGeometry = true;
            const linesRes = await linesLayer.queryFeatures(linesQuery);
            
            linesRes.features.forEach(f => {
              graphicsLayer.add(new Graphic({
                geometry: f.geometry,
                symbol: new SimpleLineSymbol({ color: [0, 255, 255, 0.6], width: 4 }) // Cyan for isolated pipes
              }));
            });
          }

          // Draw affected meters and service valves if includeIsolated is true
          if (includeIsolated) {
              if (affectedMeters.length > 0) {
                affectedMeters.forEach((m: any) => {
                  view.graphics.add(new Graphic({ geometry: new Point({ x: m.coord[0], y: m.coord[1], spatialReference: { wkid: 4326 } }),
                    symbol: new SimpleMarkerSymbol({
                      style: "circle",
                      color: [148, 0, 211, 0.4], // Semi-transparent Purple fill
                      size: '26px',
                      outline: { color: [148, 0, 211, 1], width: 3 } // Thick Purple outline
                    })
                  }));
                });
              }

              if (serviceValves && serviceValves.length > 0) {
                serviceValves.forEach((sv: any) => {
                  view.graphics.add(new Graphic({ geometry: new Point({ x: sv.coord[0], y: sv.coord[1], spatialReference: { wkid: 4326 } }),
                    symbol: new SimpleMarkerSymbol({
                      style: "square",
                      color: [255, 165, 0, 0.4], // Semi-transparent Orange fill
                      size: '26px',
                      outline: { color: [255, 165, 0, 1], width: 3 } // Thick Orange outline
                    })
                  }));
                });
              }
          }

          // Draw bounding valves to close
          if (valvesToClose.length > 0) {
            valvesToClose.forEach((v: any) => {
              view.graphics.add(new Graphic({ geometry: new Point({ x: v.coord[0], y: v.coord[1], spatialReference: { wkid: 4326 } }),
                symbol: new SimpleMarkerSymbol({
                  style: "circle",
                  color: [255, 0, 0, 0.4], // Transparent red glow
                  size: '34px',
                  outline: { color: [255, 0, 0, 1], width: 3 }
                })
              }));
              view.graphics.add(new Graphic({ geometry: new Point({ x: v.coord[0], y: v.coord[1], spatialReference: { wkid: 4326 } }),
                symbol: new SimpleMarkerSymbol({
                  style: "x",
                  color: [255, 0, 0, 1], // Solid Red X
                  size: '20px',
                  outline: { color: [255, 255, 255, 1], width: 3 }
                })
              }));
            });
          }

          // Draw already closed valves
          if (alreadyClosedValves.length > 0) {
            alreadyClosedValves.forEach((v: any) => {
              view.graphics.add(new Graphic({ geometry: new Point({ x: v.coord[0], y: v.coord[1], spatialReference: { wkid: 4326 } }),
                symbol: new SimpleMarkerSymbol({
                  style: "circle",
                  color: [100, 100, 100, 0.4], // Gray glow
                  size: '30px',
                  outline: { color: [100, 100, 100, 1], width: 3 }
                })
              }));
            });
          }

          // Zoom to extent of graphics
          view.goTo(graphicsLayer.graphics.toArray());
        }
      } else if (traceType === 'connected') {
        const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/utility-network/connected-trace`, {
          startPipeId: snappedPipeId
        }, {
          headers: { 'x-auth-token': token }
        });

        const { connectedPipes, openValves, closedValves, connectedMeters } = res.data;
        setConnectedTraceResults({ connectedPipes, openValves, closedValves, connectedMeters });

        if (graphicsLayer && view) {
          graphicsLayer.removeAll();

          if (connectedPipes.length > 0) {
            const linesLayer = new FeatureLayer({ url: waterLinesUrl });
            const linesQuery = new Query();
            linesQuery.objectIds = connectedPipes;
            linesQuery.returnGeometry = true;
            const linesRes = await linesLayer.queryFeatures(linesQuery);
            
            linesRes.features.forEach(f => {
              graphicsLayer.add(new Graphic({
                geometry: f.geometry,
                symbol: new SimpleLineSymbol({ color: '#00ffff', width: 4 }) // Solid Cyan for selection
              }));
            });
          }

          if (openValves.length > 0) {
            openValves.forEach((v: any) => {
              view.graphics.add(new Graphic({ geometry: new Point({ x: v.coord[0], y: v.coord[1], spatialReference: { wkid: 4326 } }),
                symbol: new SimpleMarkerSymbol({
                  style: "circle",
                  color: [0, 255, 255, 0.5], // Semi-transparent Cyan fill
                  size: '26px',
                  outline: { color: [0, 255, 255, 0.5], width: 1 }
                })
              }));
            });
          }

          if (closedValves.length > 0) {
            closedValves.forEach((v: any) => {
              view.graphics.add(new Graphic({ geometry: new Point({ x: v.coord[0], y: v.coord[1], spatialReference: { wkid: 4326 } }),
                symbol: new SimpleMarkerSymbol({
                  style: "circle",
                  color: [0, 255, 255, 0.5], // Semi-transparent Cyan fill
                  size: '30px',
                  outline: { color: [0, 255, 255, 0.5], width: 1 }
                })
              }));
              view.graphics.add(new Graphic({ geometry: new Point({ x: v.coord[0], y: v.coord[1], spatialReference: { wkid: 4326 } }),
                symbol: new SimpleMarkerSymbol({
                  style: "x",
                  color: [0, 255, 255, 1],
                  size: '20px',
                  outline: { color: [255, 255, 255, 1], width: 3 }
                })
              }));
            });
          }

          if (connectedMeters.length > 0) {
            connectedMeters.forEach((m: any) => {
              view.graphics.add(new Graphic({ geometry: new Point({ x: m.coord[0], y: m.coord[1], spatialReference: { wkid: 4326 } }),
                symbol: new SimpleMarkerSymbol({
                  style: "circle",
                  color: [0, 255, 255, 0.5], // Semi-transparent Cyan fill
                  size: '26px',
                  outline: { color: [0, 255, 255, 0.5], width: 1 }
                })
              }));
            });
          }

          view.goTo(graphicsLayer.graphics.toArray());
        }
      }

    } catch (error) {
      console.error("Tracing error:", error);
      alert("Failed to perform trace.");
    } finally {
      setIsTracing(false);
    }
  };

  const handleReset = () => {
    setTraceResults(null);
    setConnectedTraceResults(null);
    setShowUnitsModal(false);
    setSnappedPipeId(null);
    setIsSelectingPoint(false);
    isSelectingRef.current = false;
    if (graphicsLayer) {
      graphicsLayer.removeAll();
    }
    if (view) {
      view.graphics.removeAll();
    }
  };

  const handleNotify = async () => {
    if (!traceResults || !traceResults.meters || !notifyDate || !notifyFromTime || !notifyToTime) {
      alert('Please fill in the date and time fields.');
      return;
    }
    
    setIsNotifying(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/api/utility-network/notify`, {
        meterIds: traceResults.meters.map(m => m.id),
        ownerEmails: traceResults.ownerEmails || [],
        date: notifyDate,
        fromTime: notifyFromTime,
        toTime: notifyToTime
      }, {
        headers: { 'x-auth-token': token }
      });
      alert(`Successfully triggered notifications for ${traceResults.unitsCount} affected units.`);
      setShowNotifyModal(false);
      setNotifyDate('');
      setNotifyFromTime('');
      setNotifyToTime('');
    } catch (error) {
      console.error("Notify error:", error);
      alert("Failed to notify owners.");
    } finally {
      setIsNotifying(false);
    }
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100 }}>
      {/* Map Container */}
      <div ref={mapDiv} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
      
      {/* Floating UI Container */}
      <div style={{ position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)', width: '800px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10 }}>
        
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '15px', padding: '15px 20px', backgroundColor: 'var(--bg-secondary)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <div style={{ flex: 1, display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-primary)' }}>Instructions:</h4>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                Click on the map near a pipe. Select trace type and run trace.
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              {!traceResults && !connectedTraceResults && (
                <button 
                  onClick={() => {
                    const newState = !isSelectingPoint;
                    setIsSelectingPoint(newState);
                    isSelectingRef.current = newState;
                  }} 
                  disabled={isTracing}
                  style={{ padding: '10px 20px', height: '40px', backgroundColor: isSelectingPoint ? '#ffcc00' : '#444c56', color: isSelectingPoint ? '#000' : 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {isSelectingPoint ? 'Click on Map...' : 'Add Starting Point'}
                </button>
              )}

              {!traceResults && !connectedTraceResults && (
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#444c56', borderRadius: '6px', overflow: 'hidden', height: '40px', border: '1px solid var(--border-color)' }}>
                  <select 
                    value={traceType}
                    onChange={e => setTraceType(e.target.value as 'isolation' | 'connected')}
                    style={{ padding: '0 10px 0 15px', height: '100%', backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', fontSize: '14px', outline: 'none', cursor: 'pointer', fontWeight: 'bold', appearance: 'none' }}
                  >
                    <option value="isolation" style={{ backgroundColor: 'var(--bg-primary)' }}>Isolation Trace</option>
                    <option value="connected" style={{ backgroundColor: 'var(--bg-primary)' }}>Connected Trace</option>
                  </select>
                  <div style={{ pointerEvents: 'none', marginLeft: '-5px', marginRight: '10px' }}>
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                  <button 
                    onClick={handleTrace} 
                    disabled={!snappedPipeId || isTracing}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 15px', height: '100%', backgroundColor: snappedPipeId ? 'var(--accent-blue-bg)' : 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', cursor: snappedPipeId ? 'pointer' : 'not-allowed', transition: 'background-color 0.2s' }}
                    title="Run Trace"
                  >
                    {isTracing ? (
                      <span className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid transparent', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </button>
                  <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {traceResults && (
                <button 
                  onClick={() => setShowNotifyModal(true)} 
                  style={{ padding: '10px 20px', height: '40px', backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Confirm & Notify Owners
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              {traceType === 'isolation' && (
                <label style={{ color: 'var(--text-primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={includeIsolated} 
                    onChange={e => setIncludeIsolated(e.target.checked)} 
                    disabled={isTracing}
                    style={{ margin: 0, width: '16px', height: '16px' }}
                  />
                  Include Isolated Features
                </label>
              )}

              {(traceResults || connectedTraceResults) && (
                <button 
                  onClick={handleReset} 
                  style={{ padding: '10px 20px', height: '40px', backgroundColor: '#444c56', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Bar */}
        {traceResults && (
            <div style={{ display: 'flex', gap: '20px', padding: '15px 20px', backgroundColor: 'var(--bg-secondary)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid var(--border-color)', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ffff', fontWeight: 'bold' }}>
                <div style={{ width: '24px', height: '4px', backgroundColor: '#00ffff', borderRadius: '2px' }} />
                Isolated Pipes: {traceResults.pipes.length}
              </span>
              <span 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff7b72', fontWeight: 'bold', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'background-color 0.2s' }}
                onClick={() => handleOpenValvesModal('system')}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #ff7b72', backgroundColor: 'rgba(255,0,0,0.4)' }}>
                  <span style={{ color: 'white', fontSize: '16px', lineHeight: 1, paddingBottom: '2px' }}>×</span>
                </div>
                Valves to Close: {traceResults.valvesToClose.length}
              </span>
              {traceResults.serviceValves && traceResults.serviceValves.length > 0 && (
                <span 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'orange', fontWeight: 'bold', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'background-color 0.2s' }}
                  onClick={() => handleOpenValvesModal('service')}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ width: '16px', height: '16px', border: '2px solid orange', backgroundColor: 'rgba(255,165,0,0.4)', borderRadius: '2px' }} />
                  Service Valves: {traceResults.serviceValves.length}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--text-muted)', backgroundColor: 'rgba(100,100,100,0.4)' }} />
                Already Closed: {traceResults.alreadyClosedValves.length}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgb(148,0,211)', backgroundColor: 'rgba(148,0,211,0.4)' }} />
                Affected Meters: {traceResults.meters.length}
              </span>
              <span 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'background-color 0.2s' }}
                onClick={() => setShowUnitsModal(true)}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ fontSize: '18px', lineHeight: 1 }}>🏠</span>
                Affected Units: {traceResults.unitsCount}
              </span>
            </div>
        )}

        {/* Connected Trace Results Bar */}
        {connectedTraceResults && (
            <div style={{ display: 'flex', gap: '20px', padding: '15px 20px', backgroundColor: 'var(--bg-secondary)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: '1px solid var(--border-color)', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ffff', fontWeight: 'bold' }}>
                Connected Pipes: {connectedTraceResults.connectedPipes.length}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ffff', fontWeight: 'bold' }}>
                Open Valves: {connectedTraceResults.openValves.length}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ffff', fontWeight: 'bold' }}>
                Closed Valves (Barriers): {connectedTraceResults.closedValves.length}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00ffff', fontWeight: 'bold' }}>
                Connected Meters: {connectedTraceResults.connectedMeters.length}
              </span>
            </div>
        )}
        
        {/* Valves List Modal */}
        {valvesModalOpen && valveDetails.length > 0 && (
          <div style={{ position: 'absolute', bottom: '80px', left: '40px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', width: '320px', maxHeight: '400px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 1000, overflow: 'hidden', pointerEvents: 'auto' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Valves Status</h3>
              <button onClick={() => setValvesModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {valveDetails.map(v => (
                <div key={v.OBJECTID} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 'bold' }}>ID: {v.OBJECTID}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{v.ASSETTYPE === 0 ? 'System Valve' : v.ASSETTYPE === 9 ? 'Service Valve' : 'Valve'}</span>
                  </div>
                  <div 
                    onClick={() => handleToggleValveStatus(v.OBJECTID, v.Status)}
                    style={{ width: '40px', height: '20px', borderRadius: '10px', backgroundColor: (v.Status === 1 || v.Status == null) ? '#3fb950' : 'var(--accent-red-bg)', display: 'flex', alignItems: 'center', padding: '0 2px', cursor: 'pointer', justifyContent: (v.Status === 1 || v.Status == null) ? 'flex-end' : 'flex-start', transition: 'all 0.3s' }}
                  >
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--text-primary)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}



        {/* Units List Modal */}
        {showUnitsModal && traceResults && traceResults.affectedUnits && (
          <div style={{ position: 'absolute', bottom: '80px', right: '40px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', width: '320px', maxHeight: '400px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 1000, overflow: 'hidden', pointerEvents: 'auto' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Affected Units ({traceResults.affectedUnits.length})</h3>
              <button onClick={() => setShowUnitsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {traceResults.affectedUnits.map(u => {
                const isSold = u.status === '4' || u.status === 'sold' || u.status === '3' || u.status === 'reserved';
                return (
                  <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 'bold' }}>{u.name}</span>
                      {u.ownerEmail && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{u.ownerEmail}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', backgroundColor: isSold ? 'rgba(218,54,51,0.15)' : 'rgba(35,134,54,0.15)', color: isSold ? '#ff7b72' : '#3fb950', border: `1px solid ${isSold ? 'var(--accent-red-bg)' : 'var(--accent-green-bg)'}`, fontWeight: 'bold' }}>
                      {isSold ? 'Sold / Reserved' : 'Available'}
                    </span>
                  </div>
                );
              })}
              {traceResults.affectedUnits.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: '13px' }}>No units found for these meters.</div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Notify Form Modal */}
      {showNotifyModal && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', width: '380px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 24px rgba(0,0,0,0.8)', zIndex: 2000, pointerEvents: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Send Outage Notification</h3>
            <button onClick={() => setShowNotifyModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>×</button>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Date</label>
              <input 
                type="date" 
                value={notifyDate} 
                onChange={e => setNotifyDate(e.target.value)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '13px' }}>From Time</label>
                <input 
                  type="time" 
                  value={notifyFromTime} 
                  onChange={e => setNotifyFromTime(e.target.value)}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '13px' }}>To Time</label>
                <input 
                  type="time" 
                  value={notifyToTime} 
                  onChange={e => setNotifyToTime(e.target.value)}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={() => setShowNotifyModal(false)}
                style={{ padding: '8px 16px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleNotify}
                disabled={isNotifying}
                style={{ padding: '8px 16px', backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '6px', cursor: isNotifying ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
              >
                {isNotifying ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Click Valve Popup */}
      {selectedMapValve && selectedMapValve.screenX !== undefined && (
        <div style={{ position: 'absolute', top: selectedMapValve.screenY - 15, left: selectedMapValve.screenX, transform: 'translate(-50%, -100%)', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', width: '220px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 1000, pointerEvents: 'auto' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Selected Valve</h3>
            <button onClick={() => setSelectedMapValve(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>×</button>
          </div>
          <div style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 'bold' }}>ID: {selectedMapValve.OBJECTID}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{selectedMapValve.ASSETTYPE === 0 ? 'System Valve' : selectedMapValve.ASSETTYPE === 9 ? 'Service Valve' : 'Valve'}</span>
            </div>
            <div 
              onClick={() => handleToggleValveStatus(selectedMapValve.OBJECTID, selectedMapValve.Status)}
              style={{ width: '40px', height: '20px', borderRadius: '10px', backgroundColor: (selectedMapValve.Status === 1 || selectedMapValve.Status == null) ? '#3fb950' : 'var(--accent-red-bg)', display: 'flex', alignItems: 'center', padding: '0 2px', cursor: 'pointer', justifyContent: (selectedMapValve.Status === 1 || selectedMapValve.Status == null) ? 'flex-end' : 'flex-start', transition: 'all 0.3s' }}
            >
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--text-primary)' }} />
            </div>
          </div>
          {/* Tooltip arrow */}
          <div style={{ position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: '10px', height: '10px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}></div>
        </div>
      )}

    </div>
  );
};

export default UtilityNetworkModal;
