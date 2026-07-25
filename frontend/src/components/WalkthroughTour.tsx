import { useState, useEffect, useRef } from 'react';

interface Step {
  title: string;
  description: string;
  selector?: string;
}

interface WalkthroughTourProps {
  role: 'visitor' | 'user' | 'owner';
  userName?: string;
  onClose: () => void;
}

const WalkthroughTour = ({ role, userName, onClose }: WalkthroughTourProps) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties | null>(null);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 100000,
  });

  const cardRef = useRef<HTMLDivElement>(null);

  const tourSteps: Record<'visitor' | 'user' | 'owner', Step[]> = {
    visitor: [
      {
        title: "Welcome to El-Narges Compound Portal! 🏡",
        description: "Let's take a quick 1-minute tour of your interactive 3D map workspace. Click 'Next' to begin!",
      },
      {
        title: "🗺️ 2D / 3D Map Toggle",
        description: "Switch between 2D and 3D map views instantly to explore the compound's layout or view detailed 3D designs.",
        selector: "#tour-map-toggle",
      },
      {
        title: "🔑 Sign In / Register",
        description: "Click here to log in or create an account. Sign-in unlocks property booking, tracking requests, and full AI support!",
        selector: "#tour-login-btn",
      }
    ],
    user: [
      {
        title: `Welcome back, ${userName || 'Resident'}! 👋`,
        description: "You are now logged in as a registered user. Let's look at the new tools unlocked for you!",
      },
      {
        title: "⚙️ Account Settings",
        description: "Keep your profile up to date, change your password, and specify backup contact options.",
        selector: "#tour-settings-btn",
      },
      {
        title: "📑 My Requests",
        description: "View and track the status of all your submitted reservation requests and property interests.",
        selector: "#tour-requests-btn",
      },
      {
        title: "🌤️ Compound Map Tools",
        description: "Toggle weather overlays, view dynamic layers, or change the map basemap style.",
        selector: "#tour-customer-tools",
      },
      {
        title: "📍 Advanced GIS Tools",
        description: "Search for closest facility road routes (School, Gym, Hospital, Mall) or plan multi-stop route directions.",
        selector: "#tour-gis-tools",
      },
      {
        title: "🏢 Property Catalog",
        description: "Explore prices, check status, inspect details, and quickly request bookings for all available units.",
        selector: "#tour-catalog-btn",
      },
      {
        title: "🤖 AI Property Advisor",
        description: "Your smart assistant! Ask any question, search for properties, or request bookings instantly via natural chat.",
        selector: "#tour-ai-advisor",
      }
    ],
    owner: [
      {
        title: `Congratulations, ${userName || 'Owner'}! 🎉🔑`,
        description: "You have officially acquired a property in the compound! You now have access to specialized owner widgets.",
      },
      {
        title: "🏡 My Units & Complaints Dashboard",
        description: "This is your private control center. View your properties, download official floor plan blueprints, and submit/track maintenance complaints directly to the compound engineer!",
        selector: "#tour-owner-units-btn",
      },
      {
        title: "Ready to Explore! 🌟",
        description: "You're all set! Use the GIS Tools, AI Advisor, and catalog to continue managing your experience. Enjoy your dashboard!",
      }
    ]
  };

  const steps = tourSteps[role] || [];
  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (!currentStep) return;

    if (currentStep.selector) {
      const updatePosition = () => {
        const element = document.querySelector(currentStep.selector!);
        if (element) {
          const rect = element.getBoundingClientRect();
          
          // Spotlight positioning
          setSpotlightStyle({
            position: 'fixed',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: '12px',
            boxShadow: '0 0 0 9999px rgba(10, 15, 23, 0.85)',
            border: '3px solid #1f6feb',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 99999,
            pointerEvents: 'none',
          });

          // Dynamic Card positioning next to highlighted element
          const cardWidth = 320;
          const cardHeight = 220;
          const padding = 20;

          let top = rect.bottom + padding;
          let left = rect.left + rect.width / 2 - cardWidth / 2;

          // Align horizontally based on screen space
          if (left < padding) {
            left = padding;
          } else if (left + cardWidth > window.innerWidth - padding) {
            left = window.innerWidth - cardWidth - padding;
          }

          // Align vertically based on screen space
          if (top + cardHeight > window.innerHeight - padding) {
            top = rect.top - cardHeight - padding;
          }

          setCardStyle({
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${cardWidth}px`,
            zIndex: 100000,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          });
        } else {
          // Fallback if element not loaded yet
          setSpotlightStyle(null);
          setCardStyle({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '340px',
            zIndex: 100000,
          });
        }
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    } else {
      // Center of the screen steps
      setSpotlightStyle(null);
      setCardStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '360px',
        zIndex: 100000,
      });
    }
  }, [currentStepIndex, role, currentStep]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      localStorage.setItem(`tour_seen_${role}`, 'true');
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`tour_seen_${role}`, 'true');
    onClose();
  };

  if (!currentStep) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99998, pointerEvents: 'auto' }}>
      
      {/* Dark overlay when there's no custom spotlight style */}
      {!spotlightStyle && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(10, 15, 23, 0.85)', zIndex: 99999 }} />
      )}

      {/* Spotlight highlight */}
      {spotlightStyle && <div style={spotlightStyle} />}

      {/* Tour Card dialog */}
      <div 
        ref={cardRef} 
        style={{
          ...cardStyle,
          backgroundColor: '#0d1117',
          color: '#c9d1d9',
          border: '1px solid #30363d',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8)',
          fontFamily: "'Inter', sans-serif",
          backdropFilter: 'blur(12px)',
          boxSizing: 'border-box',
        }}
      >
        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#58a6ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Compound Guide
          </span>
          <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 600 }}>
            {currentStepIndex + 1} of {steps.length}
          </span>
        </div>

        {/* Title */}
        <h4 style={{ margin: '0 0 10px 0', fontSize: '17px', fontWeight: 800, color: '#ffffff', lineHeight: 1.3 }}>
          {currentStep.title}
        </h4>

        {/* Description */}
        <p style={{ margin: '0 0 24px 0', fontSize: '13.5px', color: '#8b949e', lineHeight: 1.5 }}>
          {currentStep.description}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              padding: '8px 12px',
              borderRadius: '6px',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#ff7b72')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#8b949e')}
          >
            Skip Tour
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {currentStepIndex > 0 && (
              <button 
                onClick={handlePrev}
                style={{
                  background: '#21262d',
                  border: '1px solid #30363d',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '8px 14px',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#30363d')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#21262d')}
              >
                Previous
              </button>
            )}

            <button 
              onClick={handleNext}
              style={{
                background: '#1f6feb',
                border: '1px solid #1f6feb',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                padding: '8px 16px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(31, 111, 235, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#388bfd')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#1f6feb')}
            >
              {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalkthroughTour;
