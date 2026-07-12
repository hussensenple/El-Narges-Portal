import { useState, useEffect } from 'react';
import axios from 'axios';
import type { PendingRoleData } from './RoleChangeModal';

interface PropertyAssignCatalogProps {
  userId: string;
  targetRole: 'owner' | 'broker';
  pendingRoleData: PendingRoleData; // Role is committed ONLY after first assignment
  roleAlreadyCommitted?: boolean;   // Pass true when user is already this role (EditUserModal)
  onClose: () => void;
  onSuccess: () => void;
}

const PropertyAssignCatalog = ({ userId, targetRole, pendingRoleData, roleAlreadyCommitted = false, onClose, onSuccess }: PropertyAssignCatalogProps) => {
  const [units, setUnits] = useState<any[]>([]);
  const [villas, setVillas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  // If role is already committed (editing existing owner/broker), start as true to skip role-commit step
  const [roleCommitted, setRoleCommitted] = useState(roleAlreadyCommitted);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/catalog`, {
          params: { mode: targetRole }
        });
        setUnits(res.data.units || []);
        setVillas(res.data.villas || []);
      } catch (error) {
        console.error('Error fetching catalog:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [targetRole]);

  const handleAssign = async (property: any) => {
    try {
      setAssigning(property.arcgisId);

      // ✅ STEP 1: Commit the role change ONLY if this is the first assignment
      if (!roleCommitted) {
        const rolePayload: any = { newRole: pendingRoleData.newRole };
        if (pendingRoleData.manualId) rolePayload.manualId = pendingRoleData.manualId;
        await axios.put(`${import.meta.env.VITE_API_URL}/api/roles/change-role/${userId}`, rolePayload);
        setRoleCommitted(true);
      }

      // ✅ STEP 2: Assign the property
      await axios.post(`${import.meta.env.VITE_API_URL}/api/roles/assign-property`, {
        userId,
        unitId: property.arcgisId,
        arcgisObjectId: property.OBJECTID,
        sourceLayer: property.sourceLayer,
        targetRole
      });

      alert(`✅ Property #${property.OBJECTID} assigned successfully!`);
      // Refresh catalog by re-fetching (remove assigned from list)
      setUnits(prev => prev.filter(u => u.arcgisId !== property.arcgisId));
      setVillas(prev => prev.filter(v => v.arcgisId !== property.arcgisId));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign property');
    } finally {
      setAssigning(null);
    }
  };

  const toggleSelection = (propertyId: string) => {
    const newSet = new Set(selectedUnits);
    if (newSet.has(propertyId)) newSet.delete(propertyId);
    else newSet.add(propertyId);
    setSelectedUnits(newSet);
  };

  const handleAssignSelected = async () => {
    try {
      setAssigning('all');

      if (!roleCommitted) {
        const rolePayload: any = { newRole: pendingRoleData.newRole };
        if (pendingRoleData.manualId) rolePayload.manualId = pendingRoleData.manualId;
        await axios.put(`${import.meta.env.VITE_API_URL}/api/roles/change-role/${userId}`, rolePayload);
        setRoleCommitted(true);
      }

      const allProps = [...units, ...villas];
      for (const propertyId of Array.from(selectedUnits)) {
        const property = allProps.find(p => p.arcgisId === propertyId);
        if (property) {
          await axios.post(`${import.meta.env.VITE_API_URL}/api/roles/assign-property`, {
            userId,
            unitId: property.arcgisId,
            arcgisObjectId: property.OBJECTID,
            sourceLayer: property.sourceLayer,
            targetRole
          });
        }
      }

      alert(`✅ ${selectedUnits.size} properties assigned successfully!`);
      
      setUnits(prev => prev.filter(u => !selectedUnits.has(u.arcgisId)));
      setVillas(prev => prev.filter(v => !selectedUnits.has(v.arcgisId)));
      setSelectedUnits(new Set());
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign properties');
    } finally {
      setAssigning(null);
    }
  };

  // Group apartments by their Building ID (for broker mode)
  const groupedUnits: Record<string, any[]> = {};
  units.forEach(u => {
    const buildingKey = u.BuildingID_FK || 'Unknown Building';
    if (!groupedUnits[buildingKey]) groupedUnits[buildingKey] = [];
    groupedUnits[buildingKey].push(u);
  });

  const statusLabel = (s: any) => {
    const v = String(s).toLowerCase();
    if (v === '1' || v === 'available') return { label: 'Available', color: '#2ea043' };
    if (v === '2' || v === 'interested') return { label: 'Interested', color: '#d29922' };
    return { label: 'Other', color: '#8b949e' };
  };

  const filteredVillas = villas.filter(v =>
    searchId === '' || String(v.OBJECTID).includes(searchId) || (v.GlobalID && v.GlobalID.includes(searchId))
  );

  const filteredBuildings = Object.entries(groupedUnits).filter(([buildingId, us]) =>
    searchId === '' || buildingId.includes(searchId) || us.some(u => String(u.OBJECTID).includes(searchId))
  );

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
      <div style={{ backgroundColor: '#161b22', borderRadius: '12px', width: '900px', height: '85vh', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d1117' }}>
          <div>
            <h3 style={{ margin: 0, color: '#58a6ff' }}>
              {targetRole === 'owner' ? '🏡 Assign Property to New Owner' : '📋 Assign Properties to Broker'}
            </h3>
            <p style={{ margin: '4px 0 0', color: roleCommitted ? '#2ea043' : '#d29922', fontSize: '13px' }}>
              {roleCommitted
                ? `✅ Role committed. Assign more properties or click "Done".`
                : `⚠️ Role not saved yet — must assign at least 1 property to confirm.`
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {targetRole === 'broker' && selectedUnits.size > 0 && (
              <button
                onClick={handleAssignSelected}
                disabled={assigning === 'all'}
                style={{ padding: '8px 16px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {assigning === 'all' ? 'Assigning...' : `Assign ${selectedUnits.size} Selected`}
              </button>
            )}
            {roleCommitted && (
              <button
                onClick={onSuccess}
                style={{ padding: '8px 16px', backgroundColor: '#238636', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Done ✓
              </button>
            )}
            <button
              onClick={() => {
                if (!roleCommitted) {
                  if (!window.confirm('No property has been assigned yet. The role change will NOT be saved. Close anyway?')) return;
                }
                onClose();
              }}
              style={{ backgroundColor: 'transparent', border: '1px solid #30363d', color: '#8b949e', fontSize: '18px', cursor: 'pointer', borderRadius: '6px', padding: '4px 10px' }}
            >
              ✖
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #30363d' }}>
          <input
            type="text"
            placeholder={targetRole === 'broker' ? '🔍 Search by Building ID or Unit ID...' : '🔍 Search by Property ID...'}
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8b949e', paddingTop: '60px' }}>Loading properties from ArcGIS...</div>
          ) : (
            <>
              {/* Apartments section — grouped by building for broker, flat for owner */}
              {units.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                  <h4 style={{ color: '#58a6ff', borderBottom: '1px solid #30363d', paddingBottom: '8px' }}>🏢 Apartments</h4>

                  {targetRole === 'broker' ? (
                    filteredBuildings.map(([buildingId, buildingUnits]) => (
                      <div key={buildingId} style={{ marginBottom: '20px' }}>
                        <div style={{ backgroundColor: '#21262d', padding: '8px 14px', borderRadius: '6px', marginBottom: '10px', fontWeight: 'bold', color: '#d29922', fontSize: '13px' }}>
                          🏗️ Building: {buildingId}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                          {buildingUnits.filter(u => searchId === '' || String(u.OBJECTID).includes(searchId)).map(unit => {
                            const s = statusLabel(unit.Status);
                            const price = unit.Price || unit.Total_Price;
                            return (
                              <div key={unit.OBJECTID} style={{ backgroundColor: '#0d1117', border: `1px solid #30363d`, borderRadius: '8px', padding: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <span style={{ fontWeight: 'bold', color: '#fff' }}>Unit #{unit.OBJECTID}</span>
                                  <span style={{ color: s.color, fontSize: '11px', fontWeight: 'bold' }}>{s.label}</span>
                                </div>
                                {price && <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '10px' }}>💰 {(Number(price) / 1000000).toFixed(1)}M EGP</div>}
                                <button
                                  onClick={() => toggleSelection(unit.arcgisId)}
                                  disabled={assigning === unit.arcgisId || assigning === 'all'}
                                  style={{ width: '100%', padding: '7px', backgroundColor: assigning === unit.arcgisId ? '#21262d' : (selectedUnits.has(unit.arcgisId) ? '#2ea043' : '#1f6feb'), color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                >
                                  {assigning === unit.arcgisId ? 'Assigning...' : (selectedUnits.has(unit.arcgisId) ? '✓ Selected' : 'Select')}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                      {units.filter(u => searchId === '' || String(u.OBJECTID).includes(searchId)).map(unit => {
                        const price = unit.Price || unit.Total_Price;
                        return (
                          <div key={unit.OBJECTID} style={{ backgroundColor: '#0d1117', border: '1px solid #2ea04355', borderRadius: '8px', padding: '14px' }}>
                            <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>Unit #{unit.OBJECTID}</div>
                            <div style={{ color: '#2ea043', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>✅ Available</div>
                            {price && <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '10px' }}>💰 {(Number(price) / 1000000).toFixed(1)}M EGP</div>}
                            <button
                              onClick={() => handleAssign(unit)}
                              disabled={assigning === unit.arcgisId}
                              style={{ width: '100%', padding: '7px', backgroundColor: assigning === unit.arcgisId ? '#21262d' : '#238636', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              {assigning === unit.arcgisId ? 'Assigning...' : '+ Assign to Owner'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Villas section */}
              {filteredVillas.length > 0 && (
                <div>
                  <h4 style={{ color: '#d29922', borderBottom: '1px solid #30363d', paddingBottom: '8px' }}>🏡 Villas & Twin Houses</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {filteredVillas.map(villa => {
                      const s = statusLabel(villa.Status);
                      const modelMap: Record<string, string> = { '1': 'Model A', '2': 'Model B', '3': 'Model D', '4': 'Model E' };
                      return (
                        <div key={villa.OBJECTID} style={{ backgroundColor: '#0d1117', border: `1px solid #30363d`, borderRadius: '8px', padding: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>Villa #{villa.OBJECTID}</span>
                            <span style={{ color: s.color, fontSize: '11px', fontWeight: 'bold' }}>{s.label}</span>
                          </div>
                          {villa.VillaModel && <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '4px' }}>🏡 {modelMap[String(villa.VillaModel)] || villa.VillaModel}</div>}
                          {villa.Price && <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '10px' }}>💰 {(Number(villa.Price) / 1000000).toFixed(1)}M EGP</div>}
                          <button
                            onClick={() => targetRole === 'broker' ? toggleSelection(villa.arcgisId) : handleAssign(villa)}
                            disabled={assigning === villa.arcgisId || assigning === 'all'}
                            style={{ width: '100%', padding: '7px', backgroundColor: assigning === villa.arcgisId ? '#21262d' : (targetRole === 'broker' && selectedUnits.has(villa.arcgisId) ? '#2ea043' : '#1f6feb'), color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            {assigning === villa.arcgisId ? 'Assigning...' : (targetRole === 'broker' && selectedUnits.has(villa.arcgisId) ? '✓ Selected' : (targetRole === 'broker' ? 'Select' : '+ Assign'))}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {units.length === 0 && villas.length === 0 && !loading && (
                <div style={{ textAlign: 'center', color: '#8b949e', paddingTop: '60px' }}>
                  No available properties found for assignment.
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default PropertyAssignCatalog;
