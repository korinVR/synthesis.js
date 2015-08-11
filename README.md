# synthesis.js

Work-in-progress MIDI / MML sound system which contains:

- MIDI Synthesizer
- SMF Player
- MML to SMF converter

**This library is in development and is not ready for use yet.**  
Working demo is at http://framesynthesis.com/experiments/synthesis.js/

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

