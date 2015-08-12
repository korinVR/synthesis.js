(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.synthesisjs = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MML2SMF = (function () {
	function MML2SMF() {
		_classCallCheck(this, MML2SMF);
	}

	_createClass(MML2SMF, [{
		key: "convert",
		value: function convert(mml) {
			var timebase = arguments.length <= 1 || arguments[1] === undefined ? 480 : arguments[1];

			this.startTick = 0;

			var trackMMLs = mml.split(";");

			var trackNum = trackMMLs.length;
			if (trackNum >= 16) {
				throw new Error("over 16 tracks");
			}

			this.timebase = timebase;
			var smfFormat = trackNum == 1 ? 0 : 1;

			var smf = [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, smfFormat, trackNum >> 8 & 0xff, trackNum & 0xff, this.timebase >> 8 & 0xff, this.timebase & 0xff];

			for (var i = 0; i < trackNum; i++) {
				var trackData = this.createTrackData(trackMMLs[i], i);

				var trackHeader = [0x4d, 0x54, 0x72, 0x6b, trackData.length >> 24 & 0xff, trackData.length >> 16 & 0xff, trackData.length >> 8 & 0xff, trackData.length & 0xff];

				smf = smf.concat(trackHeader, trackData);
			}

			return new Uint8Array(smf);
		}
	}, {
		key: "createTrackData",
		value: function createTrackData(mml, channel) {
			var abcdefg = [9, 11, 0, 2, 4, 5, 7];

			var trackData = [];
			var tick = this.timebase;
			var timebase = this.timebase;

			var currentTick = 0;

			var restTick = 0;

			var OCTAVE_MIN = -1;
			var OCTAVE_MAX = 10;
			var octave = 4;

			var velocity = 100;

			var q = 6;

			var p = 0;

			function isNextChar(candidates) {
				if (p >= mml.length) {
					return false;
				}
				var c = mml.charAt(p);
				return candidates.includes(c);
			}

			function readChar() {
				return mml.charAt(p++);
			}

			function isNextValue() {
				return isNextChar("0123456789.-");
			}

			function readValue() {
				var value = parseInt(mml.substr(p, 10));
				p += String(value).length;
				return value;
			}

			function isNextInt() {
				return isNextChar("0123456789-");
			}

			function readInt() {
				var s = "";
				while (isNextInt()) {
					s += readChar();
				}
				return parseInt(s);
			}

			function readNoteLength() {
				var totalStepTime = 0;

				do {
					var stepTime = undefined;

					// read note length
					if (isNextInt()) {
						var _length = readInt();
						stepTime = timebase * 4 / _length;
					} else {
						stepTime = tick;
					}

					// dotted note
					var dottedTime = stepTime;
					while (isNextChar(".")) {
						readChar();
						dottedTime /= 2;
						stepTime += dottedTime;
					}

					totalStepTime += stepTime;
				} while (isNextChar("^") && readChar()); // tie

				return totalStepTime;
			}

			function error(message) {
				throw new Error("char " + p + " : " + message);
			}

			function writeDeltaTick(tick) {
				if (tick < 0 || tick > 0xfffffff) {
					error("illegal length");
				}

				var stack = [];

				do {
					stack.push(tick & 0x7f);
					tick >>>= 7;
				} while (tick > 0);

				while (stack.length > 0) {
					var b = stack.pop();

					if (stack.length > 0) {
						b |= 0x80;
					}
					trackData.push(b);
				}
			}

			while (p < mml.length) {
				if (!isNextChar("cdefgabro<>lqutvpE? \n\r\t")) {
					error("syntax error '" + readChar() + "'");
				}
				var command = readChar();

				switch (command) {
					case "c":
					case "d":
					case "e":
					case "f":
					case "g":
					case "a":
					case "b":
						var n = "abcdefg".indexOf(command);
						if (n < 0 || n >= abcdefg.length) {
							break;
						}
						var note = (octave + 1) * 12 + abcdefg[n];

						if (isNextChar("+-")) {
							var c = readChar();
							if (c === "+") {
								note++;
							}
							if (c === "-") {
								note--;
							}
						}

						var stepTime = readNoteLength();
						var gateTime = Math.round(stepTime * q / 8);

						writeDeltaTick(restTick);
						trackData.push(0x90 | channel, note, velocity);
						writeDeltaTick(gateTime);
						trackData.push(0x80 | channel, note, 0);
						restTick = stepTime - gateTime;

						currentTick += stepTime;
						break;

					case "r":
						{
							var _stepTime = readNoteLength();
							restTick += _stepTime;

							currentTick += _stepTime;
						}
						break;

					case "o":
						if (!isNextValue()) {
							error("no octave number");
						} else {
							var _n = readValue();
							if (OCTAVE_MIN <= _n || _n <= OCTAVE_MAX) {
								octave = _n;
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

					case "l":
						{
							var _length2 = 4;
							if (isNextValue()) {
								_length2 = readValue();
							}
							tick = this.timebase * 4 / _length2;
						}
						break;

					case "q":
						{
							if (isNextValue()) {
								q = readValue();
								if (q < 1 || q > 8) {
									error("q value is out of range (1-8)");
								}
							}
						}
						break;

					case "u":
						{
							if (isNextValue()) {
								velocity = readValue();
								if (velocity < 0 || velocity > 127) {
									error("velocity value is out of range (0-127)");
								}
							}
						}
						break;

					case "t":
						if (!isNextValue()) {
							error("no tempo number");
						} else {
							var tempo = readValue();
							var quarterMicroseconds = 60 * 1000 * 1000 / tempo;

							if (quarterMicroseconds < 1 || quarterMicroseconds > 0xffffff) {
								error("illegal tempo");
							}

							writeDeltaTick(restTick);
							trackData.push(0xff, 0x51, 0x03, quarterMicroseconds >> 16 & 0xff, quarterMicroseconds >> 8 & 0xff, quarterMicroseconds & 0xff);
						}
						break;

					case "v":
						if (!isNextValue()) {
							error("no volume value");
						} else {
							var volume = readValue();

							if (volume < 0 || volume > 127) {
								error("volume value is out of range (0-127)");
							}

							writeDeltaTick(restTick);
							trackData.push(0xb0 | channel, 7, volume);
						}
						break;

					case "p":
						if (!isNextValue()) {
							error("no panpot value");
						} else {
							var pan = readValue();

							if (pan < -64 || pan > 63) {
								error("pan value is out of range (-64-63)");
							}

							writeDeltaTick(restTick);
							trackData.push(0xb0 | channel, 10, pan + 64);
						}
						break;

					case "E":
						if (!isNextValue()) {
							error("no expression value");
						} else {
							var expression = readValue();

							if (expression < 0 || expression > 127) {
								error("expression value is out of range (0-127)");
							}

							writeDeltaTick(restTick);
							trackData.push(0xb0 | channel, 11, expression);
						}
						break;

					case "?":
						// get start tick
						this.startTick = currentTick;
						break;
				}
			}

			return trackData;
		}
	}, {
		key: "getStartTick",
		value: function getStartTick() {
			return this.startTick;
		}
	}]);

	return MML2SMF;
})();

exports["default"] = MML2SMF;
module.exports = exports["default"];
},{}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _framesynthesisDebug = require("./framesynthesis/Debug");

var _framesynthesisDebug2 = _interopRequireDefault(_framesynthesisDebug);

var AudioManager = (function () {
	function AudioManager(synthesizer) {
		var _this = this;

		var bufferSize = arguments.length <= 1 || arguments[1] === undefined ? 1024 : arguments[1];

		_classCallCheck(this, AudioManager);

		this.synthesizer = synthesizer;
		this.bufferSize = bufferSize;

		try {
			// webkitAudioContext is for iOS 8
			this.context = window.AudioContext ? new AudioContext() : new webkitAudioContext();
		} catch (e) {
			_framesynthesisDebug2["default"].log("error: This browser does not support Web Audio API.");
			return;
		}

		this.bufferL = new Float32Array(this.bufferSize);
		this.bufferR = new Float32Array(this.bufferSize);

		this.scriptProcessor = this.context.createScriptProcessor(this.bufferSize, 0, 2);
		this.scriptProcessor.onaudioprocess = function (e) {
			return _this.process(e);
		};
		this.scriptProcessor.connect(this.context.destination);

		// Prevent GC
		// ref. http://stackoverflow.com/questions/24338144/chrome-onaudioprocess-stops-getting-called-after-a-while
		window.savedReference = this.scriptProcessor;

		_framesynthesisDebug2["default"].log("  Sampling rate : " + this.context.sampleRate + " Hz");
		_framesynthesisDebug2["default"].log("  Buffer size   : " + this.scriptProcessor.bufferSize + " samples");
	}

	_createClass(AudioManager, [{
		key: "process",
		value: function process(e) {
			var outL = e.outputBuffer.getChannelData(0);
			var outR = e.outputBuffer.getChannelData(1);

			this.synthesizer.render(this.bufferL, this.bufferR, this.context.sampleRate);

			for (var i = 0; i < this.bufferSize; i++) {
				outL[i] = this.bufferL[i];
				outR[i] = this.bufferR[i];
			}
		}
	}]);

	return AudioManager;
})();

exports["default"] = AudioManager;
module.exports = exports["default"];

},{"./framesynthesis/Debug":7}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _framesynthesisMyMath = require("./framesynthesis/MyMath");

var _framesynthesisMyMath2 = _interopRequireDefault(_framesynthesisMyMath);

var _Voice = require("./Voice");

var _Voice2 = _interopRequireDefault(_Voice);

var VOICE_MAX = 32;

var Channel = (function () {
	function Channel() {
		_classCallCheck(this, Channel);
	}

	_createClass(Channel, [{
		key: "reset",
		value: function reset() {
			this.voices = [];
			for (var i = 0; i < VOICE_MAX; i++) {
				this.voices[i] = new _Voice2["default"](this);
			}

			this.keyState = [];

			// General MIDI default
			this.volume = 100;
			this.pan = 64;
			this.expression = 127;

			this.damperPedal = false;

			this.pitchBend = 0;
			this.modulationWheel = 0;

			// preallocate channel buffer with margin
			this.channelBuffer = new Float32Array(4096);
		}
	}, {
		key: "noteOn",
		value: function noteOn(note, velocity) {
			this.keyState[note] = true;

			// stop same notes
			for (var i = 0; i < VOICE_MAX; i++) {
				if (this.voices[i].isPlaying() && this.voices[i].note === note) {
					this.voices[i].stop();
				}
			}

			// play note
			for (var i = 0; i < VOICE_MAX; i++) {
				if (!this.voices[i].isPlaying()) {
					this.voices[i].play(note, velocity);
					break;
				}
			}
		}
	}, {
		key: "noteOff",
		value: function noteOff(note, velocity) {
			this.keyState[note] = false;

			if (this.damperPedal) {
				return;
			}

			// stop notes		
			for (var i = 0; i < VOICE_MAX; i++) {
				if (this.voices[i].isPlaying() && this.voices[i].note === note) {
					this.voices[i].stop();
				}
			}
		}
	}, {
		key: "allNotesOff",
		value: function allNotesOff() {
			for (var i = 0; i < VOICE_MAX; i++) {
				if (this.voices[i].isPlaying()) {
					this.voices[i].stop();
				}
			}
		}
	}, {
		key: "damperPedalOn",
		value: function damperPedalOn() {
			this.damperPedal = true;
		}
	}, {
		key: "damperPedalOff",
		value: function damperPedalOff() {
			this.damperPedal = false;

			for (var i = 0; i < VOICE_MAX; i++) {
				if (this.keyState[this.voices[i].note] === false) {
					this.voices[i].stop();
				}
			}
		}
	}, {
		key: "setPitchBend",
		value: function setPitchBend(bend) {
			this.pitchBend = bend * 2 / 8192;
		}
	}, {
		key: "setModulationWheel",
		value: function setModulationWheel(wheel) {
			this.modulationWheel = wheel / 127;
		}
	}, {
		key: "setVolume",
		value: function setVolume(volume) {
			this.volume = volume;
		}
	}, {
		key: "setPan",
		value: function setPan(pan) {
			this.pan = pan;
		}
	}, {
		key: "setExpression",
		value: function setExpression(expression) {
			this.expression = expression;
		}
	}, {
		key: "render",
		value: function render(bufferL, bufferR, sampleRate) {
			for (var i = 0; i < bufferL.length; i++) {
				this.channelBuffer[i] = 0;
			}

			for (var i = 0; i < VOICE_MAX; i++) {
				this.voices[i].render(this.channelBuffer, bufferL.length, sampleRate);
			}

			var gain = this.volume / 127 * (this.expression / 127);
			var gainL = gain * _framesynthesisMyMath2["default"].clampedLinearMap(this.pan, 64, 127, 1, 0);
			var gainR = gain * _framesynthesisMyMath2["default"].clampedLinearMap(this.pan, 0, 64, 0, 1);

			for (var i = 0; i < bufferL.length; i++) {
				bufferL[i] += this.channelBuffer[i] * gainL;
				bufferR[i] += this.channelBuffer[i] * gainR;
			}
		}
	}]);

	return Channel;
})();

exports["default"] = Channel;
module.exports = exports["default"];

},{"./Voice":6,"./framesynthesis/MyMath":8}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TEMPO_DEFAULT = 120;
var INTERVAL = 1 / 100;

