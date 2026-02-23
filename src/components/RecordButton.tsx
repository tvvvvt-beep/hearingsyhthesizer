import React from 'react';
import { Mic } from 'lucide-react';
import styles from './RecordButton.module.css';

interface RecordButtonProps {
  isRecording: boolean;
  isRecorded: boolean;
  trackLabel: string;
  onClick: () => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, isRecorded, trackLabel, onClick }) => {
  return (
    <div className={styles.container}>
      <div className={styles.trackLabel}>{trackLabel}</div>
      {isRecording && (
        <>
          <div className={`${styles.ripple} ${styles.ripple1}`}></div>
          <div className={`${styles.ripple} ${styles.ripple2}`}></div>
          <div className={`${styles.ripple} ${styles.ripple3}`}></div>
        </>
      )}
      <button
        className={`${styles.button} glass ${isRecording ? 'pulse' : ''} ${isRecorded && !isRecording ? styles.recorded : ''}`}
        onClick={onClick}
        aria-label={isRecording ? `Stop recording ${trackLabel}` : `Start recording ${trackLabel}`}
      >
        <div className={styles.iconContainer}>
          <Mic size={48} color="var(--text-primary)" strokeWidth={1.5} />
        </div>
      </button>
      <div className={styles.statusText}>
        {isRecording ? "Listening..." : isRecorded ? "Recorded" : "Tap to record"}
      </div>
    </div>
  );
};
