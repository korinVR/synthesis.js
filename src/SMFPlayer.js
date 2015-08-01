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
		let pos = 8;
		
		function read2bytes() {
			return smf[pos++] << 8 | smf[pos++];
		}
		
		function read4bytes() {
			return smf[pos++] << 24 | smf[pos++] << 16 | smf[pos++] << 8 | smf[pos++];
		}
		
		let format = read2bytes();
		this.trackNumber = read2bytes();
		this.resolution = read2bytes();
		
		if (format === 0 && this.trackNumber !== 1) {
			throw new Error("illegal track number");
		}
		
		this.trackPos = [];
		this.trackEndPos = [];
		this.nextEventTick = [];
		
		// read track headers
		for (let i = 0; i < this.trackNumber; i++) {
			pos += 4;
			
			let trackDataLength = read4bytes();
			this.trackPos[i] = pos;
			this.trackEndPos[i] = pos + trackDataLength;
			this.nextEventTick[i] = this.readDeltaTick(i);
			
			pos += trackDataLength;
		}
		
		// set up timer
		this.prevTime = Date.now();
		this.currentTick = 0;
		
		if (!this.intervalId) {
			this.intervalId = setInterval(() => this.onInterval(), INTERVAL);
		}
	}
	
	stop() {
		clearInterval(this.intervalId);
		this.intervalId = null;
	}
	
	onInterval() {
		// calclate delta time
		let currentTime = Date.now();
		let deltaTime = currentTime - this.prevTime;
		this.prevTime = currentTime; 
		
		function time2tick(time) {
			let quarterTime = 60 * 1000 / this.tempo;
			let tickTime = quarterTime / this.resolution;
			
			return time / tickTime;
		}
		
		this.currentTick += time2tick(deltaTime);
		
		for (let i = 0; i < this.trackNumber; i++) {
			while (this.nextEventTick[i] < this.currentTick) {
				// send MIDI message
				let statusByte = this.smf[this.trackPos[i]++];
				let dataByte1 = this.smf[this.trackPos[i]++];
				let dataByte2 = this.smf[this.trackPos[i]++];

				this.synthesizer.processMIDIMessage([statusByte, dataByte1, dataByte2]);

				if (this.trackPos[i] >= this.trackEndPos) {
					// end of track data
					this.stop();
					break;
				}
				
				// calculate next event tick
				this.nextEventTick[i] += this.readDeltaTick(i);
			}
		}
	}
	
	readDeltaTick(track) {
		return this.smf[this.trackPos[track]++];
	}
}
