import { useState, useEffect } from 'react';
import axios from 'axios';

interface Property {
  OBJECTID?: number;
  GlobalID?: string;
  Status: string | number;
  Price?: number;
  BuildingType?: string;
  sourceLayer: string;
  arcgisId: string | number;
}

const PropertyManagementTab = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [newPrice, setNewPrice] = useState<number | string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/catalog?mode=all`);
      
      const units = res.data.units || [];
      const villas = res.data.villas || [];
      const buildings = res.data.buildings || [];
      
      let allProps = [
        ...units.map((u: any) => ({ ...u, sourceLayer: 'Units', arcgisId: u.OBJECTID })),
        ...villas.map((v: any) => ({ ...v, sourceLayer: 'Villas_Global', arcgisId: v.GlobalID })),
        ...buildings.map((b: any) => ({ ...b, sourceLayer: 'Buildings_Global', arcgisId: b.GlobalID }))
      ];

      // Filter only Available units
      allProps = allProps.filter((p) => {
        const status = String(p.Status).toLowerCase();
        return status === '1' || status === 'available';
      });
      
      setProperties(allProps);
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleEditClick = (prop: Property) => {
    setEditingId(prop.arcgisId);
    setNewPrice(prop.Price || '');
  };

  const handleSavePrice = async (prop: Property) => {
    if (!newPrice) {
      alert('Please enter a valid price');
      return;
    }
    
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/update-price`, {
        arcgisObjectId: prop.arcgisId,
        newPrice: Number(newPrice),
        sourceLayer: prop.sourceLayer
      });
      alert('Price updated successfully');
      setEditingId(null);
      fetchProperties();
    } catch (error) {
      console.error('Error updating price', error);
      alert('Failed to update price');
    }
  };

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#58a6ff', margin: 0 }}>🏢 Property Management</h2>
        <input 
          type="text" 
          placeholder="Search by ID..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#fff', width: '250px' }}
        />
      </div>
      
      {loading ? (
        <p style={{ color: '#8b949e' }}>Loading properties...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: '#161b22', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#21262d', color: '#c9d1d9' }}>
              <th style={{ padding: '12px' }}>ID</th>
              <th style={{ padding: '12px' }}>Type</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px' }}>Price</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {properties.filter(p => {
              const idString = (p.OBJECTID?.toString() || p.GlobalID?.substring(0,8) || '').toLowerCase();
              return idString.includes(searchTerm.toLowerCase());
            }).map((prop, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid #30363d' }}>
                <td style={{ padding: '12px' }}>{prop.OBJECTID || prop.GlobalID?.substring(0,8)}</td>
                <td style={{ padding: '12px' }}>{prop.sourceLayer === 'Units' ? 'Apartment' : prop.sourceLayer === 'Villas_Global' ? 'Villa' : 'Building'}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ color: '#2ea043', fontWeight: 'bold' }}>
                    {String(prop.Status).toLowerCase() === '1' || String(prop.Status).toLowerCase() === 'available' ? 'Available' : prop.Status}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  {editingId === prop.arcgisId ? (
                    <input 
                      type="number" 
                      value={newPrice} 
                      onChange={(e) => setNewPrice(e.target.value)}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid #30363d', backgroundColor: '#0d1117', color: '#fff' }}
                    />
                  ) : (
                    <span>{prop.Price ? prop.Price.toLocaleString() : 'N/A'}</span>
                  )}
                </td>
                <td style={{ padding: '12px' }}>
                  {editingId === prop.arcgisId ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleSavePrice(prop)} style={{ backgroundColor: '#238636', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{ backgroundColor: '#da3633', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => handleEditClick(prop)} style={{ backgroundColor: '#1f6feb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Edit Price</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PropertyManagementTab;
