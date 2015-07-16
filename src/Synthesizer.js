import Voice from "./Voice";

const MAX_VOICE = 8;

export default class Synthesizer {
	constructor() {
		this.voices = [];
	
		for (let i = 0; i < MAX_VOICE; i++) {
			this.voices[i] = new Voice();
		}
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
	
	render(buffer, sampleRate) {
		for (let i = 0; i < buffer.length; i++) {
			buffer[i] = 0;
		}
		
		for (let i = 0; i < MAX_VOICE; i++) {
			this.voices[i].render(buffer, sampleRate);
		}
	}
}

