import Debug from "./framesynthesis/Debug";
import Synthesizer from "./Synthesizer";
import AudioManager from "./AudioManager";
import VirtualKeyboard from "./VirtualKeyboard";

Debug.log("Initializing Synthesizer");
let synthesizer = new Synthesizer({ verbose: true });
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

import SMFPlayer from "./SMFPlayer";
import MML2SMF from "./MML2SMF";

let smfPlayer = new SMFPlayer(synthesizer);

function playSMF() {
	Debug.log("Play test SMF");
	
	let tick = 24;

	// track data only for now
	let smf = new Uint8Array([
		0, 0x90, 60, 96, tick, 0x80, 60, 0,
		0, 0x90, 62, 96, tick, 0x80, 62, 0,
		0, 0x90, 64, 96, tick, 0x80, 64, 0,
		0, 0x90, 65, 96, tick, 0x80, 65, 0,
		0, 0x90, 67, 96, tick, 0x80, 67, 0]);
	
	smfPlayer.play(smf);
}

// export
window.playSMF = playSMF; 

function playMML() {
	let mml2smf = new MML2SMF();
	let mml = document.getElementById("mml").value;
	Debug.log("Convert MML: " + mml);
	let smf = mml2smf.convert(mml);
	Debug.log("Play SMF");
	smfPlayer.play(smf);
}

window.playMML = playMML;