var Track = (function () {
	function Track(player, pos, length) {
		_classCallCheck(this, Track);

		this.player = player;

		this.pos = pos;
		this.endPos = pos + length;
		this.finished = false;

		this.nextEventTick = this.readDeltaTick();
	}

	_createClass(Track, [{
		key: "update",
		value: function update(currentTick, seeking) {
			if (this.finished) {
				return;
			}

			while (this.nextEventTick < currentTick) {
				// send MIDI message
				var statusByte = this.readByte();

				if (statusByte === 0xff) {
					// meta event

					var metaEventType = this.readByte();
					var _length = this.readByte();

					if (metaEventType === 0x51) {
						if (_length === 3) {
							var quarterMicroseconds = this.readByte() << 16 | this.readByte() << 8 | this.readByte();
							this.player.quarterTime = quarterMicroseconds / 1000;
						}
					} else {
						this.pos += _length;
					}
				} else {
					// MIDI event
					var dataByte1 = this.readByte();
					var dataByte2 = this.readByte();

					if (seeking && (statusByte >> 4 == 0x9 || statusByte >> 4 == 0x8)) {} else {
						this.player.synthesizer.processMIDIMessage([statusByte, dataByte1, dataByte2]);
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
	}, {
		key: "readByte",
		value: function readByte() {
			return this.player.smf[this.pos++];
		}
	}, {
		key: "readDeltaTick",
		value: function readDeltaTick() {
			var tick = 0;
			var n = undefined;

			do {
				n = this.readByte();
				tick <<= 7;
				tick |= n & 0x7f;
			} while (n & 0x80);

			if (tick > 0xfffffff) {
				throw new Error("illegal delta tick");
			}
			return tick;
		}
	}]);

	return Track;
})();

var SMFPlayer = (function () {
	function SMFPlayer(synthesizer) {
		_classCallCheck(this, SMFPlayer);

		this.synthesizer = synthesizer;
	}

	_createClass(SMFPlayer, [{
		key: "play",
		value: function play(smf) {
			var _this = this;

			var startTick = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

			this.smf = smf;
			this.startTick = startTick;

			this.quarterTime = 60 * 1000 / TEMPO_DEFAULT; // ms

			// read SMF header
			var pos = 8;

			function read2bytes() {
				return smf[pos++] << 8 | smf[pos++];
			}

			function read4bytes() {
				return smf[pos++] << 24 | smf[pos++] << 16 | smf[pos++] << 8 | smf[pos++];
			}

			var format = read2bytes();
			this.trackNumber = read2bytes();
			this.timebase = read2bytes();

			// error check
			var SMF_HEADER = [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06];
			for (var i = 0; i < SMF_HEADER.length; i++) {
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
			for (var i = 0; i < this.trackNumber; i++) {
				pos += 4;

				var _length2 = read4bytes();
				this.tracks.push(new Track(this, pos, _length2));

				pos += _length2;
			}

			// set up timer
			this.prevTime = Date.now();
			this.currentTick = 0;

			if (!this.intervalId) {
				this.intervalId = setInterval(function () {
					return _this.onInterval();
				}, INTERVAL);
			}
		}
	}, {
		key: "stop",
		value: function stop() {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}, {
		key: "onInterval",
		value: function onInterval() {
			// calclate delta time
			var currentTime = Date.now();
			var deltaTime = currentTime - this.prevTime;
			this.prevTime = currentTime;

			var tickTime = this.quarterTime / this.timebase;

			var seeking = false;
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

			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;

			try {
				for (var _iterator = this.tracks[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
					var track = _step.value;

					track.update(this.currentTick, seeking);
				}
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator["return"]) {
						_iterator["return"]();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}

			// stop when all tracks finish
			var playingTrack = 0;
			var _iteratorNormalCompletion2 = true;
			var _didIteratorError2 = false;
			var _iteratorError2 = undefined;

			try {
				for (var _iterator2 = this.tracks[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
					var track = _step2.value;

					if (track.finished === false) {
						playingTrack++;
					}
				}
			} catch (err) {
				_didIteratorError2 = true;
				_iteratorError2 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion2 && _iterator2["return"]) {
						_iterator2["return"]();
					}
				} finally {
					if (_didIteratorError2) {
						throw _iteratorError2;
					}
				}
			}

			if (playingTrack === 0) {
				this.stop();
			}
		}
	}]);

	return SMFPlayer;
})();

exports["default"] = SMFPlayer;
module.exports = exports["default"];

// disable Note On/Off when seeking

},{}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _framesynthesisDebug = require("./framesynthesis/Debug");

var _framesynthesisDebug2 = _interopRequireDefault(_framesynthesisDebug);

var _framesynthesisPlatform = require("./framesynthesis/Platform");

var _framesynthesisPlatform2 = _interopRequireDefault(_framesynthesisPlatform);

var _AudioManager = require("./AudioManager");

var _AudioManager2 = _interopRequireDefault(_AudioManager);

var _Channel = require("./Channel");

var _Channel2 = _interopRequireDefault(_Channel);

var CHANNEL_MAX = 16;

var Synthesizer = (function () {
	function Synthesizer(options) {
		_classCallCheck(this, Synthesizer);

		this.options = options;

		this.channels = [];
		for (var i = 0; i < CHANNEL_MAX; i++) {
			this.channels[i] = new _Channel2["default"]();
		}

		this.reset();

		this.audioManager = null;
		if (!_framesynthesisPlatform2["default"].isiOS()) {
			this.createAudioManager();
		}
	}

	_createClass(Synthesizer, [{
		key: "createAudioManager",
		value: function createAudioManager() {
			if (!this.audioManager) {
				_framesynthesisDebug2["default"].log("Initializing Web Audio");
				this.audioManager = new _AudioManager2["default"](this);
			}
		}
	}, {
		key: "reset",
		value: function reset() {
			_framesynthesisDebug2["default"].log("Initializing Synthesizer");

			for (var i = 0; i < CHANNEL_MAX; i++) {
				this.channels[i].reset();
			}
		}
	}, {
		key: "render",
		value: function render(bufferL, bufferR, sampleRate) {
			for (var i = 0; i < bufferL.length; i++) {
				bufferL[i] = 0;
				bufferR[i] = 0;
			}

			for (var i = 0; i < CHANNEL_MAX; i++) {
				this.channels[i].render(bufferL, bufferR, sampleRate);
			}
		}
	}, {
		key: "processMIDIMessage",
		value: function processMIDIMessage(data) {
			if (!data) {
				return;
			}

			if (data.length < 3) {
				return;
			}

			// avoid iOS audio restriction
			this.createAudioManager();

			var statusByte = data[0];
			var statusUpper4bits = statusByte >> 4;
			var channel = statusByte & 0xf;
			var midiChannel = channel + 1;

			if (statusUpper4bits === 0x9) {
				var note = data[1];
				var velocity = data[2];

				this.log("Ch. " + midiChannel + " Note On  note: " + note + " velocity: " + velocity);
				this.channels[channel].noteOn(note, velocity);
			}
			if (statusUpper4bits === 0x8) {
				var note = data[1];
				var velocity = data[2];

				this.log("Ch. " + midiChannel + " Note Off note: " + note + " velocity: " + velocity);
				this.channels[channel].noteOff(note, velocity);
			}

			if (statusUpper4bits === 0xe) {
				var lsb = data[1];
				var msb = data[2];
				var bend = (msb << 7 | lsb) - 8192;

				this.log("Ch. " + midiChannel + " Pitch bend: " + bend);
				this.channels[channel].setPitchBend(bend);
			}
			if (statusUpper4bits === 0xb) {
				var controlNumber = data[1];
				var value = data[2];

				if (controlNumber === 1) {
					this.log("Ch. " + midiChannel + " Modulation Wheel: " + value);
					this.channels[channel].setModulationWheel(value);
				}
				if (controlNumber === 7) {
					this.log("Ch. " + midiChannel + " Channel Volume: " + value);
					this.channels[channel].setVolume(value);
				}
				if (controlNumber === 10) {
					this.log("Ch. " + midiChannel + " Pan: " + value);
					this.channels[channel].setPan(value);
				}
				if (controlNumber === 11) {
					this.log("Ch. " + midiChannel + " Expression Controller: " + value);
					this.channels[channel].setExpression(value);
				}
				if (controlNumber === 64) {
					if (value >= 64) {
						this.log("Ch. " + midiChannel + " Damper Pedal On");
						this.channels[channel].damperPedalOn();
					} else {
						this.log("Ch. " + midiChannel + " Damper Pedal Off");
						this.channels[channel].damperPedalOff();
					}
				}
				if (controlNumber === 123) {
					if (value === 0) {
						this.log("Ch. " + midiChannel + " All Notes Off");
						this.channels[channel].allNotesOff();
					}
				}
			}
		}
	}, {
		key: "log",
		value: function log(message) {
			if (this.options && this.options.verbose) {
				_framesynthesisDebug2["default"].log(message);
			}
		}
	}]);

	return Synthesizer;
})();

exports["default"] = Synthesizer;
module.exports = exports["default"];

},{"./AudioManager":2,"./Channel":3,"./framesynthesis/Debug":7,"./framesynthesis/Platform":9}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _oscillatorsSquareOscillator = require("./oscillators/SquareOscillator");

var _oscillatorsSquareOscillator2 = _interopRequireDefault(_oscillatorsSquareOscillator);

var _oscillatorsTriangleOscillator = require("./oscillators/TriangleOscillator");

var _oscillatorsTriangleOscillator2 = _interopRequireDefault(_oscillatorsTriangleOscillator);

var STATE_OFF = 0;
var STATE_ATTACK = 1; // not used
var STATE_DECAY = 2; // not used
var STATE_SUSTAIN = 3;
var STATE_RELEASE = 4;

var Voice = (function () {
	function Voice(synthesizer) {
		_classCallCheck(this, Voice);

		this.synthesizer = synthesizer;
		this.state = STATE_OFF;
	}

	_createClass(Voice, [{
		key: "play",
		value: function play(note, velocity) {
			this.state = STATE_SUSTAIN;
			this.note = note;
			this.frequency = 440 * Math.pow(2, (note - 69) / 12);
			this.volume = velocity / 127;
			this.phase = 0;

			this.oscillator = new _oscillatorsSquareOscillator2["default"]();
			// this.oscillator = new TriangleOscillator();

			this.vibratoOscillator = new _oscillatorsTriangleOscillator2["default"]();
			this.vibratoPhase = 0;
			this.vibratoFrequency = 8;
			this.vibratoAmplitude = 0.5;

			this.oversampling = 4;
		}
	}, {
		key: "stop",
		value: function stop() {
			this.state = STATE_RELEASE;
		}
	}, {
		key: "render",
		value: function render(buffer, length, sampleRate) {
			if (this.state !== STATE_OFF) {
				for (var i = 0; i < length; i++) {
					var amplitude = this.synthesizer.modulationWheel * this.vibratoAmplitude;

					var vibratoPeriod = sampleRate / this.vibratoFrequency;
					this.vibratoPhase += 1 / vibratoPeriod;
					var vibratoOffset = this.vibratoOscillator.getSample(this.vibratoPhase) * amplitude;

					var frequency = this.note2frequency(this.note + this.synthesizer.pitchBend + vibratoOffset);
					var period = sampleRate / frequency;

					var sample = 0;
					for (var _i = 0; _i < this.oversampling; _i++) {
						sample += this.oscillator.getSample(this.phase);
						this.phase += 1 / period / this.oversampling;
					}
					buffer[i] += sample / this.oversampling * this.volume * 0.1;

					if (this.state === STATE_RELEASE) {
						this.volume -= 0.005;
					} else {
						this.volume *= 0.99999;
					}

					if (this.volume < 0) {
						this.state = STATE_OFF;
						return;
					}
				}
			}
		}
	}, {
		key: "isPlaying",
		value: function isPlaying() {
			if (this.state !== STATE_OFF) {
				return true;
			}
			return false;
		}
	}, {
		key: "note2frequency",
		value: function note2frequency(note) {
			return 440 * Math.pow(2, (note - 69) / 12);
		}
	}]);

	return Voice;
})();

exports["default"] = Voice;
module.exports = exports["default"];

},{"./oscillators/SquareOscillator":11,"./oscillators/TriangleOscillator":12}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Debug = (function () {
	function Debug() {
		_classCallCheck(this, Debug);
	}

	_createClass(Debug, null, [{
		key: "clear",
		value: function clear() {
			document.getElementById("debug").innerHTML = "";
		}
	}, {
		key: "log",
		value: function log(message) {
			var element = document.getElementById("debug");
			if (element) {
				var div = document.createElement("div");
				var text = document.createTextNode(message);
				div.appendChild(text);

				element.appendChild(div);
				while (element.scrollHeight > element.clientHeight) {
					element.removeChild(element.firstChild);
				}
			}
		}
	}]);

	return Debug;
})();

exports["default"] = Debug;
module.exports = exports["default"];

},{}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MyMath = (function () {
	function MyMath() {
		_classCallCheck(this, MyMath);
	}

	_createClass(MyMath, null, [{
		key: "random",
		value: function random(min, max) {
			return min + Math.random() * (max - min);
		}
	}, {
		key: "clamp",
		value: function clamp(value, min, max) {
			if (min > max) {
				var temp = min;
				min = max;
				max = temp;
			}

			if (value < min) {
				return min;
			}
			if (value > max) {
				return max;
			}
			return value;
		}
	}, {
		key: "linearMap",
		value: function linearMap(value, s0, s1, d0, d1) {
			return d0 + (value - s0) * (d1 - d0) / (s1 - s0);
		}
	}, {
		key: "clampedLinearMap",
		value: function clampedLinearMap(value, s0, s1, d0, d1) {
			return this.clamp(this.linearMap(value, s0, s1, d0, d1), d0, d1);
		}
	}, {
		key: "ease",
		value: function ease(value, target, factor, deltaTime) {
			return value + (target - value) * (1 - Math.exp(-factor * deltaTime));
		}
	}, {
		key: "radian",
		value: function radian(degree) {
			return degree * 0.01745329251994330; // Math.PI / 180
		}
	}, {
		key: "degree",
		value: function degree(radian) {
			return radian * 57.2957795130823208; // 180 / Math.PI
		}
	}, {
		key: "wrap",
		value: function wrap(value, min, max) {
			var n = (value - min) % (max - min);
			return n >= 0 ? n + min : n + max;
		}
	}]);

	return MyMath;
})();

exports["default"] = MyMath;
module.exports = exports["default"];

},{}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Platform = (function () {
	function Platform() {
		_classCallCheck(this, Platform);
	}

	_createClass(Platform, null, [{
		key: "isiOS",
		value: function isiOS() {
			return this.isiPhone() || this.isiPad();
		}
	}, {
		key: "isiPhone",
		value: function isiPhone() {
			return window.navigator.userAgent.includes("iPhone");
		}
	}, {
		key: "isiPad",
		value: function isiPad() {
			return window.navigator.userAgent.includes("iPad");
		}
	}]);

	return Platform;
})();

exports["default"] = Platform;
module.exports = exports["default"];

},{}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _MML2SMF = require("MML2SMF");

