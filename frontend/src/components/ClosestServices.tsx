import { useState, useEffect } from 'react';
import Graphic from '@arcgis/core/Graphic';
import * as closestFacility from '@arcgis/core/rest/closestFacility';
import ClosestFacilityParameters from '@arcgis/core/rest/support/ClosestFacilityParameters';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import Point from '@arcgis/core/geometry/Point';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import SceneView from '@arcgis/core/views/SceneView';
// import esriConfig from "@arcgis/core/config";

// 🔑 ضع الـ API Key الخاص بك هنا لتفعيل الـ Routing
// esriConfig.apiKey = "AAPTalXA9GcZ5lZfym8hKak90bg..wGOn5mTNFbEDgQTSt91zZ3JRiK5hffTjYdmL1ERTSPKglXpsx21W9RNlgzgoJF0Jz2FSdRc_kgkQKBh7X5t02_GyVncvhTB8KHXfFs1UpjrO_P_Si65XTQXNm5Ad_12WXsc1fjlDCgbbBvTDxYSAA495unWWkWQI47Y_XAhMLQaVT-wFHLzecsgMw-jJNUuxC1NWVSjSgp6-dtfQswbqkkwKXrGQ6asF2YrQ9PLmQhL_98RwBQ..AT1_e4bvhm43";

