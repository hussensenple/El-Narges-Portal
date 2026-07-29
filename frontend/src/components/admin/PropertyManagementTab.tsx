import { useState, useEffect } from 'react';
import axios from 'axios';

interface Property {
  OBJECTID?: number;
  GlobalID?: string;
  Status: string | number;
  Price?: number;
  BuildingType?: string | number;
  BuildingModel?: string;
  VillaModel?: string;
  sourceLayer: string;
  arcgisId: string | number;
}

const PropertyManagementTab = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [newPrice, setNewPrice] = useState<number | string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [modelFilter, setModelFilter] = useState('All Models');

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/roles/catalog?mode=all`);
      
      const units = res.data.units || [];
      const villas = res.data.villas || [];
      const buildings = res.data.buildings || [];
      
      // Create a map of BuildingID_FK -> BuildingModel for fast lookup
      const buildingModelMap: { [key: string]: string } = {};
      buildings.forEach((b: any) => {
        if (b.GlobalID) {
          buildingModelMap[b.GlobalID] = b.BuildingModel;
        }
      });

      let allProps = [
        ...units.map((u: any) => ({ 
          ...u, 
          sourceLayer: 'Units', 
          arcgisId: u.OBJECTID,
          BuildingModel: buildingModelMap[u.BuildingID_FK]
        })),
        ...villas.map((v: any) => ({ 
          ...v, 
          sourceLayer: 'Villas_Global', 
          arcgisId: v.GlobalID 
        }))
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

    const handlePricesUpdated = () => {
      fetchProperties();
    };

    window.addEventListener('pricesUpdated', handlePricesUpdated);
    return () => {
      window.removeEventListener('pricesUpdated', handlePricesUpdated);
    };
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

  const getDisplayType = (prop: Property) => {
    if (prop.sourceLayer === 'Units') return 'Apartment';
    if (prop.sourceLayer === 'Villas_Global') {
      return prop.BuildingType === 2 || prop.BuildingType === '2' ? 'TwinHouse' : 'Villa';
    }
    return 'Building';
  };

  const getDisplayModel = (prop: Property) => {
    if (prop.sourceLayer === 'Units') {
      if (!prop.BuildingModel) return 'N/A';
      const bMap: any = { '1': 'ModelX', '2': 'ModelU', '3': 'ModelS', '4': 'ModelZ' };
      return bMap[String(prop.BuildingModel)] || prop.BuildingModel;
    } else {
      if (!prop.VillaModel) return 'N/A';
      const vMap: any = { '1': 'A', '2': 'B', '3': 'D', '4': 'E' };
      return vMap[String(prop.VillaModel)] || prop.VillaModel;
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(e.target.value);
    setModelFilter('All Models');
  };

  const filteredProperties = properties.filter(p => {
    const idString = (p.OBJECTID?.toString() || p.GlobalID?.substring(0,8) || '').toLowerCase();
    const matchesSearch = idString.includes(searchTerm.toLowerCase());
    
    const displayType = getDisplayType(p);
    const matchesType = typeFilter === 'All Types' || displayType === typeFilter;
    
    const displayModel = getDisplayModel(p);
    const matchesModel = modelFilter === 'All Models' || displayModel === modelFilter;
    
    return matchesSearch && matchesType && matchesModel;
  });

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: 'var(--accent-blue)', margin: 0 }}>
          🏢 Property Management 
          <span style={{ fontSize: '16px', color: 'var(--text-muted)', marginLeft: '10px' }}>
            ({filteredProperties.length} Units)
          </span>
        </h2>
        <div style={{ display: 'flex', gap: '15px' }}>
          <select 
            value={typeFilter}
            onChange={handleTypeChange}
            style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <option value="All Types">All Types</option>
            <option value="Apartment">Apartment</option>
            <option value="Villa">Villa</option>
            <option value="TwinHouse">TwinHouse</option>
          </select>
          
          {typeFilter !== 'All Types' && (
            <select 
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              <option value="All Models">All Models</option>
              {typeFilter === 'Apartment' && (
                <>
                  <option value="ModelX">ModelX</option>
                  <option value="ModelU">ModelU</option>
                  <option value="ModelS">ModelS</option>
                  <option value="ModelZ">ModelZ</option>
                </>
              )}
              {(typeFilter === 'Villa' || typeFilter === 'TwinHouse') && (
                <>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </>
              )}
            </select>
          )}

          <input 
            type="text" 
            placeholder="Search by ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', width: '250px' }}
          />
        </div>
      </div>
      
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading properties...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px' }}>ID</th>
              <th style={{ padding: '12px' }}>Type</th>
              <th style={{ padding: '12px' }}>Model</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px' }}>Price</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProperties.map((prop, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px' }}>{prop.OBJECTID || prop.GlobalID?.substring(0,8)}</td>
                <td style={{ padding: '12px' }}>{getDisplayType(prop)}</td>
                <td style={{ padding: '12px' }}>{getDisplayModel(prop)}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>
                    {String(prop.Status).toLowerCase() === '1' || String(prop.Status).toLowerCase() === 'available' ? 'Available' : prop.Status}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  {editingId === prop.arcgisId ? (
                    <input 
                      type="number" 
                      value={newPrice} 
                      onChange={(e) => setNewPrice(e.target.value)}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                  ) : (
                    <span>{prop.Price ? prop.Price.toLocaleString() : 'N/A'}</span>
                  )}
                </td>
                <td style={{ padding: '12px' }}>
                  {editingId === prop.arcgisId ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleSavePrice(prop)} style={{ backgroundColor: 'var(--accent-green-bg)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{ backgroundColor: 'var(--accent-red-bg)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => handleEditClick(prop)} style={{ backgroundColor: 'var(--accent-blue-bg)', color: 'var(--text-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Edit Price</button>
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
