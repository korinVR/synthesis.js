export default class MML2SMF {
	convert(mml) {
		const abcdefg = [9, 11, 0, 2, 4, 5, 7];
		
		let trackData = [];
		let tick = 24;
		
		let restTick = 0;
		
		for (let i = 0; i < mml.length; i++) {
			let command = mml.charAt(i);
			
			switch (command) {
				case "c":
				case "d":
				case "e":
				case "f":
				case "g":
				case "a":
				case "b":
					let n = mml.charCodeAt(i) - "a".charCodeAt(0);
					if (n >= 0 && n < abcdefg.length) {
						let note = 60 + abcdefg[n];
						let velocity = 96;

						trackData.push(restTick, 0x90, note, velocity, tick, 0x80, note, 0);
						restTick = 0;
					}
					break;
					
				case "r":
					restTick += tick;
					break;
			}
		}
		
		return new Uint8Array(trackData);
	}
}
