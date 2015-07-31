import Voice from "./Voice";

const VOICE_MAX = 32;

export default class Channel {
	reset() {
		this.voices = [];
		for (let i = 0; i < VOICE_MAX; i++) {
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
		for (let i = 0; i < VOICE_MAX; i++) {
			if (this.voices[i].isPlaying() && this.voices[i].note === note) {
				this.voices[i].stop();
			}
		}

		// play note
		for (let i = 0; i < VOICE_MAX; i++) {
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
		for (let i = 0; i < VOICE_MAX; i++) {
			if (this.voices[i].isPlaying() && this.voices[i].note === note) {
				this.voices[i].stop();
			}
		}
	}

	allNotesOff() {
		for (let i = 0; i < VOICE_MAX; i++) {
			if (this.voices[i].isPlaying()) {
				this.voices[i].stop();
			}
		}
	}

	damperPedalOn() {
		this.damperPedal = true;
	}

	damperPedalOff() {
		this.damperPedal = false;

		for (let i = 0; i < VOICE_MAX; i++) {
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
		for (let i = 0; i < VOICE_MAX; i++) {
			this.voices[i].render(buffer, sampleRate);
		}
	}
}
