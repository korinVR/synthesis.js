import SquareOscillator from "./oscillators/SquareOscillator";
import TriangleOscillator from "./oscillators/TriangleOscillator";

const STATE_OFF = 0;
const STATE_ATTACK = 1; // not used
const STATE_DECAY = 2; // not used
const STATE_SUSTAIN = 3;
const STATE_RELEASE = 4;

export default class Voice {
    constructor(synthesizer) {
        this.synthesizer = synthesizer;
        this.state = STATE_OFF; 
    }
    
    play(note, velocity) {
        this.state = STATE_SUSTAIN;
        this.note = note;
        this.frequency = 440 * Math.pow(2, (note - 69) / 12);
        this.volume = velocity / 127;
        this.phase = 0;
        
        this.oscillator = new SquareOscillator();
        // this.oscillator = new TriangleOscillator();
        
        this.vibratoOscillator = new TriangleOscillator();
        this.vibratoPhase = 0;
        this.vibratoFrequency = 8;
        this.vibratoAmplitude = 0.5;
        
        this.oversampling = 4;
    }
    
    stop() {
        this.state = STATE_RELEASE;
    }
    
    render(buffer, length, sampleRate) {
        if (this.state !== STATE_OFF) {
            for (let i = 0; i < length; i++) {
                let amplitude = this.synthesizer.modulationWheel * this.vibratoAmplitude;
                
                let vibratoPeriod = sampleRate / this.vibratoFrequency;
                this.vibratoPhase += 1 / vibratoPeriod;
                let vibratoOffset = this.vibratoOscillator.getSample(this.vibratoPhase) * amplitude;
                
                let frequency = this.note2frequency(this.note + this.synthesizer.pitchBend + vibratoOffset);
                let period = sampleRate / frequency;
            
                let sample = 0;
                for (let i = 0; i < this.oversampling; i++) {
                    sample += this.oscillator.getSample(this.phase);
                    this.phase += 1 / period / this.oversampling;
                }
                buffer[i] += sample / this.oversampling * this.volume * 0.1;
                
                if (this.state === STATE_RELEASE) {
                    this.volume -= 0.005;
                } else {
                    this.volume *= 0.99999;
                }
                
                if (this.volume < 0) {
                    this.state = STATE_OFF;
                    return;
                }
            }
        }
    }
    
    isPlaying() {
        if (this.state !== STATE_OFF) {
            return true;
        }
        return false;
    }
    
    note2frequency(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }
}
