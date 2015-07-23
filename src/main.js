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
	Debug.log("error: Can't initialize Web MIDI: " + message);
}

function onMIDIMessage(event) {
	// let s = "MIDI message timestamp " + event.timeStamp + " : ";
	// for (let i = 0; i < event.data.length; i++) {
	// 	s += "0x" + event.data[i].toString(16) + " ";
	// }
	
	synthesizer.processMIDIMessage(event.data);
}
