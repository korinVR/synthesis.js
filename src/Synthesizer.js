import Debug from "./framesynthesis/Debug";
import Voice from "./Voice";

const MAX_VOICE = 32;

export default class Synthesizer {
	constructor(options) {
		this.options = options;
		
		this.voices = [];
		for (let i = 0; i < MAX_VOICE; i++) {
			this.voices[i] = new Voice(this);
		}
		
		this.keyState = [];
		
		this.damperPedal = false;
	
		this.pitchBend = 0;
		this.modulationWheel = 0;
	}
	
	noteOn(note) {
		this.keyState[note] = true;

		// stop same notes
		for (let i = 0; i < MAX_VOICE; i++) {
			if (this.voices[i].isPlaying() && this.voices[i].note === note) {
				this.voices[i].stop();
			}
		}

		// play note
		for (let i = 0; i < MAX_VOICE; i++) {
			if (!this.voices[i].isPlaying()) {
				this.voices[i].play(note);
				break;
			}
		}
	}
	
	noteOff(note) {
		this.keyState[note] = false;
		
		if (this.damperPedal) {
			return;
		}

		// stop notes		
		for (let i = 0; i < MAX_VOICE; i++) {
			if (this.voices[i].isPlaying() && this.voices[i].note === note) {
				this.voices[i].stop();
			}
		}
	}
	
	damperPedalOn() {
		this.damperPedal = true;
	}
	
	damperPedalOff() {
		this.damperPedal = false;
		
		for (let i = 0; i < MAX_VOICE; i++) {
			if (this.keyState[this.voices[i].note] === false) {
				this.voices[i].stop();
			}
		}
	}
	
	setPitchBend(bend) {
		this.pitchBend = bend * 2 / 8192;
	}
	
	setModulationWheel(wheel) {
		this.modulationWheel = wheel / 127;
	}
	
	render(buffer, sampleRate) {
		for (let i = 0; i < buffer.length; i++) {
			buffer[i] = 0;
		}
		
		for (let i = 0; i < MAX_VOICE; i++) {
			this.voices[i].render(buffer, sampleRate);
		}
	}
	
	processMIDIMessage(data) {
		if (!data) {
			return;
		}
		
		if (data.length < 3) {
			return;
		}
		
		let statusByte = data[0];

		if (statusByte === 0x90) {
			let note = data[1];
			let velocity = data[2];

			this.log(`Ch. 1 Note On  note: ${note} velocity: ${velocity}`);
			this.noteOn(note);
		}
		if (statusByte === 0x80) {
			let note = data[1];
			let velocity = data[2];

			this.log(`Ch. 1 Note Off note: ${note} velocity: ${velocity}`);
			this.noteOff(note);
		}
		
		if (statusByte === 0xe0) {
			let lsb = data[1];
			let msb = data[2];
			let bend = ((msb << 7) | lsb) - 8192;

			this.log(`Ch. 1 Pitch bend: ${bend}`);
			this.setPitchBend(bend);
		}
		if (statusByte === 0xb0) {
			let controlNumber = data[1];
			let value = data[2];

			if (controlNumber === 1) {
				this.log(`Ch. 1 Modulation wheel: ${value}`);
				this.setModulationWheel(value);
			}
			if (controlNumber === 64) {
				if (value >= 64) {
					this.log(`Ch. 1 Damper Pedal On`);
					this.damperPedalOn();
				} else {
					this.log(`Ch. 1 Damper Pedal Off`);
					this.damperPedalOff();
				}
			}
		}
	}
	
	log(message) {
		if (this.options && this.options.verbose) {
			Debug.log(message);
		}
	}
}

