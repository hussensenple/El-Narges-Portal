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
        🎤
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
          <button title="Cancel" onClick={cancelRecording} style={{ background:'none', border:'none', color:'var(--accent-red)', cursor:'pointer', fontSize:'18px', padding: '5px', display: 'flex' }}>
            🗑️
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
          <button title={isPaused ? 'Resume' : 'Pause'} onClick={togglePause} style={{ background:'none', border:'none', color:'var(--accent-blue)', cursor:'pointer', fontSize:'18px', padding: '5px', display: 'flex' }}>
            {isPaused ? '▶️' : '⏸️'}
          </button>
          
          {/* Done/Send */}
          <button title="Send" onClick={finishRecording} style={{ background:'none', border:'none', color:'var(--accent-green)', cursor:'pointer', fontSize:'20px', padding: '5px', display: 'flex' }}>
            ✅
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
