import { useState } from 'react';
import { createPortal } from 'react-dom';

interface UNDashboardModalProps {
  onClose: () => void;
}

const UNDashboardModal = ({ onClose }: UNDashboardModalProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const dashboardUrl = 'https://www.arcgis.com/apps/dashboards/bd9339de2519498b96a80bde6d0d0155#';

  return createPortal(
    <div 
      onClick={onClose} 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        backgroundColor: 'rgba(13, 17, 23, 0.85)', 
        backdropFilter: 'blur(6px)',
        zIndex: 99999999, 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        animation: 'fadeIn 0.2s ease-in-out'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          backgroundColor: 'var(--bg-primary)', 
          width: '1400px', 
          maxWidth: '96vw', 
          height: '90vh', 
          borderRadius: '16px', 
          border: '1px solid var(--border-color)', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden', 
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          animation: 'scaleUp 0.25s ease-out'
        }}
      >
        {/* Header */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderBottom: '1px solid var(--border-color)', 
            padding: '14px 24px',
            backgroundColor: 'var(--bg-secondary)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '22px' }}>📊</span>
            <div>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                El-Narges Water Utility Network Dashboard
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Real-time GIS analytics and monitoring portal
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--accent-blue)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              title="Open in external browser tab"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--border-color)'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
              🌐 Open in External Tab
            </a>

            <button 
              onClick={onClose} 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: '#ff7b72', 
                fontSize: '22px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                padding: '0 4px',
                lineHeight: 1,
                transition: 'transform 0.2s ease'
              }}
              title="Close Dashboard"
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, width: '100%', height: '100%', backgroundColor: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
          {isLoading && (
            <div 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center', 
                backgroundColor: 'var(--bg-primary)', 
                zIndex: 10,
                color: 'var(--text-muted)',
                gap: '14px'
              }}
            >
              <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Loading ArcGIS Dashboard...</span>
            </div>
          )}

          <iframe
            src={dashboardUrl}
            width="100%"
            height="100%"
            style={{ border: 'none', display: 'block', width: '100%', height: '100%' }}
            title="El-Narges Water Utility Network Dashboard"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default UNDashboardModal;
