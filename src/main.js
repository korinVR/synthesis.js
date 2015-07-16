import Debug from "./framesynthesis/Debug";
import Synthesizer from "./Synthesizer";
import AudioManager from "./AudioManager";
import VirtualKeyboard from "./VirtualKeyboard";

Debug.log("Simple Synthesizer");
Debug.log("Web MIDI API and Web Audio API experiment");
Debug.log("");

let synthesizer = new Synthesizer();
let audioManager = new AudioManager(synthesizer);

let virtualKeyboard = new VirtualKeyboard(synthesizer);

navigator.requestMIDIAccess(/*{ sysex: true }*/).then(onMIDISuccess, onMIDIFailure);

function onMIDISuccess(midiAccess) {
	Debug.log("MIDI ready");

	for (let input of midiAccess.inputs.values()) {
		Debug.log(`MIDI port type: ${input.type} id: ${input.id} manufacturer: ${input.manufacturer} name: ${input.name} version: ${input.version}`);

		input.onmidimessage = onMIDIMessage;
	}

	for (let output of midiAccess.outputs.values()) {
		Debug.log(`MIDI port type: ${output.type} id: ${output.id} manufacturer: ${output.manufacturer} name: ${output.name} version: ${output.version}`);
	}
}

function onMIDIFailure(message) {
	Debug.log("Failed to get MIDI access : " + message);
}

function onMIDIMessage(event) {
	let s = "MIDI message timestamp " + event.timeStamp + " : ";
	for (let i = 0; i < event.data.length; i++) {
		s += "0x" + event.data[i].toString(16) + " ";
	}
	console.log(s);

	if (event.data[0] === 0x90) {
		synthesizer.noteOn(event.data[1]);
	}
	if (event.data[0] === 0x80) {
		synthesizer.noteOff(event.data[1]);
	}
}



