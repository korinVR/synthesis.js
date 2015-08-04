# synthesis.js

Work-in-progress MIDI / MML sound system which contains:

- MIDI Synthesizer
- SMF Player
- MML to SMF converter

The features are very limited for now. Working demo is at http://framesynthesis.com/experiments/synthesis.js/

# Build

$ npm install  
$ npm run watch

# MIDI Implementation Chart

## MIDI Input (Ch. 1-16)

- Note On/Off
- Pitch Bend
- CC 1 (Modulation wheel)
- CC 64 (Damper pedal On/Off)
- CC 123 (All notes off)

# License

MIT

# Author

Katsuomi Kobayashi ([@KatsuomiK](https://twitter.com/KatsuomiK) / [@k0rin](https://twitter.com/k0rin))

http://framesynthesis.com/

