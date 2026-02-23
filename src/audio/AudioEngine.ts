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

    private activeSources: (AudioBufferSourceNode | OscillatorNode | GainNode | StereoPannerNode)[] = [];

    // Track Mixing Nodes
    private track1Gain: GainNode | null = null;
    private track2Gain: GainNode | null = null;

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

        // Track Gains
        this.track1Gain = this.audioContext.createGain();
        this.track1Gain.gain.value = 0.8;
        this.track2Gain = this.audioContext.createGain();
        this.track2Gain.gain.value = 0.8;

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

        // Connect Track Gains to the Filter (which feeds the FX bus and dry master)
        this.track1Gain.connect(this.filter);
        this.track2Gain.connect(this.filter);
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

    public setTrackVolume(track: 1 | 2, value: number) {
        // Value expects 0.0 to 1.0
        if (track === 1 && this.track1Gain && this.audioContext) {
            this.track1Gain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.05);
        } else if (track === 2 && this.track2Gain && this.audioContext) {
            this.track2Gain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.05);
        }
    }

    public async generateDualSoundscape(blob1: Blob | null, blob2: Blob | null, track1Var: number = 1, track2Var: number = 1) {
        this.init();
        if (!this.audioContext || !this.filter || !this.masterGain) throw new Error("Audio Context not initialized");

        this.stopPlaying(); // ensure no overlapping playback

        // Decode provided blobs
        let buffer1: AudioBuffer | null = null;
        let buffer2: AudioBuffer | null = null;

        if (blob1) {
            const arr1 = await blob1.arrayBuffer();
            buffer1 = await this.audioContext.decodeAudioData(arr1);
        }
        if (blob2) {
            const arr2 = await blob2.arrayBuffer();
            buffer2 = await this.audioContext.decodeAudioData(arr2);
        }

        if (!buffer1 && !buffer2) return; // Nothing to play

        // Retrieve specific parameter sets based on selected variations
        const var1Params = this.getVariationParams(track1Var);
        const var2Params = this.getVariationParams(track2Var);

        // We use track 1's base frequency for shared synths and global effects to keep them in key,
        // or a default if T1 is empty.
        const masterParams = blob1 ? var1Params : var2Params;

        // Dynamically update effect chain parameters for this new shared variation
        if (this.filter && this.delay) {
            this.filter.frequency.setTargetAtTime(masterParams.filterCutoff, this.audioContext.currentTime, 0.1);
            this.delay.delayTime.setTargetAtTime(masterParams.delayTime, this.audioContext.currentTime, 0.1);
        }

        const baseFreq = masterParams.baseFreq;
        const int1Freq = baseFreq * masterParams.intervals[0];
        const int2Freq = baseFreq * masterParams.intervals[1];

        // Set up function to build a layer so we can apply it to multiple buffers
        const buildLayer = (
            buffer: AudioBuffer,
            targetGain: GainNode | null,
            params: any,
            role: 'primary' | 'secondary'
        ) => {
            if (!this.audioContext || !targetGain) return;

            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = role === 'primary' ? params.rates[0] : params.rates[1];
            source.loop = true;

            const panner = this.audioContext.createStereoPanner();
            const pannerLfo = this.audioContext.createOscillator();
            pannerLfo.frequency.value = role === 'primary' ? params.panLfoSpeed1 : params.panLfoSpeed2;
            pannerLfo.connect(panner.pan);
            pannerLfo.start();

            // Setup Filter if variation asks for Highpass (e.g., Var 4)
            let lastNodeBeforeGain: AudioNode = panner;

            if (params.isHighpass) {
                const lp = this.audioContext.createBiquadFilter();
                lp.type = 'highpass';
                lp.frequency.value = 800;
                panner.connect(lp);
                lastNodeBeforeGain = lp;
            }

            const roleGain = this.audioContext.createGain();

            // Apply volume envelopes/LFOs based on variation percussiveness
            if (params.isPercussive) {
                // Rhythmic envelope
                roleGain.gain.value = 0;
                const volLfo = this.audioContext.createOscillator();
                volLfo.type = 'square';
                volLfo.frequency.value = params.volLfoSpeed * 20; // fast chop

                // smoothing filter for the square wave
                const smoothFilter = this.audioContext.createBiquadFilter();
                smoothFilter.type = 'lowpass';
                smoothFilter.frequency.value = 10;

                volLfo.connect(smoothFilter);
                smoothFilter.connect(roleGain.gain);
                volLfo.start();
                this.activeSources.push(volLfo);
            } else {
                // Ambient behavior
                if (role === 'primary') {
                    roleGain.gain.value = 0.5;
                } else {
                    roleGain.gain.value = 0.4;
                    const volLfo = this.audioContext.createOscillator();
                    volLfo.type = 'sine';
                    volLfo.frequency.value = params.volLfoSpeed;
                    volLfo.connect(roleGain.gain);
                    volLfo.start();
                    this.activeSources.push(volLfo);
                }
            }

            source.connect(lastNodeBeforeGain);
            lastNodeBeforeGain.connect(roleGain);

            // Connect to that specific track's mixer gain node
            roleGain.connect(targetGain);

            source.start();
            this.activeSources.push(source, pannerLfo);
        };

        // --- Build Track 1 Layers ---
        if (buffer1) {
            buildLayer(buffer1, this.track1Gain, var1Params, 'primary');
            buildLayer(buffer1, this.track1Gain, var1Params, 'secondary');
        }

        // --- Build Track 2 Layers ---
        if (buffer2) {
            buildLayer(buffer2, this.track2Gain, var2Params, 'primary');
            buildLayer(buffer2, this.track2Gain, var2Params, 'secondary');
        }

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

    private getVariationParams(mode: number) {
        // Shared random base seeds
        const roots = [55.00, 61.74, 65.41, 73.42, 82.41, 92.50, 98.00];
        const baseFreq = roots[Math.floor(Math.random() * roots.length)];
        const chordPool = [[1.5, 2.0], [1.25, 1.5], [1.2, 1.5], [1.333, 2.0], [1.122, 1.5]];
        const intervals = chordPool[Math.floor(Math.random() * chordPool.length)];

        let rates, filterCutoff, delayTime, panLfoSpeed1, panLfoSpeed2, volLfoSpeed;
        let isPercussive = false;
        let isHighpass = false;

        switch (mode) {
            case 2: // Percussive & Rhythmic
                rates = [0.8, 0.6];
                filterCutoff = 2500;
                delayTime = 0.5 + (Math.random() * 0.5); // shorter delays
                panLfoSpeed1 = 0.5;
                panLfoSpeed2 = 0.8;
                volLfoSpeed = 0.3; // fast modulation chop
                isPercussive = true;
                break;
            case 3: // Natural / Raw
                rates = [1.0, 0.95]; // close to original
                filterCutoff = 4000 + (Math.random() * 2000); // open filter
                delayTime = 0.2 + (Math.random() * 0.3); // slapback or light reflection
                panLfoSpeed1 = 0.01; // barely panning
                panLfoSpeed2 = 0.02;
                volLfoSpeed = 0.01;
                break;
            case 4: // High & Sparkle
                rates = [1.5, 2.0]; // pitched up
                filterCutoff = 800; // Not used as LP directly if we implement highpass
                delayTime = 1.0 + (Math.random() * 1.0);
                panLfoSpeed1 = 0.2;
                panLfoSpeed2 = 0.3;
                volLfoSpeed = 0.1;
                isHighpass = true;
                break;
            case 1: // Ambient (Default)
            default:
                rates = [0.5, 0.25]; // deep stretch
                filterCutoff = 1000 + (Math.random() * 1000); // muffled
                delayTime = 1.5 + (Math.random() * 1.0); // long delays
                panLfoSpeed1 = 0.05 + (Math.random() * 0.1);
                panLfoSpeed2 = 0.03 + (Math.random() * 0.07);
                volLfoSpeed = 0.02 + (Math.random() * 0.06);
                break;
        }

        return {
            baseFreq,
            intervals,
            rates,
            filterCutoff,
            delayTime,
            panLfoSpeed1,
            panLfoSpeed2,
            volLfoSpeed,
            isPercussive,
            isHighpass
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
