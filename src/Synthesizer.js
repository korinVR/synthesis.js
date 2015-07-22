import Voice from "./Voice";

const MAX_VOICE = 8;

export default class Synthesizer {
	constructor() {
		this.voices = [];
	
		for (let i = 0; i < MAX_VOICE; i++) {
			this.voices[i] = new Voice();
		}
		
		this.pitchBendOffset = 0;
		this.modulationWheel = 0;
	}
	
	noteOn(note) {
		for (let i = 0; i < MAX_VOICE; i++) {
			if (!this.voices[i].isPlaying()) {
				this.voices[i].play(note);
				break;
			}
		}
	}
	
	noteOff(note) {
		for (let i = 0; i < MAX_VOICE; i++) {
			if (this.voices[i].note === note) {
				this.voices[i].stop();
			}
		}
	}
	
	setPitchBend(bend) {
		this.pitchBendOffset = bend * 2 / 8192;
	}
	
	setModulationWheel(wheel) {
		this.modulationWheel = wheel;
	}
	
	render(buffer, sampleRate) {
		for (let i = 0; i < buffer.length; i++) {
			buffer[i] = 0;
		}
		
		for (let i = 0; i < MAX_VOICE; i++) {
			this.voices[i].render(buffer, sampleRate, this.pitchBendOffset, this.modulationWheel);
		}
	}
}

