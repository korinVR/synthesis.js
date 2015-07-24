export default class VirtualKeyboard {
	constructor(synthesizer) {
		this.synthesizer = synthesizer;

		this.keyState = [];
		for (let i = 0; i < 88; i++) {
			this.keyState[i] = false;
		}

		let lowerKeys = [67, 70, 86, 71, 66, 78, 74, 77, 75, 188, 76, 190, 191];
		let upperKeys = [69, 52, 82, 53, 84, 89, 55, 85, 56, 73, 57, 79, 80];

		this.key2note = {};

		for (let i = 0; i < lowerKeys.length; i++) {
			this.key2note[lowerKeys[i]] = 60 + i;
		}
		for (let i = 0; i < upperKeys.length; i++) {
			this.key2note[upperKeys[i]] = 72 + i;
		}
		
		document.body.addEventListener("keydown", event => this.onKeyDown(event));
		document.body.addEventListener("keyup", evemt => this.onKeyUp(event));
		
		// this.keys = [];
	}
	
	onKeyDown(event) {
		// this.keys.push(event.keyCode);
		// console.log(this.keys);
		
		if (event.keyCode === 32) {
			this.synthesizer.damperPedalOn();
		}
		
		let note = this.key2note[event.keyCode];
		if (this.keyState[note] === false) {
			this.keyState[note] = true;
			this.synthesizer.noteOn(note);
		}
	}
	
	onKeyUp(event) {
		if (event.keyCode === 32) {
			this.synthesizer.damperPedalOff();
		}
		
		let note = this.key2note[event.keyCode];
		if (this.keyState[note] === true) {
			this.keyState[note] = false;
			this.synthesizer.noteOff(note);
		}
	}
}