// 🎨 أيقونات الخدمات
const Icons = {
  Target: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
  Trash: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  School: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
  Gym: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5h2v14H6z"/><path d="M16 5h2v14h-2z"/><path d="M2 8h4v8H2z"/><path d="M18 8h4v8h-4z"/><path d="M8 11h8v2H8z"/></svg>,
  Commercial: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>,
  Hospital: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10h-3V7a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v3H3v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10z"></path><line x1="12" y1="7" x2="12" y2="13"></line><line x1="9" y1="10" x2="15" y2="10"></line></svg>,
  Cancel: () => <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

interface ClosestServicesProps {
  view: SceneView | null;
}

const ClosestServices = ({ view }: ClosestServicesProps) => {
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [routeLayer, setRouteLayer] = useState<GraphicsLayer | null>(null);

  const [routeInfo, setRouteInfo] = useState<{ [key: string]: string | null }>({
    school: null,
    gym: null,
    commercial: null,
    hospital: null
  });

  const routingServiceUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/ClosestFacility/NAServer/ClosestFacility_World";
  
  // 🏢 الطبقات المستهدفة للضغط (نتجاهل أي طبقة أخرى مثل LandUse)
//   const TARGET_LAYERS = ["Buildings_Global", "Villas_Global"];

  // 1️⃣ إنشاء طبقة الرسم عند تهيئة الـ Component
  useEffect(() => {
    if (view && view.map) {
      const layer = new GraphicsLayer({
        title: "Closest Facilities Routes", 
        elevationInfo: { mode: "relative-to-ground", offset: 6 },
        listMode: "hide"
      });
      view.map.add(layer);
      setRouteLayer(layer);

      return () => {
        if (view && view.map) {
          view.map.remove(layer);
        }
      };
    }
  }, [view]);

  // 2️⃣ تفعيل أداة الـ HitTest لاختيار المباني
  useEffect(() => {
    if (!view || !isSelecting || !routeLayer) return;

    (view as any).cursor = "crosshair";

    const clickHandle = view.on("click", async (event: any) => {
      event.stopPropagation();
      const response = await view.hitTest(event);
      
      // نبحث في جميع النتائج عن المبنى ونتجاهل الطبقات التي تغطيه
      // 🚀 بحث مرن: تجاهل الـ LandUse والبحث عن أي طبقة تحتوي على اسم المباني
      const residentialHit = response.results.find((res: any) => {
        const title = res.graphic?.layer?.title || "";
        return res.type === "graphic" && 
               !title.includes("LandUse") && // 👈 تجاهل تام لطبقة الـ LandUse
               (title.includes("Buildings") || title.includes("Villas") || title.includes("WSL"));
      }) as any;

      if (residentialHit) {
        setIsSelecting(false);
        (view as any).cursor = "default";

        const clickedBuilding = residentialHit.graphic;
        const geom = clickedBuilding.geometry as any;
        const incidentPoint = geom.extent ? geom.extent.center : geom;

        calculateRouteToServices(incidentPoint, view, routeLayer);
      } else {
        console.warn("⚠️ لم يتم العثور على مبنى أو فيلا في نقطة الضغط.");
      }
    });

    return () => {
      clickHandle.remove();
      (view as any).cursor = "default";
    };
  }, [view, isSelecting, routeLayer]);

  // 3️⃣ استخراج الخدمات وحساب المسارات
  const calculateRouteToServices = async (incidentPoint: Point, currentView: SceneView, activeRouteLayer: GraphicsLayer) => {
    setIsCalculating(true);
    setRouteInfo({ school: null, gym: null, commercial: null, hospital: null });
    
    // إعداد مجموعات الخدمات والألوان الخاصة بكل منها
    const serviceGroups: { [key: string]: { color: number[], solidColor: number[], features: Graphic[] } } = {
      "school": { color: [134, 214, 100, 1], solidColor: [134, 214, 100], features: [] },      
      "gym": { color: [248, 113, 113, 1], solidColor: [248, 113, 113], features: [] },        
      "commercial": { color: [96, 165, 250, 1], solidColor: [96, 165, 250], features: [] },
      "hospital": { color: [250, 204, 21, 1], solidColor: [250, 204, 21], features: [] }  
    };

    if (currentView && currentView.map) {
      const allLayers = currentView.map?.allLayers.toArray() || [];
      const targetFacilityLayer = allLayers.find(l => l.title === "Services_Global");

      if (targetFacilityLayer && typeof (targetFacilityLayer as any).createQuery === "function") {
        const queryLayer = targetFacilityLayer as any;
        const query = queryLayer.createQuery();
        query.where = "1=1"; 
        query.outSpatialReference = currentView.spatialReference;
        query.returnGeometry = true;
        query.outFields = ["*"]; 
        
        try {
          const featureSet = await queryLayer.queryFeatures(query);
          
          // طباعة البيانات الخام في الكونسول لكشف القيم الحقيقية
          console.log("📦 Raw Services Data:", featureSet.features.map((f: any) => f.attributes));

          // تصنيف الخدمات بناءً على أرقام الـ Subtypes
          featureSet.features.forEach((feature: any) => {
            let matchedType: string | null = null;
            
            // قراءة قيمة حقل Type مباشرة
            const typeCode = feature.attributes.Type;

            // مطابقة الرقم مع نوع الخدمة
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

          // طباعة النتيجة للتأكد
          console.log("✅ Services Extracted:", {
            school: serviceGroups.school.features.length,
            hospital: serviceGroups.hospital.features.length,
            gym: serviceGroups.gym.features.length,
            commercial: serviceGroups.commercial.features.length
          });
        } catch (error) {
          console.error("❌ فشل في جلب بيانات طبقة الخدمات:", error);
        }
      }
    }

    const incidents = new FeatureSet({ features: [new Graphic({ geometry: incidentPoint })] });
    activeRouteLayer.removeAll(); 

    // حل المسارات لكل نوع خدمة بشكل متوازي
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

          // رسم المسار كخط ثلاثي الأبعاد
          routeGraphic.symbol = {
            type: "line-3d",
            symbolLayers: [{
              type: "path",
              profile: "circle", 
              width: 4,
              material: { color: typeData.color } 
            }]
          } as any;

          // رسم دبوس على موقع الخدمة
          const routeGeom = routeGraphic.geometry as any;
          const lastPath = routeGeom.paths[routeGeom.paths.length - 1];
          const endPointCoords = lastPath[lastPath.length - 1];

          const targetFacilityPoint = new Point({
            x: endPointCoords[0],
            y: endPointCoords[1],
            z: endPointCoords.length > 2 ? endPointCoords[2] : 0,
            spatialReference: routeGeom.spatialReference
          });

          const facilityPin = new Graphic({
            geometry: targetFacilityPoint,
            symbol: {
              type: "point-3d",
              symbolLayers: [{
                type: "object",
                resource: { primitive: "inverted-cone" },
                height: 40, width: 15,
                material: { color: typeData.solidColor }
              }]
            } as any
          });

          return { routeGraphic, facilityPin, typeKey, infoText: formattedInfo };
        }
      } catch (error) {
        console.error(`❌ فشل حساب المسار لخدمة ${typeKey}:`, error);
      }
      return null;
    });

    try {
      const routeResults = await Promise.all(routePromises);
      const validResults = routeResults.filter(r => r !== null);
      
      if (validResults.length > 0) {
        const newRouteInfo: { [key: string]: string | null } = { school: null, gym: null, commercial: null, hospital: null };
        const graphicsToAdd: any[] = [];
        
        validResults.forEach(res => {
          if(res) {
            graphicsToAdd.push(res.routeGraphic);
            graphicsToAdd.push(res.facilityPin); 
            newRouteInfo[res.typeKey] = res.infoText;
          }
        });

        activeRouteLayer.addMany(graphicsToAdd);
        activeRouteLayer.listMode = "show";
        setRouteInfo(newRouteInfo); 
      }
    } catch (e) {
      console.error("❌ خطأ عام أثناء معالجة المسارات:", e);
    } finally {
      setIsCalculating(false);
    }
  };

  const clearRoutes = () => {
    if (routeLayer) {
      routeLayer.removeAll();
    }
    setRouteInfo({ school: null, gym: null, commercial: null, hospital: null });
    setIsSelecting(false);
    if (view) (view as any).cursor = "default";
  };

  return (
    <div style={{ 
      backgroundColor: '#0d1117', 
      height: 'auto', 
      maxHeight: 'calc(100vh - 160px)', 
      overflowY: 'auto', 
      overflowX: 'hidden', 
      fontFamily: "'Inter', 'Segoe UI', Roboto, sans-serif", 
      color: '#c9d1d9',
      borderRadius: '12px', 
      border: '1px solid #30363d', 
      width: '320px', 
      padding: '20px',
      boxSizing: 'border-box', 
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
    }}>
      
      {/* رأس الـ Widget */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #30363d' }}>
        <h3 style={{ fontWeight: 800, color: '#ffffff', margin: 0, fontSize: '16px' }}>📍 Closest Services</h3>
      </div>

      {/* أزرار التحكم */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => {
            setIsSelecting(!isSelecting);
            if (isSelecting && view) (view as any).cursor = "default";
          }}
          disabled={!view}
          style={{
            flex: 2, padding: '12px',
            backgroundColor: !view ? '#21262d' : (isSelecting ? 'transparent' : '#238636'),
            color: !view ? '#8b949e' : (isSelecting ? '#ff7b72' : '#ffffff'),
            border: isSelecting ? '1px solid #da3633' : '1px solid #238636',
            borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
          }}
        >
          {isSelecting ? <><Icons.Cancel /> Cancel</> : <><Icons.Target /> Select Unit</>}
        </button>

        <button 
          onClick={clearRoutes}
          style={{
            flex: 1, padding: '12px', backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
            borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px'
          }}
        >
          <Icons.Trash /> Clear
        </button>
      </div>

      {/* رسائل الحالة */}
      {isSelecting && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#58a6ff', marginBottom: '20px', padding: '8px', backgroundColor: 'rgba(56, 139, 253, 0.1)', borderRadius: '6px' }}>
          👉 Click on any Building or Villa...
        </div>
      )}

      {isCalculating && (
        <div style={{ textAlign: 'center', fontSize: '13px', color: '#d29922', fontWeight: 600, marginBottom: '20px' }}>
          ⏳ Calculating routes...
        </div>
      )}

      {/* كروت النتائج */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {['hospital', 'school', 'commercial', 'gym'].map((type) => {
          const colors: any = { hospital: '#eab308', school: '#22c55e', commercial: '#3b82f6', gym: '#ef4444' };
          const TypeIcon: any = Icons[type.charAt(0).toUpperCase() + type.slice(1) as keyof typeof Icons];
          return (
            <div key={type} style={{ backgroundColor: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d', borderLeft: `4px solid ${colors[type]}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                 <div style={{ color: colors[type] }}><TypeIcon /></div>
                 <div style={{ fontSize: '12px', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase' }}>{type}</div>
              </div>
              <div style={{ fontSize: '15px', color: '#ffffff', fontWeight: 700, paddingLeft: '24px' }}>
                {routeInfo[type] || '---'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default ClosestServices;