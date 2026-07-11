import { useState, useEffect, useRef, useContext } from 'react';
import SceneView from '@arcgis/core/views/SceneView';
// import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Graphic from '@arcgis/core/Graphic';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import AuthModal from './AuthModal';

interface UnitCatalogProps {
  view: SceneView | null;
  onClose: () => void;
}

const UnitCatalog = ({ view, onClose }: UnitCatalogProps) => {
  const [units, setUnits] = useState<Graphic[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const auth = useContext(AuthContext);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [bookingUnit, setBookingUnit] = useState<Graphic | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All Types'); 
  const [maxPrice, setMaxPrice] = useState(''); 
  
  const highlightHandleRef = useRef<any>(null);

  const [pos, setPos] = useState({ x: 80, y: 80 }); 
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  useEffect(() => {
    if (view && view.map) {
      loadUnitsData();
    }
  }, [view]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({
        x: dragInfo.current.startPosX + (e.clientX - dragInfo.current.startX),
        y: dragInfo.current.startPosY + (e.clientY - dragInfo.current.startY),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragInfo.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
  };

  const loadUnitsData = async () => {
    setIsLoading(true);
    try {
      // 🚀 SOLUTION: Always fetch the true live data from our Express backend!
      // This bypasses the stale ArcGIS JS SDK cache and perfectly syncs MongoDB + ArcGIS.
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/catalog?mode=all`);
      
      const rawUnits = res.data.units || [];
      const rawVillas = res.data.villas || [];

      const allFeatures: Graphic[] = [...rawUnits, ...rawVillas].map((item: any) => {
        return new Graphic({
          attributes: {
            ...item,
            // Ensure compatibility with previous logic
            OBJECTID: item.OBJECTID,
            GlobalID: item.GlobalID,
            Status: item.Status,
            SourceName: item.sourceLayer
          }
        });
      });

      setUnits(allFeatures);
    } catch (error) {
      console.error("Error loading units from backend:", error);
      alert("Failed to load live catalog data. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = async (unit: Graphic) => {
    if (!view || !view.map) return;

    // 1. لو كارت فيلا أو توين هاوس (ليها Geometry مباشر)
    if (unit.attributes.SourceName === 'Villas_Global' && unit.geometry) {
      view.goTo({ target: unit.geometry, tilt: 45, zoom: 19 }, { animate: true, duration: 2000 });
      const layer = unit.layer as any;
      if (layer) {
        const layerView = await view.whenLayerView(layer) as any;
        if (highlightHandleRef.current) highlightHandleRef.current.remove();
        highlightHandleRef.current = layerView.highlight(unit);
      }
    } 
    
    // 2. لو كارت شقة (جدول Units ملوش Geometry)
    else if (unit.attributes.SourceName === 'Units') {
      const foreignKey = unit.attributes.BuildingID_FK;
      
      if (foreignKey) {
        // ندور على طبقة العمارات الحقيقية
        const buildingLayer = view.map.layers.find((l: any) => l.title === "Buildings_Global") as any;
        
        if (buildingLayer) {
          const query = buildingLayer.createQuery();
          query.where = `GlobalID = '${foreignKey}'`; // الربط بالـ FK
          query.returnGeometry = true;
          query.outFields = ["*"];
          
          try {
            const results = await buildingLayer.queryFeatures(query);
            if (results.features.length > 0) {
              const buildingGraphic = results.features[0];
              
              // زووم على العمارة
              view.goTo({ target: buildingGraphic.geometry, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
              
              // تنوير العمارة (Highlight)
              const layerView = await view.whenLayerView(buildingLayer) as any;
              if (highlightHandleRef.current) highlightHandleRef.current.remove();
              highlightHandleRef.current = layerView.highlight(buildingGraphic);
            }
          } catch (err) {
            console.error("Error highlighting 3D building:", err);
          }
        }
      }
    }
  };

  const handleBuyClick = (e: React.MouseEvent, unit: Graphic) => {
    e.stopPropagation(); 
    handleCardClick(unit); 

    // الاعتماد المباشر على التخزين المحلي لتفادي بطء الـ Context
    const currentToken = localStorage.getItem('token') || auth?.token;

    // 💡 في كلتا الحالتين هنحفظ الوحدة في الـ State
    setBookingUnit(unit);

    if (!currentToken) {
      setShowAuthModal(true); // لو مفيش توكن، نفتح شاشة اللوجن
    }
  };

  const submitBookingRequest = async () => {
    console.log("RAW UNIT DATA:", bookingUnit?.attributes);
    const currentToken = auth?.token || localStorage.getItem('token');
    
    // تأكد إن الـ user موجود قبل ما تبعت الداتا
    if (!bookingUnit || !currentToken || !auth?.user) {
      alert("❌ Please log in first.");
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/request`, {
        // 🚀 السحر هنا: لو ملقاش GlobalID هياخد OBJECTID ويحوله لـ String
        unitId: String(bookingUnit.attributes?.GlobalID || bookingUnit.attributes?.globalid || bookingUnit.attributes?.OBJECTID),
        objectId: bookingUnit.attributes?.OBJECTID,
        sourceLayer: bookingUnit.attributes.SourceName || 'Villas_Global',
        buildingFK: bookingUnit.attributes.BuildingID_FK || null,
        customerName: auth.user.name,
        customerPhone: (auth.user as any).phone || 'N/A', 
        customerGmail: (auth.user as any).email || (auth.user as any).gmail || 'N/A'
      }, {
        headers: { 'x-auth-token': currentToken }
      });

      alert("🎉 Booking request sent successfully! Our sales team will review your request.");
      setBookingUnit(null); 
    } catch (error: any) {
      console.error("Booking Error:", error); // عشان لو في إيرور يظهر في الـ Console
      
      // 🚀 إظهار سبب الرفض الحقيقي للعميل
      if (error.response?.status === 400) {
        alert("❌ " + (error.response.data.error || error.response.data.msg));
      } else {
        alert("❌ An error occurred, please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    // 1. تصفية الفلاتر
    setSearchTerm('');
    setStatusFilter('All');
    setTypeFilter('All Types');
    setMaxPrice('');

    // 2. 🚀 مسح الـ Highlight اليدوي اللي إحنا عاملينه (اللي مسبب اللون اللبني)
    if (highlightHandleRef.current) {
      highlightHandleRef.current.remove();
      highlightHandleRef.current = null;
    }

    // 3. 🚀 مسح الـ Selection الافتراضي للـ Popup بطريقة صحيحة
    if (view && view.popup) {
      view.popup.visible = false; // إخفاء النافذة
      view.popup.clear(); // 🚀 الطريقة الصحيحة لمسح الـ selection من الخريطة تماماً
      view.popup.features = []; // تفريغ مصفوفة الـ features المحددة
    }

    // 4. إرجاع الكاميرا للوضع الافتراضي
    if (view && view.map) {
      const initialViewpoint = (view.map as any).initialViewProperties?.viewpoint;
      if (initialViewpoint) {
        view.goTo(initialViewpoint, { animate: true, duration: 2000 });
      }
    }
  };

  const filteredUnits = units.filter(unit => {
    const attrs = unit.attributes || {};
    const matchesSearch = attrs.OBJECTID?.toString().includes(searchTerm);
    
    // ✅ Normalize ALL real ArcGIS data variations to internal labels
    // Live data has 3 formats: text labels ("Available","Sold"), codes ("1","4")
    let rawStatus = String(attrs.Status ?? 'available').toLowerCase();
    if      (rawStatus === '1' || rawStatus === 'available')  rawStatus = 'available';
    else if (rawStatus === '3' || rawStatus === 'reserved')   rawStatus = 'reserved';
    else if (rawStatus === '4' || rawStatus === 'sold')       rawStatus = 'sold';

    const matchesStatus = statusFilter === 'All' || rawStatus === statusFilter.toLowerCase();
    
    let unitFinalType = 'Building';
    
    if (attrs.SourceName === 'Units') {
      unitFinalType = 'Apartment';
    } else if (attrs.SourceName === 'Villas_Global') {
      const buildType = attrs.BuildingType || attrs.buildingtype;
      if (buildType === 2) {
        unitFinalType = 'TwinHouse';
      } else {
        unitFinalType = 'Villa';
      }
    }

    unit.attributes.DisplayType = unitFinalType;
    const matchesType = typeFilter === 'All Types' || unitFinalType === typeFilter;
    
    let matchesPrice = true;
    if (maxPrice.trim() !== '') { 
      const priceValue = attrs.Price || 0; // ✅ Correct field name
      matchesPrice = Number(priceValue) <= Number(maxPrice) * 1000000; 
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesPrice;
  });

  return (
    <>
      <div style={{ position: 'absolute', top: `${pos.y}px`, left: `${pos.x}px`, width: '80vw', height: '80vh', minWidth: '400px', minHeight: '300px', backgroundColor: '#0d1117', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', color: '#c9d1d9', fontFamily: 'sans-serif', zIndex: 1000, resize: 'both', overflow: 'hidden' }}>
        
        <div onMouseDown={handleMouseDown} style={{ padding: '16px 24px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22', cursor: isDragging ? 'grabbing' : 'grab' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', userSelect: 'none' }}>🏢 Property Catalog</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {auth?.user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', backgroundColor: '#21262d', padding: '6px 12px', borderRadius: '20px', border: '1px solid #30363d' }}>
                <span style={{ color: '#58a6ff' }}>👤 {auth.user.name}</span>
                <button onClick={auth.logout} style={{ background: 'none', border: 'none', color: '#ff7b72', cursor: 'pointer', fontWeight: 'bold' }}>Sign Out</button>
              </div>
            )}
            <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '24px', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        <div style={{ padding: '16px 24px', display: 'flex', gap: '16px', borderBottom: '1px solid #30363d', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="🔍 Search by ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, minWidth: '120px', padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff' }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff', cursor: 'pointer' }}>
            <option value="All">All Statuses</option> <option value="Available">Available</option> <option value="Reserved">Reserved</option> <option value="Sold">Sold</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff', cursor: 'pointer' }}>
            <option value="All Types">All Types</option> 
            <option value="Apartment">Apartment</option> 
            <option value="Villa">Villa</option> 
            <option value="TwinHouse">TwinHouse</option>
          </select>
          <input type="number" placeholder="💰 Max Price (M EGP)..." value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} min="0" step="any" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#010409', color: '#fff', width: '180px' }} />
          <button onClick={handleResetFilters} style={{ padding: '10px 16px', backgroundColor: '#d29922', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>🔄 Reset</button>
          <button 
            onClick={loadUnitsData}
            disabled={isLoading}
            title="Sync latest status from ArcGIS Online"
            style={{ padding: '10px 16px', backgroundColor: isLoading ? '#21262d' : '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: isLoading ? 0.6 : 1 }}
          >
            {isLoading ? '⏳ Syncing...' : '🔃 Refresh'}
          </button>
        </div>
        
        <div style={{ padding: '12px 24px 0', color: '#8b949e', fontSize: '14px' }}>
          📊 Total Displayed Units: <strong style={{ color: '#fff' }}>{filteredUnits.length}</strong> unit
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', alignContent: 'start' }}>
          {isLoading && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#58a6ff' }}>Loading Units...</div>}
          {filteredUnits.length === 0 && !isLoading && <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#8b949e', padding: '40px' }}>No units match your criteria. 🕵️‍♂️</div>}

          {filteredUnits.map((unit, idx) => {
            // ✅ Normalize status for badge — handles "Available","Sold","1","4" from live GIS data
            const status = String(unit.attributes.Status ?? 'available').toLowerCase();
            const isAvailable = status === 'available' || status === '1';
            const isReserved  = status === 'reserved'  || status === '3';
            const badgeColor  = isAvailable ? '#2ea043' : (isReserved ? '#d29922' : '#f85149');
            const borderColor = isAvailable ? '#2ea04355' : (isReserved ? '#d2992255' : '#f8514955');
            const rawPrice = unit.attributes.Price; // ✅ Correct field name (Total_Price doesn't exist)
            const formattedPrice = rawPrice ? (Number(rawPrice) / 1000000).toFixed(2) + ' M EGP' : 'Contact Sales';
            const unitType = unit.attributes.DisplayType;

            return (
              <div key={idx} onClick={() => handleCardClick(unit)} style={{ background: '#161b22', padding: '20px', borderRadius: '10px', border: `1px solid ${borderColor}`, cursor: 'pointer', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <strong style={{ color: '#fff', fontSize: '1.2rem' }}>Unit #{unit.attributes.OBJECTID}</strong>
                  <span style={{ border: `1px solid ${badgeColor}`, color: badgeColor, padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{isAvailable ? 'Available' : (isReserved ? 'Reserved' : 'Sold')}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#8b949e', marginBottom: '20px', lineHeight: '1.8' }}>
                  <div>🧱 Type: <strong style={{ color: '#fff' }}>{unitType}</strong></div>
                  
                  {/* 🚀 التعديل: ترجمة أرقام الموديل للحروف المعتمدة بناءً على الـ Domain */}
                  {(unitType === 'Villa' || unitType === 'TwinHouse') && unit.attributes.VillaModel && (
                    <div>🏡 Model: <strong style={{ color: '#fff' }}>
                      {{ '1': 'A', '2': 'B', '3': 'D', '4': 'E' }[String(unit.attributes.VillaModel)] || unit.attributes.VillaModel}
                    </strong></div>
                  )}
                  
                  <div>💰 Price: <strong style={{ color: '#fff' }}>{formattedPrice}</strong></div>
                </div>
                <button onClick={(e) => handleBuyClick(e, unit)} disabled={!isAvailable} style={{ width: '100%', padding: '10px', backgroundColor: isAvailable ? '#1f6feb' : '#21262d', color: isAvailable ? '#fff' : '#8b949e', border: 'none', borderRadius: '6px', cursor: isAvailable ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                  {isAvailable ? "Proceed to Buy" : "Not Available"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {showAuthModal && <AuthModal 
          onClose={() => {
              setShowAuthModal(false);
              setBookingUnit(null);
          }} 
          onSuccess={() => {
              setShowAuthModal(false);
          }} 
      />}

      {bookingUnit && !showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: '#161b22', padding: '24px', borderRadius: '12px', border: '1px solid #30363d', width: '320px', textAlign: 'center', color: '#c9d1d9', fontFamily: 'sans-serif' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>📝 Confirm Booking Request</h3>
            <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>Are you sure you want to request the purchase of unit #<strong style={{color: '#fff'}}>{bookingUnit.attributes.OBJECTID}</strong>?</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={submitBookingRequest} disabled={isLoading} style={{ flex: 1, padding: '10px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: '6px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                {isLoading ? 'Sending...' : 'Confirm & Request'}
              </button>
              <button onClick={() => setBookingUnit(null)} disabled={isLoading} style={{ flex: 1, padding: '10px', backgroundColor: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UnitCatalog;