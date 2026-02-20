import React from 'react';
import { Play, Square, RefreshCcw } from 'lucide-react';
import styles from './SoundscapePlayer.module.css';
import { Visualizer } from './Visualizer';

interface SoundscapePlayerProps {
    isPlaying: boolean;
    onPlay: () => void;
    onStop: () => void;
    onReset: () => void;
}

export const SoundscapePlayer: React.FC<SoundscapePlayerProps> = ({
    isPlaying,
    onPlay,
    onStop,
    onReset
}) => {
    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Your Atmosphere</h2>
            <p className={styles.subtitle}>A unique soundscape sculpted from your environment.</p>

            <div className={`${styles.controls} glass`}>
                <button
                    className={styles.controlBtn}
                    onClick={isPlaying ? onStop : onPlay}
                    aria-label={isPlaying ? "Stop atmosphere" : "Play atmosphere"}
                >
                    {isPlaying ? <Square size={32} /> : <Play size={32} />}
                </button>

                <button
                    className={styles.resetBtn}
                    onClick={onReset}
                    aria-label="Create new atmosphere"
                >
                    <RefreshCcw size={24} />
                    <span>New</span>
                </button>
            </div>

            <Visualizer isActive={isPlaying} />
        </div>
    );
};
