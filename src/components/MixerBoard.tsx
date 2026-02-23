import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import styles from './MixerBoard.module.css';

interface MixerBoardProps {
    track1Volume: number;
    track2Volume: number;
    onTrack1VolumeChange: (value: number) => void;
    onTrack2VolumeChange: (value: number) => void;
    disabled?: boolean;
}

export const MixerBoard: React.FC<MixerBoardProps> = ({
    track1Volume,
    track2Volume,
    onTrack1VolumeChange,
    onTrack2VolumeChange,
    disabled = false
}) => {
    return (
        <div className={`${styles.container} glass ${disabled ? styles.disabled : ''}`}>
            <div className={styles.channels}>
                <div className={styles.channel}>
                    <div className={styles.label}>T1</div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={track1Volume}
                        onChange={(e) => onTrack1VolumeChange(parseFloat(e.target.value))}
                        className={styles.fader}
                        disabled={disabled}
                        aria-label="Track 1 Volume"
                    />
                    <div className={styles.icon}>
                        {track1Volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </div>
                </div>

                <div className={styles.divider}></div>

                <div className={styles.channel}>
                    <div className={styles.label}>T2</div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={track2Volume}
                        onChange={(e) => onTrack2VolumeChange(parseFloat(e.target.value))}
                        className={styles.fader}
                        disabled={disabled}
                        aria-label="Track 2 Volume"
                    />
                    <div className={styles.icon}>
                        {track2Volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </div>
                </div>
            </div>
        </div>
    );
};
