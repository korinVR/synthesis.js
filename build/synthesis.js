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
        peg$c68 = ",",
        peg$c69 = { type: "literal", value: ",", description: "\",\"" },
        peg$c70 = function(number, value) {
                if (number < 0 || number > 119) {
                    error("control number is out of range (0-127)");
                }
                if (value < 0 || value > 127) {
                    error("control value is out of range (0-127)");
                }
                return { command: "control_change", number: number, value: value };
            },
        peg$c71 = "@",
        peg$c72 = { type: "literal", value: "@", description: "\"@\"" },
        peg$c73 = function(number) {
                number = +number;
                if (number < 0 || number > 127) {
                    error("program number is out of range (0-127)");
                }
                return { command: "program_change", number: number };
            },
        peg$c74 = "D",
        peg$c75 = { type: "literal", value: "D", description: "\"D\"" },
        peg$c76 = function(value) {
                value = +value;
                if (value < 0 || value > 127) {
                    error("channel aftertouch is out of range (0-127)");
                }
                return { command: "channel_aftertouch", value: value };
            },
        peg$c77 = "t",
        peg$c78 = { type: "literal", value: "t", description: "\"t\"" },
        peg$c79 = function(value) { return { command: "tempo", value: +value }; },
        peg$c80 = "?",
        peg$c81 = { type: "literal", value: "?", description: "\"?\"" },
        peg$c82 = function() { return { command: "start_point" }; },
        peg$c83 = "k",
        peg$c84 = { type: "literal", value: "k", description: "\"k\"" },
        peg$c85 = function(value) {
                value = +value;
                if (value < -127 || value > 127) {
                    error("key shift is out of range (-127-127)");
                } 
                return { command: "key_shift", value: value };
            },
        peg$c86 = "C",
        peg$c87 = { type: "literal", value: "C", description: "\"C\"" },
        peg$c88 = function(channel) {
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
      var s0;

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
                                s0 = peg$parsecontrol_change();
                                if (s0 === peg$FAILED) {
                                  s0 = peg$parseprogram_change();
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
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10;

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
                if (input.charCodeAt(peg$currPos) === 44) {
                  s6 = peg$c68;
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c69); }
                }
                if (s6 !== peg$FAILED) {
                  s7 = peg$parse_();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$currPos;
                    s9 = [];
                    if (peg$c23.test(input.charAt(peg$currPos))) {
                      s10 = input.charAt(peg$currPos);
                      peg$currPos++;
                    } else {
                      s10 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c24); }
                    }
                    if (s10 !== peg$FAILED) {
                      while (s10 !== peg$FAILED) {
                        s9.push(s10);
                        if (peg$c23.test(input.charAt(peg$currPos))) {
                          s10 = input.charAt(peg$currPos);
                          peg$currPos++;
                        } else {
                          s10 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c24); }
                        }
                      }
                    } else {
                      s9 = peg$c1;
                    }
                    if (s9 !== peg$FAILED) {
                      s9 = input.substring(s8, peg$currPos);
                    }
                    s8 = s9;
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parse_();
                      if (s9 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c70(s4, s8);
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

    function peg$parseprogram_change() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 64) {
          s2 = peg$c71;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c72); }
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
                s1 = peg$c73(s4);
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
          s2 = peg$c74;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c75); }
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
                s1 = peg$c76(s4);
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
          s2 = peg$c77;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c78); }
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
                s1 = peg$c79(s4);
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
          s2 = peg$c80;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c81); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c82();
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
          s2 = peg$c83;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c84); }
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
                s1 = peg$c85(s4);
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
          s2 = peg$c86;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c87); }
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
                s1 = peg$c88(s4);
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