const ArcGISDashboardTab = () => {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-primary)' }}>
      <iframe 
        src="https://www.arcgis.com/apps/dashboards/572099e2dda74e6b8eb706895efdada0" 
        width="100%" 
        height="100%" 
        frameBorder="0"
        style={{ border: 'none' }}
        title="ArcGIS Executive Dashboard"
        allowFullScreen
      />
    </div>
  );
};

export default ArcGISDashboardTab;
