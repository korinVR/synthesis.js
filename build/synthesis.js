(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.synthesisjs = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports["default"] = mml2smf;

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _parserParser = require("../parser/parser");

var parser = _interopRequireWildcard(_parserParser);

function mml2smf(mml, opts) {
    var startTick = 0;
    var timebase = 480;

    if (opts && opts.timebase) {
        timebase = opts.timebase;
    }

    var trackDataArray = [];

    var tracks = parser.parse(mml + ";");
    // console.dir(tracks);

    var channel = 0;
    for (var i = 0; i < tracks.length; i++) {
        trackDataArray.push(createTrackData(tracks[i]));
        channel++;

        if (channel > 15) {
            throw new Error("Exceeded maximum MIDI channel (16)");
        }
    }

    var format = tracks.length > 1 ? 1 : 0;

    var smf = [0x4d, 0x54, 0x68, 0x64];

    function write2bytes(value) {
        smf.push(value >> 8 & 0xff, value & 0xff);
    }

    function write4bytes(value) {
        smf.push(value >> 24 & 0xff, value >> 16 & 0xff, value >> 8 & 0xff, value & 0xff);
    }

    write4bytes(6);
    write2bytes(format);
    write2bytes(tracks.length);
    write2bytes(timebase);

    for (var i = 0; i < tracks.length; i++) {
        smf.push(0x4d, 0x54, 0x72, 0x6b);
        write4bytes(trackDataArray[i].length);
        smf = smf.concat(trackDataArray[i]);
    }

    if (opts) {
        opts.startTick = startTick;
    }

    return new Uint8Array(smf);

    function createTrackData(tokens) {
        var trackData = [];
        var baseLength = timebase;

        var currentTick = 0;

        var restTick = 0;

        var OCTAVE_MIN = -1;
        var OCTAVE_MAX = 10;
        var octave = 4;

        var velocity = 100;

        var q = 6;
        var keyShift = 0;

        var p = 0;

        function write() {
            for (var _len = arguments.length, data = Array(_len), _key = 0; _key < _len; _key++) {
                data[_key] = arguments[_key];
            }

            trackData = trackData.concat(data);
        }

        function error(message) {
            throw new Error("" + message);
        }

        function calcNoteLength(length, numDots) {
            var noteLength = baseLength;
            if (length) {
                noteLength = timebase * 4 / length;
            }

            var dottedTime = noteLength;
            for (var i = 0; i < numDots; i++) {
                dottedTime /= 2;
                noteLength += dottedTime;
            }
            return noteLength;
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
                write(b);
            }
        }

        while (p < tokens.length) {
            var token = tokens[p];
            // console.dir(token);

            switch (token.command) {
                case "note":
                    {
                        var abcdefg = [9, 11, 0, 2, 4, 5, 7];
                        var n = "abcdefg".indexOf(token.tone);

                        var note = (octave + 1) * 12 + abcdefg[n] + keyShift;

                        for (var i = 0; i < token.accidentals.length; i++) {
                            if (token.accidentals[i] === "+") {
                                note++;
                            }
                            if (token.accidentals[i] === "-") {
                                note--;
                            }
                        }

                        if (note < 0 || note > 127) {
                            error("illegal note number (0-127)");
                        }

                        var _stepTime = calcNoteLength(token.length, token.dots.length);
                        while (tokens[p + 1] && tokens[p + 1].command === "tie") {
                            p++;
                            _stepTime += calcNoteLength(tokens[p].length, tokens[p].dots.length);
                        }

                        var gateTime = Math.round(_stepTime * q / 8);

                        writeDeltaTick(restTick);
                        write(0x90 | channel, note, velocity);
                        writeDeltaTick(gateTime);
                        write(0x80 | channel, note, 0);
                        restTick = _stepTime - gateTime;

                        currentTick += _stepTime;
                        break;
                    }
                case "rest":
                    var stepTime = calcNoteLength(token.length, token.dots.length);

                    restTick += stepTime;
                    currentTick += stepTime;
                    break;

                case "octave":
                    octave = token.number;
                    break;

                case "octave_up":
                    octave++;
                    break;

                case "octave_down":
                    octave--;
                    break;

                case "note_length":
                    baseLength = calcNoteLength(token.length, token.dots.length);
                    break;

                case "gate_time":
                    q = token.quantity;
                    break;

                case "velocity":
                    velocity = token.value;
                    break;

                case "volume":
                    writeDeltaTick(restTick);
                    write(0xb0 | channel, 7, token.value);
                    break;

                case "pan":
                    writeDeltaTick(restTick);
                    write(0xb0 | channel, 10, token.value + 64);
                    break;

                case "expression":
                    writeDeltaTick(restTick);
                    write(0xb0 | channel, 11, token.value);
                    break;

                case "control_change":
                    writeDeltaTick(restTick);
                    write(0xb0 | channel, token.number, token.value);
                    break;

                case "program_change":
                    writeDeltaTick(restTick);
                    write(0xc0 | channel, token.number);
                    break;

                case "channel_aftertouch":
                    writeDeltaTick(restTick);
                    write(0xd0 | channel, token.value);
                    break;

                case "tempo":
                    {
                        var quarterMicroseconds = 60 * 1000 * 1000 / token.value;
                        if (quarterMicroseconds < 1 || quarterMicroseconds > 0xffffff) {
                            error("illegal tempo");
                        }

                        writeDeltaTick(restTick);
                        write(0xff, 0x51, 0x03, quarterMicroseconds >> 16 & 0xff, quarterMicroseconds >> 8 & 0xff, quarterMicroseconds & 0xff);
                        break;
                    }

                case "start_point":
                    {
                        startTick = currentTick;
                        break;
                    }

                case "key_shift":
                    {
                        keyShift = token.value;
                        break;
                    }

                case "set_midi_channel":
                    {
                        channel = token.channel - 1;
                        break;
                    }
            }

            if (octave < OCTAVE_MIN || octave > OCTAVE_MAX) {
                error("octave is out of range");
            }

            p++;
        }

        return trackData;
    }
}

