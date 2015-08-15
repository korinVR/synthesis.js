const TEMPO_DEFAULT = 120;
const INTERVAL = 1 / 100;

class Track {
	constructor(player, pos, length) {
		this.player = player;
		
		this.pos = pos;
		this.endPos = pos + length;
		this.finished = false;
		
		this.nextEventTick = this.readDeltaTick();
	}
	
	update(currentTick, seeking) {
		if (this.finished) {
			return;
		}
		
		while (this.nextEventTick < currentTick) {
			// send MIDI message
			let statusByte = this.readByte();
			let statusUpper4bits = statusByte >> 4;
			
			// meta event
			if (statusByte === 0xff) {
				let metaEventType = this.readByte();
				let length = this.readByte();

				if (metaEventType === 0x51) {
					if (length === 3) {
						let quarterMicroseconds = this.readByte() << 16 | this.readByte() << 8 | this.readByte();
						this.player.quarterTime = quarterMicroseconds / 1000;
					}
				} else {
					this.pos += length;
				}
			}
			
			// system exclusive message
			if (statusByte === 0xf0) {
				let systemExclusive = [statusByte];
				
				while (true) {
					if (this.pos >= this.endPos) {
						throw Error("illegal system exlusive message");
					}
					
					let byte = this.readByte();
					if (byte === 0xf7) {
						break;
					}
					systemExclusive.push(byte);
				}
				this.player.synthesizer.processMIDIMessage(systemExclusive);
			}
			
			switch (statusUpper4bits) {
				// 3 bytes message
				case 0x8:
				case 0x9:
				case 0xa:
				case 0xb:
				case 0xe:
					{
						let dataByte1 = this.readByte();
						let dataByte2 = this.readByte();

						if (seeking && (statusUpper4bits === 0x8 || statusUpper4bits === 0x9)) {
							// skip note on/off when seeking
						} else {
							this.player.synthesizer.processMIDIMessage([statusByte, dataByte1, dataByte2]);
						}
						break;
					}
				// 2 bytes message
				case 0xc:
				case 0xd:
					{
						let dataByte1 = this.readByte();
						this.player.synthesizer.processMIDIMessage([statusByte, dataByte1]);
						break;
					}
			}

			if (this.pos >= this.endPos) {
				// end of track data
				this.finished = true;
				break;
			}
			
			// calculate next event tick
			this.nextEventTick += this.readDeltaTick();
		}
	}
	
	readByte() {
		return this.player.smf[this.pos++];
	}
	
	readDeltaTick() {
		let tick = 0;
		let n;
		
		do {
			n = this.readByte();
			tick <<= 7;
			tick |= (n & 0x7f);
		} while (n & 0x80);
		
		if (tick > 0xfffffff) {
			throw new Error("illegal delta tick");
		}
		return tick;
	}
}

export default class SMFPlayer {
	constructor(synthesizer) {
		this.synthesizer = synthesizer;
	}
	
	play(smf, startTick = 0) {
		this.smf = smf;
		this.startTick = startTick;
		
		this.quarterTime = 60 * 1000 / TEMPO_DEFAULT; // ms
		
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
		this.timebase = read2bytes();
		
		// error check
		const SMF_HEADER = [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06];
		for (let i = 0; i < SMF_HEADER.length; i++) {
			if (this.smf[i] != SMF_HEADER[i]) {
				throw new Error("not a standard MIDI file");
			}
		}
		
		if (format !== 0 && format !== 1) {
			throw new Error("wrong SMF format");
		}
		
		if (format === 0 && this.trackNumber !== 1) {
			throw new Error("illegal track number");
		}
		
		this.tracks = [];
		
		// read track headers
		for (let i = 0; i < this.trackNumber; i++) {
			pos += 4;
			
			let length = read4bytes();
			this.tracks.push(new Track(this, pos, length));
			
			pos += length;
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
		
		let tickTime = this.quarterTime / this.timebase;
		
		let seeking = false;
		if (this.currentTick < this.startTick) {
			// seek to start tick slowly
			// this.currentTick += deltaTime * 100 / tickTime;
			// if (this.currentTick > this.startTick) {
			// 	this.currentTick = this.startTick;
			// }
			
			this.currentTick = this.startTick;
			seeking = true;
		} else {
			this.currentTick += deltaTime / tickTime;
		}
		
		for (let i = 0; i < this.tracks.length; i++) {
			this.tracks[i].update(this.currentTick, seeking);
		}
		
		// stop when all tracks finish
		let playingTrack = 0;
		for (let i = 0; i < this.tracks.length; i++) {
			if (this.tracks[i].finished === false) {
				playingTrack++;
			}
		}
		if (playingTrack === 0) {
			this.stop();
		}
	}
}
