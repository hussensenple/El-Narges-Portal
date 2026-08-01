import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

interface BuildingSidebarProps {
  buildingId?: string;      // building mode
  villaData?: any;          // villa mode (direct attributes)
  onClose: () => void;
}

const BASE_URL = window.location.origin;

// Helper: map VillaModel / Image_Name to a design image URL
const getVillaDesignUrl = (attrs: any) => {
  if (attrs.Image_Name) return `${BASE_URL}/${attrs.Image_Name.replace('.png', '')}.png`;
  if (attrs.VillaModel) return `${BASE_URL}/${attrs.VillaModel}.png`;
  return null;
};

// Helper: map BuildingModel to a design image URL
const getBuildingDesignUrl = (model: string) => {
  if (!model) return null;
  const m = model.toUpperCase();
  if (m.includes('S')) return `${BASE_URL}/S.png`;
  if (m.includes('U')) return `${BASE_URL}/U.png`;
  if (m.includes('X')) return `${BASE_URL}/X.png`;
  if (m.includes('Z')) return `${BASE_URL}/Z.png`;
  return `${BASE_URL}/S.png`;
};


const BuildingSidebar = ({ buildingId, villaData, onClose }: BuildingSidebarProps) => {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const auth = useContext(AuthContext);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);

  // ── Fetch Assigned Units ───────────────────────────────────────────────
  useEffect(() => {
    const fetchAssigned = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/assigned-units`);
        setAssignedIds(res.data);
      } catch (e) {
        console.error('BuildingSidebar fetch assigned units error', e);
      }
    };
    fetchAssigned();
  }, []);

  // ── Building mode: fetch apartments ──────────────────────────────────────
  useEffect(() => {
    if (!buildingId) return;
    const fetchUnits = async () => {
      setLoading(true);
      try {
        const UNITS_URL = 'https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37';
        const res = await axios.get(`${UNITS_URL}/query`, {
          params: { where: `BuildingID_FK='${buildingId}'`, outFields: '*', f: 'json' }
        });
        const raw = res.data.features ? res.data.features.map((f: any) => f.attributes) : [];
        raw.sort((a: any, b: any) => (a.OBJECTID || 0) - (b.OBJECTID || 0));
        setUnits(raw);
      } catch (e) {
        console.error('BuildingSidebar fetch error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchUnits();
  }, [buildingId]);

  // ── Book apartment handler ───────────────────────────────────────────────
  const handleBookApartment = async (unit: any) => {
    const currentToken = auth?.token || localStorage.getItem('token');
    if (!currentToken || !auth?.user) {
      alert('❌ Please log in first to book an apartment.');
      return;
    }
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/request`, {
        unitId: String(unit.GlobalID || unit.OBJECTID),
        objectId: unit.OBJECTID,
        sourceLayer: 'Units',
        buildingFK: unit.BuildingID_FK,
        customerName: auth.user.name,
        customerPhone: (auth.user as any).phone || 'N/A',
        customerGmail: (auth.user as any).email || (auth.user as any).gmail || 'N/A'
      }, { headers: { 'x-auth-token': currentToken } });
      alert('🎉 Booking request sent successfully! Our sales team will review your request.');
    } catch (error: any) {
      alert('❌ ' + (error.response?.data?.error || error.response?.data?.msg || 'An error occurred.'));
    }
  };

  // ── Book villa handler ───────────────────────────────────────────────────
  const handleBookVilla = async () => {
    if (!villaData) return;
    const currentToken = auth?.token || localStorage.getItem('token');
    let currentUser = auth?.user || null;
    if (!currentUser) {
      try { currentUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) {}
    }
    if (!currentToken || !currentUser) {
      alert('❌ Please log in first to book a villa.');
      return;
    }
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/bookings/request`, {
        unitId: String(villaData.GlobalID || villaData.globalid || villaData.OBJECTID),
        objectId: villaData.OBJECTID,
        sourceLayer: 'Villas_Global',
        buildingFK: null,
        customerName: (currentUser as any).name,
        customerPhone: (currentUser as any).phone || 'N/A',
        customerGmail: (currentUser as any).email || (currentUser as any).gmail || 'N/A'
      }, { headers: { 'x-auth-token': currentToken } });
      alert('🎉 Booking request sent successfully!');
    } catch (err: any) {
      alert('❌ ' + (err.response?.data?.error || err.response?.data?.msg || 'An error occurred.'));
    }
  };

  // ── Shared status helpers ────────────────────────────────────────────────
  const isSoldStatus = (s: any) => {
    const v = String(s ?? '').toLowerCase();
    return v === 'sold' || v === '4' || v === 'reserved' || v === '3' || v === '2';
  };

  const statusLabel = (s: any) => isSoldStatus(s) ? 'Sold / Reserved' : 'Available';
  const statusColor = (s: any) => isSoldStatus(s) ? '#ff7b72' : '#3fb950';
  const statusBg    = (s: any) => isSoldStatus(s) ? 'rgba(218,54,51,0.15)' : 'rgba(35,134,54,0.15)';
  const borderColor = (s: any) => isSoldStatus(s) ? 'var(--accent-red-bg)' : 'var(--accent-green-bg)';

  // ── Shared container ─────────────────────────────────────────────────────
  const isVillaMode = !!villaData;
  let buildingModelLabel = '';
  if (!isVillaMode && units.length > 0) {
    const m = (units[0].Image_Name || units[0].BuildingModel || '').toUpperCase();
    if (m.includes('S')) buildingModelLabel = ' (S)';
    else if (m.includes('U')) buildingModelLabel = ' (U)';
    else if (m.includes('X')) buildingModelLabel = ' (X)';
    else if (m.includes('Z')) buildingModelLabel = ' (Z)';
  }

  const title = isVillaMode
    ? `🏡 ${villaData.BuildingType || 'Villa'} Details`
    : `🏢 Building Apartments${buildingModelLabel}`;

  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      bottom: '26px',
      right: '16px',
      width: '360px',
      maxWidth: 'calc(100vw - 32px)',
      backgroundColor: 'rgba(13, 17, 23, 0.97)',
      backdropFilter: 'blur(12px)',
      border: '1px solid var(--border-color)',
      borderRadius: '14px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideInRight 0.25s ease-out',
      color: 'var(--text-secondary)',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px',
        borderBottom: '1px solid var(--bg-tertiary)',
        background: 'rgba(33,38,45,0.7)',
        borderTopLeftRadius: '14px',
        borderTopRightRadius: '14px',
        flexShrink: 0
      }}>
        <h3 style={{ margin: 0, color: 'var(--accent-blue)', fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
        <button
          onClick={onClose}
          style={{
            background: 'var(--accent-red-bg)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer',
            fontSize: '0.85rem', width: '26px', height: '26px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: '0.2s', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', flexShrink: 0
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.12)'}
          onMouseOut={e  => e.currentTarget.style.transform = 'scale(1)'}
          title="Close"
        >✖</button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ════════════ VILLA MODE ════════════ */}
        {isVillaMode && (() => {
          const sold = isSoldStatus(villaData.Status);
          const designUrl = getVillaDesignUrl(villaData);
          const priceM = villaData.Price ? (villaData.Price / 1_000_000).toFixed(2) : null;
          const id = villaData.OBJECTID;
          return (
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              border: `1px solid ${borderColor(villaData.Status)}`,
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
              flexShrink: 0
            }}>
              {/* ID badge */}
              <div style={{ background: 'var(--bg-secondary)', padding: '8px 14px', borderBottom: '1px solid var(--bg-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property ID</span>
                <code style={{
                  backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-blue)', padding: '2px 8px',
                  borderRadius: '6px', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', userSelect: 'all'
                }} title="Click to copy" onClick={() => navigator.clipboard.writeText(String(id))}>
                  #{id}
                </code>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: 'auto' }}>📋 click to copy</span>
              </div>

              <div style={{ padding: '14px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '15px' }}>{villaData.BuildingType || 'Villa'}</span>
                  {villaData.VillaModel && <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '8px' }}>Model {villaData.VillaModel}</span>}
                  {(villaData.UnitArea || villaData.Area) && (
                    <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      📐 Area: <strong style={{ color: 'var(--text-secondary)' }}>{villaData.UnitArea || villaData.Area} m²</strong>
                    </div>
                  )}
                </div>

                {/* Status + Price row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <span style={{
                    backgroundColor: statusBg(villaData.Status),
                    color: statusColor(villaData.Status),
                    padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700
                  }}>{statusLabel(villaData.Status)}</span>
                  {priceM && <span style={{ color: '#3fb950', fontWeight: 700, fontSize: '14px' }}>{priceM} M EGY</span>}
                </div>

                {/* View Design (top) */}
                {designUrl && (
                  <a
                    href={designUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                      padding: '10px', marginBottom: '10px',
                      background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
                      color: 'var(--text-primary)', textDecoration: 'none', borderRadius: '8px',
                      fontWeight: 700, fontSize: '13px',
                      boxShadow: '0 3px 8px rgba(37,99,235,0.4)'
                    }}
                  >
                    🔍 View Full Design
                  </a>
                )}

                {/* Book Now (below View Design) */}
                {!sold && (
                  (assignedIds.includes(String(villaData.GlobalID || villaData.globalid).toLowerCase()) || assignedIds.includes(String(villaData.OBJECTID))) ? (
                    <button
                      onClick={handleBookVilla}
                      style={{
                        width: '100%', padding: '10px', backgroundColor: 'var(--accent-green-bg)',
                        color: 'var(--text-primary)', border: 'none', borderRadius: '8px',
                        cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: '0.2s'
                      }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--accent-green)'}
                      onMouseOut={e  => e.currentTarget.style.backgroundColor = 'var(--accent-green-bg)'}
                    >
                      🔖 Book Now
                    </button>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      🚫 Not available for booking (No broker assigned)
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })()}

        {/* ════════════ BUILDING MODE ════════════ */}
        {!isVillaMode && (
          loading
            ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px' }}>Loading apartments…</div>
            : units.length === 0
              ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px' }}>No apartments found for this building.</div>
              : units.filter(u => assignedIds.includes(String(u.GlobalID || u.OBJECTID).toLowerCase()) || assignedIds.includes(String(u.OBJECTID))).length === 0 
                ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px' }}>No apartments are currently available for booking in this building.</div>
                : units.filter(u => assignedIds.includes(String(u.GlobalID || u.OBJECTID).toLowerCase()) || assignedIds.includes(String(u.OBJECTID))).map((unit, idx) => {
                const sold = isSoldStatus(unit.Status);
                const priceM = unit.Price ? (unit.Price / 1_000_000).toFixed(2) : null;
                const designUrl = getBuildingDesignUrl(unit.Image_Name || unit.BuildingModel || '');
                const floorVal = unit.Floor ?? unit.FloorNumber ?? unit.floor ?? null;
                const floorLabel = floorVal !== null ? `Floor ${floorVal}` : null;

                return (
                  <div key={idx} style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: `1px solid ${borderColor(unit.Status)}`,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    flexShrink: 0
                  }}>
                    {/* ID badge row */}
                    <div style={{
                      background: 'var(--bg-secondary)', padding: '7px 14px', borderBottom: '1px solid var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'
                    }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Apt ID</span>
                      <code
                        style={{
                          backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-blue)', padding: '2px 8px',
                          borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                          cursor: 'pointer', userSelect: 'all'
                        }}
                        title="Click to copy"
                        onClick={() => navigator.clipboard.writeText(String(unit.OBJECTID))}
                      >
                        #{unit.OBJECTID}
                      </code>
                      {floorLabel && (
                        <span style={{
                          backgroundColor: 'rgba(88,166,255,0.12)', color: 'var(--accent-blue)',
                          padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600
                        }}>🏗️ {floorLabel}</span>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: 'auto' }}>📋</span>
                    </div>

                    <div style={{ padding: '12px 14px' }}>
                      {/* Area */}
                      {(unit.UnitArea || unit.Area) && (
                        <div style={{ marginBottom: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          📐 Area: <strong style={{ color: 'var(--text-secondary)' }}>{unit.UnitArea || unit.Area} m²</strong>
                        </div>
                      )}

                      {/* Status + Price */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{
                          backgroundColor: statusBg(unit.Status),
                          color: statusColor(unit.Status),
                          padding: '3px 9px', borderRadius: '10px', fontSize: '11px', fontWeight: 700
                        }}>{statusLabel(unit.Status)}</span>
                        {priceM && <span style={{ color: '#3fb950', fontWeight: 700, fontSize: '13px' }}>{priceM} M EGY</span>}
                      </div>

                      {/* View Design (top) */}
                      {designUrl && (
                        <a
                          href={designUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            padding: '8px', marginBottom: '8px',
                            background: 'rgba(33,38,45,0.9)', border: '1px solid var(--border-color)',
                            color: 'var(--accent-blue)', textDecoration: 'none', borderRadius: '7px',
                            fontWeight: 700, fontSize: '12px', transition: '0.2s'
                          }}
                        >
                          🔍 View Design
                        </a>
                      )}

                      {/* Book Now (below View Design) */}
                      {!sold && (
                        <button
                          onClick={() => handleBookApartment(unit)}
                          style={{
                            width: '100%', padding: '8px', backgroundColor: 'var(--accent-green-bg)',
                            color: 'var(--text-primary)', border: 'none', borderRadius: '7px',
                            cursor: 'pointer', fontWeight: 700, fontSize: '12px', transition: '0.2s'
                          }}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--accent-green)'}
                          onMouseOut={e  => e.currentTarget.style.backgroundColor = 'var(--accent-green-bg)'}
                        >
                          🔖 Book Now
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
        )}
      </div>
    </div>
  );
};

export default BuildingSidebar;
