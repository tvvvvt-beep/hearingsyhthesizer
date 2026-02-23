import { useState, useEffect } from 'react';
import { RecordButton } from './components/RecordButton';
import { SoundscapePlayer } from './components/SoundscapePlayer';
import { MixerBoard } from './components/MixerBoard';
import { audioEngine } from './audio/AudioEngine';
import './App.css';

type TrackState = 'empty' | 'recording' | 'recorded';
type GlobalState = 'setup' | 'processing' | 'playing';

function App() {
  const [globalState, setGlobalState] = useState<GlobalState>('setup');
  const [isPlaying, setIsPlaying] = useState(false);

  // Track 1
  const [track1State, setTrack1State] = useState<TrackState>('empty');
  const [track1Blob, setTrack1Blob] = useState<Blob | null>(null);
  const [track1Vol, setTrack1Vol] = useState(0.8);

  // Track 2
  const [track2State, setTrack2State] = useState<TrackState>('empty');
  const [track2Blob, setTrack2Blob] = useState<Blob | null>(null);
  const [track2Vol, setTrack2Vol] = useState(0.8);

  const handleTrack1VolChange = (v: number) => {
    setTrack1Vol(v);
    audioEngine.setTrackVolume(1, v);
  };
  const handleTrack2VolChange = (v: number) => {
    setTrack2Vol(v);
    audioEngine.setTrackVolume(2, v);
  };

  const startRecordingTrack = async (track: 1 | 2) => {
    if (globalState === 'playing') {
      audioEngine.stopPlaying();
      setIsPlaying(false);
      setGlobalState('setup');
    }
    try {
      await audioEngine.startRecording();
      if (track === 1) setTrack1State('recording');
      else setTrack2State('recording');
    } catch (e) {
      console.error(e);
      alert('Microphone access is required to create a soundscape.');
    }
  };

  const stopRecordingTrack = async (track: 1 | 2) => {
    setGlobalState('processing');
    try {
      const blob = await audioEngine.stopRecording();
      if (track === 1) {
        setTrack1Blob(blob);
        setTrack1State('recorded');
      } else {
        setTrack2Blob(blob);
        setTrack2State('recorded');
      }

      setGlobalState('setup');

      // Auto start playing if we have at least one track
      await playMix();
    } catch (e) {
      console.error(e);
      setGlobalState('setup');
      if (track === 1) setTrack1State('empty');
      else setTrack2State('empty');
    }
  };

  const playMix = async () => {
    // Need at least one track's blob using the correct outer state
    if (!track1Blob && !track2Blob) return;

    setGlobalState('processing');
    try {
      setIsPlaying(true);
      await audioEngine.generateDualSoundscape(track1Blob, track2Blob);
      // Re-apply volumes after node generation
      audioEngine.setTrackVolume(1, track1Vol);
      audioEngine.setTrackVolume(2, track2Vol);
      setGlobalState('playing');
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
      setGlobalState('setup');
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      audioEngine.stopPlaying();
      setIsPlaying(false);
      setGlobalState('setup'); // Change back to setup so we can re-record if wanted
    } else {
      await playMix();
    }
  };

  const resetAll = () => {
    audioEngine.stopPlaying();
    setTrack1Blob(null);
    setTrack2Blob(null);
    setTrack1State('empty');
    setTrack2State('empty');
    setIsPlaying(false);
    setGlobalState('setup');
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
        <div className="dual-track-container">
          <RecordButton
            trackLabel="Track 1"
            isRecording={track1State === 'recording'}
            isRecorded={track1State === 'recorded'}
            onClick={() => track1State === 'recording' ? stopRecordingTrack(1) : startRecordingTrack(1)}
          />

          <div className="divider-line"></div>

          <RecordButton
            trackLabel="Track 2"
            isRecording={track2State === 'recording'}
            isRecorded={track2State === 'recorded'}
            onClick={() => track2State === 'recording' ? stopRecordingTrack(2) : startRecordingTrack(2)}
          />
        </div>

        {globalState === 'processing' && (
          <div className="processing-text">Sculpting space...</div>
        )}

        {(track1Blob || track2Blob) && (
          <MixerBoard
            track1Volume={track1Vol}
            track2Volume={track2Vol}
            onTrack1VolumeChange={handleTrack1VolChange}
            onTrack2VolumeChange={handleTrack2VolChange}
            disabled={globalState === 'processing'}
          />
        )}

        {/* Instead of passing isPlaying to the whole app UI, just show master controls */}
        {(track1Blob || track2Blob) && (
          <SoundscapePlayer
            isPlaying={isPlaying}
            onPlay={togglePlay}
            onStop={togglePlay}
            onReset={resetAll}
          />
        )}
      </main>
    </div>
  );
}

export default App;
