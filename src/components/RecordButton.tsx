import React from 'react';
import { Mic } from 'lucide-react';
import styles from './RecordButton.module.css';

interface RecordButtonProps {
  isRecording: boolean;
  isRecorded: boolean;
  trackLabel: string;
  variation: number;
  onVariationChange: (v: number) => void;
  selectorPosition: 'left' | 'right';
  onClick: () => void;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  isRecording,
  isRecorded,
  trackLabel,
  variation,
  onVariationChange,
  selectorPosition,
  onClick
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.trackLabel}>{trackLabel}</div>
      <div className={`${styles.mainArea} ${selectorPosition === 'left' ? styles.reverse : ''}`}>

        {/* Variation Selectors */}
        <div className={styles.variationSelectors}>
          {[1, 2, 3, 4].map(num => (
            <button
              key={num}
              className={`${styles.variationBtn} ${variation === num ? styles.activeVariation : ''}`}
              onClick={() => onVariationChange(num)}
              aria-label={`Variation ${num}`}
            >
              {num}
            </button>
          ))}
        </div>

        {/* Record Button Container */}
        <div className={styles.recordContainer}>
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
              <Mic size={36} color="var(--text-primary)" strokeWidth={1.5} />
            </div>
          </button>
        </div>

      </div>

      <div className={styles.statusText}>
        {isRecording ? "Listening..." : isRecorded ? "Recorded" : "Tap to record"}
      </div>
    </div>
  );
};
