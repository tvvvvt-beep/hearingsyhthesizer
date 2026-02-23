import React from 'react';
import styles from './MixerBoard.module.css';

interface MixerBoardProps {
    mixValue: number;
    onMixChange: (value: number) => void;
    disabled?: boolean;
}

export const MixerBoard: React.FC<MixerBoardProps> = ({
    mixValue,
    onMixChange,
    disabled = false
}) => {
    return (
        <div className={`${styles.container} glass ${disabled ? styles.disabled : ''}`}>
            <div className={styles.channels}>
                <div className={`${styles.label} ${mixValue < 0 ? styles.activeLabel : ''}`}>T1</div>
                <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={mixValue}
                    onChange={(e) => onMixChange(parseFloat(e.target.value))}
                    className={styles.crossfader}
                    disabled={disabled}
                    aria-label="Crossfader"
                />
                <div className={`${styles.label} ${mixValue > 0 ? styles.activeLabel : ''}`}>T2</div>
            </div>
        </div>
    );
};
