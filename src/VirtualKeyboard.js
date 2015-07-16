export default class VirtualKeyboard {
	constructor(synthesizer) {
		this.synthesizer = synthesizer;

		this.keyState = [];
		for (let i = 0; i < 88; i++) {
			this.keyState[i] = false;
		}

		let keys = [67, 70, 86, 71, 66, 78, 74, 77, 75, 188, 76, 190, 191];

		this.key2note = {};

		let note = 72;
		for (let i = 0; i < keys.length; i++) {
			this.key2note[keys[i]] = note;
			note++;
		}
		
		document.body.addEventListener("keydown", event => this.onKeyDown(event));
		document.body.addEventListener("keyup", evemt => this.onKeyUp(event));
	}
	
	onKeyDown(event) {
		let note = this.key2note[event.keyCode];
		if (this.keyState[note] === false) {
			this.keyState[note] = true;
			this.synthesizer.noteOn(note);
		}
	}
	
	onKeyUp(event) {
		let note = this.key2note[event.keyCode];
		if (this.keyState[note] === true) {
			this.keyState[note] = false;
			this.synthesizer.noteOff(note);
		}
	}
}

