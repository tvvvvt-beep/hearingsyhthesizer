import React, { useRef, useEffect } from 'react';
import { audioEngine } from '../audio/AudioEngine';

interface VisualizerProps {
    isActive: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isActive) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const analyser = audioEngine.analyser;
        if (!analyser) return;

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let animationId: number;

        const draw = () => {
            animationId = requestAnimationFrame(draw);

            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i];

                const r = barHeight + (25 * (i / bufferLength));
                const g = 250 * (i / bufferLength);
                const b = 250;

                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

                x += barWidth + 1;
            }
        };

        draw();

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [isActive]);

    return (
        <canvas
            ref={canvasRef}
            width={window.innerWidth}
            height={300}
            style={{
                width: '100%',
                height: '300px',
                position: 'absolute',
                bottom: 0,
                left: 0,
                pointerEvents: 'none',
                opacity: isActive ? 0.4 : 0,
                transition: 'opacity 1s ease',
                zIndex: 0
            }}
        />
    );
};