module.exports = exports["default"];
},{"../parser/parser":2}],2:[function(require,module,exports){
module.exports = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleFunctions = { start: peg$parsestart },
        peg$startRuleFunction  = peg$parsestart,

        peg$c0 = [],
        peg$c1 = peg$FAILED,
        peg$c2 = function(commands) { return commands; },
        peg$c3 = ";",
        peg$c4 = { type: "literal", value: ";", description: "\";\"" },
        peg$c5 = function() { return null; },
        peg$c6 = /^[ \t\r\n]/,
        peg$c7 = { type: "class", value: "[ \\t\\r\\n]", description: "[ \\t\\r\\n]" },
        peg$c8 = "/*",
        peg$c9 = { type: "literal", value: "/*", description: "\"/*\"" },
        peg$c10 = void 0,
        peg$c11 = "*/",
        peg$c12 = { type: "literal", value: "*/", description: "\"*/\"" },
        peg$c13 = { type: "any", description: "any character" },
        peg$c14 = function() { return { command: "comment" }; },
        peg$c15 = "//",
        peg$c16 = { type: "literal", value: "//", description: "\"//\"" },
        peg$c17 = /^[^\n]/,
        peg$c18 = { type: "class", value: "[^\\n]", description: "[^\\n]" },
        peg$c19 = /^[cdefgab]/,
        peg$c20 = { type: "class", value: "[cdefgab]", description: "[cdefgab]" },
        peg$c21 = /^[\-+]/,
        peg$c22 = { type: "class", value: "[\\-+]", description: "[\\-+]" },
        peg$c23 = /^[0-9]/,
        peg$c24 = { type: "class", value: "[0-9]", description: "[0-9]" },
        peg$c25 = ".",
        peg$c26 = { type: "literal", value: ".", description: "\".\"" },
        peg$c27 = function(tone, accidentals, length, dots) { return { command: "note", tone: tone, accidentals: accidentals, length: +length, dots: dots }; },
        peg$c28 = "^",
        peg$c29 = { type: "literal", value: "^", description: "\"^\"" },
        peg$c30 = function(length, dots) { return { command: "tie", length: +length, dots: dots }; },
        peg$c31 = "r",
        peg$c32 = { type: "literal", value: "r", description: "\"r\"" },
        peg$c33 = function(length, dots) { return { command: "rest", length: +length, dots: dots }; },
        peg$c34 = "o",
        peg$c35 = { type: "literal", value: "o", description: "\"o\"" },
        peg$c36 = null,
        peg$c37 = "-",
        peg$c38 = { type: "literal", value: "-", description: "\"-\"" },
        peg$c39 = function(number) {
                if (number < -1 || number > 10) {
                    error("octave number is out of range");
                }
                return {
                    command: "octave",
                    number: +number,
                    line: line(),
                    column: column()
                };
            },
        peg$c40 = "<",
        peg$c41 = { type: "literal", value: "<", description: "\"<\"" },
        peg$c42 = function() { return { command: "octave_up" }; },
        peg$c43 = ">",
        peg$c44 = { type: "literal", value: ">", description: "\">\"" },
        peg$c45 = function() { return { command: "octave_down" }; },
        peg$c46 = "l",
        peg$c47 = { type: "literal", value: "l", description: "\"l\"" },
        peg$c48 = function(length, dots) { return { command: "note_length", length: +length, dots: dots }; },
        peg$c49 = "q",
        peg$c50 = { type: "literal", value: "q", description: "\"q\"" },
        peg$c51 = /^[1-8]/,
        peg$c52 = { type: "class", value: "[1-8]", description: "[1-8]" },
        peg$c53 = function(quantity) { return { command: "gate_time", quantity: +quantity }; },
        peg$c54 = "u",
        peg$c55 = { type: "literal", value: "u", description: "\"u\"" },
        peg$c56 = function(value) {
                value = +value;
                if (value < 0 || value > 127) {
                    error("velocity is out of range (0-127)");
                }
                return { command: "velocity", value: value };
            },
        peg$c57 = "v",
        peg$c58 = { type: "literal", value: "v", description: "\"v\"" },
        peg$c59 = function(value) {
                value = +value;
                if (value < 0 || value > 127) {
                    error("volume is out of range (0-127)");
                }
                return { command: "volume", value: value };
            },
        peg$c60 = "p",
        peg$c61 = { type: "literal", value: "p", description: "\"p\"" },
        peg$c62 = function(value) {
                value = +value;
                if (value < -64 || value > 63) {
                    error("pan is out of range (-64-63)");
                }
                return { command: "pan", value: value };
            },
        peg$c63 = "E",
        peg$c64 = { type: "literal", value: "E", description: "\"E\"" },
        peg$c65 = function(value) {
                value = +value;
                if (value < 0 || value > 127) {
                    error("expression is out of range (0-127)");
                }
                return { command: "expression", value: value };
            },
        peg$c66 = "B",
        peg$c67 = { type: "literal", value: "B", description: "\"B\"" },
        peg$c68 = function(number, value) {
                if (number < 0 || number > 119) {
                    error("control number is out of range (0-127)");
                }
                if (value < 0 || value > 127) {
                    error("control value is out of range (0-127)");
                }
                return { command: "control_change", number: number, value: value };
            },
        peg$c69 = "@",
        peg$c70 = { type: "literal", value: "@", description: "\"@\"" },
        peg$c71 = function(number) {
                number = +number;
                if (number < 0 || number > 127) {
                    error("program number is out of range (0-127)");
                }
                return { command: "program_change", number: number };
            },
        peg$c72 = "D",
        peg$c73 = { type: "literal", value: "D", description: "\"D\"" },
        peg$c74 = function(value) {
                value = +value;
                if (value < 0 || value > 127) {
                    error("channel aftertouch is out of range (0-127)");
                }
                return { command: "channel_aftertouch", value: value };
            },
        peg$c75 = "t",
        peg$c76 = { type: "literal", value: "t", description: "\"t\"" },
        peg$c77 = function(value) { return { command: "tempo", value: +value }; },
        peg$c78 = "?",
        peg$c79 = { type: "literal", value: "?", description: "\"?\"" },
        peg$c80 = function() { return { command: "start_point" }; },
        peg$c81 = "k",
        peg$c82 = { type: "literal", value: "k", description: "\"k\"" },
        peg$c83 = function(value) {
                value = +value;
                if (value < -127 || value > 127) {
                    error("key shift is out of range (-127-127)");
                } 
                return { command: "key_shift", value: value };
            },
        peg$c84 = "C",
        peg$c85 = { type: "literal", value: "C", description: "\"C\"" },
        peg$c86 = function(channel) {
                channel = +channel;
                if (channel < 1 || channel > 16) {
                    error("MIDI channel is out of range (1-16)");
                }
                return { command: "set_midi_channel", channel: channel };
            },

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$parsestart() {
      var s0, s1;

      s0 = [];
      s1 = peg$parsetrack();
      if (s1 !== peg$FAILED) {
        while (s1 !== peg$FAILED) {
          s0.push(s1);
          s1 = peg$parsetrack();
        }
      } else {
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsetrack() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parsecommand();
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsecommand();
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsenext_track();
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c2(s1);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsenext_track() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 59) {
          s2 = peg$c3;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c4); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c5();
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parse_() {
      var s0, s1;

      s0 = [];
      if (peg$c6.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c7); }
      }
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        if (peg$c6.test(input.charAt(peg$currPos))) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c7); }
        }
      }

      return s0;
    }

    function peg$parsecommand() {
      var s0, s1, s2;

      s0 = peg$parsecomment();
      if (s0 === peg$FAILED) {
        s0 = peg$parsenote();
        if (s0 === peg$FAILED) {
          s0 = peg$parsetie();
          if (s0 === peg$FAILED) {
            s0 = peg$parserest();
            if (s0 === peg$FAILED) {
              s0 = peg$parseoctave();
              if (s0 === peg$FAILED) {
                s0 = peg$parseoctave_up();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseoctave_down();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parsenote_length();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parsegate_time();
                      if (s0 === peg$FAILED) {
                        s0 = peg$parsevelocity();
                        if (s0 === peg$FAILED) {
                          s0 = peg$parsevolume();
                          if (s0 === peg$FAILED) {
                            s0 = peg$parsepan();
                            if (s0 === peg$FAILED) {
                              s0 = peg$parseexpression();
                              if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                s1 = peg$parsecontrol_change();
                                if (s1 !== peg$FAILED) {
                                  s2 = peg$parseprogram_change();
                                  if (s2 !== peg$FAILED) {
                                    s1 = [s1, s2];
                                    s0 = s1;
                                  } else {
                                    peg$currPos = s0;
                                    s0 = peg$c1;
                                  }
                                } else {
                                  peg$currPos = s0;
                                  s0 = peg$c1;
                                }
                                if (s0 === peg$FAILED) {
                                  s0 = peg$parsechannel_aftertouch();
                                  if (s0 === peg$FAILED) {
                                    s0 = peg$parsetempo();
                                    if (s0 === peg$FAILED) {
                                      s0 = peg$parsestart_point();
                                      if (s0 === peg$FAILED) {
                                        s0 = peg$parsekey_shift();
                                        if (s0 === peg$FAILED) {
                                          s0 = peg$parseset_midi_channel();
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      return s0;
    }

    function peg$parsecomment() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c8) {
          s2 = peg$c8;
          peg$currPos += 2;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c9); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$currPos;
          s4 = [];
          s5 = peg$currPos;
          s6 = peg$currPos;
          peg$silentFails++;
          if (input.substr(peg$currPos, 2) === peg$c11) {
            s7 = peg$c11;
            peg$currPos += 2;
          } else {
            s7 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c12); }
          }
          peg$silentFails--;
          if (s7 === peg$FAILED) {
            s6 = peg$c10;
          } else {
            peg$currPos = s6;
            s6 = peg$c1;
          }
          if (s6 !== peg$FAILED) {
            if (input.length > peg$currPos) {
              s7 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c13); }
            }
            if (s7 !== peg$FAILED) {
              s6 = [s6, s7];
              s5 = s6;
            } else {
              peg$currPos = s5;
              s5 = peg$c1;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$c1;
          }
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$currPos;
            s6 = peg$currPos;
            peg$silentFails++;
            if (input.substr(peg$currPos, 2) === peg$c11) {
              s7 = peg$c11;
              peg$currPos += 2;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c12); }
            }
            peg$silentFails--;
            if (s7 === peg$FAILED) {
              s6 = peg$c10;
            } else {
              peg$currPos = s6;
              s6 = peg$c1;
            }
            if (s6 !== peg$FAILED) {
              if (input.length > peg$currPos) {
                s7 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s7 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c13); }
              }
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$c1;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$c1;
            }
          }
          if (s4 !== peg$FAILED) {
            s4 = input.substring(s3, peg$currPos);
          }
          s3 = s4;
          if (s3 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c11) {
              s4 = peg$c11;
              peg$currPos += 2;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c12); }
            }
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c14();
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parse_();
        if (s1 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c15) {
            s2 = peg$c15;
            peg$currPos += 2;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c16); }
          }
          if (s2 !== peg$FAILED) {
            s3 = [];
            if (peg$c17.test(input.charAt(peg$currPos))) {
              s4 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c18); }
            }
            while (s4 !== peg$FAILED) {
              s3.push(s4);
              if (peg$c17.test(input.charAt(peg$currPos))) {
                s4 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s4 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c18); }
              }
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parse_();
              if (s4 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c14();
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      }

      return s0;
    }

    function peg$parsenote() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (peg$c19.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c20); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = [];
            if (peg$c21.test(input.charAt(peg$currPos))) {
              s5 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c22); }
            }
            while (s5 !== peg$FAILED) {
              s4.push(s5);
              if (peg$c21.test(input.charAt(peg$currPos))) {
                s5 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c22); }
              }
            }
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                s6 = peg$currPos;
                s7 = [];
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s8 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s8 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
                while (s8 !== peg$FAILED) {
                  s7.push(s8);
                  if (peg$c23.test(input.charAt(peg$currPos))) {
                    s8 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s8 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c24); }
                  }
                }
                if (s7 !== peg$FAILED) {
                  s7 = input.substring(s6, peg$currPos);
                }
                s6 = s7;
                if (s6 !== peg$FAILED) {
                  s7 = peg$parse_();
                  if (s7 !== peg$FAILED) {
                    s8 = [];
                    if (input.charCodeAt(peg$currPos) === 46) {
                      s9 = peg$c25;
                      peg$currPos++;
                    } else {
                      s9 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c26); }
                    }
                    while (s9 !== peg$FAILED) {
                      s8.push(s9);
                      if (input.charCodeAt(peg$currPos) === 46) {
                        s9 = peg$c25;
                        peg$currPos++;
                      } else {
                        s9 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c26); }
                      }
                    }
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parse_();
                      if (s9 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c27(s2, s4, s6, s8);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsetie() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 94) {
          s2 = peg$c28;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c29); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              if (peg$c23.test(input.charAt(peg$currPos))) {
                s6 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c24); }
              }
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                s6 = [];
                if (input.charCodeAt(peg$currPos) === 46) {
                  s7 = peg$c25;
                  peg$currPos++;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c26); }
                }
                while (s7 !== peg$FAILED) {
                  s6.push(s7);
                  if (input.charCodeAt(peg$currPos) === 46) {
                    s7 = peg$c25;
                    peg$currPos++;
                  } else {
                    s7 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c26); }
                  }
                }
                if (s6 !== peg$FAILED) {
                  s7 = peg$parse_();
                  if (s7 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c30(s4, s6);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parserest() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 114) {
          s2 = peg$c31;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c32); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              if (peg$c23.test(input.charAt(peg$currPos))) {
                s6 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c24); }
              }
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                s6 = [];
                if (input.charCodeAt(peg$currPos) === 46) {
                  s7 = peg$c25;
                  peg$currPos++;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c26); }
                }
                while (s7 !== peg$FAILED) {
                  s6.push(s7);
                  if (input.charCodeAt(peg$currPos) === 46) {
                    s7 = peg$c25;
                    peg$currPos++;
                  } else {
                    s7 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c26); }
                  }
                }
                if (s6 !== peg$FAILED) {
                  s7 = peg$parse_();
                  if (s7 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c33(s4, s6);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parseoctave() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 111) {
          s2 = peg$c34;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c35); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 45) {
              s6 = peg$c37;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c38); }
            }
            if (s6 === peg$FAILED) {
              s6 = peg$c36;
            }
            if (s6 !== peg$FAILED) {
              s7 = [];
              if (peg$c23.test(input.charAt(peg$currPos))) {
                s8 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s8 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c24); }
              }
              if (s8 !== peg$FAILED) {
                while (s8 !== peg$FAILED) {
                  s7.push(s8);
                  if (peg$c23.test(input.charAt(peg$currPos))) {
                    s8 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s8 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c24); }
                  }
                }
              } else {
                s7 = peg$c1;
              }
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$c1;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c39(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parseoctave_up() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 60) {
          s2 = peg$c40;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c41); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c42();
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parseoctave_down() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 62) {
          s2 = peg$c43;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c44); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c45();
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsenote_length() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 108) {
          s2 = peg$c46;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c47); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
              }
            } else {
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                s6 = [];
                if (input.charCodeAt(peg$currPos) === 46) {
                  s7 = peg$c25;
                  peg$currPos++;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c26); }
                }
                while (s7 !== peg$FAILED) {
                  s6.push(s7);
                  if (input.charCodeAt(peg$currPos) === 46) {
                    s7 = peg$c25;
                    peg$currPos++;
                  } else {
                    s7 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c26); }
                  }
                }
                if (s6 !== peg$FAILED) {
                  s7 = peg$parse_();
                  if (s7 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c48(s4, s6);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsegate_time() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 113) {
          s2 = peg$c49;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c50); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            if (peg$c51.test(input.charAt(peg$currPos))) {
              s4 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c52); }
            }
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c53(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsevelocity() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 117) {
          s2 = peg$c54;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c55); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
              }
            } else {
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c56(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsevolume() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 118) {
          s2 = peg$c57;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c58); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
              }
            } else {
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c59(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsepan() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 112) {
          s2 = peg$c60;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c61); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 45) {
              s6 = peg$c37;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c38); }
            }
            if (s6 === peg$FAILED) {
              s6 = peg$c36;
            }
            if (s6 !== peg$FAILED) {
              s7 = [];
              if (peg$c23.test(input.charAt(peg$currPos))) {
                s8 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s8 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c24); }
              }
              if (s8 !== peg$FAILED) {
                while (s8 !== peg$FAILED) {
                  s7.push(s8);
                  if (peg$c23.test(input.charAt(peg$currPos))) {
                    s8 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s8 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c24); }
                  }
                }
              } else {
                s7 = peg$c1;
              }
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$c1;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c62(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parseexpression() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 69) {
          s2 = peg$c63;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c64); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
              }
            } else {
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c65(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsecontrol_change() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 66) {
          s2 = peg$c66;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c67); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
              }
            } else {
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                s6 = peg$currPos;
                s7 = [];
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s8 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s8 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
                if (s8 !== peg$FAILED) {
                  while (s8 !== peg$FAILED) {
                    s7.push(s8);
                    if (peg$c23.test(input.charAt(peg$currPos))) {
                      s8 = input.charAt(peg$currPos);
                      peg$currPos++;
                    } else {
                      s8 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c24); }
                    }
                  }
                } else {
                  s7 = peg$c1;
                }
                if (s7 !== peg$FAILED) {
                  s7 = input.substring(s6, peg$currPos);
                }
                s6 = s7;
                if (s6 !== peg$FAILED) {
                  s7 = peg$parse_();
                  if (s7 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c68(s4, s6);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parseprogram_change() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 64) {
          s2 = peg$c69;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c70); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
              }
            } else {
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c71(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsechannel_aftertouch() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 68) {
          s2 = peg$c72;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c73); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
              }
            } else {
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c74(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsetempo() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 116) {
          s2 = peg$c75;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c76); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
              }
            } else {
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c77(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsestart_point() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 63) {
          s2 = peg$c78;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c79); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c80();
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parsekey_shift() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 107) {
          s2 = peg$c81;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c82); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 45) {
              s6 = peg$c37;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c38); }
            }
            if (s6 === peg$FAILED) {
              s6 = peg$c36;
            }
            if (s6 !== peg$FAILED) {
              s7 = [];
              if (peg$c23.test(input.charAt(peg$currPos))) {
                s8 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s8 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c24); }
              }
              if (s8 !== peg$FAILED) {
                while (s8 !== peg$FAILED) {
                  s7.push(s8);
                  if (peg$c23.test(input.charAt(peg$currPos))) {
                    s8 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s8 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c24); }
                  }
                }
              } else {
                s7 = peg$c1;
              }
              if (s7 !== peg$FAILED) {
                s6 = [s6, s7];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$c1;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c83(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parseset_midi_channel() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 67) {
          s2 = peg$c84;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c85); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            s5 = [];
            if (peg$c23.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c24); }
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                if (peg$c23.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c24); }
                }
              }
            } else {
              s5 = peg$c1;
            }
            if (s5 !== peg$FAILED) {
              s5 = input.substring(s4, peg$currPos);
            }
            s4 = s5;
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c86(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();

},{}],3:[function(require,module,exports){
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

},{"./framesynthesis/Debug":8}],4:[function(require,module,exports){
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
		key: "programChange",
		value: function programChange(programNumber) {}
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

},{"./Voice":7,"./framesynthesis/MyMath":9}],5:[function(require,module,exports){
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
				var statusUpper4bits = statusByte >> 4;

				// meta event
				if (statusByte === 0xff) {
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
				}

				// system exclusive message
				if (statusByte === 0xf0) {
					var systemExclusive = [statusByte];

					while (true) {
						if (this.pos >= this.endPos) {
							throw Error("illegal system exlusive message");
						}

						var byte = this.readByte();
						if (byte === 0xf7) {
							break;
						}
						systemExclusive.push(byte);
					}
					this.player.synthesizer.processMIDIMessage(systemExclusive);
				}

				// skip unsupported 2 bytes messages
				if (statusByte === 0xf1 || statusByte === 0xf2 || statusByte === 0xf3) {
					this.readByte();
				}

				switch (statusUpper4bits) {
					// 3 bytes message
					case 0x8:
					case 0x9:
					case 0xa:
					case 0xb:
					case 0xe:
						{
							var dataByte1 = this.readByte();
							var dataByte2 = this.readByte();

							if (seeking && (statusUpper4bits === 0x8 || statusUpper4bits === 0x9)) {} else {
								this.player.synthesizer.processMIDIMessage([statusByte, dataByte1, dataByte2]);
							}
							break;
						}
					// 2 bytes message
					case 0xc:
					case 0xd:
						{
							var dataByte1 = this.readByte();
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

			for (var i = 0; i < this.tracks.length; i++) {
				this.tracks[i].update(this.currentTick, seeking);
			}

			// stop when all tracks finish
			var playingTrack = 0;
			for (var i = 0; i < this.tracks.length; i++) {
				if (this.tracks[i].finished === false) {
					playingTrack++;
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

// skip note on/off when seeking

},{}],6:[function(require,module,exports){
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

			// avoid iOS audio restriction
			this.createAudioManager();

			var statusByte = data[0];
			if (!statusByte) {
				return;
			}

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

			if (statusUpper4bits === 0xc) {
				var programNumber = data[1];

				this.log("Ch. " + midiChannel + " Program Change: " + programNumber);
				this.channels[channel].programChange(programNumber);
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

},{"./AudioManager":3,"./Channel":4,"./framesynthesis/Debug":8,"./framesynthesis/Platform":10}],7:[function(require,module,exports){
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

},{"./oscillators/SquareOscillator":12,"./oscillators/TriangleOscillator":13}],8:[function(require,module,exports){
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
			if (typeof document === "undefined") {
				return;
			}

			document.getElementById("debug").innerHTML = "";
		}
	}, {
		key: "log",
		value: function log(message) {
			if (typeof document === "undefined") {
				return;
			}

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

},{}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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
			if (typeof document === "undefined") {
				return false;
			}

			return window.navigator.userAgent.indexOf("iPhone") >= 0;
		}
	}, {
		key: "isiPad",
		value: function isiPad() {
			if (typeof document === "undefined") {
				return false;
			}

			return window.navigator.userAgent.indexOf("iPad") >= 0;
		}
	}]);

	return Platform;
})();

exports["default"] = Platform;
module.exports = exports["default"];

},{}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _interopRequire(obj) { return obj && obj.__esModule ? obj["default"] : obj; }

var _mml2smf = require("mml2smf");

exports.mml2smf = _interopRequire(_mml2smf);

var _Synthesizer = require("./Synthesizer");

exports.Synthesizer = _interopRequire(_Synthesizer);

var _SMFPlayer = require("./SMFPlayer");

