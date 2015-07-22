import SquareOscillator from "./oscillators/SquareOscillator";
import TriangleOscillator from "./oscillators/TriangleOscillator";

const STATE_OFF = 0;
const STATE_ATTACK = 1; // not used
const STATE_DECAY = 2; // not used
const STATE_SUSTAIN = 3;
const STATE_RELEASE = 4;

export default class Voice {
	constructor() {
		this.state = STATE_OFF; 
	}
	
	play(note) {
		this.state = STATE_SUSTAIN;
		this.note = note;
		this.frequency = 440 * Math.pow(2, (note - 69) / 12);
		this.volume = 1;
		this.phase = 0;
		
		this.oscillator = new SquareOscillator();
		// this.oscillator = new TriangleOscillator();
		
		this.vibratoOscillator = new TriangleOscillator();
		this.vibratoPhase = 0;
		this.vibratoFrequency = 8;
		this.vibratoAmplitude = 0.5;
	}
	
	stop() {
		this.state = STATE_RELEASE;
	}
	
	render(buffer, sampleRate, pitchBendOffset, modulationWheel) {
		if (this.state !== STATE_OFF) {
			for (let i = 0; i < buffer.length; i++) {
				let amplitude = modulationWheel / 127 * this.vibratoAmplitude;
				
				let vibratoPeriod = sampleRate / this.vibratoFrequency;
				this.vibratoPhase += 1 / vibratoPeriod;
				let vibratoOffset = this.vibratoOscillator.getSample(this.vibratoPhase) * amplitude;
				
				let frequency = this.note2frequency(this.note + pitchBendOffset + vibratoOffset);
				let period = sampleRate / frequency;
			
				buffer[i] += this.oscillator.getSample(this.phase) * this.volume * 0.1;
				this.phase += 1 / period;
				
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
