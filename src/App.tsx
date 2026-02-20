import { useState, useEffect } from 'react';
import { RecordButton } from './components/RecordButton';
import { SoundscapePlayer } from './components/SoundscapePlayer';
import { audioEngine } from './audio/AudioEngine';
import './App.css';

type AppState = 'welcome' | 'recording' | 'processing' | 'playing';

function App() {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const startRecording = async () => {
    try {
      await audioEngine.startRecording();
      setAppState('recording');
    } catch (e) {
      console.error(e);
      alert('Microphone access is required to create a soundscape.');
    }
  };

  const stopRecording = async () => {
    setAppState('processing');
    try {
      const blob = await audioEngine.stopRecording();
      setAudioBlob(blob);
      setAppState('playing');
      setIsPlaying(true);
      await audioEngine.generateSoundscape(blob);
    } catch (e) {
      console.error(e);
      setAppState('welcome');
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      audioEngine.stopPlaying();
      setIsPlaying(false);
    } else {
      if (audioBlob) {
        await audioEngine.generateSoundscape(audioBlob);
        setIsPlaying(true);
      }
    }
  };

  const reset = () => {
    audioEngine.stopPlaying();
    setAudioBlob(null);
    setIsPlaying(false);
    setAppState('welcome');
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      audioEngine.stopPlaying();
    };
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Atmosphere</h1>
        <p className="subtitle">Discover the soundscape around you</p>
      </header>

      <main className="main-content">
        {(appState === 'welcome' || appState === 'recording') && (
          <RecordButton
            isRecording={appState === 'recording'}
            onClick={appState === 'recording' ? stopRecording : startRecording}
          />
        )}

        {appState === 'processing' && (
          <div className="processing-text">Sculpting space...</div>
        )}

        {appState === 'playing' && (
          <SoundscapePlayer
            isPlaying={isPlaying}
            onPlay={togglePlay}
            onStop={togglePlay}
            onReset={reset}
          />
        )}
      </main>
    </div>
  );
}

export default App;
