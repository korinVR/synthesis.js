const INTERVAL = 1 / 60;

export default class SMFPlayer {
	constructor(synthesizer) {
		this.synthesizer = synthesizer;
		
		this.tempo = 120;
		this.resolution = 48;
	}
	
	play(smf) {
		this.smf = smf;
		
		// read SMF header
		this.pos = 8;
		
		let format = this.read2bytes();
		let trackNumber = this.read2bytes();
		let resolution = this.read2bytes();
		
		if (format === 0 && trackNumber !== 1) {
			throw new Error("illegal track number");
		}
		
		this.trackDataLength = this.read4bytes();
		this.trackEndPos = this.trackStartPos + this.trackDataLength;
		
		this.startTime = Date.now();
		this.nextEventTime = this.tick2ms(this.readByte());
		
		if (!this.intervalId) {
			this.intervalId = setInterval(() => this.onInterval(), INTERVAL);
		}
	}
	
	stop() {
		clearInterval(this.intervalId);
		this.intervalId = null;
	}
	
	onInterval() {
		let currentTime = Date.now() - this.startTime;
		
		while (this.nextEventTime < currentTime) {
			// send MIDI message
			let statusByte = this.readByte();
			let dataByte1 = this.readByte();
			let dataByte2 = this.readByte();
			
			this.synthesizer.processMIDIMessage([statusByte, dataByte1, dataByte2]);
			
			if (this.trackPos >= this.trackEndPos) {
				// end of track data
				this.stop();
				break;
			}
			
			// calculate next event time
			let deltaTick = this.readByte();
			this.nextEventTime += this.tick2ms(deltaTick);
		}
	}
	
	readByte() {
		return this.smf[this.pos++];
	}
	
	read2bytes() {
		let length =
			this.smf[this.pos++] << 8 |
			this.smf[this.pos++]
		
		return length;
	}
	
	read4bytes() {
		let length =
			this.smf[this.pos++] << 24 |
			this.smf[this.pos++] << 16 |
			this.smf[this.pos++] << 8 |
			this.smf[this.pos++];
		
		return length;
	}
	
	tick2ms(tick) {
		return 60 * 1000 / this.tempo * tick / this.resolution;
	}
}