exports.SMFPlayer = _interopRequire(_SMFPlayer);

},{"./SMFPlayer":5,"./Synthesizer":6,"mml2smf":1}],12:[function(require,module,exports){
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

},{"../framesynthesis/MyMath":9}],13:[function(require,module,exports){
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

},{"../framesynthesis/MyMath":9}]},{},[11])(11)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImM6L1VzZXJzL2thdHN1XzAwMC9BcHBEYXRhL1JvYW1pbmcvbnBtL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL21tbDJzbWYvZXM1L21tbDJzbWYuanMiLCJub2RlX21vZHVsZXMvbW1sMnNtZi9wYXJzZXIvcGFyc2VyLmpzIiwiRDovUHJvamVjdHMvSFRNTDUvc3ludGhlc2lzLmpzL3NyYy9BdWRpb01hbmFnZXIuanMiLCJEOi9Qcm9qZWN0cy9IVE1MNS9zeW50aGVzaXMuanMvc3JjL0NoYW5uZWwuanMiLCJEOi9Qcm9qZWN0cy9IVE1MNS9zeW50aGVzaXMuanMvc3JjL1NNRlBsYXllci5qcyIsIkQ6L1Byb2plY3RzL0hUTUw1L3N5bnRoZXNpcy5qcy9zcmMvU3ludGhlc2l6ZXIuanMiLCJEOi9Qcm9qZWN0cy9IVE1MNS9zeW50aGVzaXMuanMvc3JjL1ZvaWNlLmpzIiwiRDovUHJvamVjdHMvSFRNTDUvc3ludGhlc2lzLmpzL3NyYy9mcmFtZXN5bnRoZXNpcy9EZWJ1Zy5qcyIsIkQ6L1Byb2plY3RzL0hUTUw1L3N5bnRoZXNpcy5qcy9zcmMvZnJhbWVzeW50aGVzaXMvTXlNYXRoLmpzIiwiRDovUHJvamVjdHMvSFRNTDUvc3ludGhlc2lzLmpzL3NyYy9mcmFtZXN5bnRoZXNpcy9QbGF0Zm9ybS5qcyIsIkQ6L1Byb2plY3RzL0hUTUw1L3N5bnRoZXNpcy5qcy9zcmMvbWFpbi5qcyIsIkQ6L1Byb2plY3RzL0hUTUw1L3N5bnRoZXNpcy5qcy9zcmMvb3NjaWxsYXRvcnMvU3F1YXJlT3NjaWxsYXRvci5qcyIsIkQ6L1Byb2plY3RzL0hUTUw1L3N5bnRoZXNpcy5qcy9zcmMvb3NjaWxsYXRvcnMvVHJpYW5nbGVPc2NpbGxhdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7O21DQ3hyRWtCLHdCQUF3Qjs7OztJQUVyQixZQUFZO0FBQ3JCLFVBRFMsWUFBWSxDQUNwQixX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LGtDQUFPLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7O0lBRTFDO0FBQ0QsT0FBSSxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQ2IsV0FBTyxrQ0FBTyxTQUFTLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUM7QUFDRCxVQUFPLGtDQUFPLFNBQVMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztHQUMzQzs7O1FBWm1CLGtCQUFrQjs7O3FCQUFsQixrQkFBa0IiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gbW1sMnNtZjtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQob2JqKSB7IGlmIChvYmogJiYgb2JqLl9fZXNNb2R1bGUpIHsgcmV0dXJuIG9iajsgfSBlbHNlIHsgdmFyIG5ld09iaiA9IHt9OyBpZiAob2JqICE9IG51bGwpIHsgZm9yICh2YXIga2V5IGluIG9iaikgeyBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkgbmV3T2JqW2tleV0gPSBvYmpba2V5XTsgfSB9IG5ld09ialtcImRlZmF1bHRcIl0gPSBvYmo7IHJldHVybiBuZXdPYmo7IH0gfVxuXG52YXIgX3BhcnNlclBhcnNlciA9IHJlcXVpcmUoXCIuLi9wYXJzZXIvcGFyc2VyXCIpO1xuXG52YXIgcGFyc2VyID0gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQoX3BhcnNlclBhcnNlcik7XG5cbmZ1bmN0aW9uIG1tbDJzbWYobW1sLCBvcHRzKSB7XG4gICAgdmFyIHN0YXJ0VGljayA9IDA7XG4gICAgdmFyIHRpbWViYXNlID0gNDgwO1xuXG4gICAgaWYgKG9wdHMgJiYgb3B0cy50aW1lYmFzZSkge1xuICAgICAgICB0aW1lYmFzZSA9IG9wdHMudGltZWJhc2U7XG4gICAgfVxuXG4gICAgdmFyIHRyYWNrRGF0YUFycmF5ID0gW107XG5cbiAgICB2YXIgdHJhY2tzID0gcGFyc2VyLnBhcnNlKG1tbCArIFwiO1wiKTtcbiAgICAvLyBjb25zb2xlLmRpcih0cmFja3MpO1xuXG4gICAgdmFyIGNoYW5uZWwgPSAwO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRyYWNrRGF0YUFycmF5LnB1c2goY3JlYXRlVHJhY2tEYXRhKHRyYWNrc1tpXSkpO1xuICAgICAgICBjaGFubmVsKys7XG5cbiAgICAgICAgaWYgKGNoYW5uZWwgPiAxNSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXhjZWVkZWQgbWF4aW11bSBNSURJIGNoYW5uZWwgKDE2KVwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBmb3JtYXQgPSB0cmFja3MubGVuZ3RoID4gMSA/IDEgOiAwO1xuXG4gICAgdmFyIHNtZiA9IFsweDRkLCAweDU0LCAweDY4LCAweDY0XTtcblxuICAgIGZ1bmN0aW9uIHdyaXRlMmJ5dGVzKHZhbHVlKSB7XG4gICAgICAgIHNtZi5wdXNoKHZhbHVlID4+IDggJiAweGZmLCB2YWx1ZSAmIDB4ZmYpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHdyaXRlNGJ5dGVzKHZhbHVlKSB7XG4gICAgICAgIHNtZi5wdXNoKHZhbHVlID4+IDI0ICYgMHhmZiwgdmFsdWUgPj4gMTYgJiAweGZmLCB2YWx1ZSA+PiA4ICYgMHhmZiwgdmFsdWUgJiAweGZmKTtcbiAgICB9XG5cbiAgICB3cml0ZTRieXRlcyg2KTtcbiAgICB3cml0ZTJieXRlcyhmb3JtYXQpO1xuICAgIHdyaXRlMmJ5dGVzKHRyYWNrcy5sZW5ndGgpO1xuICAgIHdyaXRlMmJ5dGVzKHRpbWViYXNlKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdHJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHNtZi5wdXNoKDB4NGQsIDB4NTQsIDB4NzIsIDB4NmIpO1xuICAgICAgICB3cml0ZTRieXRlcyh0cmFja0RhdGFBcnJheVtpXS5sZW5ndGgpO1xuICAgICAgICBzbWYgPSBzbWYuY29uY2F0KHRyYWNrRGF0YUFycmF5W2ldKTtcbiAgICB9XG5cbiAgICBpZiAob3B0cykge1xuICAgICAgICBvcHRzLnN0YXJ0VGljayA9IHN0YXJ0VGljaztcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoc21mKTtcblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVRyYWNrRGF0YSh0b2tlbnMpIHtcbiAgICAgICAgdmFyIHRyYWNrRGF0YSA9IFtdO1xuICAgICAgICB2YXIgYmFzZUxlbmd0aCA9IHRpbWViYXNlO1xuXG4gICAgICAgIHZhciBjdXJyZW50VGljayA9IDA7XG5cbiAgICAgICAgdmFyIHJlc3RUaWNrID0gMDtcblxuICAgICAgICB2YXIgT0NUQVZFX01JTiA9IC0xO1xuICAgICAgICB2YXIgT0NUQVZFX01BWCA9IDEwO1xuICAgICAgICB2YXIgb2N0YXZlID0gNDtcblxuICAgICAgICB2YXIgdmVsb2NpdHkgPSAxMDA7XG5cbiAgICAgICAgdmFyIHEgPSA2O1xuICAgICAgICB2YXIga2V5U2hpZnQgPSAwO1xuXG4gICAgICAgIHZhciBwID0gMDtcblxuICAgICAgICBmdW5jdGlvbiB3cml0ZSgpIHtcbiAgICAgICAgICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBkYXRhID0gQXJyYXkoX2xlbiksIF9rZXkgPSAwOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XG4gICAgICAgICAgICAgICAgZGF0YVtfa2V5XSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJhY2tEYXRhID0gdHJhY2tEYXRhLmNvbmNhdChkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGVycm9yKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlwiICsgbWVzc2FnZSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjYWxjTm90ZUxlbmd0aChsZW5ndGgsIG51bURvdHMpIHtcbiAgICAgICAgICAgIHZhciBub3RlTGVuZ3RoID0gYmFzZUxlbmd0aDtcbiAgICAgICAgICAgIGlmIChsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBub3RlTGVuZ3RoID0gdGltZWJhc2UgKiA0IC8gbGVuZ3RoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgZG90dGVkVGltZSA9IG5vdGVMZW5ndGg7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG51bURvdHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGRvdHRlZFRpbWUgLz0gMjtcbiAgICAgICAgICAgICAgICBub3RlTGVuZ3RoICs9IGRvdHRlZFRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbm90ZUxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHdyaXRlRGVsdGFUaWNrKHRpY2spIHtcbiAgICAgICAgICAgIGlmICh0aWNrIDwgMCB8fCB0aWNrID4gMHhmZmZmZmZmKSB7XG4gICAgICAgICAgICAgICAgZXJyb3IoXCJpbGxlZ2FsIGxlbmd0aFwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHN0YWNrID0gW107XG5cbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBzdGFjay5wdXNoKHRpY2sgJiAweDdmKTtcbiAgICAgICAgICAgICAgICB0aWNrID4+Pj0gNztcbiAgICAgICAgICAgIH0gd2hpbGUgKHRpY2sgPiAwKTtcblxuICAgICAgICAgICAgd2hpbGUgKHN0YWNrLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICB2YXIgYiA9IHN0YWNrLnBvcCgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHN0YWNrLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYiB8PSAweDgwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3cml0ZShiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChwIDwgdG9rZW5zLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIHRva2VuID0gdG9rZW5zW3BdO1xuICAgICAgICAgICAgLy8gY29uc29sZS5kaXIodG9rZW4pO1xuXG4gICAgICAgICAgICBzd2l0Y2ggKHRva2VuLmNvbW1hbmQpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFwibm90ZVwiOlxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgYWJjZGVmZyA9IFs5LCAxMSwgMCwgMiwgNCwgNSwgN107XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbiA9IFwiYWJjZGVmZ1wiLmluZGV4T2YodG9rZW4udG9uZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBub3RlID0gKG9jdGF2ZSArIDEpICogMTIgKyBhYmNkZWZnW25dICsga2V5U2hpZnQ7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdG9rZW4uYWNjaWRlbnRhbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodG9rZW4uYWNjaWRlbnRhbHNbaV0gPT09IFwiK1wiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdGUrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRva2VuLmFjY2lkZW50YWxzW2ldID09PSBcIi1cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3RlLS07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm90ZSA8IDAgfHwgbm90ZSA+IDEyNykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yKFwiaWxsZWdhbCBub3RlIG51bWJlciAoMC0xMjcpXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgX3N0ZXBUaW1lID0gY2FsY05vdGVMZW5ndGgodG9rZW4ubGVuZ3RoLCB0b2tlbi5kb3RzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAodG9rZW5zW3AgKyAxXSAmJiB0b2tlbnNbcCArIDFdLmNvbW1hbmQgPT09IFwidGllXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3N0ZXBUaW1lICs9IGNhbGNOb3RlTGVuZ3RoKHRva2Vuc1twXS5sZW5ndGgsIHRva2Vuc1twXS5kb3RzLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBnYXRlVGltZSA9IE1hdGgucm91bmQoX3N0ZXBUaW1lICogcSAvIDgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB3cml0ZURlbHRhVGljayhyZXN0VGljayk7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cml0ZSgweDkwIHwgY2hhbm5lbCwgbm90ZSwgdmVsb2NpdHkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgd3JpdGVEZWx0YVRpY2soZ2F0ZVRpbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgd3JpdGUoMHg4MCB8IGNoYW5uZWwsIG5vdGUsIDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdFRpY2sgPSBfc3RlcFRpbWUgLSBnYXRlVGltZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudFRpY2sgKz0gX3N0ZXBUaW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlIFwicmVzdFwiOlxuICAgICAgICAgICAgICAgICAgICB2YXIgc3RlcFRpbWUgPSBjYWxjTm90ZUxlbmd0aCh0b2tlbi5sZW5ndGgsIHRva2VuLmRvdHMubGVuZ3RoKTtcblxuICAgICAgICAgICAgICAgICAgICByZXN0VGljayArPSBzdGVwVGltZTtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFRpY2sgKz0gc3RlcFRpbWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBcIm9jdGF2ZVwiOlxuICAgICAgICAgICAgICAgICAgICBvY3RhdmUgPSB0b2tlbi5udW1iZXI7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBcIm9jdGF2ZV91cFwiOlxuICAgICAgICAgICAgICAgICAgICBvY3RhdmUrKztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwib2N0YXZlX2Rvd25cIjpcbiAgICAgICAgICAgICAgICAgICAgb2N0YXZlLS07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBcIm5vdGVfbGVuZ3RoXCI6XG4gICAgICAgICAgICAgICAgICAgIGJhc2VMZW5ndGggPSBjYWxjTm90ZUxlbmd0aCh0b2tlbi5sZW5ndGgsIHRva2VuLmRvdHMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwiZ2F0ZV90aW1lXCI6XG4gICAgICAgICAgICAgICAgICAgIHEgPSB0b2tlbi5xdWFudGl0eTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwidmVsb2NpdHlcIjpcbiAgICAgICAgICAgICAgICAgICAgdmVsb2NpdHkgPSB0b2tlbi52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwidm9sdW1lXCI6XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlRGVsdGFUaWNrKHJlc3RUaWNrKTtcbiAgICAgICAgICAgICAgICAgICAgd3JpdGUoMHhiMCB8IGNoYW5uZWwsIDcsIHRva2VuLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwicGFuXCI6XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlRGVsdGFUaWNrKHJlc3RUaWNrKTtcbiAgICAgICAgICAgICAgICAgICAgd3JpdGUoMHhiMCB8IGNoYW5uZWwsIDEwLCB0b2tlbi52YWx1ZSArIDY0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwiZXhwcmVzc2lvblwiOlxuICAgICAgICAgICAgICAgICAgICB3cml0ZURlbHRhVGljayhyZXN0VGljayk7XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlKDB4YjAgfCBjaGFubmVsLCAxMSwgdG9rZW4udmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJjb250cm9sX2NoYW5nZVwiOlxuICAgICAgICAgICAgICAgICAgICB3cml0ZURlbHRhVGljayhyZXN0VGljayk7XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlKDB4YjAgfCBjaGFubmVsLCB0b2tlbi5udW1iZXIsIHRva2VuLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwicHJvZ3JhbV9jaGFuZ2VcIjpcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVEZWx0YVRpY2socmVzdFRpY2spO1xuICAgICAgICAgICAgICAgICAgICB3cml0ZSgweGMwIHwgY2hhbm5lbCwgdG9rZW4ubnVtYmVyKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwiY2hhbm5lbF9hZnRlcnRvdWNoXCI6XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlRGVsdGFUaWNrKHJlc3RUaWNrKTtcbiAgICAgICAgICAgICAgICAgICAgd3JpdGUoMHhkMCB8IGNoYW5uZWwsIHRva2VuLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwidGVtcG9cIjpcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHF1YXJ0ZXJNaWNyb3NlY29uZHMgPSA2MCAqIDEwMDAgKiAxMDAwIC8gdG9rZW4udmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocXVhcnRlck1pY3Jvc2Vjb25kcyA8IDEgfHwgcXVhcnRlck1pY3Jvc2Vjb25kcyA+IDB4ZmZmZmZmKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJpbGxlZ2FsIHRlbXBvXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB3cml0ZURlbHRhVGljayhyZXN0VGljayk7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cml0ZSgweGZmLCAweDUxLCAweDAzLCBxdWFydGVyTWljcm9zZWNvbmRzID4+IDE2ICYgMHhmZiwgcXVhcnRlck1pY3Jvc2Vjb25kcyA+PiA4ICYgMHhmZiwgcXVhcnRlck1pY3Jvc2Vjb25kcyAmIDB4ZmYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNhc2UgXCJzdGFydF9wb2ludFwiOlxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFydFRpY2sgPSBjdXJyZW50VGljaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwia2V5X3NoaWZ0XCI6XG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleVNoaWZ0ID0gdG9rZW4udmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY2FzZSBcInNldF9taWRpX2NoYW5uZWxcIjpcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhbm5lbCA9IHRva2VuLmNoYW5uZWwgLSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9jdGF2ZSA8IE9DVEFWRV9NSU4gfHwgb2N0YXZlID4gT0NUQVZFX01BWCkge1xuICAgICAgICAgICAgICAgIGVycm9yKFwib2N0YXZlIGlzIG91dCBvZiByYW5nZVwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRyYWNrRGF0YTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1tcImRlZmF1bHRcIl07IiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG4gIC8qXG4gICAqIEdlbmVyYXRlZCBieSBQRUcuanMgMC44LjAuXG4gICAqXG4gICAqIGh0dHA6Ly9wZWdqcy5tYWpkYS5jei9cbiAgICovXG5cbiAgZnVuY3Rpb24gcGVnJHN1YmNsYXNzKGNoaWxkLCBwYXJlbnQpIHtcbiAgICBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH1cbiAgICBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7XG4gICAgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIFN5bnRheEVycm9yKG1lc3NhZ2UsIGV4cGVjdGVkLCBmb3VuZCwgb2Zmc2V0LCBsaW5lLCBjb2x1bW4pIHtcbiAgICB0aGlzLm1lc3NhZ2UgID0gbWVzc2FnZTtcbiAgICB0aGlzLmV4cGVjdGVkID0gZXhwZWN0ZWQ7XG4gICAgdGhpcy5mb3VuZCAgICA9IGZvdW5kO1xuICAgIHRoaXMub2Zmc2V0ICAgPSBvZmZzZXQ7XG4gICAgdGhpcy5saW5lICAgICA9IGxpbmU7XG4gICAgdGhpcy5jb2x1bW4gICA9IGNvbHVtbjtcblxuICAgIHRoaXMubmFtZSAgICAgPSBcIlN5bnRheEVycm9yXCI7XG4gIH1cblxuICBwZWckc3ViY2xhc3MoU3ludGF4RXJyb3IsIEVycm9yKTtcblxuICBmdW5jdGlvbiBwYXJzZShpbnB1dCkge1xuICAgIHZhciBvcHRpb25zID0gYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiB7fSxcblxuICAgICAgICBwZWckRkFJTEVEID0ge30sXG5cbiAgICAgICAgcGVnJHN0YXJ0UnVsZUZ1bmN0aW9ucyA9IHsgc3RhcnQ6IHBlZyRwYXJzZXN0YXJ0IH0sXG4gICAgICAgIHBlZyRzdGFydFJ1bGVGdW5jdGlvbiAgPSBwZWckcGFyc2VzdGFydCxcblxuICAgICAgICBwZWckYzAgPSBbXSxcbiAgICAgICAgcGVnJGMxID0gcGVnJEZBSUxFRCxcbiAgICAgICAgcGVnJGMyID0gZnVuY3Rpb24oY29tbWFuZHMpIHsgcmV0dXJuIGNvbW1hbmRzOyB9LFxuICAgICAgICBwZWckYzMgPSBcIjtcIixcbiAgICAgICAgcGVnJGM0ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiO1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiO1xcXCJcIiB9LFxuICAgICAgICBwZWckYzUgPSBmdW5jdGlvbigpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICAgIHBlZyRjNiA9IC9eWyBcXHRcXHJcXG5dLyxcbiAgICAgICAgcGVnJGM3ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlsgXFxcXHRcXFxcclxcXFxuXVwiLCBkZXNjcmlwdGlvbjogXCJbIFxcXFx0XFxcXHJcXFxcbl1cIiB9LFxuICAgICAgICBwZWckYzggPSBcIi8qXCIsXG4gICAgICAgIHBlZyRjOSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIi8qXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIvKlxcXCJcIiB9LFxuICAgICAgICBwZWckYzEwID0gdm9pZCAwLFxuICAgICAgICBwZWckYzExID0gXCIqL1wiLFxuICAgICAgICBwZWckYzEyID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiKi9cIiwgZGVzY3JpcHRpb246IFwiXFxcIiovXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTMgPSB7IHR5cGU6IFwiYW55XCIsIGRlc2NyaXB0aW9uOiBcImFueSBjaGFyYWN0ZXJcIiB9LFxuICAgICAgICBwZWckYzE0ID0gZnVuY3Rpb24oKSB7IHJldHVybiB7IGNvbW1hbmQ6IFwiY29tbWVudFwiIH07IH0sXG4gICAgICAgIHBlZyRjMTUgPSBcIi8vXCIsXG4gICAgICAgIHBlZyRjMTYgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIvL1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiLy9cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxNyA9IC9eW15cXG5dLyxcbiAgICAgICAgcGVnJGMxOCA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbXlxcXFxuXVwiLCBkZXNjcmlwdGlvbjogXCJbXlxcXFxuXVwiIH0sXG4gICAgICAgIHBlZyRjMTkgPSAvXltjZGVmZ2FiXS8sXG4gICAgICAgIHBlZyRjMjAgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiW2NkZWZnYWJdXCIsIGRlc2NyaXB0aW9uOiBcIltjZGVmZ2FiXVwiIH0sXG4gICAgICAgIHBlZyRjMjEgPSAvXltcXC0rXS8sXG4gICAgICAgIHBlZyRjMjIgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiW1xcXFwtK11cIiwgZGVzY3JpcHRpb246IFwiW1xcXFwtK11cIiB9LFxuICAgICAgICBwZWckYzIzID0gL15bMC05XS8sXG4gICAgICAgIHBlZyRjMjQgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWzAtOV1cIiwgZGVzY3JpcHRpb246IFwiWzAtOV1cIiB9LFxuICAgICAgICBwZWckYzI1ID0gXCIuXCIsXG4gICAgICAgIHBlZyRjMjYgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIuXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIuXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMjcgPSBmdW5jdGlvbih0b25lLCBhY2NpZGVudGFscywgbGVuZ3RoLCBkb3RzKSB7IHJldHVybiB7IGNvbW1hbmQ6IFwibm90ZVwiLCB0b25lOiB0b25lLCBhY2NpZGVudGFsczogYWNjaWRlbnRhbHMsIGxlbmd0aDogK2xlbmd0aCwgZG90czogZG90cyB9OyB9LFxuICAgICAgICBwZWckYzI4ID0gXCJeXCIsXG4gICAgICAgIHBlZyRjMjkgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJeXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJeXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMzAgPSBmdW5jdGlvbihsZW5ndGgsIGRvdHMpIHsgcmV0dXJuIHsgY29tbWFuZDogXCJ0aWVcIiwgbGVuZ3RoOiArbGVuZ3RoLCBkb3RzOiBkb3RzIH07IH0sXG4gICAgICAgIHBlZyRjMzEgPSBcInJcIixcbiAgICAgICAgcGVnJGMzMiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInJcIiwgZGVzY3JpcHRpb246IFwiXFxcInJcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMzMyA9IGZ1bmN0aW9uKGxlbmd0aCwgZG90cykgeyByZXR1cm4geyBjb21tYW5kOiBcInJlc3RcIiwgbGVuZ3RoOiArbGVuZ3RoLCBkb3RzOiBkb3RzIH07IH0sXG4gICAgICAgIHBlZyRjMzQgPSBcIm9cIixcbiAgICAgICAgcGVnJGMzNSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIm9cIiwgZGVzY3JpcHRpb246IFwiXFxcIm9cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMzNiA9IG51bGwsXG4gICAgICAgIHBlZyRjMzcgPSBcIi1cIixcbiAgICAgICAgcGVnJGMzOCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIi1cIiwgZGVzY3JpcHRpb246IFwiXFxcIi1cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMzOSA9IGZ1bmN0aW9uKG51bWJlcikge1xyXG4gICAgICAgICAgICAgICAgaWYgKG51bWJlciA8IC0xIHx8IG51bWJlciA+IDEwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJvY3RhdmUgbnVtYmVyIGlzIG91dCBvZiByYW5nZVwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29tbWFuZDogXCJvY3RhdmVcIixcclxuICAgICAgICAgICAgICAgICAgICBudW1iZXI6ICtudW1iZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgbGluZTogbGluZSgpLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbjogY29sdW1uKClcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjNDAgPSBcIjxcIixcbiAgICAgICAgcGVnJGM0MSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIjxcIiwgZGVzY3JpcHRpb246IFwiXFxcIjxcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM0MiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4geyBjb21tYW5kOiBcIm9jdGF2ZV91cFwiIH07IH0sXG4gICAgICAgIHBlZyRjNDMgPSBcIj5cIixcbiAgICAgICAgcGVnJGM0NCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIj5cIiwgZGVzY3JpcHRpb246IFwiXFxcIj5cXFwiXCIgfSxcbiAgICAgICAgcGVnJGM0NSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4geyBjb21tYW5kOiBcIm9jdGF2ZV9kb3duXCIgfTsgfSxcbiAgICAgICAgcGVnJGM0NiA9IFwibFwiLFxuICAgICAgICBwZWckYzQ3ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwibFwiLCBkZXNjcmlwdGlvbjogXCJcXFwibFxcXCJcIiB9LFxuICAgICAgICBwZWckYzQ4ID0gZnVuY3Rpb24obGVuZ3RoLCBkb3RzKSB7IHJldHVybiB7IGNvbW1hbmQ6IFwibm90ZV9sZW5ndGhcIiwgbGVuZ3RoOiArbGVuZ3RoLCBkb3RzOiBkb3RzIH07IH0sXG4gICAgICAgIHBlZyRjNDkgPSBcInFcIixcbiAgICAgICAgcGVnJGM1MCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInFcIiwgZGVzY3JpcHRpb246IFwiXFxcInFcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM1MSA9IC9eWzEtOF0vLFxuICAgICAgICBwZWckYzUyID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlsxLThdXCIsIGRlc2NyaXB0aW9uOiBcIlsxLThdXCIgfSxcbiAgICAgICAgcGVnJGM1MyA9IGZ1bmN0aW9uKHF1YW50aXR5KSB7IHJldHVybiB7IGNvbW1hbmQ6IFwiZ2F0ZV90aW1lXCIsIHF1YW50aXR5OiArcXVhbnRpdHkgfTsgfSxcbiAgICAgICAgcGVnJGM1NCA9IFwidVwiLFxuICAgICAgICBwZWckYzU1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwidVwiLCBkZXNjcmlwdGlvbjogXCJcXFwidVxcXCJcIiB9LFxuICAgICAgICBwZWckYzU2ID0gZnVuY3Rpb24odmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHZhbHVlID0gK3ZhbHVlO1xyXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlIDwgMCB8fCB2YWx1ZSA+IDEyNykge1xyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yKFwidmVsb2NpdHkgaXMgb3V0IG9mIHJhbmdlICgwLTEyNylcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBjb21tYW5kOiBcInZlbG9jaXR5XCIsIHZhbHVlOiB2YWx1ZSB9O1xyXG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzU3ID0gXCJ2XCIsXG4gICAgICAgIHBlZyRjNTggPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ2XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ2XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNTkgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSArdmFsdWU7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPCAwIHx8IHZhbHVlID4gMTI3KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJ2b2x1bWUgaXMgb3V0IG9mIHJhbmdlICgwLTEyNylcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBjb21tYW5kOiBcInZvbHVtZVwiLCB2YWx1ZTogdmFsdWUgfTtcclxuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGM2MCA9IFwicFwiLFxuICAgICAgICBwZWckYzYxID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwicFwiLCBkZXNjcmlwdGlvbjogXCJcXFwicFxcXCJcIiB9LFxuICAgICAgICBwZWckYzYyID0gZnVuY3Rpb24odmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHZhbHVlID0gK3ZhbHVlO1xyXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlIDwgLTY0IHx8IHZhbHVlID4gNjMpIHtcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcihcInBhbiBpcyBvdXQgb2YgcmFuZ2UgKC02NC02MylcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBjb21tYW5kOiBcInBhblwiLCB2YWx1ZTogdmFsdWUgfTtcclxuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGM2MyA9IFwiRVwiLFxuICAgICAgICBwZWckYzY0ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiRVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiRVxcXCJcIiB9LFxuICAgICAgICBwZWckYzY1ID0gZnVuY3Rpb24odmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHZhbHVlID0gK3ZhbHVlO1xyXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlIDwgMCB8fCB2YWx1ZSA+IDEyNykge1xyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yKFwiZXhwcmVzc2lvbiBpcyBvdXQgb2YgcmFuZ2UgKDAtMTI3KVwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IGNvbW1hbmQ6IFwiZXhwcmVzc2lvblwiLCB2YWx1ZTogdmFsdWUgfTtcclxuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGM2NiA9IFwiQlwiLFxuICAgICAgICBwZWckYzY3ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiQlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiQlxcXCJcIiB9LFxuICAgICAgICBwZWckYzY4ID0gZnVuY3Rpb24obnVtYmVyLCB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG51bWJlciA8IDAgfHwgbnVtYmVyID4gMTE5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJjb250cm9sIG51bWJlciBpcyBvdXQgb2YgcmFuZ2UgKDAtMTI3KVwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA8IDAgfHwgdmFsdWUgPiAxMjcpIHtcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcihcImNvbnRyb2wgdmFsdWUgaXMgb3V0IG9mIHJhbmdlICgwLTEyNylcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBjb21tYW5kOiBcImNvbnRyb2xfY2hhbmdlXCIsIG51bWJlcjogbnVtYmVyLCB2YWx1ZTogdmFsdWUgfTtcclxuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGM2OSA9IFwiQFwiLFxuICAgICAgICBwZWckYzcwID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiQFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiQFxcXCJcIiB9LFxuICAgICAgICBwZWckYzcxID0gZnVuY3Rpb24obnVtYmVyKSB7XHJcbiAgICAgICAgICAgICAgICBudW1iZXIgPSArbnVtYmVyO1xyXG4gICAgICAgICAgICAgICAgaWYgKG51bWJlciA8IDAgfHwgbnVtYmVyID4gMTI3KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJwcm9ncmFtIG51bWJlciBpcyBvdXQgb2YgcmFuZ2UgKDAtMTI3KVwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IGNvbW1hbmQ6IFwicHJvZ3JhbV9jaGFuZ2VcIiwgbnVtYmVyOiBudW1iZXIgfTtcclxuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGM3MiA9IFwiRFwiLFxuICAgICAgICBwZWckYzczID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiRFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiRFxcXCJcIiB9LFxuICAgICAgICBwZWckYzc0ID0gZnVuY3Rpb24odmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHZhbHVlID0gK3ZhbHVlO1xyXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlIDwgMCB8fCB2YWx1ZSA+IDEyNykge1xyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yKFwiY2hhbm5lbCBhZnRlcnRvdWNoIGlzIG91dCBvZiByYW5nZSAoMC0xMjcpXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgY29tbWFuZDogXCJjaGFubmVsX2FmdGVydG91Y2hcIiwgdmFsdWU6IHZhbHVlIH07XHJcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjNzUgPSBcInRcIixcbiAgICAgICAgcGVnJGM3NiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInRcIiwgZGVzY3JpcHRpb246IFwiXFxcInRcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM3NyA9IGZ1bmN0aW9uKHZhbHVlKSB7IHJldHVybiB7IGNvbW1hbmQ6IFwidGVtcG9cIiwgdmFsdWU6ICt2YWx1ZSB9OyB9LFxuICAgICAgICBwZWckYzc4ID0gXCI/XCIsXG4gICAgICAgIHBlZyRjNzkgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCI/XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCI/XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjODAgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHsgY29tbWFuZDogXCJzdGFydF9wb2ludFwiIH07IH0sXG4gICAgICAgIHBlZyRjODEgPSBcImtcIixcbiAgICAgICAgcGVnJGM4MiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcImtcIiwgZGVzY3JpcHRpb246IFwiXFxcImtcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM4MyA9IGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9ICt2YWx1ZTtcclxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA8IC0xMjcgfHwgdmFsdWUgPiAxMjcpIHtcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcihcImtleSBzaGlmdCBpcyBvdXQgb2YgcmFuZ2UgKC0xMjctMTI3KVwiKTtcclxuICAgICAgICAgICAgICAgIH0gXHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBjb21tYW5kOiBcImtleV9zaGlmdFwiLCB2YWx1ZTogdmFsdWUgfTtcclxuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGM4NCA9IFwiQ1wiLFxuICAgICAgICBwZWckYzg1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiQ1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiQ1xcXCJcIiB9LFxuICAgICAgICBwZWckYzg2ID0gZnVuY3Rpb24oY2hhbm5lbCkge1xyXG4gICAgICAgICAgICAgICAgY2hhbm5lbCA9ICtjaGFubmVsO1xyXG4gICAgICAgICAgICAgICAgaWYgKGNoYW5uZWwgPCAxIHx8IGNoYW5uZWwgPiAxNikge1xyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yKFwiTUlESSBjaGFubmVsIGlzIG91dCBvZiByYW5nZSAoMS0xNilcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBjb21tYW5kOiBcInNldF9taWRpX2NoYW5uZWxcIiwgY2hhbm5lbDogY2hhbm5lbCB9O1xyXG4gICAgICAgICAgICB9LFxuXG4gICAgICAgIHBlZyRjdXJyUG9zICAgICAgICAgID0gMCxcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zICAgICAgPSAwLFxuICAgICAgICBwZWckY2FjaGVkUG9zICAgICAgICA9IDAsXG4gICAgICAgIHBlZyRjYWNoZWRQb3NEZXRhaWxzID0geyBsaW5lOiAxLCBjb2x1bW46IDEsIHNlZW5DUjogZmFsc2UgfSxcbiAgICAgICAgcGVnJG1heEZhaWxQb3MgICAgICAgPSAwLFxuICAgICAgICBwZWckbWF4RmFpbEV4cGVjdGVkICA9IFtdLFxuICAgICAgICBwZWckc2lsZW50RmFpbHMgICAgICA9IDAsXG5cbiAgICAgICAgcGVnJHJlc3VsdDtcblxuICAgIGlmIChcInN0YXJ0UnVsZVwiIGluIG9wdGlvbnMpIHtcbiAgICAgIGlmICghKG9wdGlvbnMuc3RhcnRSdWxlIGluIHBlZyRzdGFydFJ1bGVGdW5jdGlvbnMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHN0YXJ0IHBhcnNpbmcgZnJvbSBydWxlIFxcXCJcIiArIG9wdGlvbnMuc3RhcnRSdWxlICsgXCJcXFwiLlwiKTtcbiAgICAgIH1cblxuICAgICAgcGVnJHN0YXJ0UnVsZUZ1bmN0aW9uID0gcGVnJHN0YXJ0UnVsZUZ1bmN0aW9uc1tvcHRpb25zLnN0YXJ0UnVsZV07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdGV4dCgpIHtcbiAgICAgIHJldHVybiBpbnB1dC5zdWJzdHJpbmcocGVnJHJlcG9ydGVkUG9zLCBwZWckY3VyclBvcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb2Zmc2V0KCkge1xuICAgICAgcmV0dXJuIHBlZyRyZXBvcnRlZFBvcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaW5lKCkge1xuICAgICAgcmV0dXJuIHBlZyRjb21wdXRlUG9zRGV0YWlscyhwZWckcmVwb3J0ZWRQb3MpLmxpbmU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29sdW1uKCkge1xuICAgICAgcmV0dXJuIHBlZyRjb21wdXRlUG9zRGV0YWlscyhwZWckcmVwb3J0ZWRQb3MpLmNvbHVtbjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleHBlY3RlZChkZXNjcmlwdGlvbikge1xuICAgICAgdGhyb3cgcGVnJGJ1aWxkRXhjZXB0aW9uKFxuICAgICAgICBudWxsLFxuICAgICAgICBbeyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbiB9XSxcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zXG4gICAgICApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVycm9yKG1lc3NhZ2UpIHtcbiAgICAgIHRocm93IHBlZyRidWlsZEV4Y2VwdGlvbihtZXNzYWdlLCBudWxsLCBwZWckcmVwb3J0ZWRQb3MpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRjb21wdXRlUG9zRGV0YWlscyhwb3MpIHtcbiAgICAgIGZ1bmN0aW9uIGFkdmFuY2UoZGV0YWlscywgc3RhcnRQb3MsIGVuZFBvcykge1xuICAgICAgICB2YXIgcCwgY2g7XG5cbiAgICAgICAgZm9yIChwID0gc3RhcnRQb3M7IHAgPCBlbmRQb3M7IHArKykge1xuICAgICAgICAgIGNoID0gaW5wdXQuY2hhckF0KHApO1xuICAgICAgICAgIGlmIChjaCA9PT0gXCJcXG5cIikge1xuICAgICAgICAgICAgaWYgKCFkZXRhaWxzLnNlZW5DUikgeyBkZXRhaWxzLmxpbmUrKzsgfVxuICAgICAgICAgICAgZGV0YWlscy5jb2x1bW4gPSAxO1xuICAgICAgICAgICAgZGV0YWlscy5zZWVuQ1IgPSBmYWxzZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoID09PSBcIlxcclwiIHx8IGNoID09PSBcIlxcdTIwMjhcIiB8fCBjaCA9PT0gXCJcXHUyMDI5XCIpIHtcbiAgICAgICAgICAgIGRldGFpbHMubGluZSsrO1xuICAgICAgICAgICAgZGV0YWlscy5jb2x1bW4gPSAxO1xuICAgICAgICAgICAgZGV0YWlscy5zZWVuQ1IgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZXRhaWxzLmNvbHVtbisrO1xuICAgICAgICAgICAgZGV0YWlscy5zZWVuQ1IgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHBlZyRjYWNoZWRQb3MgIT09IHBvcykge1xuICAgICAgICBpZiAocGVnJGNhY2hlZFBvcyA+IHBvcykge1xuICAgICAgICAgIHBlZyRjYWNoZWRQb3MgPSAwO1xuICAgICAgICAgIHBlZyRjYWNoZWRQb3NEZXRhaWxzID0geyBsaW5lOiAxLCBjb2x1bW46IDEsIHNlZW5DUjogZmFsc2UgfTtcbiAgICAgICAgfVxuICAgICAgICBhZHZhbmNlKHBlZyRjYWNoZWRQb3NEZXRhaWxzLCBwZWckY2FjaGVkUG9zLCBwb3MpO1xuICAgICAgICBwZWckY2FjaGVkUG9zID0gcG9zO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGVnJGNhY2hlZFBvc0RldGFpbHM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJGZhaWwoZXhwZWN0ZWQpIHtcbiAgICAgIGlmIChwZWckY3VyclBvcyA8IHBlZyRtYXhGYWlsUG9zKSB7IHJldHVybjsgfVxuXG4gICAgICBpZiAocGVnJGN1cnJQb3MgPiBwZWckbWF4RmFpbFBvcykge1xuICAgICAgICBwZWckbWF4RmFpbFBvcyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBwZWckbWF4RmFpbEV4cGVjdGVkID0gW107XG4gICAgICB9XG5cbiAgICAgIHBlZyRtYXhGYWlsRXhwZWN0ZWQucHVzaChleHBlY3RlZCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJGJ1aWxkRXhjZXB0aW9uKG1lc3NhZ2UsIGV4cGVjdGVkLCBwb3MpIHtcbiAgICAgIGZ1bmN0aW9uIGNsZWFudXBFeHBlY3RlZChleHBlY3RlZCkge1xuICAgICAgICB2YXIgaSA9IDE7XG5cbiAgICAgICAgZXhwZWN0ZWQuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgaWYgKGEuZGVzY3JpcHRpb24gPCBiLmRlc2NyaXB0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfSBlbHNlIGlmIChhLmRlc2NyaXB0aW9uID4gYi5kZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgd2hpbGUgKGkgPCBleHBlY3RlZC5sZW5ndGgpIHtcbiAgICAgICAgICBpZiAoZXhwZWN0ZWRbaSAtIDFdID09PSBleHBlY3RlZFtpXSkge1xuICAgICAgICAgICAgZXhwZWN0ZWQuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGJ1aWxkTWVzc2FnZShleHBlY3RlZCwgZm91bmQpIHtcbiAgICAgICAgZnVuY3Rpb24gc3RyaW5nRXNjYXBlKHMpIHtcbiAgICAgICAgICBmdW5jdGlvbiBoZXgoY2gpIHsgcmV0dXJuIGNoLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCk7IH1cblxuICAgICAgICAgIHJldHVybiBzXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXC9nLCAgICdcXFxcXFxcXCcpXG4gICAgICAgICAgICAucmVwbGFjZSgvXCIvZywgICAgJ1xcXFxcIicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx4MDgvZywgJ1xcXFxiJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHQvZywgICAnXFxcXHQnKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcbi9nLCAgICdcXFxcbicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxmL2csICAgJ1xcXFxmJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHIvZywgICAnXFxcXHInKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXHgwMC1cXHgwN1xceDBCXFx4MEVcXHgwRl0vZywgZnVuY3Rpb24oY2gpIHsgcmV0dXJuICdcXFxceDAnICsgaGV4KGNoKTsgfSlcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXFx4MTAtXFx4MUZcXHg4MC1cXHhGRl0vZywgICAgZnVuY3Rpb24oY2gpIHsgcmV0dXJuICdcXFxceCcgICsgaGV4KGNoKTsgfSlcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXFx1MDE4MC1cXHUwRkZGXS9nLCAgICAgICAgIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHUwJyArIGhleChjaCk7IH0pXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xcdTEwODAtXFx1RkZGRl0vZywgICAgICAgICBmdW5jdGlvbihjaCkgeyByZXR1cm4gJ1xcXFx1JyAgKyBoZXgoY2gpOyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBleHBlY3RlZERlc2NzID0gbmV3IEFycmF5KGV4cGVjdGVkLmxlbmd0aCksXG4gICAgICAgICAgICBleHBlY3RlZERlc2MsIGZvdW5kRGVzYywgaTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZXhwZWN0ZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBleHBlY3RlZERlc2NzW2ldID0gZXhwZWN0ZWRbaV0uZGVzY3JpcHRpb247XG4gICAgICAgIH1cblxuICAgICAgICBleHBlY3RlZERlc2MgPSBleHBlY3RlZC5sZW5ndGggPiAxXG4gICAgICAgICAgPyBleHBlY3RlZERlc2NzLnNsaWNlKDAsIC0xKS5qb2luKFwiLCBcIilcbiAgICAgICAgICAgICAgKyBcIiBvciBcIlxuICAgICAgICAgICAgICArIGV4cGVjdGVkRGVzY3NbZXhwZWN0ZWQubGVuZ3RoIC0gMV1cbiAgICAgICAgICA6IGV4cGVjdGVkRGVzY3NbMF07XG5cbiAgICAgICAgZm91bmREZXNjID0gZm91bmQgPyBcIlxcXCJcIiArIHN0cmluZ0VzY2FwZShmb3VuZCkgKyBcIlxcXCJcIiA6IFwiZW5kIG9mIGlucHV0XCI7XG5cbiAgICAgICAgcmV0dXJuIFwiRXhwZWN0ZWQgXCIgKyBleHBlY3RlZERlc2MgKyBcIiBidXQgXCIgKyBmb3VuZERlc2MgKyBcIiBmb3VuZC5cIjtcbiAgICAgIH1cblxuICAgICAgdmFyIHBvc0RldGFpbHMgPSBwZWckY29tcHV0ZVBvc0RldGFpbHMocG9zKSxcbiAgICAgICAgICBmb3VuZCAgICAgID0gcG9zIDwgaW5wdXQubGVuZ3RoID8gaW5wdXQuY2hhckF0KHBvcykgOiBudWxsO1xuXG4gICAgICBpZiAoZXhwZWN0ZWQgIT09IG51bGwpIHtcbiAgICAgICAgY2xlYW51cEV4cGVjdGVkKGV4cGVjdGVkKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG5ldyBTeW50YXhFcnJvcihcbiAgICAgICAgbWVzc2FnZSAhPT0gbnVsbCA/IG1lc3NhZ2UgOiBidWlsZE1lc3NhZ2UoZXhwZWN0ZWQsIGZvdW5kKSxcbiAgICAgICAgZXhwZWN0ZWQsXG4gICAgICAgIGZvdW5kLFxuICAgICAgICBwb3MsXG4gICAgICAgIHBvc0RldGFpbHMubGluZSxcbiAgICAgICAgcG9zRGV0YWlscy5jb2x1bW5cbiAgICAgICk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlc3RhcnQoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IFtdO1xuICAgICAgczEgPSBwZWckcGFyc2V0cmFjaygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHdoaWxlIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwLnB1c2goczEpO1xuICAgICAgICAgIHMxID0gcGVnJHBhcnNldHJhY2soKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2V0cmFjaygpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBbXTtcbiAgICAgIHMyID0gcGVnJHBhcnNlY29tbWFuZCgpO1xuICAgICAgd2hpbGUgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxLnB1c2goczIpO1xuICAgICAgICBzMiA9IHBlZyRwYXJzZWNvbW1hbmQoKTtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZW5leHRfdHJhY2soKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzIoczEpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VuZXh0X3RyYWNrKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA1OSkge1xuICAgICAgICAgIHMyID0gcGVnJGMzO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjNSgpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZV8oKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IFtdO1xuICAgICAgaWYgKHBlZyRjNi50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMxID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzcpOyB9XG4gICAgICB9XG4gICAgICB3aGlsZSAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAucHVzaChzMSk7XG4gICAgICAgIGlmIChwZWckYzYudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgIHMxID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNyk7IH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlY29tbWFuZCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRwYXJzZWNvbW1lbnQoKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZW5vdGUoKTtcbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckcGFyc2V0aWUoKTtcbiAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlcmVzdCgpO1xuICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlb2N0YXZlKCk7XG4gICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlb2N0YXZlX3VwKCk7XG4gICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZW9jdGF2ZV9kb3duKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2Vub3RlX2xlbmd0aCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZWdhdGVfdGltZSgpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2V2ZWxvY2l0eSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNldm9sdW1lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlcGFuKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZWV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRwYXJzZWNvbnRyb2xfY2hhbmdlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMyID0gcGVnJHBhcnNlcHJvZ3JhbV9jaGFuZ2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gW3MxLCBzMl07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2VjaGFubmVsX2FmdGVydG91Y2goKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNldGVtcG8oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZXN0YXJ0X3BvaW50KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNla2V5X3NoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZXNldF9taWRpX2NoYW5uZWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZWNvbW1lbnQoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjOCkge1xuICAgICAgICAgIHMyID0gcGVnJGM4O1xuICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBbXTtcbiAgICAgICAgICBzNSA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM2ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMTEpIHtcbiAgICAgICAgICAgIHM3ID0gcGVnJGMxMTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM3ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMik7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICAgICAgaWYgKHM3ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRjMTA7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczY7XG4gICAgICAgICAgICBzNiA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICAgICAgczcgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczcgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTMpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBbczYsIHM3XTtcbiAgICAgICAgICAgICAgczUgPSBzNjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczU7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICAgIHdoaWxlIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQucHVzaChzNSk7XG4gICAgICAgICAgICBzNSA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczYgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMTEpIHtcbiAgICAgICAgICAgICAgczcgPSBwZWckYzExO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczcgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTIpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgICAgICAgIGlmIChzNyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRjMTA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM2O1xuICAgICAgICAgICAgICBzNiA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICAgICAgICBzNyA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEzKTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gW3M2LCBzN107XG4gICAgICAgICAgICAgICAgczUgPSBzNjtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IGlucHV0LnN1YnN0cmluZyhzMywgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMTEpIHtcbiAgICAgICAgICAgICAgczQgPSBwZWckYzExO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczQgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTIpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGMxNCgpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzE1KSB7XG4gICAgICAgICAgICBzMiA9IHBlZyRjMTU7XG4gICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTYpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzE3LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczQgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczQgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTgpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczMucHVzaChzNCk7XG4gICAgICAgICAgICAgIGlmIChwZWckYzE3LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICBzNCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE4KTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGMxNCgpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlbm90ZSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczcsIHM4LCBzOTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChwZWckYzE5LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIwKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzIxLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjIpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczQucHVzaChzNSk7XG4gICAgICAgICAgICAgIGlmIChwZWckYzIxLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICBzNSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIyKTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgICAgczcgPSBbXTtcbiAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICBzOCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHdoaWxlIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcucHVzaChzOCk7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gaW5wdXQuc3Vic3RyaW5nKHM2LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHM2ID0gczc7XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckYzI1O1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNik7IH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoczkgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzOC5wdXNoKHM5KTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzOSA9IHBlZyRjMjU7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzOSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjYpOyB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChzOSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMjcoczIsIHM0LCBzNiwgczgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXRpZSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDk0KSB7XG4gICAgICAgICAgczIgPSBwZWckYzI4O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyOSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNS5wdXNoKHM2KTtcbiAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczYgPSBbXTtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ2KSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRjMjU7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjYpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHdoaWxlIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczYucHVzaChzNyk7XG4gICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ2KSB7XG4gICAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJGMyNTtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI2KTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMzAoczQsIHM2KTtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlcmVzdCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDExNCkge1xuICAgICAgICAgIHMyID0gcGVnJGMzMTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzIpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczUgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUucHVzaChzNik7XG4gICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5zdWJzdHJpbmcoczQsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gW107XG4gICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckYzI1O1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI2KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM2LnB1c2goczcpO1xuICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICAgICAgICBzNyA9IHBlZyRjMjU7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzNyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNik7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzMzKHM0LCBzNik7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZW9jdGF2ZSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczcsIHM4O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTEpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjMzQ7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzM1KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM1ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ1KSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJGMzNztcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzM4KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJGMzNjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IFtdO1xuICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgczggPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczggPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICB3aGlsZSAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM3LnB1c2goczgpO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczYgPSBbczYsIHM3XTtcbiAgICAgICAgICAgICAgICBzNSA9IHM2O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczU7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczU7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuc3Vic3RyaW5nKHM0LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMzkoczQpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VvY3RhdmVfdXAoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYwKSB7XG4gICAgICAgICAgczIgPSBwZWckYzQwO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0MSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzQyKCk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlb2N0YXZlX2Rvd24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYyKSB7XG4gICAgICAgICAgczIgPSBwZWckYzQzO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0NCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzQ1KCk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlbm90ZV9sZW5ndGgoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMDgpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNDY7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzQ3KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM1ID0gW107XG4gICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM1LnB1c2goczYpO1xuICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuc3Vic3RyaW5nKHM0LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IFtdO1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDYpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJGMyNTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNik7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgd2hpbGUgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNi5wdXNoKHM3KTtcbiAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDYpIHtcbiAgICAgICAgICAgICAgICAgICAgczcgPSBwZWckYzI1O1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgczcgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjYpOyB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM0OChzNCwgczYpO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VnYXRlX3RpbWUoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTEzKSB7XG4gICAgICAgICAgczIgPSBwZWckYzQ5O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1MCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChwZWckYzUxLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczQgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczQgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTIpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM1MyhzNCk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXZlbG9jaXR5KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTcpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNTQ7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzU1KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM1ID0gW107XG4gICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM1LnB1c2goczYpO1xuICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuc3Vic3RyaW5nKHM0LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNTYoczQpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2V2b2x1bWUoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczY7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDExOCkge1xuICAgICAgICAgIHMyID0gcGVnJGM1NztcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTgpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczUgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgd2hpbGUgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczUucHVzaChzNik7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5zdWJzdHJpbmcoczQsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM1OShzNCk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXBhbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczcsIHM4O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTIpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNjA7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzYxKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM1ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ1KSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJGMzNztcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzM4KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJGMzNjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IFtdO1xuICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgczggPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczggPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICB3aGlsZSAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM3LnB1c2goczgpO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczYgPSBbczYsIHM3XTtcbiAgICAgICAgICAgICAgICBzNSA9IHM2O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczU7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczU7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuc3Vic3RyaW5nKHM0LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjIoczQpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VleHByZXNzaW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2OSkge1xuICAgICAgICAgIHMyID0gcGVnJGM2MztcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNjQpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczUgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgd2hpbGUgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczUucHVzaChzNik7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5zdWJzdHJpbmcoczQsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM2NShzNCk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZWNvbnRyb2xfY2hhbmdlKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNywgczg7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDY2KSB7XG4gICAgICAgICAgczIgPSBwZWckYzY2O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2Nyk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICB3aGlsZSAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNS5wdXNoKHM2KTtcbiAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczYgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgICBzNyA9IFtdO1xuICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgIHM4ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICB3aGlsZSAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczcucHVzaChzOCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzOCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gaW5wdXQuc3Vic3RyaW5nKHM2LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHM2ID0gczc7XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzY4KHM0LCBzNik7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXByb2dyYW1fY2hhbmdlKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2NCkge1xuICAgICAgICAgIHMyID0gcGVnJGM2OTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczUgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgd2hpbGUgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczUucHVzaChzNik7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5zdWJzdHJpbmcoczQsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM3MShzNCk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZWNoYW5uZWxfYWZ0ZXJ0b3VjaCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjgpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNzI7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzczKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM1ID0gW107XG4gICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM1LnB1c2goczYpO1xuICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuc3Vic3RyaW5nKHM0LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNzQoczQpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2V0ZW1wbygpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTE2KSB7XG4gICAgICAgICAgczIgPSBwZWckYzc1O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3Nik7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICB3aGlsZSAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNS5wdXNoKHM2KTtcbiAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzc3KHM0KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlc3RhcnRfcG9pbnQoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYzKSB7XG4gICAgICAgICAgczIgPSBwZWckYzc4O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3OSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzgwKCk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNla2V5X3NoaWZ0KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNywgczg7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEwNykge1xuICAgICAgICAgIHMyID0gcGVnJGM4MTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODIpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczUgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDUpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckYzM3O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzgpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckYzM2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gW107XG4gICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICBzOCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHdoaWxlIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcucHVzaChzOCk7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IFtzNiwgczddO1xuICAgICAgICAgICAgICAgIHM1ID0gczY7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5zdWJzdHJpbmcoczQsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM4MyhzNCk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXNldF9taWRpX2NoYW5uZWwoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczY7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDY3KSB7XG4gICAgICAgICAgczIgPSBwZWckYzg0O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4NSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICB3aGlsZSAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNS5wdXNoKHM2KTtcbiAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzg2KHM0KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgcGVnJHJlc3VsdCA9IHBlZyRzdGFydFJ1bGVGdW5jdGlvbigpO1xuXG4gICAgaWYgKHBlZyRyZXN1bHQgIT09IHBlZyRGQUlMRUQgJiYgcGVnJGN1cnJQb3MgPT09IGlucHV0Lmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHBlZyRyZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChwZWckcmVzdWx0ICE9PSBwZWckRkFJTEVEICYmIHBlZyRjdXJyUG9zIDwgaW5wdXQubGVuZ3RoKSB7XG4gICAgICAgIHBlZyRmYWlsKHsgdHlwZTogXCJlbmRcIiwgZGVzY3JpcHRpb246IFwiZW5kIG9mIGlucHV0XCIgfSk7XG4gICAgICB9XG5cbiAgICAgIHRocm93IHBlZyRidWlsZEV4Y2VwdGlvbihudWxsLCBwZWckbWF4RmFpbEV4cGVjdGVkLCBwZWckbWF4RmFpbFBvcyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBTeW50YXhFcnJvcjogU3ludGF4RXJyb3IsXG4gICAgcGFyc2U6ICAgICAgIHBhcnNlXG4gIH07XG59KSgpO1xuIiwiaW1wb3J0IERlYnVnIGZyb20gXCIuL2ZyYW1lc3ludGhlc2lzL0RlYnVnXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBdWRpb01hbmFnZXIge1xyXG5cdGNvbnN0cnVjdG9yKHN5bnRoZXNpemVyLCBidWZmZXJTaXplID0gMTAyNCkge1xyXG5cdFx0dGhpcy5zeW50aGVzaXplciA9IHN5bnRoZXNpemVyO1xyXG5cdFx0dGhpcy5idWZmZXJTaXplID0gYnVmZmVyU2l6ZTtcclxuXHRcdFxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Ly8gd2Via2l0QXVkaW9Db250ZXh0IGlzIGZvciBpT1MgOFxyXG5cdFx0XHR0aGlzLmNvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0ID8gbmV3IEF1ZGlvQ29udGV4dCgpIDogbmV3IHdlYmtpdEF1ZGlvQ29udGV4dCgpO1xyXG5cdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHREZWJ1Zy5sb2coXCJlcnJvcjogVGhpcyBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgV2ViIEF1ZGlvIEFQSS5cIik7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0dGhpcy5idWZmZXJMID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLmJ1ZmZlclNpemUpO1xyXG5cdFx0dGhpcy5idWZmZXJSID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLmJ1ZmZlclNpemUpO1xyXG5cdFx0XHJcblx0XHR0aGlzLnNjcmlwdFByb2Nlc3NvciA9IHRoaXMuY29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IodGhpcy5idWZmZXJTaXplLCAwLCAyKTtcclxuXHRcdHRoaXMuc2NyaXB0UHJvY2Vzc29yLm9uYXVkaW9wcm9jZXNzID0gZSA9PiB0aGlzLnByb2Nlc3MoZSk7XHJcblx0XHR0aGlzLnNjcmlwdFByb2Nlc3Nvci5jb25uZWN0KHRoaXMuY29udGV4dC5kZXN0aW5hdGlvbik7XHJcblxyXG5cdFx0Ly8gUHJldmVudCBHQ1xyXG5cdFx0Ly8gcmVmLiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzI0MzM4MTQ0L2Nocm9tZS1vbmF1ZGlvcHJvY2Vzcy1zdG9wcy1nZXR0aW5nLWNhbGxlZC1hZnRlci1hLXdoaWxlXHJcblx0XHR3aW5kb3cuc2F2ZWRSZWZlcmVuY2UgPSB0aGlzLnNjcmlwdFByb2Nlc3NvcjtcclxuXHRcdFxyXG5cdFx0RGVidWcubG9nKFwiICBTYW1wbGluZyByYXRlIDogXCIgKyB0aGlzLmNvbnRleHQuc2FtcGxlUmF0ZSArIFwiIEh6XCIpO1xyXG5cdFx0RGVidWcubG9nKFwiICBCdWZmZXIgc2l6ZSAgIDogXCIgKyB0aGlzLnNjcmlwdFByb2Nlc3Nvci5idWZmZXJTaXplICsgXCIgc2FtcGxlc1wiKTtcclxuXHR9XHJcblx0XHJcblx0cHJvY2VzcyhlKSB7XHJcblx0XHRsZXQgb3V0TCA9IGUub3V0cHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApO1xyXG5cdFx0bGV0IG91dFIgPSBlLm91dHB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgxKTtcclxuXHRcdFxyXG5cdFx0dGhpcy5zeW50aGVzaXplci5yZW5kZXIodGhpcy5idWZmZXJMLCB0aGlzLmJ1ZmZlclIsIHRoaXMuY29udGV4dC5zYW1wbGVSYXRlKTtcclxuXHRcdFxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmJ1ZmZlclNpemU7IGkrKykge1xyXG5cdFx0XHRvdXRMW2ldID0gdGhpcy5idWZmZXJMW2ldO1xyXG5cdFx0XHRvdXRSW2ldID0gdGhpcy5idWZmZXJSW2ldO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuIiwiaW1wb3J0IE15TWF0aCBmcm9tIFwiLi9mcmFtZXN5bnRoZXNpcy9NeU1hdGhcIjtcclxuaW1wb3J0IFZvaWNlIGZyb20gXCIuL1ZvaWNlXCI7XHJcblxyXG5jb25zdCBWT0lDRV9NQVggPSAzMjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENoYW5uZWwge1xyXG5cdHJlc2V0KCkge1xyXG5cdFx0dGhpcy52b2ljZXMgPSBbXTtcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgVk9JQ0VfTUFYOyBpKyspIHtcclxuXHRcdFx0dGhpcy52b2ljZXNbaV0gPSBuZXcgVm9pY2UodGhpcyk7XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5rZXlTdGF0ZSA9IFtdO1xyXG5cdFx0XHJcblx0XHQvLyBHZW5lcmFsIE1JREkgZGVmYXVsdFxyXG5cdFx0dGhpcy52b2x1bWUgPSAxMDA7XHJcblx0XHR0aGlzLnBhbiA9IDY0O1xyXG5cdFx0dGhpcy5leHByZXNzaW9uID0gMTI3O1xyXG5cclxuXHRcdHRoaXMuZGFtcGVyUGVkYWwgPSBmYWxzZTtcclxuXHJcblx0XHR0aGlzLnBpdGNoQmVuZCA9IDA7XHJcblx0XHR0aGlzLm1vZHVsYXRpb25XaGVlbCA9IDA7XHJcblx0XHRcclxuXHRcdC8vIHByZWFsbG9jYXRlIGNoYW5uZWwgYnVmZmVyIHdpdGggbWFyZ2luXHJcblx0XHR0aGlzLmNoYW5uZWxCdWZmZXIgPSBuZXcgRmxvYXQzMkFycmF5KDQwOTYpO1xyXG5cdH1cclxuXHJcblx0bm90ZU9uKG5vdGUsIHZlbG9jaXR5KSB7XHJcblx0XHR0aGlzLmtleVN0YXRlW25vdGVdID0gdHJ1ZTtcclxuXHJcblx0XHQvLyBzdG9wIHNhbWUgbm90ZXNcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgVk9JQ0VfTUFYOyBpKyspIHtcclxuXHRcdFx0aWYgKHRoaXMudm9pY2VzW2ldLmlzUGxheWluZygpICYmIHRoaXMudm9pY2VzW2ldLm5vdGUgPT09IG5vdGUpIHtcclxuXHRcdFx0XHR0aGlzLnZvaWNlc1tpXS5zdG9wKCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBwbGF5IG5vdGVcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgVk9JQ0VfTUFYOyBpKyspIHtcclxuXHRcdFx0aWYgKCF0aGlzLnZvaWNlc1tpXS5pc1BsYXlpbmcoKSkge1xyXG5cdFx0XHRcdHRoaXMudm9pY2VzW2ldLnBsYXkobm90ZSwgdmVsb2NpdHkpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRub3RlT2ZmKG5vdGUsIHZlbG9jaXR5KSB7XHJcblx0XHR0aGlzLmtleVN0YXRlW25vdGVdID0gZmFsc2U7XHJcblxyXG5cdFx0aWYgKHRoaXMuZGFtcGVyUGVkYWwpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIHN0b3Agbm90ZXNcdFx0XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IFZPSUNFX01BWDsgaSsrKSB7XHJcblx0XHRcdGlmICh0aGlzLnZvaWNlc1tpXS5pc1BsYXlpbmcoKSAmJiB0aGlzLnZvaWNlc1tpXS5ub3RlID09PSBub3RlKSB7XHJcblx0XHRcdFx0dGhpcy52b2ljZXNbaV0uc3RvcCgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRhbGxOb3Rlc09mZigpIHtcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgVk9JQ0VfTUFYOyBpKyspIHtcclxuXHRcdFx0aWYgKHRoaXMudm9pY2VzW2ldLmlzUGxheWluZygpKSB7XHJcblx0XHRcdFx0dGhpcy52b2ljZXNbaV0uc3RvcCgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRkYW1wZXJQZWRhbE9uKCkge1xyXG5cdFx0dGhpcy5kYW1wZXJQZWRhbCA9IHRydWU7XHJcblx0fVxyXG5cclxuXHRkYW1wZXJQZWRhbE9mZigpIHtcclxuXHRcdHRoaXMuZGFtcGVyUGVkYWwgPSBmYWxzZTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IFZPSUNFX01BWDsgaSsrKSB7XHJcblx0XHRcdGlmICh0aGlzLmtleVN0YXRlW3RoaXMudm9pY2VzW2ldLm5vdGVdID09PSBmYWxzZSkge1xyXG5cdFx0XHRcdHRoaXMudm9pY2VzW2ldLnN0b3AoKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHRcclxuXHRwcm9ncmFtQ2hhbmdlKHByb2dyYW1OdW1iZXIpIHtcclxuXHR9XHJcblxyXG5cdHNldFBpdGNoQmVuZChiZW5kKSB7XHJcblx0XHR0aGlzLnBpdGNoQmVuZCA9IGJlbmQgKiAyIC8gODE5MjtcclxuXHR9XHJcblxyXG5cdHNldE1vZHVsYXRpb25XaGVlbCh3aGVlbCkge1xyXG5cdFx0dGhpcy5tb2R1bGF0aW9uV2hlZWwgPSB3aGVlbCAvIDEyNztcclxuXHR9XHJcblx0XHJcblx0c2V0Vm9sdW1lKHZvbHVtZSkge1xyXG5cdFx0dGhpcy52b2x1bWUgPSB2b2x1bWU7XHJcblx0fVxyXG5cdFxyXG5cdHNldFBhbihwYW4pIHtcclxuXHRcdHRoaXMucGFuID0gcGFuO1xyXG5cdH1cclxuXHRcclxuXHRzZXRFeHByZXNzaW9uKGV4cHJlc3Npb24pIHtcclxuXHRcdHRoaXMuZXhwcmVzc2lvbiA9IGV4cHJlc3Npb247XHJcblx0fVxyXG5cclxuXHRyZW5kZXIoYnVmZmVyTCwgYnVmZmVyUiwgc2FtcGxlUmF0ZSkge1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBidWZmZXJMLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHRoaXMuY2hhbm5lbEJ1ZmZlcltpXSA9IDA7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgVk9JQ0VfTUFYOyBpKyspIHtcclxuXHRcdFx0dGhpcy52b2ljZXNbaV0ucmVuZGVyKHRoaXMuY2hhbm5lbEJ1ZmZlciwgYnVmZmVyTC5sZW5ndGgsIHNhbXBsZVJhdGUpO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRsZXQgZ2FpbiA9ICh0aGlzLnZvbHVtZSAvIDEyNykgKiAodGhpcy5leHByZXNzaW9uIC8gMTI3KTtcclxuXHRcdGxldCBnYWluTCA9IGdhaW4gKiBNeU1hdGguY2xhbXBlZExpbmVhck1hcCh0aGlzLnBhbiwgNjQsIDEyNywgMSwgMCk7XHJcblx0XHRsZXQgZ2FpblIgPSBnYWluICogTXlNYXRoLmNsYW1wZWRMaW5lYXJNYXAodGhpcy5wYW4sIDAsIDY0LCAwLCAxKTtcclxuXHRcdFxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBidWZmZXJMLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGJ1ZmZlckxbaV0gKz0gdGhpcy5jaGFubmVsQnVmZmVyW2ldICogZ2Fpbkw7XHJcblx0XHRcdGJ1ZmZlclJbaV0gKz0gdGhpcy5jaGFubmVsQnVmZmVyW2ldICogZ2FpblI7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcbiIsImNvbnN0IFRFTVBPX0RFRkFVTFQgPSAxMjA7XHJcbmNvbnN0IElOVEVSVkFMID0gMSAvIDEwMDtcclxuXHJcbmNsYXNzIFRyYWNrIHtcclxuXHRjb25zdHJ1Y3RvcihwbGF5ZXIsIHBvcywgbGVuZ3RoKSB7XHJcblx0XHR0aGlzLnBsYXllciA9IHBsYXllcjtcclxuXHRcdFxyXG5cdFx0dGhpcy5wb3MgPSBwb3M7XHJcblx0XHR0aGlzLmVuZFBvcyA9IHBvcyArIGxlbmd0aDtcclxuXHRcdHRoaXMuZmluaXNoZWQgPSBmYWxzZTtcclxuXHRcdFxyXG5cdFx0dGhpcy5uZXh0RXZlbnRUaWNrID0gdGhpcy5yZWFkRGVsdGFUaWNrKCk7XHJcblx0fVxyXG5cdFxyXG5cdHVwZGF0ZShjdXJyZW50VGljaywgc2Vla2luZykge1xyXG5cdFx0aWYgKHRoaXMuZmluaXNoZWQpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHR3aGlsZSAodGhpcy5uZXh0RXZlbnRUaWNrIDwgY3VycmVudFRpY2spIHtcclxuXHRcdFx0Ly8gc2VuZCBNSURJIG1lc3NhZ2VcclxuXHRcdFx0bGV0IHN0YXR1c0J5dGUgPSB0aGlzLnJlYWRCeXRlKCk7XHJcblx0XHRcdGxldCBzdGF0dXNVcHBlcjRiaXRzID0gc3RhdHVzQnl0ZSA+PiA0O1xyXG5cdFx0XHRcclxuXHRcdFx0Ly8gbWV0YSBldmVudFxyXG5cdFx0XHRpZiAoc3RhdHVzQnl0ZSA9PT0gMHhmZikge1xyXG5cdFx0XHRcdGxldCBtZXRhRXZlbnRUeXBlID0gdGhpcy5yZWFkQnl0ZSgpO1xyXG5cdFx0XHRcdGxldCBsZW5ndGggPSB0aGlzLnJlYWRCeXRlKCk7XHJcblxyXG5cdFx0XHRcdGlmIChtZXRhRXZlbnRUeXBlID09PSAweDUxKSB7XHJcblx0XHRcdFx0XHRpZiAobGVuZ3RoID09PSAzKSB7XHJcblx0XHRcdFx0XHRcdGxldCBxdWFydGVyTWljcm9zZWNvbmRzID0gdGhpcy5yZWFkQnl0ZSgpIDw8IDE2IHwgdGhpcy5yZWFkQnl0ZSgpIDw8IDggfCB0aGlzLnJlYWRCeXRlKCk7XHJcblx0XHRcdFx0XHRcdHRoaXMucGxheWVyLnF1YXJ0ZXJUaW1lID0gcXVhcnRlck1pY3Jvc2Vjb25kcyAvIDEwMDA7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMucG9zICs9IGxlbmd0aDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdC8vIHN5c3RlbSBleGNsdXNpdmUgbWVzc2FnZVxyXG5cdFx0XHRpZiAoc3RhdHVzQnl0ZSA9PT0gMHhmMCkge1xyXG5cdFx0XHRcdGxldCBzeXN0ZW1FeGNsdXNpdmUgPSBbc3RhdHVzQnl0ZV07XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0d2hpbGUgKHRydWUpIHtcclxuXHRcdFx0XHRcdGlmICh0aGlzLnBvcyA+PSB0aGlzLmVuZFBvcykge1xyXG5cdFx0XHRcdFx0XHR0aHJvdyBFcnJvcihcImlsbGVnYWwgc3lzdGVtIGV4bHVzaXZlIG1lc3NhZ2VcIik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdGxldCBieXRlID0gdGhpcy5yZWFkQnl0ZSgpO1xyXG5cdFx0XHRcdFx0aWYgKGJ5dGUgPT09IDB4ZjcpIHtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRzeXN0ZW1FeGNsdXNpdmUucHVzaChieXRlKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dGhpcy5wbGF5ZXIuc3ludGhlc2l6ZXIucHJvY2Vzc01JRElNZXNzYWdlKHN5c3RlbUV4Y2x1c2l2ZSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIHNraXAgdW5zdXBwb3J0ZWQgMiBieXRlcyBtZXNzYWdlc1xyXG5cdFx0XHRpZiAoc3RhdHVzQnl0ZSA9PT0gMHhmMSB8fCBzdGF0dXNCeXRlID09PSAweGYyIHx8IHN0YXR1c0J5dGUgPT09IDB4ZjMpIHtcclxuXHRcdFx0XHR0aGlzLnJlYWRCeXRlKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHN3aXRjaCAoc3RhdHVzVXBwZXI0Yml0cykge1xyXG5cdFx0XHRcdC8vIDMgYnl0ZXMgbWVzc2FnZVxyXG5cdFx0XHRcdGNhc2UgMHg4OlxyXG5cdFx0XHRcdGNhc2UgMHg5OlxyXG5cdFx0XHRcdGNhc2UgMHhhOlxyXG5cdFx0XHRcdGNhc2UgMHhiOlxyXG5cdFx0XHRcdGNhc2UgMHhlOlxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRsZXQgZGF0YUJ5dGUxID0gdGhpcy5yZWFkQnl0ZSgpO1xyXG5cdFx0XHRcdFx0XHRsZXQgZGF0YUJ5dGUyID0gdGhpcy5yZWFkQnl0ZSgpO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKHNlZWtpbmcgJiYgKHN0YXR1c1VwcGVyNGJpdHMgPT09IDB4OCB8fCBzdGF0dXNVcHBlcjRiaXRzID09PSAweDkpKSB7XHJcblx0XHRcdFx0XHRcdFx0Ly8gc2tpcCBub3RlIG9uL29mZiB3aGVuIHNlZWtpbmdcclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLnBsYXllci5zeW50aGVzaXplci5wcm9jZXNzTUlESU1lc3NhZ2UoW3N0YXR1c0J5dGUsIGRhdGFCeXRlMSwgZGF0YUJ5dGUyXSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0Ly8gMiBieXRlcyBtZXNzYWdlXHJcblx0XHRcdFx0Y2FzZSAweGM6XHJcblx0XHRcdFx0Y2FzZSAweGQ6XHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdGxldCBkYXRhQnl0ZTEgPSB0aGlzLnJlYWRCeXRlKCk7XHJcblx0XHRcdFx0XHRcdHRoaXMucGxheWVyLnN5bnRoZXNpemVyLnByb2Nlc3NNSURJTWVzc2FnZShbc3RhdHVzQnl0ZSwgZGF0YUJ5dGUxXSk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodGhpcy5wb3MgPj0gdGhpcy5lbmRQb3MpIHtcclxuXHRcdFx0XHQvLyBlbmQgb2YgdHJhY2sgZGF0YVxyXG5cdFx0XHRcdHRoaXMuZmluaXNoZWQgPSB0cnVlO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHQvLyBjYWxjdWxhdGUgbmV4dCBldmVudCB0aWNrXHJcblx0XHRcdHRoaXMubmV4dEV2ZW50VGljayArPSB0aGlzLnJlYWREZWx0YVRpY2soKTtcclxuXHRcdH1cclxuXHR9XHJcblx0XHJcblx0cmVhZEJ5dGUoKSB7XHJcblx0XHRyZXR1cm4gdGhpcy5wbGF5ZXIuc21mW3RoaXMucG9zKytdO1xyXG5cdH1cclxuXHRcclxuXHRyZWFkRGVsdGFUaWNrKCkge1xyXG5cdFx0bGV0IHRpY2sgPSAwO1xyXG5cdFx0bGV0IG47XHJcblx0XHRcclxuXHRcdGRvIHtcclxuXHRcdFx0biA9IHRoaXMucmVhZEJ5dGUoKTtcclxuXHRcdFx0dGljayA8PD0gNztcclxuXHRcdFx0dGljayB8PSAobiAmIDB4N2YpO1xyXG5cdFx0fSB3aGlsZSAobiAmIDB4ODApO1xyXG5cdFx0XHJcblx0XHRpZiAodGljayA+IDB4ZmZmZmZmZikge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2FsIGRlbHRhIHRpY2tcIik7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdGljaztcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNNRlBsYXllciB7XHJcblx0Y29uc3RydWN0b3Ioc3ludGhlc2l6ZXIpIHtcclxuXHRcdHRoaXMuc3ludGhlc2l6ZXIgPSBzeW50aGVzaXplcjtcclxuXHR9XHJcblx0XHJcblx0cGxheShzbWYsIHN0YXJ0VGljayA9IDApIHtcclxuXHRcdHRoaXMuc21mID0gc21mO1xyXG5cdFx0dGhpcy5zdGFydFRpY2sgPSBzdGFydFRpY2s7XHJcblx0XHRcclxuXHRcdHRoaXMucXVhcnRlclRpbWUgPSA2MCAqIDEwMDAgLyBURU1QT19ERUZBVUxUOyAvLyBtc1xyXG5cdFx0XHJcblx0XHQvLyByZWFkIFNNRiBoZWFkZXJcclxuXHRcdGxldCBwb3MgPSA4O1xyXG5cdFx0XHJcblx0XHRmdW5jdGlvbiByZWFkMmJ5dGVzKCkge1xyXG5cdFx0XHRyZXR1cm4gc21mW3BvcysrXSA8PCA4IHwgc21mW3BvcysrXTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0ZnVuY3Rpb24gcmVhZDRieXRlcygpIHtcclxuXHRcdFx0cmV0dXJuIHNtZltwb3MrK10gPDwgMjQgfCBzbWZbcG9zKytdIDw8IDE2IHwgc21mW3BvcysrXSA8PCA4IHwgc21mW3BvcysrXTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0bGV0IGZvcm1hdCA9IHJlYWQyYnl0ZXMoKTtcclxuXHRcdHRoaXMudHJhY2tOdW1iZXIgPSByZWFkMmJ5dGVzKCk7XHJcblx0XHR0aGlzLnRpbWViYXNlID0gcmVhZDJieXRlcygpO1xyXG5cdFx0XHJcblx0XHQvLyBlcnJvciBjaGVja1xyXG5cdFx0Y29uc3QgU01GX0hFQURFUiA9IFsweDRkLCAweDU0LCAweDY4LCAweDY0LCAweDAwLCAweDAwLCAweDAwLCAweDA2XTtcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgU01GX0hFQURFUi5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRpZiAodGhpcy5zbWZbaV0gIT0gU01GX0hFQURFUltpXSkge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIm5vdCBhIHN0YW5kYXJkIE1JREkgZmlsZVwiKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRpZiAoZm9ybWF0ICE9PSAwICYmIGZvcm1hdCAhPT0gMSkge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJ3cm9uZyBTTUYgZm9ybWF0XCIpO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRpZiAoZm9ybWF0ID09PSAwICYmIHRoaXMudHJhY2tOdW1iZXIgIT09IDEpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiaWxsZWdhbCB0cmFjayBudW1iZXJcIik7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMudHJhY2tzID0gW107XHJcblx0XHRcclxuXHRcdC8vIHJlYWQgdHJhY2sgaGVhZGVyc1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnRyYWNrTnVtYmVyOyBpKyspIHtcclxuXHRcdFx0cG9zICs9IDQ7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgbGVuZ3RoID0gcmVhZDRieXRlcygpO1xyXG5cdFx0XHR0aGlzLnRyYWNrcy5wdXNoKG5ldyBUcmFjayh0aGlzLCBwb3MsIGxlbmd0aCkpO1xyXG5cdFx0XHRcclxuXHRcdFx0cG9zICs9IGxlbmd0aDtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0Ly8gc2V0IHVwIHRpbWVyXHJcblx0XHR0aGlzLnByZXZUaW1lID0gRGF0ZS5ub3coKTtcclxuXHRcdHRoaXMuY3VycmVudFRpY2sgPSAwO1xyXG5cdFx0XHJcblx0XHRpZiAoIXRoaXMuaW50ZXJ2YWxJZCkge1xyXG5cdFx0XHR0aGlzLmludGVydmFsSWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLm9uSW50ZXJ2YWwoKSwgSU5URVJWQUwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRcclxuXHRzdG9wKCkge1xyXG5cdFx0Y2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsSWQpO1xyXG5cdFx0dGhpcy5pbnRlcnZhbElkID0gbnVsbDtcclxuXHR9XHJcblx0XHJcblx0b25JbnRlcnZhbCgpIHtcclxuXHRcdC8vIGNhbGNsYXRlIGRlbHRhIHRpbWVcclxuXHRcdGxldCBjdXJyZW50VGltZSA9IERhdGUubm93KCk7XHJcblx0XHRsZXQgZGVsdGFUaW1lID0gY3VycmVudFRpbWUgLSB0aGlzLnByZXZUaW1lO1xyXG5cdFx0dGhpcy5wcmV2VGltZSA9IGN1cnJlbnRUaW1lOyBcclxuXHRcdFxyXG5cdFx0bGV0IHRpY2tUaW1lID0gdGhpcy5xdWFydGVyVGltZSAvIHRoaXMudGltZWJhc2U7XHJcblx0XHRcclxuXHRcdGxldCBzZWVraW5nID0gZmFsc2U7XHJcblx0XHRpZiAodGhpcy5jdXJyZW50VGljayA8IHRoaXMuc3RhcnRUaWNrKSB7XHJcblx0XHRcdC8vIHNlZWsgdG8gc3RhcnQgdGljayBzbG93bHlcclxuXHRcdFx0Ly8gdGhpcy5jdXJyZW50VGljayArPSBkZWx0YVRpbWUgKiAxMDAgLyB0aWNrVGltZTtcclxuXHRcdFx0Ly8gaWYgKHRoaXMuY3VycmVudFRpY2sgPiB0aGlzLnN0YXJ0VGljaykge1xyXG5cdFx0XHQvLyBcdHRoaXMuY3VycmVudFRpY2sgPSB0aGlzLnN0YXJ0VGljaztcclxuXHRcdFx0Ly8gfVxyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5jdXJyZW50VGljayA9IHRoaXMuc3RhcnRUaWNrO1xyXG5cdFx0XHRzZWVraW5nID0gdHJ1ZTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuY3VycmVudFRpY2sgKz0gZGVsdGFUaW1lIC8gdGlja1RpbWU7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy50cmFja3MubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0dGhpcy50cmFja3NbaV0udXBkYXRlKHRoaXMuY3VycmVudFRpY2ssIHNlZWtpbmcpO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQvLyBzdG9wIHdoZW4gYWxsIHRyYWNrcyBmaW5pc2hcclxuXHRcdGxldCBwbGF5aW5nVHJhY2sgPSAwO1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnRyYWNrcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRpZiAodGhpcy50cmFja3NbaV0uZmluaXNoZWQgPT09IGZhbHNlKSB7XHJcblx0XHRcdFx0cGxheWluZ1RyYWNrKys7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGlmIChwbGF5aW5nVHJhY2sgPT09IDApIHtcclxuXHRcdFx0dGhpcy5zdG9wKCk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcbiIsImltcG9ydCBEZWJ1ZyBmcm9tIFwiLi9mcmFtZXN5bnRoZXNpcy9EZWJ1Z1wiO1xyXG5pbXBvcnQgUGxhdGZvcm0gZnJvbSBcIi4vZnJhbWVzeW50aGVzaXMvUGxhdGZvcm1cIjtcclxuaW1wb3J0IEF1ZGlvTWFuYWdlciBmcm9tIFwiLi9BdWRpb01hbmFnZXJcIjtcclxuaW1wb3J0IENoYW5uZWwgZnJvbSBcIi4vQ2hhbm5lbFwiO1xyXG5cclxuY29uc3QgQ0hBTk5FTF9NQVggPSAxNjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFN5bnRoZXNpemVyIHtcclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xyXG5cdFx0XHJcblx0XHR0aGlzLmNoYW5uZWxzID0gW107XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IENIQU5ORUxfTUFYOyBpKyspIHtcclxuXHRcdFx0dGhpcy5jaGFubmVsc1tpXSA9IG5ldyBDaGFubmVsKCk7XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdHRoaXMucmVzZXQoKTtcclxuXHRcdFxyXG5cdFx0dGhpcy5hdWRpb01hbmFnZXIgPSBudWxsO1xyXG5cdFx0aWYgKCFQbGF0Zm9ybS5pc2lPUygpKSB7XHJcblx0XHRcdHRoaXMuY3JlYXRlQXVkaW9NYW5hZ2VyKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cdFxyXG5cdGNyZWF0ZUF1ZGlvTWFuYWdlcigpIHtcclxuXHRcdGlmICghdGhpcy5hdWRpb01hbmFnZXIpIHtcclxuXHRcdFx0RGVidWcubG9nKFwiSW5pdGlhbGl6aW5nIFdlYiBBdWRpb1wiKTtcclxuXHRcdFx0dGhpcy5hdWRpb01hbmFnZXIgPSBuZXcgQXVkaW9NYW5hZ2VyKHRoaXMpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmVzZXQoKSB7XHJcblx0XHREZWJ1Zy5sb2coXCJJbml0aWFsaXppbmcgU3ludGhlc2l6ZXJcIik7XHJcblx0XHRcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgQ0hBTk5FTF9NQVg7IGkrKykge1xyXG5cdFx0XHR0aGlzLmNoYW5uZWxzW2ldLnJlc2V0KCk7XHJcblx0XHR9XHJcblx0fVxyXG5cdFxyXG5cdHJlbmRlcihidWZmZXJMLCBidWZmZXJSLCBzYW1wbGVSYXRlKSB7XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlckwubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0YnVmZmVyTFtpXSA9IDA7XHJcblx0XHRcdGJ1ZmZlclJbaV0gPSAwO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IENIQU5ORUxfTUFYOyBpKyspIHtcclxuXHRcdFx0dGhpcy5jaGFubmVsc1tpXS5yZW5kZXIoYnVmZmVyTCwgYnVmZmVyUiwgc2FtcGxlUmF0ZSk7XHJcblx0XHR9XHJcblx0fVxyXG5cdFxyXG5cdHByb2Nlc3NNSURJTWVzc2FnZShkYXRhKSB7XHJcblx0XHRpZiAoIWRhdGEpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0XHQvLyBhdm9pZCBpT1MgYXVkaW8gcmVzdHJpY3Rpb25cclxuXHRcdHRoaXMuY3JlYXRlQXVkaW9NYW5hZ2VyKCk7XHJcblx0XHRcclxuXHRcdGxldCBzdGF0dXNCeXRlID0gZGF0YVswXTtcclxuXHRcdGlmICghc3RhdHVzQnl0ZSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRcclxuXHRcdGxldCBzdGF0dXNVcHBlcjRiaXRzID0gc3RhdHVzQnl0ZSA+PiA0O1xyXG5cdFx0bGV0IGNoYW5uZWwgPSBzdGF0dXNCeXRlICYgMHhmO1xyXG5cdFx0bGV0IG1pZGlDaGFubmVsID0gY2hhbm5lbCArIDE7XHJcblx0XHRcclxuXHRcdGlmIChzdGF0dXNVcHBlcjRiaXRzID09PSAweDkpIHtcclxuXHRcdFx0bGV0IG5vdGUgPSBkYXRhWzFdO1xyXG5cdFx0XHRsZXQgdmVsb2NpdHkgPSBkYXRhWzJdO1xyXG5cclxuXHRcdFx0dGhpcy5sb2coYENoLiAke21pZGlDaGFubmVsfSBOb3RlIE9uICBub3RlOiAke25vdGV9IHZlbG9jaXR5OiAke3ZlbG9jaXR5fWApO1xyXG5cdFx0XHR0aGlzLmNoYW5uZWxzW2NoYW5uZWxdLm5vdGVPbihub3RlLCB2ZWxvY2l0eSk7XHJcblx0XHR9XHJcblx0XHRpZiAoc3RhdHVzVXBwZXI0Yml0cyA9PT0gMHg4KSB7XHJcblx0XHRcdGxldCBub3RlID0gZGF0YVsxXTtcclxuXHRcdFx0bGV0IHZlbG9jaXR5ID0gZGF0YVsyXTtcclxuXHJcblx0XHRcdHRoaXMubG9nKGBDaC4gJHttaWRpQ2hhbm5lbH0gTm90ZSBPZmYgbm90ZTogJHtub3RlfSB2ZWxvY2l0eTogJHt2ZWxvY2l0eX1gKTtcclxuXHRcdFx0dGhpcy5jaGFubmVsc1tjaGFubmVsXS5ub3RlT2ZmKG5vdGUsIHZlbG9jaXR5KTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0aWYgKHN0YXR1c1VwcGVyNGJpdHMgPT09IDB4Yykge1xyXG5cdFx0XHRsZXQgcHJvZ3JhbU51bWJlciA9IGRhdGFbMV07XHJcblxyXG5cdFx0XHR0aGlzLmxvZyhgQ2guICR7bWlkaUNoYW5uZWx9IFByb2dyYW0gQ2hhbmdlOiAke3Byb2dyYW1OdW1iZXJ9YCk7XHJcblx0XHRcdHRoaXMuY2hhbm5lbHNbY2hhbm5lbF0ucHJvZ3JhbUNoYW5nZShwcm9ncmFtTnVtYmVyKTtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0aWYgKHN0YXR1c1VwcGVyNGJpdHMgPT09IDB4ZSkge1xyXG5cdFx0XHRsZXQgbHNiID0gZGF0YVsxXTtcclxuXHRcdFx0bGV0IG1zYiA9IGRhdGFbMl07XHJcblx0XHRcdGxldCBiZW5kID0gKChtc2IgPDwgNykgfCBsc2IpIC0gODE5MjtcclxuXHJcblx0XHRcdHRoaXMubG9nKGBDaC4gJHttaWRpQ2hhbm5lbH0gUGl0Y2ggYmVuZDogJHtiZW5kfWApO1xyXG5cdFx0XHR0aGlzLmNoYW5uZWxzW2NoYW5uZWxdLnNldFBpdGNoQmVuZChiZW5kKTtcclxuXHRcdH1cclxuXHRcdGlmIChzdGF0dXNVcHBlcjRiaXRzID09PSAweGIpIHtcclxuXHRcdFx0bGV0IGNvbnRyb2xOdW1iZXIgPSBkYXRhWzFdO1xyXG5cdFx0XHRsZXQgdmFsdWUgPSBkYXRhWzJdO1xyXG5cclxuXHRcdFx0aWYgKGNvbnRyb2xOdW1iZXIgPT09IDEpIHtcclxuXHRcdFx0XHR0aGlzLmxvZyhgQ2guICR7bWlkaUNoYW5uZWx9IE1vZHVsYXRpb24gV2hlZWw6ICR7dmFsdWV9YCk7XHJcblx0XHRcdFx0dGhpcy5jaGFubmVsc1tjaGFubmVsXS5zZXRNb2R1bGF0aW9uV2hlZWwodmFsdWUpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChjb250cm9sTnVtYmVyID09PSA3KSB7XHJcblx0XHRcdFx0dGhpcy5sb2coYENoLiAke21pZGlDaGFubmVsfSBDaGFubmVsIFZvbHVtZTogJHt2YWx1ZX1gKTtcclxuXHRcdFx0XHR0aGlzLmNoYW5uZWxzW2NoYW5uZWxdLnNldFZvbHVtZSh2YWx1ZSk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKGNvbnRyb2xOdW1iZXIgPT09IDEwKSB7XHJcblx0XHRcdFx0dGhpcy5sb2coYENoLiAke21pZGlDaGFubmVsfSBQYW46ICR7dmFsdWV9YCk7XHJcblx0XHRcdFx0dGhpcy5jaGFubmVsc1tjaGFubmVsXS5zZXRQYW4odmFsdWUpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChjb250cm9sTnVtYmVyID09PSAxMSkge1xyXG5cdFx0XHRcdHRoaXMubG9nKGBDaC4gJHttaWRpQ2hhbm5lbH0gRXhwcmVzc2lvbiBDb250cm9sbGVyOiAke3ZhbHVlfWApO1xyXG5cdFx0XHRcdHRoaXMuY2hhbm5lbHNbY2hhbm5lbF0uc2V0RXhwcmVzc2lvbih2YWx1ZSk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKGNvbnRyb2xOdW1iZXIgPT09IDY0KSB7XHJcblx0XHRcdFx0aWYgKHZhbHVlID49IDY0KSB7XHJcblx0XHRcdFx0XHR0aGlzLmxvZyhgQ2guICR7bWlkaUNoYW5uZWx9IERhbXBlciBQZWRhbCBPbmApO1xyXG5cdFx0XHRcdFx0dGhpcy5jaGFubmVsc1tjaGFubmVsXS5kYW1wZXJQZWRhbE9uKCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMubG9nKGBDaC4gJHttaWRpQ2hhbm5lbH0gRGFtcGVyIFBlZGFsIE9mZmApO1xyXG5cdFx0XHRcdFx0dGhpcy5jaGFubmVsc1tjaGFubmVsXS5kYW1wZXJQZWRhbE9mZigpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoY29udHJvbE51bWJlciA9PT0gMTIzKSB7XHJcblx0XHRcdFx0aWYgKHZhbHVlID09PSAwKSB7XHJcblx0XHRcdFx0XHR0aGlzLmxvZyhgQ2guICR7bWlkaUNoYW5uZWx9IEFsbCBOb3RlcyBPZmZgKTtcclxuXHRcdFx0XHRcdHRoaXMuY2hhbm5lbHNbY2hhbm5lbF0uYWxsTm90ZXNPZmYoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblx0XHJcblx0bG9nKG1lc3NhZ2UpIHtcclxuXHRcdGlmICh0aGlzLm9wdGlvbnMgJiYgdGhpcy5vcHRpb25zLnZlcmJvc2UpIHtcclxuXHRcdFx0RGVidWcubG9nKG1lc3NhZ2UpO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuIiwiaW1wb3J0IFNxdWFyZU9zY2lsbGF0b3IgZnJvbSBcIi4vb3NjaWxsYXRvcnMvU3F1YXJlT3NjaWxsYXRvclwiO1xyXG5pbXBvcnQgVHJpYW5nbGVPc2NpbGxhdG9yIGZyb20gXCIuL29zY2lsbGF0b3JzL1RyaWFuZ2xlT3NjaWxsYXRvclwiO1xyXG5cclxuY29uc3QgU1RBVEVfT0ZGID0gMDtcclxuY29uc3QgU1RBVEVfQVRUQUNLID0gMTsgLy8gbm90IHVzZWRcclxuY29uc3QgU1RBVEVfREVDQVkgPSAyOyAvLyBub3QgdXNlZFxyXG5jb25zdCBTVEFURV9TVVNUQUlOID0gMztcclxuY29uc3QgU1RBVEVfUkVMRUFTRSA9IDQ7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBWb2ljZSB7XHJcblx0Y29uc3RydWN0b3Ioc3ludGhlc2l6ZXIpIHtcclxuXHRcdHRoaXMuc3ludGhlc2l6ZXIgPSBzeW50aGVzaXplcjtcclxuXHRcdHRoaXMuc3RhdGUgPSBTVEFURV9PRkY7IFxyXG5cdH1cclxuXHRcclxuXHRwbGF5KG5vdGUsIHZlbG9jaXR5KSB7XHJcblx0XHR0aGlzLnN0YXRlID0gU1RBVEVfU1VTVEFJTjtcclxuXHRcdHRoaXMubm90ZSA9IG5vdGU7XHJcblx0XHR0aGlzLmZyZXF1ZW5jeSA9IDQ0MCAqIE1hdGgucG93KDIsIChub3RlIC0gNjkpIC8gMTIpO1xyXG5cdFx0dGhpcy52b2x1bWUgPSB2ZWxvY2l0eSAvIDEyNztcclxuXHRcdHRoaXMucGhhc2UgPSAwO1xyXG5cdFx0XHJcblx0XHR0aGlzLm9zY2lsbGF0b3IgPSBuZXcgU3F1YXJlT3NjaWxsYXRvcigpO1xyXG5cdFx0Ly8gdGhpcy5vc2NpbGxhdG9yID0gbmV3IFRyaWFuZ2xlT3NjaWxsYXRvcigpO1xyXG5cdFx0XHJcblx0XHR0aGlzLnZpYnJhdG9Pc2NpbGxhdG9yID0gbmV3IFRyaWFuZ2xlT3NjaWxsYXRvcigpO1xyXG5cdFx0dGhpcy52aWJyYXRvUGhhc2UgPSAwO1xyXG5cdFx0dGhpcy52aWJyYXRvRnJlcXVlbmN5ID0gODtcclxuXHRcdHRoaXMudmlicmF0b0FtcGxpdHVkZSA9IDAuNTtcclxuXHRcdFxyXG5cdFx0dGhpcy5vdmVyc2FtcGxpbmcgPSA0O1xyXG5cdH1cclxuXHRcclxuXHRzdG9wKCkge1xyXG5cdFx0dGhpcy5zdGF0ZSA9IFNUQVRFX1JFTEVBU0U7XHJcblx0fVxyXG5cdFxyXG5cdHJlbmRlcihidWZmZXIsIGxlbmd0aCwgc2FtcGxlUmF0ZSkge1xyXG5cdFx0aWYgKHRoaXMuc3RhdGUgIT09IFNUQVRFX09GRikge1xyXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0bGV0IGFtcGxpdHVkZSA9IHRoaXMuc3ludGhlc2l6ZXIubW9kdWxhdGlvbldoZWVsICogdGhpcy52aWJyYXRvQW1wbGl0dWRlO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGxldCB2aWJyYXRvUGVyaW9kID0gc2FtcGxlUmF0ZSAvIHRoaXMudmlicmF0b0ZyZXF1ZW5jeTtcclxuXHRcdFx0XHR0aGlzLnZpYnJhdG9QaGFzZSArPSAxIC8gdmlicmF0b1BlcmlvZDtcclxuXHRcdFx0XHRsZXQgdmlicmF0b09mZnNldCA9IHRoaXMudmlicmF0b09zY2lsbGF0b3IuZ2V0U2FtcGxlKHRoaXMudmlicmF0b1BoYXNlKSAqIGFtcGxpdHVkZTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRsZXQgZnJlcXVlbmN5ID0gdGhpcy5ub3RlMmZyZXF1ZW5jeSh0aGlzLm5vdGUgKyB0aGlzLnN5bnRoZXNpemVyLnBpdGNoQmVuZCArIHZpYnJhdG9PZmZzZXQpO1xyXG5cdFx0XHRcdGxldCBwZXJpb2QgPSBzYW1wbGVSYXRlIC8gZnJlcXVlbmN5O1xyXG5cdFx0XHRcclxuXHRcdFx0XHRsZXQgc2FtcGxlID0gMDtcclxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMub3ZlcnNhbXBsaW5nOyBpKyspIHtcclxuXHRcdFx0XHRcdHNhbXBsZSArPSB0aGlzLm9zY2lsbGF0b3IuZ2V0U2FtcGxlKHRoaXMucGhhc2UpO1xyXG5cdFx0XHRcdFx0dGhpcy5waGFzZSArPSAxIC8gcGVyaW9kIC8gdGhpcy5vdmVyc2FtcGxpbmc7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJ1ZmZlcltpXSArPSBzYW1wbGUgLyB0aGlzLm92ZXJzYW1wbGluZyAqIHRoaXMudm9sdW1lICogMC4xO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmICh0aGlzLnN0YXRlID09PSBTVEFURV9SRUxFQVNFKSB7XHJcblx0XHRcdFx0XHR0aGlzLnZvbHVtZSAtPSAwLjAwNTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dGhpcy52b2x1bWUgKj0gMC45OTk5OTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0aWYgKHRoaXMudm9sdW1lIDwgMCkge1xyXG5cdFx0XHRcdFx0dGhpcy5zdGF0ZSA9IFNUQVRFX09GRjtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblx0XHJcblx0aXNQbGF5aW5nKCkge1xyXG5cdFx0aWYgKHRoaXMuc3RhdGUgIT09IFNUQVRFX09GRikge1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblx0XHJcblx0bm90ZTJmcmVxdWVuY3kobm90ZSkge1xyXG5cdFx0cmV0dXJuIDQ0MCAqIE1hdGgucG93KDIsIChub3RlIC0gNjkpIC8gMTIpO1xyXG5cdH1cclxufVxyXG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBEZWJ1ZyB7XHJcblx0c3RhdGljIGNsZWFyKCkge1xyXG5cdFx0aWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJkZWJ1Z1wiKS5pbm5lckhUTUwgPSBcIlwiO1xyXG5cdH1cclxuXHRcclxuXHRzdGF0aWMgbG9nKG1lc3NhZ2UpIHtcclxuXHRcdGlmICh0eXBlb2YgZG9jdW1lbnQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCBlbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJkZWJ1Z1wiKTtcclxuXHRcdGlmIChlbGVtZW50KSB7XHJcblx0XHRcdGxldCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cdFx0XHRsZXQgdGV4dCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG1lc3NhZ2UpO1xyXG5cdFx0XHRkaXYuYXBwZW5kQ2hpbGQodGV4dCk7XHJcblx0XHRcdFxyXG5cdFx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGRpdik7XHJcblx0XHRcdHdoaWxlIChlbGVtZW50LnNjcm9sbEhlaWdodCA+IGVsZW1lbnQuY2xpZW50SGVpZ2h0KSB7XHJcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmVDaGlsZChlbGVtZW50LmZpcnN0Q2hpbGQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59XHJcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIE15TWF0aCB7XHJcblx0c3RhdGljIHJhbmRvbShtaW4sIG1heCkge1xyXG5cdFx0cmV0dXJuIG1pbiArIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKTtcclxuXHR9XHJcblxyXG5cdHN0YXRpYyBjbGFtcCh2YWx1ZSwgbWluLCBtYXgpXHJcblx0e1xyXG5cdFx0aWYgKG1pbiA+IG1heCkge1xyXG5cdFx0XHR2YXIgdGVtcCA9IG1pbjtcclxuXHRcdFx0bWluID0gbWF4O1xyXG5cdFx0XHRtYXggPSB0ZW1wO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh2YWx1ZSA8IG1pbikge1xyXG5cdFx0XHRyZXR1cm4gbWluO1xyXG5cdFx0fVxyXG5cdFx0aWYgKHZhbHVlID4gbWF4KSB7XHJcblx0XHRcdHJldHVybiBtYXg7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdmFsdWU7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgbGluZWFyTWFwKHZhbHVlLCBzMCwgczEsIGQwLCBkMSlcclxuXHR7XHJcblx0XHRyZXR1cm4gZDAgKyAodmFsdWUgLSBzMCkgKiAoZDEgLSBkMCkgLyAoczEgLSBzMCk7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgY2xhbXBlZExpbmVhck1hcCh2YWx1ZSwgczAsIHMxLCBkMCwgZDEpXHJcblx0e1xyXG5cdFx0cmV0dXJuIHRoaXMuY2xhbXAodGhpcy5saW5lYXJNYXAodmFsdWUsIHMwLCBzMSwgZDAsIGQxKSwgZDAsIGQxKTtcclxuXHR9XHJcblxyXG5cdHN0YXRpYyBlYXNlKHZhbHVlLCB0YXJnZXQsIGZhY3RvciwgZGVsdGFUaW1lKSB7XHJcblx0XHRyZXR1cm4gdmFsdWUgKyAodGFyZ2V0IC0gdmFsdWUpICogKDEgLSBNYXRoLmV4cCgtZmFjdG9yICogZGVsdGFUaW1lKSk7XHJcblx0fVxyXG5cclxuXHRzdGF0aWMgcmFkaWFuKGRlZ3JlZSkge1xyXG5cdFx0cmV0dXJuIGRlZ3JlZSAqIDAuMDE3NDUzMjkyNTE5OTQzMzA7IC8vIE1hdGguUEkgLyAxODBcclxuXHR9XHJcblxyXG5cdHN0YXRpYyBkZWdyZWUocmFkaWFuKSB7XHJcblx0XHRyZXR1cm4gcmFkaWFuICogNTcuMjk1Nzc5NTEzMDgyMzIwODsgLy8gMTgwIC8gTWF0aC5QSVxyXG5cdH1cclxuXHJcblx0c3RhdGljIHdyYXAodmFsdWUsIG1pbiwgbWF4KSB7XHJcblx0XHRsZXQgbiA9ICh2YWx1ZSAtIG1pbikgJSAobWF4IC0gbWluKTtcclxuXHRcdHJldHVybiAobiA+PSAwKSA/IG4gKyBtaW4gOiBuICsgbWF4O1xyXG5cdH1cclxufVxyXG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBQbGF0Zm9ybSB7XHJcblx0c3RhdGljIGlzaU9TKCkge1xyXG5cdFx0cmV0dXJuIHRoaXMuaXNpUGhvbmUoKSB8fCB0aGlzLmlzaVBhZCgpO1xyXG5cdH1cclxuXHRcclxuXHRzdGF0aWMgaXNpUGhvbmUoKSB7XHJcblx0XHRpZiAodHlwZW9mIGRvY3VtZW50ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gd2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZihcImlQaG9uZVwiKSA+PSAwO1xyXG5cdH1cclxuXHRcclxuXHRzdGF0aWMgaXNpUGFkKCkge1xyXG5cdFx0aWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50LmluZGV4T2YoXCJpUGFkXCIpID49IDA7XHJcblx0fVxyXG59XHJcbiIsImV4cG9ydCB7IGRlZmF1bHQgYXMgbW1sMnNtZiB9IGZyb20gXCJtbWwyc21mXCI7XHJcbmV4cG9ydCB7IGRlZmF1bHQgYXMgU3ludGhlc2l6ZXIgfSBmcm9tIFwiLi9TeW50aGVzaXplclwiO1xyXG5leHBvcnQgeyBkZWZhdWx0IGFzIFNNRlBsYXllciB9IGZyb20gXCIuL1NNRlBsYXllclwiO1xyXG4iLCJpbXBvcnQgTXlNYXRoIGZyb20gXCIuLi9mcmFtZXN5bnRoZXNpcy9NeU1hdGhcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNxdWFyZU9zY2lsbGF0b3Ige1xyXG5cdGdldFNhbXBsZShwaGFzZSkge1xyXG5cdFx0bGV0IHAgPSBwaGFzZSAlIDE7XHJcblxyXG5cdFx0cmV0dXJuIHAgPCAwLjUgPyAxIDogLTE7XHJcblx0fVxyXG59XHJcbiIsImltcG9ydCBNeU1hdGggZnJvbSBcIi4uL2ZyYW1lc3ludGhlc2lzL015TWF0aFwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVHJpYW5nbGVPc2NpbGxhdG9yIHtcclxuXHRnZXRTYW1wbGUocGhhc2UpIHtcclxuXHRcdGxldCBwID0gcGhhc2UgJSAxO1xyXG5cdFx0XHJcblx0XHRpZiAocCA8IDAuMjUpIHtcclxuXHRcdFx0cmV0dXJuIE15TWF0aC5saW5lYXJNYXAocCwgMCwgMC4yNSwgMCwgMSk7XHJcblx0XHRcdC8vIHJldHVybiBwICogNDtcclxuXHRcdH1cclxuXHRcdGlmIChwIDwgMC43NSkge1xyXG5cdFx0XHRyZXR1cm4gTXlNYXRoLmxpbmVhck1hcChwLCAwLjI1LCAwLjc1LCAxLCAtMSk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gTXlNYXRoLmxpbmVhck1hcChwLCAwLjc1LCAxLCAtMSwgMCk7XHJcblx0fVxyXG59XHJcbiJdfQ==
