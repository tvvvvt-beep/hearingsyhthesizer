import React from 'react';
import { Mic } from 'lucide-react';
import styles from './RecordButton.module.css';

interface RecordButtonProps {
  isRecording: boolean;
  onClick: () => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, onClick }) => {
  return (
    <div className={styles.container}>
      {isRecording && (
        <>
          <div className={`${styles.ripple} ${styles.ripple1}`}></div>
          <div className={`${styles.ripple} ${styles.ripple2}`}></div>
          <div className={`${styles.ripple} ${styles.ripple3}`}></div>
        </>
      )}
      <button 
        className={`${styles.button} glass ${isRecording ? 'pulse' : ''}`}
        onClick={onClick}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        <div className={styles.iconContainer}>
          <Mic size={48} color="var(--text-primary)" strokeWidth={1.5} />
        </div>
      </button>
      <div className={styles.statusText}>
        {isRecording ? "Listening..." : "Tap to record environment"}
      </div>
    </div>
  );
};
