const INTERVAL = 1 / 60;

export default class SMFPlayer {
	constructor(synthesizer) {
		this.synthesizer = synthesizer;
		
		this.tempo = 120;
		this.resolution = 48;
	}
	
	play(smf) {
		this.trackData = smf;
		
		this.pos = 0;
		
		this.startTime = Date.now();
		this.nextEventTime = this.tick2ms(this.readByte());
		
		if (!this.intervalId) {
			this.intervalId = setInterval(() => this.onInterval(), INTERVAL);
		}
	}
	
	onInterval() {
		let currentTime = Date.now();
		let elapsedTime = currentTime - this.startTime;
		
		while (elapsedTime > this.nextEventTime) {
			// send MIDI message
			let statusByte = this.readByte();
			let dataByte1 = this.readByte();
			let dataByte2 = this.readByte();
			
			this.synthesizer.processMIDIMessage([statusByte, dataByte1, dataByte2]);
			
			if (this.pos >= this.trackData.length) {
				// end of track data
				clearInterval(this.intervalId);
				this.intervalId = null;
				break;
			}
			
			// calculate next event time
			let deltaTick = this.readByte();
			this.nextEventTime += this.tick2ms(deltaTick);
		}
	}
	
	readByte() {
		return this.trackData[this.pos++];
	}
	
	tick2ms(tick) {
		return 60 * 1000 / this.tempo * tick / this.resolution;
	}
}
