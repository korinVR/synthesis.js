export default class AudioManager {
	constructor(synthesizer, bufferSize = 1024) {
		this.synthesizer = synthesizer;
		this.bufferSize = bufferSize;

		try {
			this.context = new AudioContext();
		} catch (e) {
			alert("Web Audio API is not supported");
		}

		let buffer = new Float32Array(this.bufferSize);
		
		this.node = this.context.createScriptProcessor(this.bufferSize, 0, 2);
		this.node.onaudioprocess = e => {
			let outL = e.outputBuffer.getChannelData(0);
			let outR = e.outputBuffer.getChannelData(1);
			
			this.synthesizer.render(buffer, this.context.sampleRate);
			
			for (let i = 0; i < this.bufferSize; i++) {
				outL[i] = buffer[i];
				outR[i] = buffer[i];
			}
		}
		this.node.connect(this.context.destination);
	}
}

