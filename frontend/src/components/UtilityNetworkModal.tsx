import { createPortal } from 'react-dom';

interface UtilityNetworkModalProps {
  onClose: () => void;
}

const UtilityNetworkModal = ({ onClose }: UtilityNetworkModalProps) => {
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(13, 17, 23, 0.85)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#0d1117', width: '90vw', maxWidth: '1200px', height: '80vh', borderRadius: '12px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', padding: '20px' }}>
          <h2 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            ⚡ Utility Network
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#ff7b72', fontSize: '28px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        {/* Content Placeholder */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: '#8b949e', gap: '20px' }}>
          <div style={{ fontSize: '60px' }}>🏗️</div>
          <h3 style={{ margin: 0, color: '#c9d1d9' }}>Utility Network Module</h3>
          <p style={{ margin: 0, fontSize: '15px' }}>This feature is currently under development and will be added later.</p>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default UtilityNetworkModal;
