import React, { useState, useEffect } from 'react';

const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'dark';
    setIsDark(currentTheme === 'dark');
    
    // Listen for theme changes from other tabs/instances
    const handleStorage = () => {
      const updatedTheme = localStorage.getItem('theme') || 'dark';
      setIsDark(updatedTheme === 'dark');
      document.documentElement.setAttribute('data-theme', updatedTheme);
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setIsDark(!isDark);
  };

  return (
    <div 
      onClick={toggleTheme}
      style={{
        width: '56px',
        height: '28px',
        borderRadius: '14px',
        backgroundColor: isDark ? 'var(--accent-blue-bg)' : 'var(--bg-hover)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.3s, border-color 0.3s',
        boxSizing: 'border-box'
      }}
      title="Toggle Light/Dark Mode"
    >
      <div 
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          backgroundColor: isDark ? 'var(--bg-primary)' : '#ffffff',
          position: 'absolute',
          top: '2px',
          left: isDark ? '30px' : '2px',
          transition: 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        <span style={{ fontSize: '13px', lineHeight: 1, userSelect: 'none' }}>
          {isDark ? '🌙' : '☀️'}
        </span>
      </div>
    </div>
  );
};

export default ThemeToggle;