var _MML2SMF2 = _interopRequireDefault(_MML2SMF);

var _Synthesizer = require("./Synthesizer");

var _Synthesizer2 = _interopRequireDefault(_Synthesizer);

var _SMFPlayer = require("./SMFPlayer");

var _SMFPlayer2 = _interopRequireDefault(_SMFPlayer);

var MML2SMF = _MML2SMF2["default"];
exports.MML2SMF = MML2SMF;
var Synthesizer = _Synthesizer2["default"];
exports.Synthesizer = Synthesizer;
var SMFPlayer = _SMFPlayer2["default"];
exports.SMFPlayer = SMFPlayer;

},{"./SMFPlayer":4,"./Synthesizer":5,"MML2SMF":1}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _framesynthesisMyMath = require("../framesynthesis/MyMath");

var _framesynthesisMyMath2 = _interopRequireDefault(_framesynthesisMyMath);

var SquareOscillator = (function () {
	function SquareOscillator() {
		_classCallCheck(this, SquareOscillator);
	}

	_createClass(SquareOscillator, [{
		key: "getSample",
		value: function getSample(phase) {
			var p = phase % 1;

			return p < 0.5 ? 1 : -1;
		}
	}]);

	return SquareOscillator;
})();

exports["default"] = SquareOscillator;
module.exports = exports["default"];

},{"../framesynthesis/MyMath":8}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _framesynthesisMyMath = require("../framesynthesis/MyMath");

var _framesynthesisMyMath2 = _interopRequireDefault(_framesynthesisMyMath);

var TriangleOscillator = (function () {
	function TriangleOscillator() {
		_classCallCheck(this, TriangleOscillator);
	}

	_createClass(TriangleOscillator, [{
		key: "getSample",
		value: function getSample(phase) {
			var p = phase % 1;

			if (p < 0.25) {
				return _framesynthesisMyMath2["default"].linearMap(p, 0, 0.25, 0, 1);
				// return p * 4;
			}
			if (p < 0.75) {
				return _framesynthesisMyMath2["default"].linearMap(p, 0.25, 0.75, 1, -1);
			}
			return _framesynthesisMyMath2["default"].linearMap(p, 0.75, 1, -1, 0);
		}
	}]);

	return TriangleOscillator;
})();

exports["default"] = TriangleOscillator;
module.exports = exports["default"];

},{"../framesynthesis/MyMath":8}]},{},[10])(10)
});