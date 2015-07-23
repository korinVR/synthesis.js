import Debug from "./framesynthesis/Debug";
import Voice from "./Voice";

const MAX_VOICE = 8;

export default class Synthesizer {
	constructor() {
		this.voices = [];
	
		for (let i = 0; i < MAX_VOICE; i++) {
			this.voices[i] = new Voice(this);
		}
		
		this.pitchBend = 0;
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
		if (data.length < 2) {
			return;
		}
		
		let statusByte = data[0];

		if (statusByte === 0x90) {
			let note = data[1];
			let velocity = data[2];

			Debug.log(`Ch. 1 Note On  note: ${note} velocity: ${velocity}`);
			this.noteOn(note);
		}
		if (statusByte === 0x80) {
			let note = data[1];
			let velocity = data[2];

			Debug.log(`Ch. 1 Note Off note: ${note} velocity: ${velocity}`);
			this.noteOff(note);
		}
		
		if (data.length < 3) {
			return;
		}
		
		if (statusByte === 0xe0) {
			let lsb = data[1];
			let msb = data[2];
			let bend = ((msb << 7) | lsb) - 8192;

			Debug.log(`Ch. 1 Pitch bend: ${bend}`);
			this.setPitchBend(bend);
		}
		if (statusByte === 0xb0) {
			let controlNumber = data[1];
			let value = data[2];

			if (controlNumber === 1) {
				Debug.log(`Ch. 1 Modulation wheel: ${value}`);
				this.setModulationWheel(value);
			}
		}
	}
}

