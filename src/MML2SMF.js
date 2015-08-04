export default class MML2SMF {
	convert(mml) {
		let trackMMLs = mml.split(";");
		
		let trackNum = trackMMLs.length;
		let resolution = 48;
		let smfFormat = (trackNum == 1) ? 0 : 1;
		
		let smf = [
			0x4d, 0x54, 0x68, 0x64,
			0x00, 0x00, 0x00, 0x06,
			0x00, smfFormat, 
			(trackNum >> 8) & 0xff,
			trackNum & 0xff,
			(resolution >> 8) & 0xff,
			resolution & 0xff
		];
		
		for (let trackMML of trackMMLs) {
			let trackData = this.createTrackData(trackMML);

			const trackHeader = [
				0x4d, 0x54, 0x72, 0x6b,
				(trackData.length >> 24) & 0xff,
				(trackData.length >> 16) & 0xff,
				(trackData.length >> 8) & 0xff,
				trackData.length & 0xff
			];

			smf = smf.concat(trackHeader, trackData);
		}
		
		return new Uint8Array(smf);
	}
	
	createTrackData(mml) {
		const abcdefg = [9, 11, 0, 2, 4, 5, 7];
		
		let trackData = [];
		let tick = 24;
		
		let restTick = 0;
		
		const OCTAVE_MIN = -1;
		const OCTAVE_MAX = 10;
		let octave = 4;
		
		let p = 0;
		
		function readChar() {
			return mml.charAt(p++);
		}
		
		function isNextChar(candidates) {
			let c = mml.charAt(p);
			if (candidates.indexOf(c) >= 0) {
				return true;
			}
			return false;
		}
		
		function readValue() {
			let value = parseInt(mml.substr(p, 10));
			p += String(value).length;
			return value;
		}
		
		function isNextValue() {
			return isNextChar("0123456789.-");
		}
		
		function error(message) {
			throw new Error(`char ${p} : ${message}`);
		}
		
		function writeDeltaTick(tick) {
			if (tick < 0 || tick > 0xfffffff) {
				error("illegal length");
			}
			
			let stack = [];
			
			do {
				stack.push(tick & 0x7f);
				tick >>>= 7;
			} while (tick > 0);
			
			while (stack.length > 0) {
				let b = stack.pop();
				
				if (stack.length > 0) {
					b |= 0x80;
				}
				trackData.push(b);
			}
		}
		
		while (p < mml.length) {
			if (!isNextChar("cdefgabro<>t ")) {
				error(`syntax error '${readChar()}'`);
			}
			let command = readChar();
			
			switch (command) {
				case "c":
				case "d":
				case "e":
				case "f":
				case "g":
				case "a":
				case "b":
					let n = "abcdefg".indexOf(command);
					if (n < 0 || n >= abcdefg.length) {
						break;
					}
					let note = (octave + 1) * 12 + abcdefg[n];
					
					if (isNextChar("+-")) {
						let c = readChar();
						if (c === "+") {
							note++;
						}
						if (c === "-") {
							note--;
						}
					}

					let velocity = 96;
					
					writeDeltaTick(restTick);
					trackData.push(0x90, note, velocity);
					writeDeltaTick(tick);
					trackData.push(0x80, note, 0);
					restTick = 0;
					break;

				case "r":
					restTick += tick;
					break;

				case "o":
					if (!isNextValue()) {
						error("no octave number");
					} else {
						let n = readValue();
						if (OCTAVE_MIN <= n || n <= OCTAVE_MAX) {
							octave = n;
							break;
						}
					}
					break;

				case "<":
					if (octave < OCTAVE_MAX) {
						octave++;
					}
					break;

				case ">":
					if (octave > OCTAVE_MIN) {
						octave--;
					}
					break;

				case "t":
					if (!isNextValue()) {
						error("no tempo number");
					}
					{
						let tempo = readValue();
						let quarterMicroseconds = 60 * 1000 * 1000 / tempo;
						
						if (quarterMicroseconds < 1 || quarterMicroseconds > 0xffffff) {
							error("illegal tempo");
						}

						writeDeltaTick(restTick);
						trackData.push(0xff, 0x51, 0x03,
							(quarterMicroseconds >> 16) & 0xff,
							(quarterMicroseconds >> 8) & 0xff,
							(quarterMicroseconds) & 0xff);
					}
					break;
			}
		}
		
		return trackData;
	}
}
