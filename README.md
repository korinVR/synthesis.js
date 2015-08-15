# synthesis.js

MIDI / MML synthesizer for Chrome, Edge and iOS Safari

**This library is in a very early stage.** Currently it has square wave only.   
Working demo is [available here](http://framesynthesis.com/experiments/synthesis.js/examples/showcase/). You can play it with MIDI keyboard or [mml2smf](https://github.com/KatsuomiK/mml2smf) MMLs.

# Usage

```js
<script src="synthesis.min.js"></script>
```

## Process MIDI Message

```js
var synthesizer = new synthesisjs.Synthesizer();

setTimeout(function() {
	// Note On
	synthesizer.processMIDIMessage([0x90, 60, 100]);
}, 1000);

setTimeout(function() {
	// Note off
	synthesizer.processMIDIMessage([0x80, 60, 100]);
}, 2000);
```

## Play MML

```js
var mml2smf = new synthesisjs.MML2SMF();
var smf = mml2smf.convert("t150l8 g4gagrfrerfrg2");

var synthesizer = new synthesisjs.Synthesizer();
var smfPlayer = new synthesisjs.SMFPlayer(synthesizer);
smfPlayer.play(smf);
```

# Build

$ npm install  
$ npm run watch

# MIDI Implementation Chart

## MIDI Input (Ch. 1-16)

- Note On/Off
- Pitch Bend
- CC 1 (Modulation Wheel)
- CC 7 (Channel Volume)
- CC 10 (Pan)
- CC 11 (Expression Controller)
- CC 64 (Damper Pedal On/Off)
- CC 123 (All Notes Off)

# License

MIT

# Author

Katsuomi Kobayashi ([@KatsuomiK](https://twitter.com/KatsuomiK) / [@k0rin](https://twitter.com/k0rin))

http://framesynthesis.com/

