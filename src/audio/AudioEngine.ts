export class AudioEngine {
    private audioContext: AudioContext | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];

    // Soundscape nodes
    private masterGain: GainNode | null = null;
    private convolver: ConvolverNode | null = null;
    private delay: DelayNode | null = null;
    private delayFeedback: GainNode | null = null;
    private filter: BiquadFilterNode | null = null;

    // Active playing sources for stop() func
    private activeSources: (AudioBufferSourceNode | OscillatorNode | GainNode | StereoPannerNode)[] = [];

    // Generative Timers
    private generativeTimers: number[] = [];

    // Analyser
    public analyser: AnalyserNode | null = null;

    public init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.setupEffectChain();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    private setupEffectChain() {
        if (!this.audioContext) return;

        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 1.0;

        // Analyser setup
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        // Reverb - Longer tail (8 seconds) for V2
        this.convolver = this.audioContext.createConvolver();
        this.createImpulseResponse(this.audioContext, 8.0, 4.0).then((buffer) => {
            if (this.convolver) {
                this.convolver.buffer = buffer;
            }
        });

        const reverbGain = this.audioContext.createGain();
        reverbGain.gain.value = 0.8;
        this.convolver.connect(reverbGain);
        reverbGain.connect(this.masterGain);

        // Delay - Wider
        this.delay = this.audioContext.createDelay(10.0);
        this.delay.delayTime.value = 1.5; // 1.5s delay for more expansive feel

        // Delay modulation LFO
        const delayLfo = this.audioContext.createOscillator();
        delayLfo.type = 'sine';
        delayLfo.frequency.value = 0.1; // slow modulation
        const delayLfoGain = this.audioContext.createGain();
        delayLfoGain.gain.value = 0.05;
        delayLfo.connect(delayLfoGain);
        delayLfoGain.connect(this.delay.delayTime);
        delayLfo.start();

        this.delayFeedback = this.audioContext.createGain();
        this.delayFeedback.gain.value = 0.6; // 60% feedback

        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
        // Connect modulated delay to master
        this.delay.connect(this.masterGain);

        // Filter
        this.filter = this.audioContext.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 1500; // lower for more muffled ambient
        this.filter.Q.value = 1.0;

        // Filter modulation
        const filterLfo = this.audioContext.createOscillator();
        filterLfo.type = 'sine';
        filterLfo.frequency.value = 0.05;
        const filterLfoGain = this.audioContext.createGain();
        filterLfoGain.gain.value = 800; // sweep +/- 800Hz
        filterLfo.connect(filterLfoGain);
        filterLfoGain.connect(this.filter.frequency);
        filterLfo.start();

        // Routing
        this.filter.connect(this.convolver);
        this.filter.connect(this.delay);

        const dryGain = this.audioContext.createGain();
        dryGain.gain.value = 0.2; // Less dry signal in V2
        this.filter.connect(dryGain);
        dryGain.connect(this.masterGain);
    }

    private async createImpulseResponse(context: AudioContext, duration: number, decay: number): Promise<AudioBuffer> {
        const sampleRate = context.sampleRate;
        const length = sampleRate * duration;
        const impulse = context.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = i / length; // 0 to 1
            const noise_L = (Math.random() * 2 - 1);
            const noise_R = (Math.random() * 2 - 1);

            left[i] = noise_L * Math.exp(-n * decay) * (1 - n);
            right[i] = noise_R * Math.exp(-n * decay) * (1 - n);
        }
        return impulse;
    }

    public async startRecording(): Promise<void> {
        this.init();
        this.recordedChunks = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
            });

            const mimeTypes = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'];
            let options: MediaRecorderOptions | undefined;
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    options = { mimeType };
                    break;
                }
            }

            this.mediaRecorder = new MediaRecorder(stream, options);
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            this.mediaRecorder.start();
        } catch (err) {
            console.error('Failed to access microphone:', err);
            throw err;
        }
    }

    public stopRecording(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('MediaRecorder not initialized'));
                return;
            }
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
                this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
                resolve(audioBlob);
            };
            this.mediaRecorder.stop();
        });
    }

    public async generateSoundscape(blob: Blob) {
        this.init();
        if (!this.audioContext || !this.filter || !this.masterGain) throw new Error("Audio Context not initialized");

        this.stopPlaying(); // ensure no overlapping playback

        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        // Get subtle random variations (Combines 7 roots * 5 chords * 5 rates = 175 harmonic/rhythmic bases + infinite LFO/Filter drifts)
        const variation = this.getRandomVariation();

        // Dynamically update effect chain parameters for this new variation
        if (this.filter && this.delay) {
            // Smoothly shift to new values to avoid clicks if reusing context
            this.filter.frequency.setTargetAtTime(variation.filterCutoff, this.audioContext.currentTime, 0.1);
            this.delay.delayTime.setTargetAtTime(variation.delayTime, this.audioContext.currentTime, 0.1);
        }

        const baseFreq = variation.baseFreq;
        const int1Freq = baseFreq * variation.intervals[0];
        const int2Freq = baseFreq * variation.intervals[1];

        // --- Layer 1: Stretch & Pitch down audio with Panning ---
        const source1 = this.audioContext.createBufferSource();
        source1.buffer = audioBuffer;
        source1.playbackRate.value = variation.rates[0];
        source1.loop = true;

        const panner1 = this.audioContext.createStereoPanner();
        const panner1Lfo = this.audioContext.createOscillator();
        panner1Lfo.frequency.value = variation.panLfoSpeed1;
        panner1Lfo.connect(panner1.pan);
        panner1Lfo.start();

        const gain1 = this.audioContext.createGain();
        gain1.gain.value = 0.5;

        source1.connect(panner1);
        panner1.connect(gain1);
        gain1.connect(this.filter);

        source1.start();
        this.activeSources.push(source1, panner1Lfo);

        // --- Layer 2: Ultra stretch audio with opposite panning ---
        const source2 = this.audioContext.createBufferSource();
        source2.buffer = audioBuffer;
        source2.playbackRate.value = variation.rates[1];
        source2.loop = true;

        const panner2 = this.audioContext.createStereoPanner();
        const panner2Lfo = this.audioContext.createOscillator();
        panner2Lfo.frequency.value = variation.panLfoSpeed2;
        panner2Lfo.connect(panner2.pan);
        // Offset phase by starting later (or just letting it drift)
        panner2Lfo.start();

        const gain2 = this.audioContext.createGain();
        gain2.gain.value = 0.4;

        // Volume LFO
        const volLfo = this.audioContext.createOscillator();
        volLfo.type = 'sine';
        volLfo.frequency.value = variation.volLfoSpeed;
        volLfo.connect(gain2.gain);
        volLfo.start();

        source2.connect(panner2);
        panner2.connect(gain2);
        gain2.connect(this.filter);
        source2.start();
        this.activeSources.push(source2, panner2Lfo, volLfo);

        // --- Synth Layer: Drone Pad (C2, G2, C3) ---
        const createDrone = (freq: number, type: OscillatorType, maxGain: number) => {
            const osc = this.audioContext!.createOscillator();
            osc.type = type;
            osc.frequency.value = freq;

            const oscGain = this.audioContext!.createGain();
            oscGain.gain.value = maxGain;

            const oscFilter = this.audioContext!.createBiquadFilter();
            oscFilter.type = 'lowpass';
            oscFilter.frequency.value = 300; // very dark and warm

            osc.connect(oscFilter);
            oscFilter.connect(oscGain);
            oscGain.connect(this.convolver!); // Direct to heavy reverb

            osc.start();
            this.activeSources.push(osc);
        };

        createDrone(baseFreq, 'triangle', 0.15);
        createDrone(int1Freq, 'sine', 0.1);
        createDrone(int2Freq, 'sine', 0.08);

        // --- Generative Layer: Random Sparkles (High frequencies) ---
        const sparkleNotes = [
            baseFreq * 8, int1Freq * 8, int2Freq * 8,
            baseFreq * 16, int1Freq * 16
        ];

        const playSparkle = () => {
            if (!this.audioContext || this.activeSources.length === 0) return; // stopped

            const freq = sparkleNotes[Math.floor(Math.random() * sparkleNotes.length)];

            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0, this.audioContext.currentTime);
            // Gentle fade in, fade out
            gain.gain.linearRampToValueAtTime(0.05, this.audioContext.currentTime + 2.0); // attack
            gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 6.0);    // release

            // Random Pan
            const panner = this.audioContext.createStereoPanner();
            panner.pan.value = (Math.random() * 2) - 1;

            osc.connect(gain);
            gain.connect(panner);
            panner.connect(this.convolver!); // heavy reverb for ethereal tail

            osc.start(this.audioContext.currentTime);
            osc.stop(this.audioContext.currentTime + 6.0); // self cleanup

            // Schedule next sparkle
            const nextTime = Math.random() * 4000 + 2000; // 2-6 seconds
            const timerId = window.setTimeout(playSparkle, nextTime);
            this.generativeTimers.push(timerId);
        };

        // start first sparkle
        const timerId = window.setTimeout(playSparkle, 3000);
        this.generativeTimers.push(timerId);
    }

    private getRandomVariation() {
        // Subtle base frequency changes: A1, B1, C2, D2, E2, F#2, G2
        const roots = [55.00, 61.74, 65.41, 73.42, 82.41, 92.50, 98.00];
        const baseFreq = roots[Math.floor(Math.random() * roots.length)];

        // Subtle chord structures for the drone (based on fundamental ratios)
        const chordPool = [
            [1.5, 2.0],     // Perfect 5th + Octave
            [1.25, 1.5],    // Major 3rd + Perfect 5th
            [1.2, 1.5],     // Minor 3rd + Perfect 5th
            [1.333, 2.0],   // Perfect 4th + Octave
            [1.122, 1.5]    // Sus2 (Major 2nd + Perfect 5th)
        ];
        const intervals = chordPool[Math.floor(Math.random() * chordPool.length)];

        // Variations in sound stretching
        const ratesPool = [
            [0.5, 0.25],    // Classic deep stretch
            [0.4, 0.2],     // Extremely slow and deep
            [0.6, 0.3],     // Slightly faster, lighter
            [0.75, 0.375],  // Less pitched down, closer to original but dreamy
            [0.5, 0.125]    // Layer 1 normal stretch, Layer 2 deep abyss
        ];
        const rates = ratesPool[Math.floor(Math.random() * ratesPool.length)];

        // Infinite subtle drifts in effect parameters
        const filterCutoff = 1000 + (Math.random() * 1000); // 1000 - 2000 Hz
        const delayTime = 1.0 + (Math.random() * 1.5); // 1.0 - 2.5 seconds
        const panLfoSpeed1 = 0.05 + (Math.random() * 0.1);
        const panLfoSpeed2 = 0.03 + (Math.random() * 0.07);
        const volLfoSpeed = 0.02 + (Math.random() * 0.06);

        return {
            baseFreq,
            intervals,
            rates,
            filterCutoff,
            delayTime,
            panLfoSpeed1,
            panLfoSpeed2,
            volLfoSpeed
        };
    }

    public stopPlaying() {
        this.activeSources.forEach(source => {
            try {
                if ('stop' in source) source.stop();
                source.disconnect();
            } catch (e) {
                // ignore errors if already stopped
            }
        });
        this.activeSources = [];

        this.generativeTimers.forEach(timer => window.clearTimeout(timer));
        this.generativeTimers = [];
    }

    public getContext(): AudioContext | null {
        return this.audioContext;
    }
}

export const audioEngine = new AudioEngine();
