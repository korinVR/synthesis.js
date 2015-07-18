const PHASE_OFF = 0;
const PHASE_ATTACK = 1; // not used
const PHASE_DECAY = 2; // not used
const PHASE_SUSTAIN = 3;
const PHASE_RELEASE = 4;

export default class Voice {
	constructor() {
		this.phase = PHASE_OFF;
	}
	
	play(note) {
		this.phase = PHASE_SUSTAIN;
		this.note = note;
		this.volume = 1;
		this.frequency = 440 * Math.pow(2, (note - 69) / 12);
		this.pos = 0;
	}
	
	stop() {
		this.phase = PHASE_RELEASE;
	}
	
	render(buffer, sampleRate) {
		if (this.phase !== PHASE_OFF) {
			let n = this.frequency * 2 * Math.PI / sampleRate;
	
			for (let i = 0; i < buffer.length; i++) {
				buffer[i] += Math.sin(n * this.pos) * this.volume * 0.1;
				this.pos++;
				
				if (this.phase === PHASE_RELEASE) {
					this.volume -= 0.005;
				} else {
					this.volume *= 0.99999;
				}
				
				if (this.volume < 0) {
					this.phase = PHASE_OFF;
					return;
				}
			}
		}
	}
	
	isPlaying() {
		if (this.phase !== PHASE_OFF) {
			return true;
		}
		return false;
	}
}

