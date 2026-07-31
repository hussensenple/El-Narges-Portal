import React, { useState, useEffect, useRef } from 'react';

interface VoiceInputProps {
  onTextCapture: (text: string) => void;
  disabled?: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTextCapture, disabled }) => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [accumulatedText, setAccumulatedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [duration, setDuration] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  
  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);
  const durationIntervalRef = useRef<any>(null);
  
  useEffect(() => {
    isRecordingRef.current = isRecording;
    isPausedRef.current = isPaused;
  }, [isRecording, isPaused]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      durationIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(durationIntervalRef.current);
    }
    return () => clearInterval(durationIntervalRef.current);
  }, [isRecording, isPaused]);
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ar-EG'; 
      
      recognition.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript + ' ';
          } else {
            interimTrans += event.results[i][0].transcript;
          }
        }
        
        if (finalTrans) {
          setAccumulatedText(prev => prev + finalTrans);
        }
        setInterimText(interimTrans);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access in your browser settings to use voice commands.');
          stopAll();
        } else if (event.error !== 'no-speech') {
          stopAll();
        }
      };
      
      recognition.onend = () => {
        if (isRecordingRef.current && !isPausedRef.current) {
          try {
            recognitionRef.current?.start();
          } catch(e) {}
        }
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  const startRecording = () => {
    if (!recognitionRef.current) {
      alert("Your browser does not support Voice Recognition. Please use Chrome or Edge.");
      return;
    }
    setAccumulatedText('');
    setInterimText('');
    setDuration(0);
    setIsOverlayOpen(true);
    setIsRecording(true);
    setIsPaused(false);
    try {
      recognitionRef.current.start();
    } catch (e) {}
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      try {
        recognitionRef.current.start();
      } catch (e) {}
    } else {
      setIsPaused(true);
      recognitionRef.current.stop();
    }
  };

  const cancelRecording = () => {
    stopAll();
  };

  const finishRecording = () => {
    const finalResult = (accumulatedText + ' ' + interimText).trim();
    if (finalResult) {
      onTextCapture(finalResult);
    }
    stopAll();
  };

  const stopAll = () => {
    setIsRecording(false);
    setIsPaused(false);
    setIsOverlayOpen(false);
    setAccumulatedText('');
    setInterimText('');
    setDuration(0);
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button 
        type="button"
        onClick={startRecording}
        disabled={disabled}
        title="Start Voice Recording"
        style={{
          background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '22px', padding: '10px', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: disabled ? 0.5 : 1, transition: 'color 0.2s'
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.color = 'var(--accent-blue)'; }}
        onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/><line x1="8" x2="16" y1="22" y2="22"/></svg>
      </button>

      {isOverlayOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          bottom: '100%',
          marginBottom: '10px',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '25px',
          padding: '8px 16px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          whiteSpace: 'nowrap',
          transition: 'all 0.3s'
        }}>
          {/* Trash */}
          <button title="Cancel" onClick={cancelRecording} style={{ background:'none', border:'none', color:'var(--accent-red)', cursor:'pointer', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
          
          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)' }}></div>

          {/* Time & Pulsing indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '60px' }}>
            <div style={{ 
              width: '8px', height: '8px', borderRadius: '50%', 
              backgroundColor: isPaused ? 'var(--text-muted)' : 'var(--accent-red)', 
              boxShadow: isPaused ? 'none' : '0 0 8px var(--accent-red)',
              opacity: (duration % 2 === 0 && !isPaused) ? 0.5 : 1,
              transition: 'opacity 0.3s'
            }}></div>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {formatTime(duration)}
            </span>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)' }}></div>

          {/* Pause/Resume */}
          <button title={isPaused ? 'Resume' : 'Pause'} onClick={togglePause} style={{ background:'none', border:'none', color:'var(--accent-blue)', cursor:'pointer', display: 'flex', alignItems: 'center' }}>
            {isPaused ? 
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> 
              : 
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></svg>
            }
          </button>
          
          {/* Done/Send */}
          <button title="Send" onClick={finishRecording} style={{ background:'none', border:'none', color:'var(--accent-green)', cursor:'pointer', display: 'flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
