import Debug from "./framesynthesis/Debug";
import Synthesizer from "./Synthesizer";
import AudioManager from "./AudioManager";
import VirtualKeyboard from "./VirtualKeyboard";

Debug.log("Initializing Synthesizer");
let synthesizer = new Synthesizer();
Debug.log("Initializing Web Audio");
let audioManager = new AudioManager(synthesizer);

let virtualKeyboard = new VirtualKeyboard(synthesizer);

Debug.log("Initializing Web MIDI");
if (navigator.requestMIDIAccess) {
	navigator.requestMIDIAccess(/*{ sysex: true }*/).then(onMIDISuccess, onMIDIFailure);
} else {
	Debug.log("error: This browser does not support Web MIDI API.");
}

function onMIDISuccess(midiAccess) {
	for (let input of midiAccess.inputs.values()) {
		Debug.log(`  MIDI Input  id: ${input.id} manufacturer: ${input.manufacturer} name: ${input.name}`);

		input.onmidimessage = onMIDIMessage;
	}

	for (let output of midiAccess.outputs.values()) {
		Debug.log(`  MIDI Output id: ${output.id} manufacturer: ${output.manufacturer} name: ${output.name}`);
	}
	
	Debug.log("Ready");
}

function onMIDIFailure(message) {
	Debug.log("MIDI not ready : " + message);
}

function onMIDIMessage(event) {
	let s = "MIDI message timestamp " + event.timeStamp + " : ";
	for (let i = 0; i < event.data.length; i++) {
		s += "0x" + event.data[i].toString(16) + " ";
	}
	
	let statusByte = event.data[0];

	if (statusByte === 0x90) {
		let note = event.data[1];
		let velocity = event.data[2];
		
		Debug.log(`Ch. 1 Note On  note: ${note} velocity: ${velocity}`);
		synthesizer.noteOn(note);
	}
	if (statusByte === 0x80) {
		let note = event.data[1];
		let velocity = event.data[2];
		
		Debug.log(`Ch. 1 Note Off note: ${note} velocity: ${velocity}`);
		synthesizer.noteOff(note);
	}
	if (statusByte === 0xe0) {
		let lsb = event.data[1];
		let msb = event.data[2];
		let bend = ((msb << 7) | lsb) - 8192;
		
		Debug.log(`Ch. 1 Pitch bend: ${bend}`);
		synthesizer.pitchBend(bend);
	}
}
