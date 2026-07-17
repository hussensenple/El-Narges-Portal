import React from 'react';

interface Unit {
  _id: string;
  unitName: string;
  globalId?: string;
  arcgisId?: string;
  objectId?: number;
  sourceLayer?: string;
  status: string;
  buildingFK?: string;
  buildingIdFk?: string;
}

interface OwnerPropertiesModalProps {
  owner: {
    _id: string;
    name: string;
    ownedUnits?: Unit[];
  };
  view: any;
  onClose: () => void;
}

const OwnerPropertiesModal: React.FC<OwnerPropertiesModalProps> = ({ owner, view, onClose }) => {
  const units = owner.ownedUnits || [];

  const handleViewMyUnit = async (unit: any) => {
    if (!view || !view.map) {
      alert("Map is not ready yet.");
      return;
    }

    let sourceLayer = unit.sourceLayer;
    if (!sourceLayer) {
      if (unit.unitType === 'Villa' || unit.unitName === 'Villa' || unit.unitName === 'فيلا') {
        sourceLayer = 'Villas_Global';
      } else {
        sourceLayer = 'Units'; // default assumption
      }
    }

    const cleanId = String(unit.globalId || unit.arcgisId || '').replace(/[{}]/g, '').trim();

    const getWhereClause = (id: string) => {
      if (/^\d+$/.test(id)) {
        return `OBJECTID = ${id}`;
      }
      const idUpper = id.toUpperCase();
      const idLower = id.toLowerCase();
      return `GlobalID = '{${idUpper}}' OR GlobalID = '${idUpper}' OR GlobalID = '{${idLower}}' OR GlobalID = '${idLower}' OR GlobalID = '{${id}}' OR GlobalID = '${id}'`;
    };

    try {
      if (sourceLayer === 'Villas_Global') {
        const layer = view.map.layers.find((l: any) => l.title === "Villas_Global");
        if (layer) {
          const query = layer.createQuery();
          query.where = getWhereClause(cleanId);
          query.returnGeometry = true;

          const extentRes = await layer.queryExtent(query);
          if (extentRes && extentRes.extent) {
            view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
          }

          const objectIds = await layer.queryObjectIds(query);
          if (objectIds && objectIds.length > 0) {
            const layerView = await view.whenLayerView(layer) as any;
            if ((window as any).viewUnitHighlightHandle) {
              (window as any).viewUnitHighlightHandle.remove();
            }
            (window as any).viewUnitHighlightHandle = layerView.highlight(objectIds);
          }
        }
      } else if (sourceLayer === 'Units') {
        let foreignKey = unit.buildingIdFk || unit.buildingFK;

        if (!foreignKey) {
          const unitsTable = view.map.tables?.find((t: any) => t.title === "Units") || view.map.layers.find((l: any) => l.title === "Units");
          if (unitsTable) {
            const query = unitsTable.createQuery();
            query.where = getWhereClause(cleanId);
            query.outFields = ["BuildingID_FK"];
            const results = await unitsTable.queryFeatures(query);
            if (results.features && results.features.length > 0) {
              foreignKey = results.features[0].attributes.BuildingID_FK;
            }
          }
        }

        if (foreignKey) {
          const buildingLayer = view.map.layers.find((l: any) => l.title === "Buildings_Global");
          if (buildingLayer) {
            try {
              const bQuery = buildingLayer.createQuery();
              const cleanFk = String(foreignKey).replace(/[{}]/g, '').trim();
              bQuery.where = getWhereClause(cleanFk);
              bQuery.returnGeometry = true;

              const extentRes = await buildingLayer.queryExtent(bQuery);
              if (extentRes && extentRes.extent) {
                view.goTo({ target: extentRes.extent, tilt: 60, zoom: 20 }, { animate: true, duration: 1500 });
              }

              const objectIds = await buildingLayer.queryObjectIds(bQuery);
              if (objectIds && objectIds.length > 0) {
                const layerView = await view.whenLayerView(buildingLayer);
                if ((window as any).viewUnitHighlightHandle) {
                  (window as any).viewUnitHighlightHandle.remove();
                }
                (window as any).viewUnitHighlightHandle = layerView.highlight(objectIds);
              }
            } catch (err) {
              console.error("Error highlighting building:", err);
            }
          }
        } else {
          alert("Building information is missing for this unit.");
        }
      }
      onClose();
    } catch (error) {
      console.error("Error viewing unit:", error);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1002, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: '#0d1117', padding: '24px', borderRadius: '12px', width: '600px', maxWidth: '90vw', border: '1px solid #30363d', color: '#fff', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#58a6ff', fontSize: '1.25rem' }}>
            🏠 Properties Owned by {owner.name}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#010409', borderRadius: '8px', border: '1px solid #30363d' }}>
          {units.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#8b949e' }}>No properties owned by this user.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#161b22', borderBottom: '2px solid #30363d' }}>
                  <th style={{ padding: '12px', color: '#fff' }}>#</th>
                  <th style={{ padding: '12px', color: '#fff' }}>Unit Type</th>
                  <th style={{ padding: '12px', color: '#fff' }}>Identifier</th>
                  <th style={{ padding: '12px', color: '#fff' }}>Status</th>
                  <th style={{ padding: '12px', color: '#fff' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit, index) => {
                  const displayType = unit.sourceLayer === 'Villas_Global' || unit.unitName === 'فيلا' || unit.unitName === 'Villa' ? 'Villa' : 'Apartment';
                  const displayId = unit.objectId || unit.globalId || unit.arcgisId || 'N/A';
                  return (
                    <tr key={unit._id} style={{ borderBottom: '1px solid #30363d', backgroundColor: index % 2 === 0 ? '#0d1117' : '#161b22' }}>
                      <td style={{ padding: '12px', color: '#8b949e' }}>{index + 1}</td>
                      <td style={{ padding: '12px', color: '#58a6ff', fontWeight: 'bold' }}>{displayType}</td>
                      <td style={{ padding: '12px', color: '#c9d1d9', fontFamily: 'monospace' }}>{displayId}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ backgroundColor: '#2ea04322', color: '#2ea043', padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #2ea04355' }}>
                          ✅ Owned
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleViewMyUnit(unit)}
                          style={{ padding: '4px 8px', backgroundColor: '#1f6feb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        >
                          👁️ View Unit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerPropertiesModal;
