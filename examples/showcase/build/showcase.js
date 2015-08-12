(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var VirtualKeyboard = (function () {
	function VirtualKeyboard(synthesizer) {
		var _this = this;

		_classCallCheck(this, VirtualKeyboard);

		this.synthesizer = synthesizer;

		this.keyState = [];
		for (var i = 0; i < 88; i++) {
			this.keyState[i] = false;
		}

		var lowerKeys = [67, 70, 86, 71, 66, 78, 74, 77, 75, 188, 76, 190, 191];
		var upperKeys = [69, 52, 82, 53, 84, 89, 55, 85, 56, 73, 57, 79, 80];

		this.key2note = {};

		for (var i = 0; i < lowerKeys.length; i++) {
			this.key2note[lowerKeys[i]] = 60 + i;
		}
		for (var i = 0; i < upperKeys.length; i++) {
			this.key2note[upperKeys[i]] = 72 + i;
		}

		document.body.addEventListener("keydown", function (event) {
			return _this.onKeyDown(event);
		});
		document.body.addEventListener("keyup", function (evemt) {
			return _this.onKeyUp(event);
		});

		this.damperPedal = false;

		this.createKeyboard();
	}

	_createClass(VirtualKeyboard, [{
		key: "onKeyDown",
		value: function onKeyDown(event) {
			if (event.target.nodeName === "INPUT" || event.target.nodeName === "TEXTAREA") {
				return;
			}

			if (event.keyCode === 32 && this.damperPedal === false) {
				this.damperPedal = true;
				this.synthesizer.processMIDIMessage([0xb0, 64, 127]);
			}

			var note = this.key2note[event.keyCode];
			if (this.keyState[note] === false) {
				this.keyState[note] = true;
				this.noteOn(note);
			}
		}
	}, {
		key: "onKeyUp",
		value: function onKeyUp(event) {
			if (event.keyCode === 32) {
				this.damperPedal = false;
				this.synthesizer.processMIDIMessage([0xb0, 64, 0]);
			}

			var note = this.key2note[event.keyCode];
			if (this.keyState[note] === true) {
				this.keyState[note] = false;
				this.noteOff(note);
			}
		}
	}, {
		key: "noteOn",
		value: function noteOn(note) {
			var velocity = arguments.length <= 1 || arguments[1] === undefined ? 96 : arguments[1];

			this.synthesizer.processMIDIMessage([0x90, note, velocity]);
		}
	}, {
		key: "noteOff",
		value: function noteOff(note) {
			this.synthesizer.processMIDIMessage([0x80, note, 0]);
		}
	}, {
		key: "createKeyboard",
		value: function createKeyboard() {
			var KEY_LENGTH = 120;

			var parent = document.getElementById("keyboard");

			var canvas = document.createElement("canvas");
			canvas.setAttribute("width", "1000");
			canvas.setAttribute("height", "" + KEY_LENGTH);
			parent.appendChild(canvas);

			var KEYS = [{ dx: 0.4, black: false }, // C
			{ dx: 0.6, black: true }, // C#
			{ dx: 0.6, black: false }, // D
			{ dx: 0.4, black: true }, // D#
			{ dx: 1.0, black: false }, // E
			{ dx: 0.35, black: false }, // F
			{ dx: 0.65, black: true }, // F#
			{ dx: 0.5, black: false }, // G
			{ dx: 0.5, black: true }, // G#
			{ dx: 0.65, black: false }, // A
			{ dx: 0.35, black: true }, // A#
			{ dx: 1.0, black: false } // B
			];

			var wholeToneInterval = 28; // pixel

			var context = canvas.getContext("2d");

			var LOWEST_NOTE = 21;
			var HIGHEST_NOTE = 21 + 88;
			var START_KEY = 9;

			// draw white keys
			var x = 0.5;
			var key = START_KEY;

			for (var note = LOWEST_NOTE; note < HIGHEST_NOTE; note++) {
				if (!KEYS[key].black) {
					var center = x * wholeToneInterval;
					var width = wholeToneInterval;
					var height = KEY_LENGTH;

					context.fillStyle = "#F8F8F8";
					context.fillRect(center - width / 2, 0, width, height);

					context.lineWidth = 0.5;
					context.strokeStyle = "#CCC";
					context.beginPath();
					context.moveTo(center - width / 2 - 0.5, 0);
					context.lineTo(center - width / 2 - 0.5, KEY_LENGTH);
					context.stroke();
				}

				x += KEYS[key].dx;
				if (++key >= KEYS.length) {
					key = 0;
				}
			}

			// draw black keys
			x = 0.5;
			key = START_KEY;

			for (var note = LOWEST_NOTE; note < HIGHEST_NOTE; note++) {
				if (KEYS[key].black) {
					var center = x * wholeToneInterval;
					var width = wholeToneInterval * 0.5;
					var height = KEY_LENGTH * 0.625;

					context.fillStyle = "#333";
					context.fillRect(center - width / 2, 0, width, height);
				}

				x += KEYS[key].dx;
				if (++key >= KEYS.length) {
					key = 0;
				}
			}
		}
	}]);

	return VirtualKeyboard;
})();

exports["default"] = VirtualKeyboard;
module.exports = exports["default"];

},{}],2:[function(require,module,exports){
"use strict";

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _srcFramesynthesisDebug = require("../../../src/framesynthesis/Debug");

var _srcFramesynthesisDebug2 = _interopRequireDefault(_srcFramesynthesisDebug);

var _VirtualKeyboard = require("./VirtualKeyboard");

var _VirtualKeyboard2 = _interopRequireDefault(_VirtualKeyboard);

var synthesizer = new synthesisjs.Synthesizer({ verbose: true });

var virtualKeyboard = new _VirtualKeyboard2["default"](synthesizer);

_srcFramesynthesisDebug2["default"].log("Initializing Web MIDI");
if (navigator.requestMIDIAccess) {
	navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
} else {
	_srcFramesynthesisDebug2["default"].log("error: This browser does not support Web MIDI API.");
}

function onMIDISuccess(midiAccess) {
	var _iteratorNormalCompletion = true;
	var _didIteratorError = false;
	var _iteratorError = undefined;

	try {
		for (var _iterator = midiAccess.inputs.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
			var input = _step.value;

			_srcFramesynthesisDebug2["default"].log("  MIDI Input  id: " + input.id + " manufacturer: " + input.manufacturer + " name: " + input.name);

			input.onmidimessage = onMIDIMessage;
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

	var _iteratorNormalCompletion2 = true;
	var _didIteratorError2 = false;
	var _iteratorError2 = undefined;

	try {
		for (var _iterator2 = midiAccess.outputs.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
			var output = _step2.value;

			_srcFramesynthesisDebug2["default"].log("  MIDI Output id: " + output.id + " manufacturer: " + output.manufacturer + " name: " + output.name);
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

	_srcFramesynthesisDebug2["default"].log("Ready");
}

function onMIDIFailure(message) {
	_srcFramesynthesisDebug2["default"].log("error: Can't initialize Web MIDI: " + message);
}

function onMIDIMessage(event) {
	// let s = "MIDI message timestamp " + event.timeStamp + " : ";
	// for (let i = 0; i < event.data.length; i++) {
	// 	s += "0x" + event.data[i].toString(16) + " ";
	// }

	synthesizer.processMIDIMessage(event.data);
}

var smfPlayer = new synthesisjs.SMFPlayer(synthesizer);

function playSMF() {
	_srcFramesynthesisDebug2["default"].log("Play test SMF");

	var tick = 24;

	var smf = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x01, 0x00, 0x30, 0x4d, 0x54, 0x72, 0x6b, 0x00, 0x00, 0x00, 46, 0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, 0, 0x9f, 60, 96, tick, 0x8f, 60, 0, 0, 0x9f, 62, 96, tick, 0x8f, 62, 0, 0, 0x9f, 64, 96, tick, 0x8f, 64, 0, 0, 0x9f, 65, 96, tick, 0x8f, 65, 0, 0, 0x9f, 67, 96, tick, 0x8f, 67, 0]);

	smfPlayer.play(smf);
}

function stopSMF() {
	_srcFramesynthesisDebug2["default"].log("Stop SMF");

	smfPlayer.stop();

	for (var i = 0; i < 16; i++) {
		synthesizer.processMIDIMessage([0xb0 + i, 123, 0]);
	}
}

// export
window.playSMF = playSMF;
window.stopSMF = stopSMF;

function playMML() {
	var mml2smf = new synthesisjs.MML2SMF();
	var mml = document.getElementById("mml").value;
	_srcFramesynthesisDebug2["default"].log("Convert MML: " + mml);
	try {
		var smf = mml2smf.convert(mml);
		var startTick = mml2smf.getStartTick();
		_srcFramesynthesisDebug2["default"].log("Play SMF");
		smfPlayer.play(smf, startTick);
	} catch (e) {
		_srcFramesynthesisDebug2["default"].log(e.message);
	}
}

function tweetMML() {
	var mml = document.getElementById("mml").value;
	var mmlURL = "http://framesynthesis.com/experiments/synthesis.js/?mml=" + encodeURIComponent(mml);

	var url = "https://twitter.com/intent/tweet?hashtags=synthesisjs&text=" + encodeURIComponent(mmlURL);
	window.open(url, "_blank");
}

window.playMML = playMML;
window.tweetMML = tweetMML;

function synthesizerReset() {
	synthesizer.reset();
}

window.synthesizerReset = synthesizerReset;

// set MML from query string
if (location.search.startsWith("?mml=")) {
	var mml = decodeURIComponent(location.search.substring(5));
	document.getElementById("mml").value = mml;
}
/*{ sysex: true }*/

},{"../../../src/framesynthesis/Debug":3,"./VirtualKeyboard":1}],3:[function(require,module,exports){
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

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImM6L1VzZXJzL2thdHN1XzAwMC9BcHBEYXRhL1JvYW1pbmcvbnBtL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiRDovUHJvamVjdHMvSFRNTDUvc3ludGhlc2lzLmpzL2V4YW1wbGVzL3Nob3djYXNlL3NyYy9WaXJ0dWFsS2V5Ym9hcmQuanMiLCJEOi9Qcm9qZWN0cy9IVE1MNS9zeW50aGVzaXMuanMvZXhhbXBsZXMvc2hvd2Nhc2Uvc3JjL21haW4uanMiLCJEOi9Qcm9qZWN0cy9IVE1MNS9zeW50aGVzaXMuanMvc3JjL2ZyYW1lc3ludGhlc2lzL0RlYnVnLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7OztJQ0FxQixlQUFlO0FBQ3hCLFVBRFMsZUFBZSxDQUN2QixXQUFXLEVBQUU7Ozt3QkFETCxlQUFlOztBQUVsQyxNQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQzs7QUFFL0IsTUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7QUFDbkIsT0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM1QixPQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztHQUN6Qjs7QUFFRCxNQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3hFLE1BQUksU0FBUyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFF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QixPQUFJLE9BQU8sR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQy9DLE9BQUksT0FBTyxFQUFFO0FBQ1osUUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN4QyxRQUFJLElBQUksR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzVDLE9BQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBRXRCLFdBQU8sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDekIsV0FBTyxPQUFPLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQyxZQUFZLEVBQUU7QUFDbkQsWUFBTyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7S0FDeEM7SUFDRDtHQUNEOzs7UUFqQm1CLEtBQUs7OztxQkFBTCxLQUFLIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFZpcnR1YWxLZXlib2FyZCB7XHJcblx0Y29uc3RydWN0b3Ioc3ludGhlc2l6ZXIpIHtcclxuXHRcdHRoaXMuc3ludGhlc2l6ZXIgPSBzeW50aGVzaXplcjtcclxuXHJcblx0XHR0aGlzLmtleVN0YXRlID0gW107XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDg4OyBpKyspIHtcclxuXHRcdFx0dGhpcy5rZXlTdGF0ZVtpXSA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCBsb3dlcktleXMgPSBbNjcsIDcwLCA4NiwgNzEsIDY2LCA3OCwgNzQsIDc3LCA3NSwgMTg4LCA3NiwgMTkwLCAxOTFdO1xyXG5cdFx0bGV0IHVwcGVyS2V5cyA9IFs2OSwgNTIsIDgyLCA1MywgODQsIDg5LCA1NSwgODUsIDU2LCA3MywgNTcsIDc5LCA4MF07XHJcblxyXG5cdFx0dGhpcy5rZXkybm90ZSA9IHt9O1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbG93ZXJLZXlzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHRoaXMua2V5Mm5vdGVbbG93ZXJLZXlzW2ldXSA9IDYwICsgaTtcclxuXHRcdH1cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdXBwZXJLZXlzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHRoaXMua2V5Mm5vdGVbdXBwZXJLZXlzW2ldXSA9IDcyICsgaTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0ZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBldmVudCA9PiB0aGlzLm9uS2V5RG93bihldmVudCkpO1xyXG5cdFx0ZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgZXZlbXQgPT4gdGhpcy5vbktleVVwKGV2ZW50KSk7XHJcblx0XHRcclxuXHRcdHRoaXMuZGFtcGVyUGVkYWwgPSBmYWxzZTtcclxuXHRcdFxyXG5cdFx0dGhpcy5jcmVhdGVLZXlib2FyZCgpO1xyXG5cdH1cclxuXHRcclxuXHRvbktleURvd24oZXZlbnQpIHtcclxuXHRcdGlmIChldmVudC50YXJnZXQubm9kZU5hbWUgPT09IFwiSU5QVVRcIiB8fCBldmVudC50YXJnZXQubm9kZU5hbWUgPT09IFwiVEVYVEFSRUFcIikge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGlmIChldmVudC5rZXlDb2RlID09PSAzMiAmJiB0aGlzLmRhbXBlclBlZGFsID09PSBmYWxzZSkge1xyXG5cdFx0XHR0aGlzLmRhbXBlclBlZGFsID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5zeW50aGVzaXplci5wcm9jZXNzTUlESU1lc3NhZ2UoWzB4YjAsIDY0LCAxMjddKTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0bGV0IG5vdGUgPSB0aGlzLmtleTJub3RlW2V2ZW50LmtleUNvZGVdO1xyXG5cdFx0aWYgKHRoaXMua2V5U3RhdGVbbm90ZV0gPT09IGZhbHNlKSB7XHJcblx0XHRcdHRoaXMua2V5U3RhdGVbbm90ZV0gPSB0cnVlO1xyXG5cdFx0XHR0aGlzLm5vdGVPbihub3RlKTtcclxuXHRcdH1cclxuXHR9XHJcblx0XHJcblx0b25LZXlVcChldmVudCkge1xyXG5cdFx0aWYgKGV2ZW50LmtleUNvZGUgPT09IDMyKSB7XHJcblx0XHRcdHRoaXMuZGFtcGVyUGVkYWwgPSBmYWxzZTtcclxuXHRcdFx0dGhpcy5zeW50aGVzaXplci5wcm9jZXNzTUlESU1lc3NhZ2UoWzB4YjAsIDY0LCAwXSk7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGxldCBub3RlID0gdGhpcy5rZXkybm90ZVtldmVudC5rZXlDb2RlXTtcclxuXHRcdGlmICh0aGlzLmtleVN0YXRlW25vdGVdID09PSB0cnVlKSB7XHJcblx0XHRcdHRoaXMua2V5U3RhdGVbbm90ZV0gPSBmYWxzZTtcclxuXHRcdFx0dGhpcy5ub3RlT2ZmKG5vdGUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRcclxuXHRub3RlT24obm90ZSwgdmVsb2NpdHkgPSA5Nikge1xyXG5cdFx0dGhpcy5zeW50aGVzaXplci5wcm9jZXNzTUlESU1lc3NhZ2UoWzB4OTAsIG5vdGUsIHZlbG9jaXR5XSk7XHJcblx0fVxyXG5cdFxyXG5cdG5vdGVPZmYobm90ZSkge1xyXG5cdFx0dGhpcy5zeW50aGVzaXplci5wcm9jZXNzTUlESU1lc3NhZ2UoWzB4ODAsIG5vdGUsIDBdKTtcclxuXHR9XHJcblx0XHJcblx0Y3JlYXRlS2V5Ym9hcmQoKSB7XHJcblx0XHRjb25zdCBLRVlfTEVOR1RIID0gMTIwO1xyXG5cdFx0XHJcblx0XHRsZXQgcGFyZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJrZXlib2FyZFwiKTtcclxuXHRcdFxyXG5cdFx0bGV0IGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcblx0XHRjYW52YXMuc2V0QXR0cmlidXRlKFwid2lkdGhcIiwgXCIxMDAwXCIpO1xyXG5cdFx0Y2FudmFzLnNldEF0dHJpYnV0ZShcImhlaWdodFwiLCBcIlwiICsgS0VZX0xFTkdUSCk7XHJcblx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQoY2FudmFzKTtcclxuXHRcdFxyXG5cdFx0Y29uc3QgS0VZUyA9IFtcclxuXHRcdFx0eyBkeDogMC40LCBibGFjazogZmFsc2UgfSxcdC8vIENcclxuXHRcdFx0eyBkeDogMC42LCBibGFjazogdHJ1ZSB9LFx0Ly8gQyNcclxuXHRcdFx0eyBkeDogMC42LCBibGFjazogZmFsc2UgfSxcdC8vIERcclxuXHRcdFx0eyBkeDogMC40LCBibGFjazogdHJ1ZSB9LFx0Ly8gRCNcclxuXHRcdFx0eyBkeDogMS4wLCBibGFjazogZmFsc2UgfSxcdC8vIEVcclxuXHRcdFx0eyBkeDogMC4zNSwgYmxhY2s6IGZhbHNlIH0sXHQvLyBGXHJcblx0XHRcdHsgZHg6IDAuNjUsIGJsYWNrOiB0cnVlIH0sXHQvLyBGI1xyXG5cdFx0XHR7IGR4OiAwLjUsIGJsYWNrOiBmYWxzZSB9LFx0Ly8gR1xyXG5cdFx0XHR7IGR4OiAwLjUsIGJsYWNrOiB0cnVlIH0sXHQvLyBHI1xyXG5cdFx0XHR7IGR4OiAwLjY1LCBibGFjazogZmFsc2UgfSxcdC8vIEFcclxuXHRcdFx0eyBkeDogMC4zNSwgYmxhY2s6IHRydWUgfSxcdC8vIEEjXHJcblx0XHRcdHsgZHg6IDEuMCwgYmxhY2s6IGZhbHNlIH1cdC8vIEJcclxuXHRcdF07XHJcblx0XHRcclxuXHRcdGxldCB3aG9sZVRvbmVJbnRlcnZhbCA9IDI4OyAvLyBwaXhlbFxyXG5cdFx0XHJcblx0XHRsZXQgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XHJcblx0XHRcclxuXHRcdGNvbnN0IExPV0VTVF9OT1RFID0gMjE7XHJcblx0XHRjb25zdCBISUdIRVNUX05PVEUgPSAyMSArIDg4O1xyXG5cdFx0Y29uc3QgU1RBUlRfS0VZID0gOTtcclxuXHRcdFxyXG5cdFx0Ly8gZHJhdyB3aGl0ZSBrZXlzXHJcblx0XHRsZXQgeCA9IDAuNTtcclxuXHRcdGxldCBrZXkgPSBTVEFSVF9LRVk7XHJcblx0XHRcclxuXHRcdGZvciAobGV0IG5vdGUgPSBMT1dFU1RfTk9URTsgbm90ZSA8IEhJR0hFU1RfTk9URTsgbm90ZSsrKSB7XHJcblx0XHRcdGlmICghS0VZU1trZXldLmJsYWNrKSB7XHJcblx0XHRcdFx0bGV0IGNlbnRlciA9IHggKiB3aG9sZVRvbmVJbnRlcnZhbDtcclxuXHRcdFx0XHRsZXQgd2lkdGggPSB3aG9sZVRvbmVJbnRlcnZhbDtcclxuXHRcdFx0XHRsZXQgaGVpZ2h0ID0gS0VZX0xFTkdUSDtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRjb250ZXh0LmZpbGxTdHlsZSA9IFwiI0Y4RjhGOFwiO1xyXG5cdFx0XHRcdGNvbnRleHQuZmlsbFJlY3QoY2VudGVyIC0gd2lkdGggLyAyLCAwLCB3aWR0aCwgaGVpZ2h0KTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRjb250ZXh0LmxpbmVXaWR0aCA9IDAuNTtcclxuXHRcdFx0XHRjb250ZXh0LnN0cm9rZVN0eWxlID0gXCIjQ0NDXCI7XHJcblx0XHRcdFx0Y29udGV4dC5iZWdpblBhdGgoKTtcclxuXHRcdFx0XHRjb250ZXh0Lm1vdmVUbyhjZW50ZXIgLSB3aWR0aCAvIDIgLSAwLjUsIDApO1xyXG5cdFx0XHRcdGNvbnRleHQubGluZVRvKGNlbnRlciAtIHdpZHRoIC8gMiAtIDAuNSwgS0VZX0xFTkdUSCk7XHJcblx0XHRcdFx0Y29udGV4dC5zdHJva2UoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0eCArPSBLRVlTW2tleV0uZHg7XHJcblx0XHRcdGlmICgrK2tleSA+PSBLRVlTLmxlbmd0aCkge1xyXG5cdFx0XHRcdGtleSA9IDA7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0Ly8gZHJhdyBibGFjayBrZXlzXHJcblx0XHR4ID0gMC41O1xyXG5cdFx0a2V5ID0gU1RBUlRfS0VZO1xyXG5cdFx0XHJcblx0XHRmb3IgKGxldCBub3RlID0gTE9XRVNUX05PVEU7IG5vdGUgPCBISUdIRVNUX05PVEU7IG5vdGUrKykge1xyXG5cdFx0XHRpZiAoS0VZU1trZXldLmJsYWNrKSB7XHJcblx0XHRcdFx0bGV0IGNlbnRlciA9IHggKiB3aG9sZVRvbmVJbnRlcnZhbDtcclxuXHRcdFx0XHRsZXQgd2lkdGggPSB3aG9sZVRvbmVJbnRlcnZhbCAqIDAuNTtcclxuXHRcdFx0XHRsZXQgaGVpZ2h0ID0gS0VZX0xFTkdUSCAqIDAuNjI1O1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGNvbnRleHQuZmlsbFN0eWxlID0gXCIjMzMzXCI7XHJcblx0XHRcdFx0Y29udGV4dC5maWxsUmVjdChjZW50ZXIgLSB3aWR0aCAvIDIsIDAsIHdpZHRoLCBoZWlnaHQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHR4ICs9IEtFWVNba2V5XS5keDtcclxuXHRcdFx0aWYgKCsra2V5ID49IEtFWVMubGVuZ3RoKSB7XHJcblx0XHRcdFx0a2V5ID0gMDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufVxyXG4iLCJpbXBvcnQgRGVidWcgZnJvbSBcIi4uLy4uLy4uL3NyYy9mcmFtZXN5bnRoZXNpcy9EZWJ1Z1wiO1xyXG5pbXBvcnQgVmlydHVhbEtleWJvYXJkIGZyb20gXCIuL1ZpcnR1YWxLZXlib2FyZFwiO1xyXG5cclxubGV0IHN5bnRoZXNpemVyID0gbmV3IHN5bnRoZXNpc2pzLlN5bnRoZXNpemVyKHsgdmVyYm9zZTogdHJ1ZSB9KTtcclxuXHJcbmxldCB2aXJ0dWFsS2V5Ym9hcmQgPSBuZXcgVmlydHVhbEtleWJvYXJkKHN5bnRoZXNpemVyKTtcclxuXHJcbkRlYnVnLmxvZyhcIkluaXRpYWxpemluZyBXZWIgTUlESVwiKTtcclxuaWYgKG5hdmlnYXRvci5yZXF1ZXN0TUlESUFjY2Vzcykge1xyXG5cdG5hdmlnYXRvci5yZXF1ZXN0TUlESUFjY2VzcygvKnsgc3lzZXg6IHRydWUgfSovKS50aGVuKG9uTUlESVN1Y2Nlc3MsIG9uTUlESUZhaWx1cmUpO1xyXG59IGVsc2Uge1xyXG5cdERlYnVnLmxvZyhcImVycm9yOiBUaGlzIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBXZWIgTUlESSBBUEkuXCIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbk1JRElTdWNjZXNzKG1pZGlBY2Nlc3MpIHtcclxuXHRmb3IgKGxldCBpbnB1dCBvZiBtaWRpQWNjZXNzLmlucHV0cy52YWx1ZXMoKSkge1xyXG5cdFx0RGVidWcubG9nKGAgIE1JREkgSW5wdXQgIGlkOiAke2lucHV0LmlkfSBtYW51ZmFjdHVyZXI6ICR7aW5wdXQubWFudWZhY3R1cmVyfSBuYW1lOiAke2lucHV0Lm5hbWV9YCk7XHJcblxyXG5cdFx0aW5wdXQub25taWRpbWVzc2FnZSA9IG9uTUlESU1lc3NhZ2U7XHJcblx0fVxyXG5cclxuXHRmb3IgKGxldCBvdXRwdXQgb2YgbWlkaUFjY2Vzcy5vdXRwdXRzLnZhbHVlcygpKSB7XHJcblx0XHREZWJ1Zy5sb2coYCAgTUlESSBPdXRwdXQgaWQ6ICR7b3V0cHV0LmlkfSBtYW51ZmFjdHVyZXI6ICR7b3V0cHV0Lm1hbnVmYWN0dXJlcn0gbmFtZTogJHtvdXRwdXQubmFtZX1gKTtcclxuXHR9XHJcblx0XHJcblx0RGVidWcubG9nKFwiUmVhZHlcIik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uTUlESUZhaWx1cmUobWVzc2FnZSkge1xyXG5cdERlYnVnLmxvZyhcImVycm9yOiBDYW4ndCBpbml0aWFsaXplIFdlYiBNSURJOiBcIiArIG1lc3NhZ2UpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbk1JRElNZXNzYWdlKGV2ZW50KSB7XHJcblx0Ly8gbGV0IHMgPSBcIk1JREkgbWVzc2FnZSB0aW1lc3RhbXAgXCIgKyBldmVudC50aW1lU3RhbXAgKyBcIiA6IFwiO1xyXG5cdC8vIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnQuZGF0YS5sZW5ndGg7IGkrKykge1xyXG5cdC8vIFx0cyArPSBcIjB4XCIgKyBldmVudC5kYXRhW2ldLnRvU3RyaW5nKDE2KSArIFwiIFwiO1xyXG5cdC8vIH1cclxuXHRcclxuXHRzeW50aGVzaXplci5wcm9jZXNzTUlESU1lc3NhZ2UoZXZlbnQuZGF0YSk7XHJcbn1cclxuXHJcbmxldCBzbWZQbGF5ZXIgPSBuZXcgc3ludGhlc2lzanMuU01GUGxheWVyKHN5bnRoZXNpemVyKTtcclxuXHJcbmZ1bmN0aW9uIHBsYXlTTUYoKSB7XHJcblx0RGVidWcubG9nKFwiUGxheSB0ZXN0IFNNRlwiKTtcclxuXHRcclxuXHRsZXQgdGljayA9IDI0O1xyXG5cclxuXHRsZXQgc21mID0gbmV3IFVpbnQ4QXJyYXkoW1xyXG5cdFx0MHg0ZCwgMHg1NCwgMHg2OCwgMHg2NCxcclxuXHRcdDB4MDAsIDB4MDAsIDB4MDAsIDB4MDYsXHJcblx0XHQweDAwLCAweDAwLFxyXG5cdFx0MHgwMCwgMHgwMSxcclxuXHRcdDB4MDAsIDB4MzAsXHJcblx0XHQweDRkLCAweDU0LCAweDcyLCAweDZiLFxyXG5cdFx0MHgwMCwgMHgwMCwgMHgwMCwgNDYsXHJcblx0XHRcclxuXHRcdDAsIDB4ZmYsIDB4NTEsIDB4MDMsIDB4MDcsIDB4YTEsIDB4MjAsXHJcblx0XHJcblx0XHQwLCAweDlmLCA2MCwgOTYsIHRpY2ssIDB4OGYsIDYwLCAwLFxyXG5cdFx0MCwgMHg5ZiwgNjIsIDk2LCB0aWNrLCAweDhmLCA2MiwgMCxcclxuXHRcdDAsIDB4OWYsIDY0LCA5NiwgdGljaywgMHg4ZiwgNjQsIDAsXHJcblx0XHQwLCAweDlmLCA2NSwgOTYsIHRpY2ssIDB4OGYsIDY1LCAwLFxyXG5cdFx0MCwgMHg5ZiwgNjcsIDk2LCB0aWNrLCAweDhmLCA2NywgMF0pO1xyXG5cdFxyXG5cdHNtZlBsYXllci5wbGF5KHNtZik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0b3BTTUYoKSB7XHJcblx0RGVidWcubG9nKFwiU3RvcCBTTUZcIik7XHJcblx0XHJcblx0c21mUGxheWVyLnN0b3AoKTtcclxuXHRcclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcclxuXHRcdHN5bnRoZXNpemVyLnByb2Nlc3NNSURJTWVzc2FnZShbMHhiMCArIGksIDEyMywgMF0pO1xyXG5cdH1cclxufVxyXG5cclxuLy8gZXhwb3J0XHJcbndpbmRvdy5wbGF5U01GID0gcGxheVNNRjsgXHJcbndpbmRvdy5zdG9wU01GID0gc3RvcFNNRjtcclxuXHJcbmZ1bmN0aW9uIHBsYXlNTUwoKSB7XHJcblx0bGV0IG1tbDJzbWYgPSBuZXcgc3ludGhlc2lzanMuTU1MMlNNRigpO1xyXG5cdGxldCBtbWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm1tbFwiKS52YWx1ZTtcclxuXHREZWJ1Zy5sb2coXCJDb252ZXJ0IE1NTDogXCIgKyBtbWwpO1xyXG5cdHRyeSB7XHJcblx0XHRsZXQgc21mID0gbW1sMnNtZi5jb252ZXJ0KG1tbCk7XHJcblx0XHRsZXQgc3RhcnRUaWNrID0gbW1sMnNtZi5nZXRTdGFydFRpY2soKTtcclxuXHRcdERlYnVnLmxvZyhcIlBsYXkgU01GXCIpO1xyXG5cdFx0c21mUGxheWVyLnBsYXkoc21mLCBzdGFydFRpY2spO1xyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdERlYnVnLmxvZyhlLm1lc3NhZ2UpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gdHdlZXRNTUwoKSB7XHJcblx0bGV0IG1tbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibW1sXCIpLnZhbHVlO1xyXG5cdGxldCBtbWxVUkwgPSBcImh0dHA6Ly9mcmFtZXN5bnRoZXNpcy5jb20vZXhwZXJpbWVudHMvc3ludGhlc2lzLmpzLz9tbWw9XCIgKyBlbmNvZGVVUklDb21wb25lbnQobW1sKTtcclxuXHRcclxuXHRsZXQgdXJsID0gXCJodHRwczovL3R3aXR0ZXIuY29tL2ludGVudC90d2VldD9oYXNodGFncz1zeW50aGVzaXNqcyZ0ZXh0PVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KG1tbFVSTCk7XHJcblx0d2luZG93Lm9wZW4odXJsLCBcIl9ibGFua1wiKTtcclxufVxyXG5cclxud2luZG93LnBsYXlNTUwgPSBwbGF5TU1MO1xyXG53aW5kb3cudHdlZXRNTUwgPSB0d2VldE1NTDtcclxuXHJcbmZ1bmN0aW9uIHN5bnRoZXNpemVyUmVzZXQoKSB7XHJcblx0c3ludGhlc2l6ZXIucmVzZXQoKTtcclxufVxyXG5cclxud2luZG93LnN5bnRoZXNpemVyUmVzZXQgPSBzeW50aGVzaXplclJlc2V0O1xyXG5cclxuLy8gc2V0IE1NTCBmcm9tIHF1ZXJ5IHN0cmluZ1xyXG5pZiAobG9jYXRpb24uc2VhcmNoLnN0YXJ0c1dpdGgoXCI/bW1sPVwiKSkge1xyXG5cdGxldCBtbWwgPSBkZWNvZGVVUklDb21wb25lbnQobG9jYXRpb24uc2VhcmNoLnN1YnN0cmluZyg1KSk7XHJcblx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJtbWxcIikudmFsdWUgPSBtbWw7XHJcbn1cclxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgRGVidWcge1xyXG5cdHN0YXRpYyBjbGVhcigpIHtcclxuXHRcdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZGVidWdcIikuaW5uZXJIVE1MID0gXCJcIjtcclxuXHR9XHJcblx0XHJcblx0c3RhdGljIGxvZyhtZXNzYWdlKSB7XHJcblx0XHRsZXQgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZGVidWdcIik7XHJcblx0XHRpZiAoZWxlbWVudCkge1xyXG5cdFx0XHRsZXQgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHRcdFx0bGV0IHRleHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShtZXNzYWdlKTtcclxuXHRcdFx0ZGl2LmFwcGVuZENoaWxkKHRleHQpO1xyXG5cdFx0XHRcclxuXHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChkaXYpO1xyXG5cdFx0XHR3aGlsZSAoZWxlbWVudC5zY3JvbGxIZWlnaHQgPiBlbGVtZW50LmNsaWVudEhlaWdodCkge1xyXG5cdFx0XHRcdGVsZW1lbnQucmVtb3ZlQ2hpbGQoZWxlbWVudC5maXJzdENoaWxkKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufVxyXG4iXX0=
