import Debug from "../../../src/framesynthesis/Debug";
import VirtualKeyboard from "./VirtualKeyboard";

let synthesizer = new synthesisjs.Synthesizer({ verbose: true });

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

let smfPlayer = new synthesisjs.SMFPlayer(synthesizer);

function playSMF() {
	Debug.log("Play test SMF");
	
	let tick = 24;

	let smf = new Uint8Array([
		0x4d, 0x54, 0x68, 0x64,
		0x00, 0x00, 0x00, 0x06,
		0x00, 0x00,
		0x00, 0x01,
		0x00, 0x30,
		0x4d, 0x54, 0x72, 0x6b,
		0x00, 0x00, 0x00, 46,
		
		0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
	
		0, 0x9f, 60, 96, tick, 0x8f, 60, 0,
		0, 0x9f, 62, 96, tick, 0x8f, 62, 0,
		0, 0x9f, 64, 96, tick, 0x8f, 64, 0,
		0, 0x9f, 65, 96, tick, 0x8f, 65, 0,
		0, 0x9f, 67, 96, tick, 0x8f, 67, 0]);
	
	smfPlayer.play(smf);
}

function stopSMF() {
	Debug.log("Stop SMF");
	
	smfPlayer.stop();
	
	for (let i = 0; i < 16; i++) {
		synthesizer.processMIDIMessage([0xb0 + i, 123, 0]);
	}
}

// export
window.playSMF = playSMF; 
window.stopSMF = stopSMF;

function playMML() {
	let mml2smf = new synthesisjs.MML2SMF();
	let mml = document.getElementById("mml").value;
	Debug.log("Convert MML: " + mml);
	try {
		let smf = mml2smf.convert(mml);
		let startTick = mml2smf.getStartTick();
		Debug.log("Play SMF");
		smfPlayer.play(smf, startTick);
	} catch (e) {
		Debug.log(e.message);
	}
}

function tweetMML() {
	let mml = document.getElementById("mml").value;
	let mmlURL = "http://framesynthesis.com/experiments/synthesis.js/?mml=" + encodeURIComponent(mml);
	
	let url = "https://twitter.com/intent/tweet?hashtags=synthesisjs&text=" + encodeURIComponent(mmlURL);
	window.open(url, "_blank");
}

window.playMML = playMML;
window.tweetMML = tweetMML;

function synthesizerReset() {
	synthesizer.reset();
}

window.synthesizerReset = synthesizerReset;

// set MML from query string
if (location.search.startsWith("?mml=")) {
	let mml = decodeURIComponent(location.search.substring(5));
	document.getElementById("mml").value = mml;
}
