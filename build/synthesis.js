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

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Debug = require("./framesynthesis/Debug");

var _Debug2 = _interopRequireDefault(_Debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AudioManager = function () {
    function AudioManager(synthesizer) {
        var _this = this;

        var bufferSize = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1024;

        _classCallCheck(this, AudioManager);

        this.synthesizer = synthesizer;
        this.bufferSize = bufferSize;

        try {
            // webkitAudioContext is for iOS 8
            this.context = window.AudioContext ? new AudioContext() : new webkitAudioContext();
        } catch (e) {
            _Debug2.default.log("error: This browser does not support Web Audio API.");
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

        _Debug2.default.log("  Sampling rate : " + this.context.sampleRate + " Hz");
        _Debug2.default.log("  Buffer size   : " + this.scriptProcessor.bufferSize + " samples");
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
}();

exports.default = AudioManager;

},{"./framesynthesis/Debug":8}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _MyMath = require("./framesynthesis/MyMath");

var _MyMath2 = _interopRequireDefault(_MyMath);

var _Voice = require("./Voice");

var _Voice2 = _interopRequireDefault(_Voice);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var VOICE_MAX = 32;

var Channel = function () {
    function Channel() {
        _classCallCheck(this, Channel);
    }

    _createClass(Channel, [{
        key: "reset",
        value: function reset() {
            this.voices = [];
            for (var i = 0; i < VOICE_MAX; i++) {
                this.voices[i] = new _Voice2.default(this);
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
            for (var _i = 0; _i < VOICE_MAX; _i++) {
                if (!this.voices[_i].isPlaying()) {
                    this.voices[_i].play(note, velocity);
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

            for (var _i2 = 0; _i2 < VOICE_MAX; _i2++) {
                this.voices[_i2].render(this.channelBuffer, bufferL.length, sampleRate);
            }

            var gain = this.volume / 127 * (this.expression / 127);
            var gainL = gain * _MyMath2.default.clampedLinearMap(this.pan, 64, 127, 1, 0);
            var gainR = gain * _MyMath2.default.clampedLinearMap(this.pan, 0, 64, 0, 1);

            for (var _i3 = 0; _i3 < bufferL.length; _i3++) {
                bufferL[_i3] += this.channelBuffer[_i3] * gainL;
                bufferR[_i3] += this.channelBuffer[_i3] * gainR;
            }
        }
    }]);

    return Channel;
}();

exports.default = Channel;

},{"./Voice":7,"./framesynthesis/MyMath":9}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TEMPO_DEFAULT = 120;
var INTERVAL = 1 / 100;

var Track = function () {
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
                    var length = this.readByte();

                    if (metaEventType === 0x51) {
                        if (length === 3) {
                            var quarterMicroseconds = this.readByte() << 16 | this.readByte() << 8 | this.readByte();
                            this.player.quarterTime = quarterMicroseconds / 1000;
                        }
                    } else {
                        this.pos += length;
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
                            var _dataByte = this.readByte();
                            this.player.synthesizer.processMIDIMessage([statusByte, _dataByte]);
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
            var n = void 0;

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
}();

var SMFPlayer = function () {
    function SMFPlayer(synthesizer) {
        _classCallCheck(this, SMFPlayer);

        this.synthesizer = synthesizer;
    }

    _createClass(SMFPlayer, [{
        key: "play",
        value: function play(smf) {
            var _this = this;

            var startTick = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

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
            for (var _i = 0; _i < this.trackNumber; _i++) {
                pos += 4;

                var length = read4bytes();
                this.tracks.push(new Track(this, pos, length));

                pos += length;
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
            for (var _i2 = 0; _i2 < this.tracks.length; _i2++) {
                if (this.tracks[_i2].finished === false) {
                    playingTrack++;
                }
            }
            if (playingTrack === 0) {
                this.stop();
            }
        }
    }]);

    return SMFPlayer;
}();

exports.default = SMFPlayer;

},{}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Debug = require("./framesynthesis/Debug");

var _Debug2 = _interopRequireDefault(_Debug);

var _Platform = require("./framesynthesis/Platform");

var _Platform2 = _interopRequireDefault(_Platform);

var _AudioManager = require("./AudioManager");

var _AudioManager2 = _interopRequireDefault(_AudioManager);

var _Channel = require("./Channel");

var _Channel2 = _interopRequireDefault(_Channel);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CHANNEL_MAX = 16;

var Synthesizer = function () {
    function Synthesizer(options) {
        _classCallCheck(this, Synthesizer);

        this.options = options;

        this.channels = [];
        for (var i = 0; i < CHANNEL_MAX; i++) {
            this.channels[i] = new _Channel2.default();
        }

        this.reset();

        this.audioManager = null;
        if (!_Platform2.default.isiOS()) {
            this.createAudioManager();
        }
    }

    _createClass(Synthesizer, [{
        key: "createAudioManager",
        value: function createAudioManager() {
            if (!this.audioManager) {
                _Debug2.default.log("Initializing Web Audio");
                this.audioManager = new _AudioManager2.default(this);
            }
        }
    }, {
        key: "reset",
        value: function reset() {
            _Debug2.default.log("Initializing Synthesizer");

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

            for (var _i = 0; _i < CHANNEL_MAX; _i++) {
                this.channels[_i].render(bufferL, bufferR, sampleRate);
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
                var _note = data[1];
                var _velocity = data[2];

                this.log("Ch. " + midiChannel + " Note Off note: " + _note + " velocity: " + _velocity);
                this.channels[channel].noteOff(_note, _velocity);
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
                _Debug2.default.log(message);
            }
        }
    }]);

    return Synthesizer;
}();

exports.default = Synthesizer;

},{"./AudioManager":3,"./Channel":4,"./framesynthesis/Debug":8,"./framesynthesis/Platform":10}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _SquareOscillator = require("./oscillators/SquareOscillator");

var _SquareOscillator2 = _interopRequireDefault(_SquareOscillator);

var _TriangleOscillator = require("./oscillators/TriangleOscillator");

var _TriangleOscillator2 = _interopRequireDefault(_TriangleOscillator);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var STATE_OFF = 0;
var STATE_ATTACK = 1; // not used
var STATE_DECAY = 2; // not used
var STATE_SUSTAIN = 3;
var STATE_RELEASE = 4;

var Voice = function () {
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

            this.oscillator = new _SquareOscillator2.default();
            // this.oscillator = new TriangleOscillator();

            this.vibratoOscillator = new _TriangleOscillator2.default();
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
}();

exports.default = Voice;

},{"./oscillators/SquareOscillator":12,"./oscillators/TriangleOscillator":13}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Debug = function () {
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
}();

exports.default = Debug;

},{}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MyMath = function () {
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
}();

exports.default = MyMath;

},{}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Platform = function () {
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
}();

exports.default = Platform;

},{}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _mml2smf = require("mml2smf");

Object.defineProperty(exports, "mml2smf", {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_mml2smf).default;
  }
});

var _Synthesizer = require("./Synthesizer");

Object.defineProperty(exports, "Synthesizer", {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_Synthesizer).default;
  }
});

var _SMFPlayer = require("./SMFPlayer");

Object.defineProperty(exports, "SMFPlayer", {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_SMFPlayer).default;
  }
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./SMFPlayer":5,"./Synthesizer":6,"mml2smf":1}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _MyMath = require("../framesynthesis/MyMath");

var _MyMath2 = _interopRequireDefault(_MyMath);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SquareOscillator = function () {
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
}();

exports.default = SquareOscillator;

},{"../framesynthesis/MyMath":9}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _MyMath = require("../framesynthesis/MyMath");

var _MyMath2 = _interopRequireDefault(_MyMath);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TriangleOscillator = function () {
    function TriangleOscillator() {
        _classCallCheck(this, TriangleOscillator);
    }

    _createClass(TriangleOscillator, [{
        key: "getSample",
        value: function getSample(phase) {
            var p = phase % 1;

            if (p < 0.25) {
                return _MyMath2.default.linearMap(p, 0, 0.25, 0, 1);
                // return p * 4;
            }
            if (p < 0.75) {
                return _MyMath2.default.linearMap(p, 0.25, 0.75, 1, -1);
            }
            return _MyMath2.default.linearMap(p, 0.75, 1, -1, 0);
        }
    }]);

    return TriangleOscillator;
}();

exports.default = TriangleOscillator;

},{"../framesynthesis/MyMath":9}]},{},[11])(11)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbW1sMnNtZi9lczUvbW1sMnNtZi5qcyIsIm5vZGVfbW9kdWxlcy9tbWwyc21mL3BhcnNlci9wYXJzZXIuanMiLCJzcmNcXEF1ZGlvTWFuYWdlci5qcyIsInNyY1xcQ2hhbm5lbC5qcyIsInNyY1xcU01GUGxheWVyLmpzIiwic3JjXFxTeW50aGVzaXplci5qcyIsInNyY1xcVm9pY2UuanMiLCJzcmNcXGZyYW1lc3ludGhlc2lzXFxEZWJ1Zy5qcyIsInNyY1xcZnJhbWVzeW50aGVzaXNcXE15TWF0aC5qcyIsInNyY1xcZnJhbWVzeW50aGVzaXNcXFBsYXRmb3JtLmpzIiwic3JjXFxtYWluLmpzIiwic3JjXFxvc2NpbGxhdG9yc1xcU3F1YXJlT3NjaWxsYXRvci5qcyIsInNyY1xcb3NjaWxsYXRvcnNcXFRyaWFuZ2xlT3NjaWxsYXRvci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7O0FDanNFQTs7Ozs7Ozs7SUFFcUIsWTtBQUNqQiwwQkFBWSxXQUFaLEVBQTRDO0FBQUE7O0FBQUEsWUFBbkIsVUFBbUIsdUVBQU4sSUFBTTs7QUFBQTs7QUFDeEMsYUFBSyxXQUFMLEdBQW1CLFdBQW5CO0FBQ0EsYUFBSyxVQUFMLEdBQWtCLFVBQWxCOztBQUVBLFlBQUk7QUFDQTtBQUNBLGlCQUFLLE9BQUwsR0FBZSxPQUFPLFlBQVAsR0FBc0IsSUFBSSxZQUFKLEVBQXRCLEdBQTJDLElBQUksa0JBQUosRUFBMUQ7QUFDSCxTQUhELENBR0UsT0FBTyxDQUFQLEVBQVU7QUFDUiw0QkFBTSxHQUFOLENBQVUscURBQVY7QUFDQTtBQUNIOztBQUVELGFBQUssT0FBTCxHQUFlLElBQUksWUFBSixDQUFpQixLQUFLLFVBQXRCLENBQWY7QUFDQSxhQUFLLE9BQUwsR0FBZSxJQUFJLFlBQUosQ0FBaUIsS0FBSyxVQUF0QixDQUFmOztBQUVBLGFBQUssZUFBTCxHQUF1QixLQUFLLE9BQUwsQ0FBYSxxQkFBYixDQUFtQyxLQUFLLFVBQXhDLEVBQW9ELENBQXBELEVBQXVELENBQXZELENBQXZCO0FBQ0EsYUFBSyxlQUFMLENBQXFCLGNBQXJCLEdBQXNDO0FBQUEsbUJBQUssTUFBSyxPQUFMLENBQWEsQ0FBYixDQUFMO0FBQUEsU0FBdEM7QUFDQSxhQUFLLGVBQUwsQ0FBcUIsT0FBckIsQ0FBNkIsS0FBSyxPQUFMLENBQWEsV0FBMUM7O0FBRUE7QUFDQTtBQUNBLGVBQU8sY0FBUCxHQUF3QixLQUFLLGVBQTdCOztBQUVBLHdCQUFNLEdBQU4sQ0FBVSx1QkFBdUIsS0FBSyxPQUFMLENBQWEsVUFBcEMsR0FBaUQsS0FBM0Q7QUFDQSx3QkFBTSxHQUFOLENBQVUsdUJBQXVCLEtBQUssZUFBTCxDQUFxQixVQUE1QyxHQUF5RCxVQUFuRTtBQUNIOzs7O2dDQUVPLEMsRUFBRztBQUNQLGdCQUFJLE9BQU8sRUFBRSxZQUFGLENBQWUsY0FBZixDQUE4QixDQUE5QixDQUFYO0FBQ0EsZ0JBQUksT0FBTyxFQUFFLFlBQUYsQ0FBZSxjQUFmLENBQThCLENBQTlCLENBQVg7O0FBRUEsaUJBQUssV0FBTCxDQUFpQixNQUFqQixDQUF3QixLQUFLLE9BQTdCLEVBQXNDLEtBQUssT0FBM0MsRUFBb0QsS0FBSyxPQUFMLENBQWEsVUFBakU7O0FBRUEsaUJBQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxLQUFLLFVBQXpCLEVBQXFDLEdBQXJDLEVBQTBDO0FBQ3RDLHFCQUFLLENBQUwsSUFBVSxLQUFLLE9BQUwsQ0FBYSxDQUFiLENBQVY7QUFDQSxxQkFBSyxDQUFMLElBQVUsS0FBSyxPQUFMLENBQWEsQ0FBYixDQUFWO0FBQ0g7QUFDSjs7Ozs7O2tCQXRDZ0IsWTs7Ozs7Ozs7Ozs7QUNGckI7Ozs7QUFDQTs7Ozs7Ozs7QUFFQSxJQUFNLFlBQVksRUFBbEI7O0lBRXFCLE87Ozs7Ozs7Z0NBQ1Q7QUFDSixpQkFBSyxNQUFMLEdBQWMsRUFBZDtBQUNBLGlCQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksU0FBcEIsRUFBK0IsR0FBL0IsRUFBb0M7QUFDaEMscUJBQUssTUFBTCxDQUFZLENBQVosSUFBaUIsb0JBQVUsSUFBVixDQUFqQjtBQUNIOztBQUVELGlCQUFLLFFBQUwsR0FBZ0IsRUFBaEI7O0FBRUE7QUFDQSxpQkFBSyxNQUFMLEdBQWMsR0FBZDtBQUNBLGlCQUFLLEdBQUwsR0FBVyxFQUFYO0FBQ0EsaUJBQUssVUFBTCxHQUFrQixHQUFsQjs7QUFFQSxpQkFBSyxXQUFMLEdBQW1CLEtBQW5COztBQUVBLGlCQUFLLFNBQUwsR0FBaUIsQ0FBakI7QUFDQSxpQkFBSyxlQUFMLEdBQXVCLENBQXZCOztBQUVBO0FBQ0EsaUJBQUssYUFBTCxHQUFxQixJQUFJLFlBQUosQ0FBaUIsSUFBakIsQ0FBckI7QUFDSDs7OytCQUVNLEksRUFBTSxRLEVBQVU7QUFDbkIsaUJBQUssUUFBTCxDQUFjLElBQWQsSUFBc0IsSUFBdEI7O0FBRUE7QUFDQSxpQkFBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFNBQXBCLEVBQStCLEdBQS9CLEVBQW9DO0FBQ2hDLG9CQUFJLEtBQUssTUFBTCxDQUFZLENBQVosRUFBZSxTQUFmLE1BQThCLEtBQUssTUFBTCxDQUFZLENBQVosRUFBZSxJQUFmLEtBQXdCLElBQTFELEVBQWdFO0FBQzVELHlCQUFLLE1BQUwsQ0FBWSxDQUFaLEVBQWUsSUFBZjtBQUNIO0FBQ0o7O0FBRUQ7QUFDQSxpQkFBSyxJQUFJLEtBQUksQ0FBYixFQUFnQixLQUFJLFNBQXBCLEVBQStCLElBQS9CLEVBQW9DO0FBQ2hDLG9CQUFJLENBQUMsS0FBSyxNQUFMLENBQVksRUFBWixFQUFlLFNBQWYsRUFBTCxFQUFpQztBQUM3Qix5QkFBSyxNQUFMLENBQVksRUFBWixFQUFlLElBQWYsQ0FBb0IsSUFBcEIsRUFBMEIsUUFBMUI7QUFDQTtBQUNIO0FBQ0o7QUFDSjs7O2dDQUVPLEksRUFBTSxRLEVBQVU7QUFDcEIsaUJBQUssUUFBTCxDQUFjLElBQWQsSUFBc0IsS0FBdEI7O0FBRUEsZ0JBQUksS0FBSyxXQUFULEVBQXNCO0FBQ2xCO0FBQ0g7O0FBRUQ7QUFDQSxpQkFBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFNBQXBCLEVBQStCLEdBQS9CLEVBQW9DO0FBQ2hDLG9CQUFJLEtBQUssTUFBTCxDQUFZLENBQVosRUFBZSxTQUFmLE1BQThCLEtBQUssTUFBTCxDQUFZLENBQVosRUFBZSxJQUFmLEtBQXdCLElBQTFELEVBQWdFO0FBQzVELHlCQUFLLE1BQUwsQ0FBWSxDQUFaLEVBQWUsSUFBZjtBQUNIO0FBQ0o7QUFDSjs7O3NDQUVhO0FBQ1YsaUJBQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxTQUFwQixFQUErQixHQUEvQixFQUFvQztBQUNoQyxvQkFBSSxLQUFLLE1BQUwsQ0FBWSxDQUFaLEVBQWUsU0FBZixFQUFKLEVBQWdDO0FBQzVCLHlCQUFLLE1BQUwsQ0FBWSxDQUFaLEVBQWUsSUFBZjtBQUNIO0FBQ0o7QUFDSjs7O3dDQUVlO0FBQ1osaUJBQUssV0FBTCxHQUFtQixJQUFuQjtBQUNIOzs7eUNBRWdCO0FBQ2IsaUJBQUssV0FBTCxHQUFtQixLQUFuQjs7QUFFQSxpQkFBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFNBQXBCLEVBQStCLEdBQS9CLEVBQW9DO0FBQ2hDLG9CQUFJLEtBQUssUUFBTCxDQUFjLEtBQUssTUFBTCxDQUFZLENBQVosRUFBZSxJQUE3QixNQUF1QyxLQUEzQyxFQUFrRDtBQUM5Qyx5QkFBSyxNQUFMLENBQVksQ0FBWixFQUFlLElBQWY7QUFDSDtBQUNKO0FBQ0o7OztzQ0FFYSxhLEVBQWUsQ0FDNUI7OztxQ0FFWSxJLEVBQU07QUFDZixpQkFBSyxTQUFMLEdBQWlCLE9BQU8sQ0FBUCxHQUFXLElBQTVCO0FBQ0g7OzsyQ0FFa0IsSyxFQUFPO0FBQ3RCLGlCQUFLLGVBQUwsR0FBdUIsUUFBUSxHQUEvQjtBQUNIOzs7a0NBRVMsTSxFQUFRO0FBQ2QsaUJBQUssTUFBTCxHQUFjLE1BQWQ7QUFDSDs7OytCQUVNLEcsRUFBSztBQUNSLGlCQUFLLEdBQUwsR0FBVyxHQUFYO0FBQ0g7OztzQ0FFYSxVLEVBQVk7QUFDdEIsaUJBQUssVUFBTCxHQUFrQixVQUFsQjtBQUNIOzs7K0JBRU0sTyxFQUFTLE8sRUFBUyxVLEVBQVk7QUFDakMsaUJBQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxRQUFRLE1BQTVCLEVBQW9DLEdBQXBDLEVBQXlDO0FBQ3JDLHFCQUFLLGFBQUwsQ0FBbUIsQ0FBbkIsSUFBd0IsQ0FBeEI7QUFDSDs7QUFFRCxpQkFBSyxJQUFJLE1BQUksQ0FBYixFQUFnQixNQUFJLFNBQXBCLEVBQStCLEtBQS9CLEVBQW9DO0FBQ2hDLHFCQUFLLE1BQUwsQ0FBWSxHQUFaLEVBQWUsTUFBZixDQUFzQixLQUFLLGFBQTNCLEVBQTBDLFFBQVEsTUFBbEQsRUFBMEQsVUFBMUQ7QUFDSDs7QUFFRCxnQkFBSSxPQUFRLEtBQUssTUFBTCxHQUFjLEdBQWYsSUFBdUIsS0FBSyxVQUFMLEdBQWtCLEdBQXpDLENBQVg7QUFDQSxnQkFBSSxRQUFRLE9BQU8saUJBQU8sZ0JBQVAsQ0FBd0IsS0FBSyxHQUE3QixFQUFrQyxFQUFsQyxFQUFzQyxHQUF0QyxFQUEyQyxDQUEzQyxFQUE4QyxDQUE5QyxDQUFuQjtBQUNBLGdCQUFJLFFBQVEsT0FBTyxpQkFBTyxnQkFBUCxDQUF3QixLQUFLLEdBQTdCLEVBQWtDLENBQWxDLEVBQXFDLEVBQXJDLEVBQXlDLENBQXpDLEVBQTRDLENBQTVDLENBQW5COztBQUVBLGlCQUFLLElBQUksTUFBSSxDQUFiLEVBQWdCLE1BQUksUUFBUSxNQUE1QixFQUFvQyxLQUFwQyxFQUF5QztBQUNyQyx3QkFBUSxHQUFSLEtBQWMsS0FBSyxhQUFMLENBQW1CLEdBQW5CLElBQXdCLEtBQXRDO0FBQ0Esd0JBQVEsR0FBUixLQUFjLEtBQUssYUFBTCxDQUFtQixHQUFuQixJQUF3QixLQUF0QztBQUNIO0FBQ0o7Ozs7OztrQkF2SGdCLE87Ozs7Ozs7Ozs7Ozs7QUNMckIsSUFBTSxnQkFBZ0IsR0FBdEI7QUFDQSxJQUFNLFdBQVcsSUFBSSxHQUFyQjs7SUFFTSxLO0FBQ0YsbUJBQVksTUFBWixFQUFvQixHQUFwQixFQUF5QixNQUF6QixFQUFpQztBQUFBOztBQUM3QixhQUFLLE1BQUwsR0FBYyxNQUFkOztBQUVBLGFBQUssR0FBTCxHQUFXLEdBQVg7QUFDQSxhQUFLLE1BQUwsR0FBYyxNQUFNLE1BQXBCO0FBQ0EsYUFBSyxRQUFMLEdBQWdCLEtBQWhCOztBQUVBLGFBQUssYUFBTCxHQUFxQixLQUFLLGFBQUwsRUFBckI7QUFDSDs7OzsrQkFFTSxXLEVBQWEsTyxFQUFTO0FBQ3pCLGdCQUFJLEtBQUssUUFBVCxFQUFtQjtBQUNmO0FBQ0g7O0FBRUQsbUJBQU8sS0FBSyxhQUFMLEdBQXFCLFdBQTVCLEVBQXlDO0FBQ3JDO0FBQ0Esb0JBQUksYUFBYSxLQUFLLFFBQUwsRUFBakI7QUFDQSxvQkFBSSxtQkFBbUIsY0FBYyxDQUFyQzs7QUFFQTtBQUNBLG9CQUFJLGVBQWUsSUFBbkIsRUFBeUI7QUFDckIsd0JBQUksZ0JBQWdCLEtBQUssUUFBTCxFQUFwQjtBQUNBLHdCQUFJLFNBQVMsS0FBSyxRQUFMLEVBQWI7O0FBRUEsd0JBQUksa0JBQWtCLElBQXRCLEVBQTRCO0FBQ3hCLDRCQUFJLFdBQVcsQ0FBZixFQUFrQjtBQUNkLGdDQUFJLHNCQUFzQixLQUFLLFFBQUwsTUFBbUIsRUFBbkIsR0FBd0IsS0FBSyxRQUFMLE1BQW1CLENBQTNDLEdBQStDLEtBQUssUUFBTCxFQUF6RTtBQUNBLGlDQUFLLE1BQUwsQ0FBWSxXQUFaLEdBQTBCLHNCQUFzQixJQUFoRDtBQUNIO0FBQ0oscUJBTEQsTUFLTztBQUNILDZCQUFLLEdBQUwsSUFBWSxNQUFaO0FBQ0g7QUFDSjs7QUFFRDtBQUNBLG9CQUFJLGVBQWUsSUFBbkIsRUFBeUI7QUFDckIsd0JBQUksa0JBQWtCLENBQUMsVUFBRCxDQUF0Qjs7QUFFQSwyQkFBTyxJQUFQLEVBQWE7QUFDVCw0QkFBSSxLQUFLLEdBQUwsSUFBWSxLQUFLLE1BQXJCLEVBQTZCO0FBQ3pCLGtDQUFNLE1BQU0saUNBQU4sQ0FBTjtBQUNIOztBQUVELDRCQUFJLE9BQU8sS0FBSyxRQUFMLEVBQVg7QUFDQSw0QkFBSSxTQUFTLElBQWIsRUFBbUI7QUFDZjtBQUNIO0FBQ0Qsd0NBQWdCLElBQWhCLENBQXFCLElBQXJCO0FBQ0g7QUFDRCx5QkFBSyxNQUFMLENBQVksV0FBWixDQUF3QixrQkFBeEIsQ0FBMkMsZUFBM0M7QUFDSDs7QUFFRDtBQUNBLG9CQUFJLGVBQWUsSUFBZixJQUF1QixlQUFlLElBQXRDLElBQThDLGVBQWUsSUFBakUsRUFBdUU7QUFDbkUseUJBQUssUUFBTDtBQUNIOztBQUVELHdCQUFRLGdCQUFSO0FBQ0k7QUFDQSx5QkFBSyxHQUFMO0FBQ0EseUJBQUssR0FBTDtBQUNBLHlCQUFLLEdBQUw7QUFDQSx5QkFBSyxHQUFMO0FBQ0EseUJBQUssR0FBTDtBQUNJO0FBQ0ksZ0NBQUksWUFBWSxLQUFLLFFBQUwsRUFBaEI7QUFDQSxnQ0FBSSxZQUFZLEtBQUssUUFBTCxFQUFoQjs7QUFFQSxnQ0FBSSxZQUFZLHFCQUFxQixHQUFyQixJQUE0QixxQkFBcUIsR0FBN0QsQ0FBSixFQUF1RTtBQUNuRTtBQUNILDZCQUZELE1BRU87QUFDSCxxQ0FBSyxNQUFMLENBQVksV0FBWixDQUF3QixrQkFBeEIsQ0FBMkMsQ0FBQyxVQUFELEVBQWEsU0FBYixFQUF3QixTQUF4QixDQUEzQztBQUNIO0FBQ0Q7QUFDSDtBQUNMO0FBQ0EseUJBQUssR0FBTDtBQUNBLHlCQUFLLEdBQUw7QUFDSTtBQUNJLGdDQUFJLFlBQVksS0FBSyxRQUFMLEVBQWhCO0FBQ0EsaUNBQUssTUFBTCxDQUFZLFdBQVosQ0FBd0Isa0JBQXhCLENBQTJDLENBQUMsVUFBRCxFQUFhLFNBQWIsQ0FBM0M7QUFDQTtBQUNIO0FBekJUOztBQTRCQSxvQkFBSSxLQUFLLEdBQUwsSUFBWSxLQUFLLE1BQXJCLEVBQTZCO0FBQ3pCO0FBQ0EseUJBQUssUUFBTCxHQUFnQixJQUFoQjtBQUNBO0FBQ0g7O0FBRUQ7QUFDQSxxQkFBSyxhQUFMLElBQXNCLEtBQUssYUFBTCxFQUF0QjtBQUNIO0FBQ0o7OzttQ0FFVTtBQUNQLG1CQUFPLEtBQUssTUFBTCxDQUFZLEdBQVosQ0FBZ0IsS0FBSyxHQUFMLEVBQWhCLENBQVA7QUFDSDs7O3dDQUVlO0FBQ1osZ0JBQUksT0FBTyxDQUFYO0FBQ0EsZ0JBQUksVUFBSjs7QUFFQSxlQUFHO0FBQ0Msb0JBQUksS0FBSyxRQUFMLEVBQUo7QUFDQSx5QkFBUyxDQUFUO0FBQ0Esd0JBQVMsSUFBSSxJQUFiO0FBQ0gsYUFKRCxRQUlTLElBQUksSUFKYjs7QUFNQSxnQkFBSSxPQUFPLFNBQVgsRUFBc0I7QUFDbEIsc0JBQU0sSUFBSSxLQUFKLENBQVUsb0JBQVYsQ0FBTjtBQUNIO0FBQ0QsbUJBQU8sSUFBUDtBQUNIOzs7Ozs7SUFHZ0IsUztBQUNqQix1QkFBWSxXQUFaLEVBQXlCO0FBQUE7O0FBQ3JCLGFBQUssV0FBTCxHQUFtQixXQUFuQjtBQUNIOzs7OzZCQUVJLEcsRUFBb0I7QUFBQTs7QUFBQSxnQkFBZixTQUFlLHVFQUFILENBQUc7O0FBQ3JCLGlCQUFLLEdBQUwsR0FBVyxHQUFYO0FBQ0EsaUJBQUssU0FBTCxHQUFpQixTQUFqQjs7QUFFQSxpQkFBSyxXQUFMLEdBQW1CLEtBQUssSUFBTCxHQUFZLGFBQS9CLENBSnFCLENBSXlCOztBQUU5QztBQUNBLGdCQUFJLE1BQU0sQ0FBVjs7QUFFQSxxQkFBUyxVQUFULEdBQXNCO0FBQ2xCLHVCQUFPLElBQUksS0FBSixLQUFjLENBQWQsR0FBa0IsSUFBSSxLQUFKLENBQXpCO0FBQ0g7O0FBRUQscUJBQVMsVUFBVCxHQUFzQjtBQUNsQix1QkFBTyxJQUFJLEtBQUosS0FBYyxFQUFkLEdBQW1CLElBQUksS0FBSixLQUFjLEVBQWpDLEdBQXNDLElBQUksS0FBSixLQUFjLENBQXBELEdBQXdELElBQUksS0FBSixDQUEvRDtBQUNIOztBQUVELGdCQUFJLFNBQVMsWUFBYjtBQUNBLGlCQUFLLFdBQUwsR0FBbUIsWUFBbkI7QUFDQSxpQkFBSyxRQUFMLEdBQWdCLFlBQWhCOztBQUVBO0FBQ0EsZ0JBQU0sYUFBYSxDQUFDLElBQUQsRUFBTyxJQUFQLEVBQWEsSUFBYixFQUFtQixJQUFuQixFQUF5QixJQUF6QixFQUErQixJQUEvQixFQUFxQyxJQUFyQyxFQUEyQyxJQUEzQyxDQUFuQjtBQUNBLGlCQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksV0FBVyxNQUEvQixFQUF1QyxHQUF2QyxFQUE0QztBQUN4QyxvQkFBSSxLQUFLLEdBQUwsQ0FBUyxDQUFULEtBQWUsV0FBVyxDQUFYLENBQW5CLEVBQWtDO0FBQzlCLDBCQUFNLElBQUksS0FBSixDQUFVLDBCQUFWLENBQU47QUFDSDtBQUNKOztBQUVELGdCQUFJLFdBQVcsQ0FBWCxJQUFnQixXQUFXLENBQS9CLEVBQWtDO0FBQzlCLHNCQUFNLElBQUksS0FBSixDQUFVLGtCQUFWLENBQU47QUFDSDs7QUFFRCxnQkFBSSxXQUFXLENBQVgsSUFBZ0IsS0FBSyxXQUFMLEtBQXFCLENBQXpDLEVBQTRDO0FBQ3hDLHNCQUFNLElBQUksS0FBSixDQUFVLHNCQUFWLENBQU47QUFDSDs7QUFFRCxpQkFBSyxNQUFMLEdBQWMsRUFBZDs7QUFFQTtBQUNBLGlCQUFLLElBQUksS0FBSSxDQUFiLEVBQWdCLEtBQUksS0FBSyxXQUF6QixFQUFzQyxJQUF0QyxFQUEyQztBQUN2Qyx1QkFBTyxDQUFQOztBQUVBLG9CQUFJLFNBQVMsWUFBYjtBQUNBLHFCQUFLLE1BQUwsQ0FBWSxJQUFaLENBQWlCLElBQUksS0FBSixDQUFVLElBQVYsRUFBZ0IsR0FBaEIsRUFBcUIsTUFBckIsQ0FBakI7O0FBRUEsdUJBQU8sTUFBUDtBQUNIOztBQUVEO0FBQ0EsaUJBQUssUUFBTCxHQUFnQixLQUFLLEdBQUwsRUFBaEI7QUFDQSxpQkFBSyxXQUFMLEdBQW1CLENBQW5COztBQUVBLGdCQUFJLENBQUMsS0FBSyxVQUFWLEVBQXNCO0FBQ2xCLHFCQUFLLFVBQUwsR0FBa0IsWUFBWTtBQUFBLDJCQUFNLE1BQUssVUFBTCxFQUFOO0FBQUEsaUJBQVosRUFBcUMsUUFBckMsQ0FBbEI7QUFDSDtBQUNKOzs7K0JBRU07QUFDSCwwQkFBYyxLQUFLLFVBQW5CO0FBQ0EsaUJBQUssVUFBTCxHQUFrQixJQUFsQjtBQUNIOzs7cUNBRVk7QUFDVDtBQUNBLGdCQUFJLGNBQWMsS0FBSyxHQUFMLEVBQWxCO0FBQ0EsZ0JBQUksWUFBWSxjQUFjLEtBQUssUUFBbkM7QUFDQSxpQkFBSyxRQUFMLEdBQWdCLFdBQWhCOztBQUVBLGdCQUFJLFdBQVcsS0FBSyxXQUFMLEdBQW1CLEtBQUssUUFBdkM7O0FBRUEsZ0JBQUksVUFBVSxLQUFkO0FBQ0EsZ0JBQUksS0FBSyxXQUFMLEdBQW1CLEtBQUssU0FBNUIsRUFBdUM7QUFDbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxxQkFBSyxXQUFMLEdBQW1CLEtBQUssU0FBeEI7QUFDQSwwQkFBVSxJQUFWO0FBQ0gsYUFURCxNQVNPO0FBQ0gscUJBQUssV0FBTCxJQUFvQixZQUFZLFFBQWhDO0FBQ0g7O0FBRUQsaUJBQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxLQUFLLE1BQUwsQ0FBWSxNQUFoQyxFQUF3QyxHQUF4QyxFQUE2QztBQUN6QyxxQkFBSyxNQUFMLENBQVksQ0FBWixFQUFlLE1BQWYsQ0FBc0IsS0FBSyxXQUEzQixFQUF3QyxPQUF4QztBQUNIOztBQUVEO0FBQ0EsZ0JBQUksZUFBZSxDQUFuQjtBQUNBLGlCQUFLLElBQUksTUFBSSxDQUFiLEVBQWdCLE1BQUksS0FBSyxNQUFMLENBQVksTUFBaEMsRUFBd0MsS0FBeEMsRUFBNkM7QUFDekMsb0JBQUksS0FBSyxNQUFMLENBQVksR0FBWixFQUFlLFFBQWYsS0FBNEIsS0FBaEMsRUFBdUM7QUFDbkM7QUFDSDtBQUNKO0FBQ0QsZ0JBQUksaUJBQWlCLENBQXJCLEVBQXdCO0FBQ3BCLHFCQUFLLElBQUw7QUFDSDtBQUNKOzs7Ozs7a0JBeEdnQixTOzs7Ozs7Ozs7OztBQzFIckI7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O0FBRUEsSUFBTSxjQUFjLEVBQXBCOztJQUVxQixXO0FBQ2pCLHlCQUFZLE9BQVosRUFBcUI7QUFBQTs7QUFDakIsYUFBSyxPQUFMLEdBQWUsT0FBZjs7QUFFQSxhQUFLLFFBQUwsR0FBZ0IsRUFBaEI7QUFDQSxhQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksV0FBcEIsRUFBaUMsR0FBakMsRUFBc0M7QUFDbEMsaUJBQUssUUFBTCxDQUFjLENBQWQsSUFBbUIsdUJBQW5CO0FBQ0g7O0FBRUQsYUFBSyxLQUFMOztBQUVBLGFBQUssWUFBTCxHQUFvQixJQUFwQjtBQUNBLFlBQUksQ0FBQyxtQkFBUyxLQUFULEVBQUwsRUFBdUI7QUFDbkIsaUJBQUssa0JBQUw7QUFDSDtBQUNKOzs7OzZDQUVvQjtBQUNqQixnQkFBSSxDQUFDLEtBQUssWUFBVixFQUF3QjtBQUNwQixnQ0FBTSxHQUFOLENBQVUsd0JBQVY7QUFDQSxxQkFBSyxZQUFMLEdBQW9CLDJCQUFpQixJQUFqQixDQUFwQjtBQUNIO0FBQ0o7OztnQ0FFTztBQUNKLDRCQUFNLEdBQU4sQ0FBVSwwQkFBVjs7QUFFQSxpQkFBSyxJQUFJLElBQUksQ0FBYixFQUFnQixJQUFJLFdBQXBCLEVBQWlDLEdBQWpDLEVBQXNDO0FBQ2xDLHFCQUFLLFFBQUwsQ0FBYyxDQUFkLEVBQWlCLEtBQWpCO0FBQ0g7QUFDSjs7OytCQUVNLE8sRUFBUyxPLEVBQVMsVSxFQUFZO0FBQ2pDLGlCQUFLLElBQUksSUFBSSxDQUFiLEVBQWdCLElBQUksUUFBUSxNQUE1QixFQUFvQyxHQUFwQyxFQUF5QztBQUNyQyx3QkFBUSxDQUFSLElBQWEsQ0FBYjtBQUNBLHdCQUFRLENBQVIsSUFBYSxDQUFiO0FBQ0g7O0FBRUQsaUJBQUssSUFBSSxLQUFJLENBQWIsRUFBZ0IsS0FBSSxXQUFwQixFQUFpQyxJQUFqQyxFQUFzQztBQUNsQyxxQkFBSyxRQUFMLENBQWMsRUFBZCxFQUFpQixNQUFqQixDQUF3QixPQUF4QixFQUFpQyxPQUFqQyxFQUEwQyxVQUExQztBQUNIO0FBQ0o7OzsyQ0FFa0IsSSxFQUFNO0FBQ3JCLGdCQUFJLENBQUMsSUFBTCxFQUFXO0FBQ1A7QUFDSDs7QUFFRDtBQUNBLGlCQUFLLGtCQUFMOztBQUVBLGdCQUFJLGFBQWEsS0FBSyxDQUFMLENBQWpCO0FBQ0EsZ0JBQUksQ0FBQyxVQUFMLEVBQWlCO0FBQ2I7QUFDSDs7QUFFRCxnQkFBSSxtQkFBbUIsY0FBYyxDQUFyQztBQUNBLGdCQUFJLFVBQVUsYUFBYSxHQUEzQjtBQUNBLGdCQUFJLGNBQWMsVUFBVSxDQUE1Qjs7QUFFQSxnQkFBSSxxQkFBcUIsR0FBekIsRUFBOEI7QUFDMUIsb0JBQUksT0FBTyxLQUFLLENBQUwsQ0FBWDtBQUNBLG9CQUFJLFdBQVcsS0FBSyxDQUFMLENBQWY7O0FBRUEscUJBQUssR0FBTCxVQUFnQixXQUFoQix3QkFBOEMsSUFBOUMsbUJBQWdFLFFBQWhFO0FBQ0EscUJBQUssUUFBTCxDQUFjLE9BQWQsRUFBdUIsTUFBdkIsQ0FBOEIsSUFBOUIsRUFBb0MsUUFBcEM7QUFDSDtBQUNELGdCQUFJLHFCQUFxQixHQUF6QixFQUE4QjtBQUMxQixvQkFBSSxRQUFPLEtBQUssQ0FBTCxDQUFYO0FBQ0Esb0JBQUksWUFBVyxLQUFLLENBQUwsQ0FBZjs7QUFFQSxxQkFBSyxHQUFMLFVBQWdCLFdBQWhCLHdCQUE4QyxLQUE5QyxtQkFBZ0UsU0FBaEU7QUFDQSxxQkFBSyxRQUFMLENBQWMsT0FBZCxFQUF1QixPQUF2QixDQUErQixLQUEvQixFQUFxQyxTQUFyQztBQUNIOztBQUVELGdCQUFJLHFCQUFxQixHQUF6QixFQUE4QjtBQUMxQixvQkFBSSxnQkFBZ0IsS0FBSyxDQUFMLENBQXBCOztBQUVBLHFCQUFLLEdBQUwsVUFBZ0IsV0FBaEIseUJBQStDLGFBQS9DO0FBQ0EscUJBQUssUUFBTCxDQUFjLE9BQWQsRUFBdUIsYUFBdkIsQ0FBcUMsYUFBckM7QUFDSDs7QUFFRCxnQkFBSSxxQkFBcUIsR0FBekIsRUFBOEI7QUFDMUIsb0JBQUksTUFBTSxLQUFLLENBQUwsQ0FBVjtBQUNBLG9CQUFJLE1BQU0sS0FBSyxDQUFMLENBQVY7QUFDQSxvQkFBSSxPQUFPLENBQUUsT0FBTyxDQUFSLEdBQWEsR0FBZCxJQUFxQixJQUFoQzs7QUFFQSxxQkFBSyxHQUFMLFVBQWdCLFdBQWhCLHFCQUEyQyxJQUEzQztBQUNBLHFCQUFLLFFBQUwsQ0FBYyxPQUFkLEVBQXVCLFlBQXZCLENBQW9DLElBQXBDO0FBQ0g7QUFDRCxnQkFBSSxxQkFBcUIsR0FBekIsRUFBOEI7QUFDMUIsb0JBQUksZ0JBQWdCLEtBQUssQ0FBTCxDQUFwQjtBQUNBLG9CQUFJLFFBQVEsS0FBSyxDQUFMLENBQVo7O0FBRUEsb0JBQUksa0JBQWtCLENBQXRCLEVBQXlCO0FBQ3JCLHlCQUFLLEdBQUwsVUFBZ0IsV0FBaEIsMkJBQWlELEtBQWpEO0FBQ0EseUJBQUssUUFBTCxDQUFjLE9BQWQsRUFBdUIsa0JBQXZCLENBQTBDLEtBQTFDO0FBQ0g7QUFDRCxvQkFBSSxrQkFBa0IsQ0FBdEIsRUFBeUI7QUFDckIseUJBQUssR0FBTCxVQUFnQixXQUFoQix5QkFBK0MsS0FBL0M7QUFDQSx5QkFBSyxRQUFMLENBQWMsT0FBZCxFQUF1QixTQUF2QixDQUFpQyxLQUFqQztBQUNIO0FBQ0Qsb0JBQUksa0JBQWtCLEVBQXRCLEVBQTBCO0FBQ3RCLHlCQUFLLEdBQUwsVUFBZ0IsV0FBaEIsY0FBb0MsS0FBcEM7QUFDQSx5QkFBSyxRQUFMLENBQWMsT0FBZCxFQUF1QixNQUF2QixDQUE4QixLQUE5QjtBQUNIO0FBQ0Qsb0JBQUksa0JBQWtCLEVBQXRCLEVBQTBCO0FBQ3RCLHlCQUFLLEdBQUwsVUFBZ0IsV0FBaEIsZ0NBQXNELEtBQXREO0FBQ0EseUJBQUssUUFBTCxDQUFjLE9BQWQsRUFBdUIsYUFBdkIsQ0FBcUMsS0FBckM7QUFDSDtBQUNELG9CQUFJLGtCQUFrQixFQUF0QixFQUEwQjtBQUN0Qix3QkFBSSxTQUFTLEVBQWIsRUFBaUI7QUFDYiw2QkFBSyxHQUFMLFVBQWdCLFdBQWhCO0FBQ0EsNkJBQUssUUFBTCxDQUFjLE9BQWQsRUFBdUIsYUFBdkI7QUFDSCxxQkFIRCxNQUdPO0FBQ0gsNkJBQUssR0FBTCxVQUFnQixXQUFoQjtBQUNBLDZCQUFLLFFBQUwsQ0FBYyxPQUFkLEVBQXVCLGNBQXZCO0FBQ0g7QUFDSjtBQUNELG9CQUFJLGtCQUFrQixHQUF0QixFQUEyQjtBQUN2Qix3QkFBSSxVQUFVLENBQWQsRUFBaUI7QUFDYiw2QkFBSyxHQUFMLFVBQWdCLFdBQWhCO0FBQ0EsNkJBQUssUUFBTCxDQUFjLE9BQWQsRUFBdUIsV0FBdkI7QUFDSDtBQUNKO0FBQ0o7QUFDSjs7OzRCQUVHLE8sRUFBUztBQUNULGdCQUFJLEtBQUssT0FBTCxJQUFnQixLQUFLLE9BQUwsQ0FBYSxPQUFqQyxFQUEwQztBQUN0QyxnQ0FBTSxHQUFOLENBQVUsT0FBVjtBQUNIO0FBQ0o7Ozs7OztrQkFwSWdCLFc7Ozs7Ozs7Ozs7O0FDUHJCOzs7O0FBQ0E7Ozs7Ozs7O0FBRUEsSUFBTSxZQUFZLENBQWxCO0FBQ0EsSUFBTSxlQUFlLENBQXJCLEMsQ0FBd0I7QUFDeEIsSUFBTSxjQUFjLENBQXBCLEMsQ0FBdUI7QUFDdkIsSUFBTSxnQkFBZ0IsQ0FBdEI7QUFDQSxJQUFNLGdCQUFnQixDQUF0Qjs7SUFFcUIsSztBQUNqQixtQkFBWSxXQUFaLEVBQXlCO0FBQUE7O0FBQ3JCLGFBQUssV0FBTCxHQUFtQixXQUFuQjtBQUNBLGFBQUssS0FBTCxHQUFhLFNBQWI7QUFDSDs7Ozs2QkFFSSxJLEVBQU0sUSxFQUFVO0FBQ2pCLGlCQUFLLEtBQUwsR0FBYSxhQUFiO0FBQ0EsaUJBQUssSUFBTCxHQUFZLElBQVo7QUFDQSxpQkFBSyxTQUFMLEdBQWlCLE1BQU0sS0FBSyxHQUFMLENBQVMsQ0FBVCxFQUFZLENBQUMsT0FBTyxFQUFSLElBQWMsRUFBMUIsQ0FBdkI7QUFDQSxpQkFBSyxNQUFMLEdBQWMsV0FBVyxHQUF6QjtBQUNBLGlCQUFLLEtBQUwsR0FBYSxDQUFiOztBQUVBLGlCQUFLLFVBQUwsR0FBa0IsZ0NBQWxCO0FBQ0E7O0FBRUEsaUJBQUssaUJBQUwsR0FBeUIsa0NBQXpCO0FBQ0EsaUJBQUssWUFBTCxHQUFvQixDQUFwQjtBQUNBLGlCQUFLLGdCQUFMLEdBQXdCLENBQXhCO0FBQ0EsaUJBQUssZ0JBQUwsR0FBd0IsR0FBeEI7O0FBRUEsaUJBQUssWUFBTCxHQUFvQixDQUFwQjtBQUNIOzs7K0JBRU07QUFDSCxpQkFBSyxLQUFMLEdBQWEsYUFBYjtBQUNIOzs7K0JBRU0sTSxFQUFRLE0sRUFBUSxVLEVBQVk7QUFDL0IsZ0JBQUksS0FBSyxLQUFMLEtBQWUsU0FBbkIsRUFBOEI7QUFDMUIscUJBQUssSUFBSSxJQUFJLENBQWIsRUFBZ0IsSUFBSSxNQUFwQixFQUE0QixHQUE1QixFQUFpQztBQUM3Qix3QkFBSSxZQUFZLEtBQUssV0FBTCxDQUFpQixlQUFqQixHQUFtQyxLQUFLLGdCQUF4RDs7QUFFQSx3QkFBSSxnQkFBZ0IsYUFBYSxLQUFLLGdCQUF0QztBQUNBLHlCQUFLLFlBQUwsSUFBcUIsSUFBSSxhQUF6QjtBQUNBLHdCQUFJLGdCQUFnQixLQUFLLGlCQUFMLENBQXVCLFNBQXZCLENBQWlDLEtBQUssWUFBdEMsSUFBc0QsU0FBMUU7O0FBRUEsd0JBQUksWUFBWSxLQUFLLGNBQUwsQ0FBb0IsS0FBSyxJQUFMLEdBQVksS0FBSyxXQUFMLENBQWlCLFNBQTdCLEdBQXlDLGFBQTdELENBQWhCO0FBQ0Esd0JBQUksU0FBUyxhQUFhLFNBQTFCOztBQUVBLHdCQUFJLFNBQVMsQ0FBYjtBQUNBLHlCQUFLLElBQUksS0FBSSxDQUFiLEVBQWdCLEtBQUksS0FBSyxZQUF6QixFQUF1QyxJQUF2QyxFQUE0QztBQUN4QyxrQ0FBVSxLQUFLLFVBQUwsQ0FBZ0IsU0FBaEIsQ0FBMEIsS0FBSyxLQUEvQixDQUFWO0FBQ0EsNkJBQUssS0FBTCxJQUFjLElBQUksTUFBSixHQUFhLEtBQUssWUFBaEM7QUFDSDtBQUNELDJCQUFPLENBQVAsS0FBYSxTQUFTLEtBQUssWUFBZCxHQUE2QixLQUFLLE1BQWxDLEdBQTJDLEdBQXhEOztBQUVBLHdCQUFJLEtBQUssS0FBTCxLQUFlLGFBQW5CLEVBQWtDO0FBQzlCLDZCQUFLLE1BQUwsSUFBZSxLQUFmO0FBQ0gscUJBRkQsTUFFTztBQUNILDZCQUFLLE1BQUwsSUFBZSxPQUFmO0FBQ0g7O0FBRUQsd0JBQUksS0FBSyxNQUFMLEdBQWMsQ0FBbEIsRUFBcUI7QUFDakIsNkJBQUssS0FBTCxHQUFhLFNBQWI7QUFDQTtBQUNIO0FBQ0o7QUFDSjtBQUNKOzs7b0NBRVc7QUFDUixnQkFBSSxLQUFLLEtBQUwsS0FBZSxTQUFuQixFQUE4QjtBQUMxQix1QkFBTyxJQUFQO0FBQ0g7QUFDRCxtQkFBTyxLQUFQO0FBQ0g7Ozt1Q0FFYyxJLEVBQU07QUFDakIsbUJBQU8sTUFBTSxLQUFLLEdBQUwsQ0FBUyxDQUFULEVBQVksQ0FBQyxPQUFPLEVBQVIsSUFBYyxFQUExQixDQUFiO0FBQ0g7Ozs7OztrQkF0RWdCLEs7Ozs7Ozs7Ozs7Ozs7SUNUQSxLOzs7Ozs7O2dDQUNGO0FBQ1gsZ0JBQUksT0FBTyxRQUFQLEtBQW9CLFdBQXhCLEVBQXFDO0FBQ2pDO0FBQ0g7O0FBRUQscUJBQVMsY0FBVCxDQUF3QixPQUF4QixFQUFpQyxTQUFqQyxHQUE2QyxFQUE3QztBQUNIOzs7NEJBRVUsTyxFQUFTO0FBQ2hCLGdCQUFJLE9BQU8sUUFBUCxLQUFvQixXQUF4QixFQUFxQztBQUNqQztBQUNIOztBQUVELGdCQUFJLFVBQVUsU0FBUyxjQUFULENBQXdCLE9BQXhCLENBQWQ7QUFDQSxnQkFBSSxPQUFKLEVBQWE7QUFDVCxvQkFBSSxNQUFNLFNBQVMsYUFBVCxDQUF1QixLQUF2QixDQUFWO0FBQ0Esb0JBQUksT0FBTyxTQUFTLGNBQVQsQ0FBd0IsT0FBeEIsQ0FBWDtBQUNBLG9CQUFJLFdBQUosQ0FBZ0IsSUFBaEI7O0FBRUEsd0JBQVEsV0FBUixDQUFvQixHQUFwQjtBQUNBLHVCQUFPLFFBQVEsWUFBUixHQUF1QixRQUFRLFlBQXRDLEVBQW9EO0FBQ2hELDRCQUFRLFdBQVIsQ0FBb0IsUUFBUSxVQUE1QjtBQUNIO0FBQ0o7QUFDSjs7Ozs7O2tCQXpCZ0IsSzs7Ozs7Ozs7Ozs7OztJQ0FBLE07Ozs7Ozs7K0JBQ0gsRyxFQUFLLEcsRUFBSztBQUNwQixtQkFBTyxNQUFNLEtBQUssTUFBTCxNQUFpQixNQUFNLEdBQXZCLENBQWI7QUFDSDs7OzhCQUVZLEssRUFBTyxHLEVBQUssRyxFQUN6QjtBQUNJLGdCQUFJLE1BQU0sR0FBVixFQUFlO0FBQ1gsb0JBQUksT0FBTyxHQUFYO0FBQ0Esc0JBQU0sR0FBTjtBQUNBLHNCQUFNLElBQU47QUFDSDs7QUFFRCxnQkFBSSxRQUFRLEdBQVosRUFBaUI7QUFDYix1QkFBTyxHQUFQO0FBQ0g7QUFDRCxnQkFBSSxRQUFRLEdBQVosRUFBaUI7QUFDYix1QkFBTyxHQUFQO0FBQ0g7QUFDRCxtQkFBTyxLQUFQO0FBQ0g7OztrQ0FFZ0IsSyxFQUFPLEUsRUFBSSxFLEVBQUksRSxFQUFJLEUsRUFDcEM7QUFDSSxtQkFBTyxLQUFLLENBQUMsUUFBUSxFQUFULEtBQWdCLEtBQUssRUFBckIsS0FBNEIsS0FBSyxFQUFqQyxDQUFaO0FBQ0g7Ozt5Q0FFdUIsSyxFQUFPLEUsRUFBSSxFLEVBQUksRSxFQUFJLEUsRUFDM0M7QUFDSSxtQkFBTyxLQUFLLEtBQUwsQ0FBVyxLQUFLLFNBQUwsQ0FBZSxLQUFmLEVBQXNCLEVBQXRCLEVBQTBCLEVBQTFCLEVBQThCLEVBQTlCLEVBQWtDLEVBQWxDLENBQVgsRUFBa0QsRUFBbEQsRUFBc0QsRUFBdEQsQ0FBUDtBQUNIOzs7NkJBRVcsSyxFQUFPLE0sRUFBUSxNLEVBQVEsUyxFQUFXO0FBQzFDLG1CQUFPLFFBQVEsQ0FBQyxTQUFTLEtBQVYsS0FBb0IsSUFBSSxLQUFLLEdBQUwsQ0FBUyxDQUFDLE1BQUQsR0FBVSxTQUFuQixDQUF4QixDQUFmO0FBQ0g7OzsrQkFFYSxNLEVBQVE7QUFDbEIsbUJBQU8sU0FBUyxtQkFBaEIsQ0FEa0IsQ0FDbUI7QUFDeEM7OzsrQkFFYSxNLEVBQVE7QUFDbEIsbUJBQU8sU0FBUyxtQkFBaEIsQ0FEa0IsQ0FDbUI7QUFDeEM7Ozs2QkFFVyxLLEVBQU8sRyxFQUFLLEcsRUFBSztBQUN6QixnQkFBSSxJQUFJLENBQUMsUUFBUSxHQUFULEtBQWlCLE1BQU0sR0FBdkIsQ0FBUjtBQUNBLG1CQUFRLEtBQUssQ0FBTixHQUFXLElBQUksR0FBZixHQUFxQixJQUFJLEdBQWhDO0FBQ0g7Ozs7OztrQkEvQ2dCLE07Ozs7Ozs7Ozs7Ozs7SUNBQSxROzs7Ozs7O2dDQUNGO0FBQ1gsbUJBQU8sS0FBSyxRQUFMLE1BQW1CLEtBQUssTUFBTCxFQUExQjtBQUNIOzs7bUNBRWlCO0FBQ2QsZ0JBQUksT0FBTyxRQUFQLEtBQW9CLFdBQXhCLEVBQXFDO0FBQ2pDLHVCQUFPLEtBQVA7QUFDSDs7QUFFRCxtQkFBTyxPQUFPLFNBQVAsQ0FBaUIsU0FBakIsQ0FBMkIsT0FBM0IsQ0FBbUMsUUFBbkMsS0FBZ0QsQ0FBdkQ7QUFDSDs7O2lDQUVlO0FBQ1osZ0JBQUksT0FBTyxRQUFQLEtBQW9CLFdBQXhCLEVBQXFDO0FBQ2pDLHVCQUFPLEtBQVA7QUFDSDs7QUFFRCxtQkFBTyxPQUFPLFNBQVAsQ0FBaUIsU0FBakIsQ0FBMkIsT0FBM0IsQ0FBbUMsTUFBbkMsS0FBOEMsQ0FBckQ7QUFDSDs7Ozs7O2tCQW5CZ0IsUTs7Ozs7Ozs7Ozs7Ozs7NENDQVosTzs7Ozs7Ozs7O2dEQUNBLE87Ozs7Ozs7Ozs4Q0FDQSxPOzs7Ozs7Ozs7Ozs7Ozs7QUNGVDs7Ozs7Ozs7SUFFcUIsZ0I7Ozs7Ozs7a0NBQ1AsSyxFQUFPO0FBQ2IsZ0JBQUksSUFBSSxRQUFRLENBQWhCOztBQUVBLG1CQUFPLElBQUksR0FBSixHQUFVLENBQVYsR0FBYyxDQUFDLENBQXRCO0FBQ0g7Ozs7OztrQkFMZ0IsZ0I7Ozs7Ozs7Ozs7O0FDRnJCOzs7Ozs7OztJQUVxQixrQjs7Ozs7OztrQ0FDUCxLLEVBQU87QUFDYixnQkFBSSxJQUFJLFFBQVEsQ0FBaEI7O0FBRUEsZ0JBQUksSUFBSSxJQUFSLEVBQWM7QUFDVix1QkFBTyxpQkFBTyxTQUFQLENBQWlCLENBQWpCLEVBQW9CLENBQXBCLEVBQXVCLElBQXZCLEVBQTZCLENBQTdCLEVBQWdDLENBQWhDLENBQVA7QUFDQTtBQUNIO0FBQ0QsZ0JBQUksSUFBSSxJQUFSLEVBQWM7QUFDVix1QkFBTyxpQkFBTyxTQUFQLENBQWlCLENBQWpCLEVBQW9CLElBQXBCLEVBQTBCLElBQTFCLEVBQWdDLENBQWhDLEVBQW1DLENBQUMsQ0FBcEMsQ0FBUDtBQUNIO0FBQ0QsbUJBQU8saUJBQU8sU0FBUCxDQUFpQixDQUFqQixFQUFvQixJQUFwQixFQUEwQixDQUExQixFQUE2QixDQUFDLENBQTlCLEVBQWlDLENBQWpDLENBQVA7QUFDSDs7Ozs7O2tCQVpnQixrQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBtbWwyc21mO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChvYmopIHsgaWYgKG9iaiAmJiBvYmouX19lc01vZHVsZSkgeyByZXR1cm4gb2JqOyB9IGVsc2UgeyB2YXIgbmV3T2JqID0ge307IGlmIChvYmogIT0gbnVsbCkgeyBmb3IgKHZhciBrZXkgaW4gb2JqKSB7IGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSBuZXdPYmpba2V5XSA9IG9ialtrZXldOyB9IH0gbmV3T2JqW1wiZGVmYXVsdFwiXSA9IG9iajsgcmV0dXJuIG5ld09iajsgfSB9XG5cbnZhciBfcGFyc2VyUGFyc2VyID0gcmVxdWlyZShcIi4uL3BhcnNlci9wYXJzZXJcIik7XG5cbnZhciBwYXJzZXIgPSBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChfcGFyc2VyUGFyc2VyKTtcblxuZnVuY3Rpb24gbW1sMnNtZihtbWwsIG9wdHMpIHtcbiAgICB2YXIgc3RhcnRUaWNrID0gMDtcbiAgICB2YXIgdGltZWJhc2UgPSA0ODA7XG5cbiAgICBpZiAob3B0cyAmJiBvcHRzLnRpbWViYXNlKSB7XG4gICAgICAgIHRpbWViYXNlID0gb3B0cy50aW1lYmFzZTtcbiAgICB9XG5cbiAgICB2YXIgdHJhY2tEYXRhQXJyYXkgPSBbXTtcblxuICAgIHZhciB0cmFja3MgPSBwYXJzZXIucGFyc2UobW1sICsgXCI7XCIpO1xuICAgIC8vIGNvbnNvbGUuZGlyKHRyYWNrcyk7XG5cbiAgICB2YXIgY2hhbm5lbCA9IDA7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0cmFja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdHJhY2tEYXRhQXJyYXkucHVzaChjcmVhdGVUcmFja0RhdGEodHJhY2tzW2ldKSk7XG4gICAgICAgIGNoYW5uZWwrKztcblxuICAgICAgICBpZiAoY2hhbm5lbCA+IDE1KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeGNlZWRlZCBtYXhpbXVtIE1JREkgY2hhbm5lbCAoMTYpXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGZvcm1hdCA9IHRyYWNrcy5sZW5ndGggPiAxID8gMSA6IDA7XG5cbiAgICB2YXIgc21mID0gWzB4NGQsIDB4NTQsIDB4NjgsIDB4NjRdO1xuXG4gICAgZnVuY3Rpb24gd3JpdGUyYnl0ZXModmFsdWUpIHtcbiAgICAgICAgc21mLnB1c2godmFsdWUgPj4gOCAmIDB4ZmYsIHZhbHVlICYgMHhmZik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gd3JpdGU0Ynl0ZXModmFsdWUpIHtcbiAgICAgICAgc21mLnB1c2godmFsdWUgPj4gMjQgJiAweGZmLCB2YWx1ZSA+PiAxNiAmIDB4ZmYsIHZhbHVlID4+IDggJiAweGZmLCB2YWx1ZSAmIDB4ZmYpO1xuICAgIH1cblxuICAgIHdyaXRlNGJ5dGVzKDYpO1xuICAgIHdyaXRlMmJ5dGVzKGZvcm1hdCk7XG4gICAgd3JpdGUyYnl0ZXModHJhY2tzLmxlbmd0aCk7XG4gICAgd3JpdGUyYnl0ZXModGltZWJhc2UpO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0cmFja3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgc21mLnB1c2goMHg0ZCwgMHg1NCwgMHg3MiwgMHg2Yik7XG4gICAgICAgIHdyaXRlNGJ5dGVzKHRyYWNrRGF0YUFycmF5W2ldLmxlbmd0aCk7XG4gICAgICAgIHNtZiA9IHNtZi5jb25jYXQodHJhY2tEYXRhQXJyYXlbaV0pO1xuICAgIH1cblxuICAgIGlmIChvcHRzKSB7XG4gICAgICAgIG9wdHMuc3RhcnRUaWNrID0gc3RhcnRUaWNrO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVWludDhBcnJheShzbWYpO1xuXG4gICAgZnVuY3Rpb24gY3JlYXRlVHJhY2tEYXRhKHRva2Vucykge1xuICAgICAgICB2YXIgdHJhY2tEYXRhID0gW107XG4gICAgICAgIHZhciBiYXNlTGVuZ3RoID0gdGltZWJhc2U7XG5cbiAgICAgICAgdmFyIGN1cnJlbnRUaWNrID0gMDtcblxuICAgICAgICB2YXIgcmVzdFRpY2sgPSAwO1xuXG4gICAgICAgIHZhciBPQ1RBVkVfTUlOID0gLTE7XG4gICAgICAgIHZhciBPQ1RBVkVfTUFYID0gMTA7XG4gICAgICAgIHZhciBvY3RhdmUgPSA0O1xuXG4gICAgICAgIHZhciB2ZWxvY2l0eSA9IDEwMDtcblxuICAgICAgICB2YXIgcSA9IDY7XG4gICAgICAgIHZhciBrZXlTaGlmdCA9IDA7XG5cbiAgICAgICAgdmFyIHAgPSAwO1xuXG4gICAgICAgIGZ1bmN0aW9uIHdyaXRlKCkge1xuICAgICAgICAgICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGRhdGEgPSBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICAgICAgICAgICAgICBkYXRhW19rZXldID0gYXJndW1lbnRzW19rZXldO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cmFja0RhdGEgPSB0cmFja0RhdGEuY29uY2F0KGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZXJyb3IobWVzc2FnZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiXCIgKyBtZXNzYWdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGNhbGNOb3RlTGVuZ3RoKGxlbmd0aCwgbnVtRG90cykge1xuICAgICAgICAgICAgdmFyIG5vdGVMZW5ndGggPSBiYXNlTGVuZ3RoO1xuICAgICAgICAgICAgaWYgKGxlbmd0aCkge1xuICAgICAgICAgICAgICAgIG5vdGVMZW5ndGggPSB0aW1lYmFzZSAqIDQgLyBsZW5ndGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBkb3R0ZWRUaW1lID0gbm90ZUxlbmd0aDtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbnVtRG90czsgaSsrKSB7XG4gICAgICAgICAgICAgICAgZG90dGVkVGltZSAvPSAyO1xuICAgICAgICAgICAgICAgIG5vdGVMZW5ndGggKz0gZG90dGVkVGltZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBub3RlTGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gd3JpdGVEZWx0YVRpY2sodGljaykge1xuICAgICAgICAgICAgaWYgKHRpY2sgPCAwIHx8IHRpY2sgPiAweGZmZmZmZmYpIHtcbiAgICAgICAgICAgICAgICBlcnJvcihcImlsbGVnYWwgbGVuZ3RoXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc3RhY2sgPSBbXTtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIHN0YWNrLnB1c2godGljayAmIDB4N2YpO1xuICAgICAgICAgICAgICAgIHRpY2sgPj4+PSA3O1xuICAgICAgICAgICAgfSB3aGlsZSAodGljayA+IDApO1xuXG4gICAgICAgICAgICB3aGlsZSAoc3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHZhciBiID0gc3RhY2sucG9wKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3RhY2subGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBiIHw9IDB4ODA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHdyaXRlKGIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKHAgPCB0b2tlbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgdG9rZW4gPSB0b2tlbnNbcF07XG4gICAgICAgICAgICAvLyBjb25zb2xlLmRpcih0b2tlbik7XG5cbiAgICAgICAgICAgIHN3aXRjaCAodG9rZW4uY29tbWFuZCkge1xuICAgICAgICAgICAgICAgIGNhc2UgXCJub3RlXCI6XG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBhYmNkZWZnID0gWzksIDExLCAwLCAyLCA0LCA1LCA3XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBuID0gXCJhYmNkZWZnXCIuaW5kZXhPZih0b2tlbi50b25lKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG5vdGUgPSAob2N0YXZlICsgMSkgKiAxMiArIGFiY2RlZmdbbl0gKyBrZXlTaGlmdDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b2tlbi5hY2NpZGVudGFscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0b2tlbi5hY2NpZGVudGFsc1tpXSA9PT0gXCIrXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90ZSsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodG9rZW4uYWNjaWRlbnRhbHNbaV0gPT09IFwiLVwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdGUtLTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub3RlIDwgMCB8fCBub3RlID4gMTI3KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJpbGxlZ2FsIG5vdGUgbnVtYmVyICgwLTEyNylcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfc3RlcFRpbWUgPSBjYWxjTm90ZUxlbmd0aCh0b2tlbi5sZW5ndGgsIHRva2VuLmRvdHMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdoaWxlICh0b2tlbnNbcCArIDFdICYmIHRva2Vuc1twICsgMV0uY29tbWFuZCA9PT0gXCJ0aWVcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHArKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfc3RlcFRpbWUgKz0gY2FsY05vdGVMZW5ndGgodG9rZW5zW3BdLmxlbmd0aCwgdG9rZW5zW3BdLmRvdHMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGdhdGVUaW1lID0gTWF0aC5yb3VuZChfc3RlcFRpbWUgKiBxIC8gOCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHdyaXRlRGVsdGFUaWNrKHJlc3RUaWNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdyaXRlKDB4OTAgfCBjaGFubmVsLCBub3RlLCB2ZWxvY2l0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cml0ZURlbHRhVGljayhnYXRlVGltZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cml0ZSgweDgwIHwgY2hhbm5lbCwgbm90ZSwgMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN0VGljayA9IF9zdGVwVGltZSAtIGdhdGVUaW1lO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50VGljayArPSBfc3RlcFRpbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhc2UgXCJyZXN0XCI6XG4gICAgICAgICAgICAgICAgICAgIHZhciBzdGVwVGltZSA9IGNhbGNOb3RlTGVuZ3RoKHRva2VuLmxlbmd0aCwgdG9rZW4uZG90cy5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHJlc3RUaWNrICs9IHN0ZXBUaW1lO1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50VGljayArPSBzdGVwVGltZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwib2N0YXZlXCI6XG4gICAgICAgICAgICAgICAgICAgIG9jdGF2ZSA9IHRva2VuLm51bWJlcjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwib2N0YXZlX3VwXCI6XG4gICAgICAgICAgICAgICAgICAgIG9jdGF2ZSsrO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJvY3RhdmVfZG93blwiOlxuICAgICAgICAgICAgICAgICAgICBvY3RhdmUtLTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwibm90ZV9sZW5ndGhcIjpcbiAgICAgICAgICAgICAgICAgICAgYmFzZUxlbmd0aCA9IGNhbGNOb3RlTGVuZ3RoKHRva2VuLmxlbmd0aCwgdG9rZW4uZG90cy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJnYXRlX3RpbWVcIjpcbiAgICAgICAgICAgICAgICAgICAgcSA9IHRva2VuLnF1YW50aXR5O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJ2ZWxvY2l0eVwiOlxuICAgICAgICAgICAgICAgICAgICB2ZWxvY2l0eSA9IHRva2VuLnZhbHVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJ2b2x1bWVcIjpcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVEZWx0YVRpY2socmVzdFRpY2spO1xuICAgICAgICAgICAgICAgICAgICB3cml0ZSgweGIwIHwgY2hhbm5lbCwgNywgdG9rZW4udmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJwYW5cIjpcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVEZWx0YVRpY2socmVzdFRpY2spO1xuICAgICAgICAgICAgICAgICAgICB3cml0ZSgweGIwIHwgY2hhbm5lbCwgMTAsIHRva2VuLnZhbHVlICsgNjQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJleHByZXNzaW9uXCI6XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlRGVsdGFUaWNrKHJlc3RUaWNrKTtcbiAgICAgICAgICAgICAgICAgICAgd3JpdGUoMHhiMCB8IGNoYW5uZWwsIDExLCB0b2tlbi52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBcImNvbnRyb2xfY2hhbmdlXCI6XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlRGVsdGFUaWNrKHJlc3RUaWNrKTtcbiAgICAgICAgICAgICAgICAgICAgd3JpdGUoMHhiMCB8IGNoYW5uZWwsIHRva2VuLm51bWJlciwgdG9rZW4udmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJwcm9ncmFtX2NoYW5nZVwiOlxuICAgICAgICAgICAgICAgICAgICB3cml0ZURlbHRhVGljayhyZXN0VGljayk7XG4gICAgICAgICAgICAgICAgICAgIHdyaXRlKDB4YzAgfCBjaGFubmVsLCB0b2tlbi5udW1iZXIpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJjaGFubmVsX2FmdGVydG91Y2hcIjpcbiAgICAgICAgICAgICAgICAgICAgd3JpdGVEZWx0YVRpY2socmVzdFRpY2spO1xuICAgICAgICAgICAgICAgICAgICB3cml0ZSgweGQwIHwgY2hhbm5lbCwgdG9rZW4udmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgXCJ0ZW1wb1wiOlxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcXVhcnRlck1pY3Jvc2Vjb25kcyA9IDYwICogMTAwMCAqIDEwMDAgLyB0b2tlbi52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChxdWFydGVyTWljcm9zZWNvbmRzIDwgMSB8fCBxdWFydGVyTWljcm9zZWNvbmRzID4gMHhmZmZmZmYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcihcImlsbGVnYWwgdGVtcG9cIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHdyaXRlRGVsdGFUaWNrKHJlc3RUaWNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdyaXRlKDB4ZmYsIDB4NTEsIDB4MDMsIHF1YXJ0ZXJNaWNyb3NlY29uZHMgPj4gMTYgJiAweGZmLCBxdWFydGVyTWljcm9zZWNvbmRzID4+IDggJiAweGZmLCBxdWFydGVyTWljcm9zZWNvbmRzICYgMHhmZik7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY2FzZSBcInN0YXJ0X3BvaW50XCI6XG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0VGljayA9IGN1cnJlbnRUaWNrO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNhc2UgXCJrZXlfc2hpZnRcIjpcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAga2V5U2hpZnQgPSB0b2tlbi52YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjYXNlIFwic2V0X21pZGlfY2hhbm5lbFwiOlxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFubmVsID0gdG9rZW4uY2hhbm5lbCAtIDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob2N0YXZlIDwgT0NUQVZFX01JTiB8fCBvY3RhdmUgPiBPQ1RBVkVfTUFYKSB7XG4gICAgICAgICAgICAgICAgZXJyb3IoXCJvY3RhdmUgaXMgb3V0IG9mIHJhbmdlXCIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwKys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJhY2tEYXRhO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzW1wiZGVmYXVsdFwiXTsiLCJtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbigpIHtcbiAgLypcbiAgICogR2VuZXJhdGVkIGJ5IFBFRy5qcyAwLjguMC5cbiAgICpcbiAgICogaHR0cDovL3BlZ2pzLm1hamRhLmN6L1xuICAgKi9cblxuICBmdW5jdGlvbiBwZWckc3ViY2xhc3MoY2hpbGQsIHBhcmVudCkge1xuICAgIGZ1bmN0aW9uIGN0b3IoKSB7IHRoaXMuY29uc3RydWN0b3IgPSBjaGlsZDsgfVxuICAgIGN0b3IucHJvdG90eXBlID0gcGFyZW50LnByb3RvdHlwZTtcbiAgICBjaGlsZC5wcm90b3R5cGUgPSBuZXcgY3RvcigpO1xuICB9XG5cbiAgZnVuY3Rpb24gU3ludGF4RXJyb3IobWVzc2FnZSwgZXhwZWN0ZWQsIGZvdW5kLCBvZmZzZXQsIGxpbmUsIGNvbHVtbikge1xuICAgIHRoaXMubWVzc2FnZSAgPSBtZXNzYWdlO1xuICAgIHRoaXMuZXhwZWN0ZWQgPSBleHBlY3RlZDtcbiAgICB0aGlzLmZvdW5kICAgID0gZm91bmQ7XG4gICAgdGhpcy5vZmZzZXQgICA9IG9mZnNldDtcbiAgICB0aGlzLmxpbmUgICAgID0gbGluZTtcbiAgICB0aGlzLmNvbHVtbiAgID0gY29sdW1uO1xuXG4gICAgdGhpcy5uYW1lICAgICA9IFwiU3ludGF4RXJyb3JcIjtcbiAgfVxuXG4gIHBlZyRzdWJjbGFzcyhTeW50YXhFcnJvciwgRXJyb3IpO1xuXG4gIGZ1bmN0aW9uIHBhcnNlKGlucHV0KSB7XG4gICAgdmFyIG9wdGlvbnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMSA/IGFyZ3VtZW50c1sxXSA6IHt9LFxuXG4gICAgICAgIHBlZyRGQUlMRUQgPSB7fSxcblxuICAgICAgICBwZWckc3RhcnRSdWxlRnVuY3Rpb25zID0geyBzdGFydDogcGVnJHBhcnNlc3RhcnQgfSxcbiAgICAgICAgcGVnJHN0YXJ0UnVsZUZ1bmN0aW9uICA9IHBlZyRwYXJzZXN0YXJ0LFxuXG4gICAgICAgIHBlZyRjMCA9IFtdLFxuICAgICAgICBwZWckYzEgPSBwZWckRkFJTEVELFxuICAgICAgICBwZWckYzIgPSBmdW5jdGlvbihjb21tYW5kcykgeyByZXR1cm4gY29tbWFuZHM7IH0sXG4gICAgICAgIHBlZyRjMyA9IFwiO1wiLFxuICAgICAgICBwZWckYzQgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCI7XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCI7XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgICAgcGVnJGM2ID0gL15bIFxcdFxcclxcbl0vLFxuICAgICAgICBwZWckYzcgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWyBcXFxcdFxcXFxyXFxcXG5dXCIsIGRlc2NyaXB0aW9uOiBcIlsgXFxcXHRcXFxcclxcXFxuXVwiIH0sXG4gICAgICAgIHBlZyRjOCA9IFwiLypcIixcbiAgICAgICAgcGVnJGM5ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiLypcIiwgZGVzY3JpcHRpb246IFwiXFxcIi8qXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTAgPSB2b2lkIDAsXG4gICAgICAgIHBlZyRjMTEgPSBcIiovXCIsXG4gICAgICAgIHBlZyRjMTIgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIqL1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiKi9cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMyA9IHsgdHlwZTogXCJhbnlcIiwgZGVzY3JpcHRpb246IFwiYW55IGNoYXJhY3RlclwiIH0sXG4gICAgICAgIHBlZyRjMTQgPSBmdW5jdGlvbigpIHsgcmV0dXJuIHsgY29tbWFuZDogXCJjb21tZW50XCIgfTsgfSxcbiAgICAgICAgcGVnJGMxNSA9IFwiLy9cIixcbiAgICAgICAgcGVnJGMxNiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIi8vXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIvL1xcXCJcIiB9LFxuICAgICAgICBwZWckYzE3ID0gL15bXlxcbl0vLFxuICAgICAgICBwZWckYzE4ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlteXFxcXG5dXCIsIGRlc2NyaXB0aW9uOiBcIlteXFxcXG5dXCIgfSxcbiAgICAgICAgcGVnJGMxOSA9IC9eW2NkZWZnYWJdLyxcbiAgICAgICAgcGVnJGMyMCA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbY2RlZmdhYl1cIiwgZGVzY3JpcHRpb246IFwiW2NkZWZnYWJdXCIgfSxcbiAgICAgICAgcGVnJGMyMSA9IC9eW1xcLStdLyxcbiAgICAgICAgcGVnJGMyMiA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbXFxcXC0rXVwiLCBkZXNjcmlwdGlvbjogXCJbXFxcXC0rXVwiIH0sXG4gICAgICAgIHBlZyRjMjMgPSAvXlswLTldLyxcbiAgICAgICAgcGVnJGMyNCA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbMC05XVwiLCBkZXNjcmlwdGlvbjogXCJbMC05XVwiIH0sXG4gICAgICAgIHBlZyRjMjUgPSBcIi5cIixcbiAgICAgICAgcGVnJGMyNiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIi5cIiwgZGVzY3JpcHRpb246IFwiXFxcIi5cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMyNyA9IGZ1bmN0aW9uKHRvbmUsIGFjY2lkZW50YWxzLCBsZW5ndGgsIGRvdHMpIHsgcmV0dXJuIHsgY29tbWFuZDogXCJub3RlXCIsIHRvbmU6IHRvbmUsIGFjY2lkZW50YWxzOiBhY2NpZGVudGFscywgbGVuZ3RoOiArbGVuZ3RoLCBkb3RzOiBkb3RzIH07IH0sXG4gICAgICAgIHBlZyRjMjggPSBcIl5cIixcbiAgICAgICAgcGVnJGMyOSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIl5cIiwgZGVzY3JpcHRpb246IFwiXFxcIl5cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMzMCA9IGZ1bmN0aW9uKGxlbmd0aCwgZG90cykgeyByZXR1cm4geyBjb21tYW5kOiBcInRpZVwiLCBsZW5ndGg6ICtsZW5ndGgsIGRvdHM6IGRvdHMgfTsgfSxcbiAgICAgICAgcGVnJGMzMSA9IFwiclwiLFxuICAgICAgICBwZWckYzMyID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiclwiLCBkZXNjcmlwdGlvbjogXCJcXFwiclxcXCJcIiB9LFxuICAgICAgICBwZWckYzMzID0gZnVuY3Rpb24obGVuZ3RoLCBkb3RzKSB7IHJldHVybiB7IGNvbW1hbmQ6IFwicmVzdFwiLCBsZW5ndGg6ICtsZW5ndGgsIGRvdHM6IGRvdHMgfTsgfSxcbiAgICAgICAgcGVnJGMzNCA9IFwib1wiLFxuICAgICAgICBwZWckYzM1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwib1wiLCBkZXNjcmlwdGlvbjogXCJcXFwib1xcXCJcIiB9LFxuICAgICAgICBwZWckYzM2ID0gbnVsbCxcbiAgICAgICAgcGVnJGMzNyA9IFwiLVwiLFxuICAgICAgICBwZWckYzM4ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiLVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiLVxcXCJcIiB9LFxuICAgICAgICBwZWckYzM5ID0gZnVuY3Rpb24obnVtYmVyKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobnVtYmVyIDwgLTEgfHwgbnVtYmVyID4gMTApIHtcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcihcIm9jdGF2ZSBudW1iZXIgaXMgb3V0IG9mIHJhbmdlXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBjb21tYW5kOiBcIm9jdGF2ZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIG51bWJlcjogK251bWJlcixcclxuICAgICAgICAgICAgICAgICAgICBsaW5lOiBsaW5lKCksXHJcbiAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBjb2x1bW4oKVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGM0MCA9IFwiPFwiLFxuICAgICAgICBwZWckYzQxID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiPFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiPFxcXCJcIiB9LFxuICAgICAgICBwZWckYzQyID0gZnVuY3Rpb24oKSB7IHJldHVybiB7IGNvbW1hbmQ6IFwib2N0YXZlX3VwXCIgfTsgfSxcbiAgICAgICAgcGVnJGM0MyA9IFwiPlwiLFxuICAgICAgICBwZWckYzQ0ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiPlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiPlxcXCJcIiB9LFxuICAgICAgICBwZWckYzQ1ID0gZnVuY3Rpb24oKSB7IHJldHVybiB7IGNvbW1hbmQ6IFwib2N0YXZlX2Rvd25cIiB9OyB9LFxuICAgICAgICBwZWckYzQ2ID0gXCJsXCIsXG4gICAgICAgIHBlZyRjNDcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJsXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJsXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNDggPSBmdW5jdGlvbihsZW5ndGgsIGRvdHMpIHsgcmV0dXJuIHsgY29tbWFuZDogXCJub3RlX2xlbmd0aFwiLCBsZW5ndGg6ICtsZW5ndGgsIGRvdHM6IGRvdHMgfTsgfSxcbiAgICAgICAgcGVnJGM0OSA9IFwicVwiLFxuICAgICAgICBwZWckYzUwID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwicVwiLCBkZXNjcmlwdGlvbjogXCJcXFwicVxcXCJcIiB9LFxuICAgICAgICBwZWckYzUxID0gL15bMS04XS8sXG4gICAgICAgIHBlZyRjNTIgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWzEtOF1cIiwgZGVzY3JpcHRpb246IFwiWzEtOF1cIiB9LFxuICAgICAgICBwZWckYzUzID0gZnVuY3Rpb24ocXVhbnRpdHkpIHsgcmV0dXJuIHsgY29tbWFuZDogXCJnYXRlX3RpbWVcIiwgcXVhbnRpdHk6ICtxdWFudGl0eSB9OyB9LFxuICAgICAgICBwZWckYzU0ID0gXCJ1XCIsXG4gICAgICAgIHBlZyRjNTUgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ1XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ1XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNTYgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSArdmFsdWU7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPCAwIHx8IHZhbHVlID4gMTI3KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJ2ZWxvY2l0eSBpcyBvdXQgb2YgcmFuZ2UgKDAtMTI3KVwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IGNvbW1hbmQ6IFwidmVsb2NpdHlcIiwgdmFsdWU6IHZhbHVlIH07XHJcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjNTcgPSBcInZcIixcbiAgICAgICAgcGVnJGM1OCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInZcIiwgZGVzY3JpcHRpb246IFwiXFxcInZcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM1OSA9IGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9ICt2YWx1ZTtcclxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA8IDAgfHwgdmFsdWUgPiAxMjcpIHtcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcihcInZvbHVtZSBpcyBvdXQgb2YgcmFuZ2UgKDAtMTI3KVwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IGNvbW1hbmQ6IFwidm9sdW1lXCIsIHZhbHVlOiB2YWx1ZSB9O1xyXG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzYwID0gXCJwXCIsXG4gICAgICAgIHBlZyRjNjEgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJwXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJwXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNjIgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSArdmFsdWU7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPCAtNjQgfHwgdmFsdWUgPiA2Mykge1xyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yKFwicGFuIGlzIG91dCBvZiByYW5nZSAoLTY0LTYzKVwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IGNvbW1hbmQ6IFwicGFuXCIsIHZhbHVlOiB2YWx1ZSB9O1xyXG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzYzID0gXCJFXCIsXG4gICAgICAgIHBlZyRjNjQgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJFXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJFXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNjUgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSArdmFsdWU7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPCAwIHx8IHZhbHVlID4gMTI3KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJleHByZXNzaW9uIGlzIG91dCBvZiByYW5nZSAoMC0xMjcpXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgY29tbWFuZDogXCJleHByZXNzaW9uXCIsIHZhbHVlOiB2YWx1ZSB9O1xyXG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzY2ID0gXCJCXCIsXG4gICAgICAgIHBlZyRjNjcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJCXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJCXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNjggPSBcIixcIixcbiAgICAgICAgcGVnJGM2OSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIixcIiwgZGVzY3JpcHRpb246IFwiXFxcIixcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM3MCA9IGZ1bmN0aW9uKG51bWJlciwgdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChudW1iZXIgPCAwIHx8IG51bWJlciA+IDExOSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yKFwiY29udHJvbCBudW1iZXIgaXMgb3V0IG9mIHJhbmdlICgwLTEyNylcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPCAwIHx8IHZhbHVlID4gMTI3KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJjb250cm9sIHZhbHVlIGlzIG91dCBvZiByYW5nZSAoMC0xMjcpXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgY29tbWFuZDogXCJjb250cm9sX2NoYW5nZVwiLCBudW1iZXI6IG51bWJlciwgdmFsdWU6IHZhbHVlIH07XHJcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjNzEgPSBcIkBcIixcbiAgICAgICAgcGVnJGM3MiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIkBcIiwgZGVzY3JpcHRpb246IFwiXFxcIkBcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM3MyA9IGZ1bmN0aW9uKG51bWJlcikge1xyXG4gICAgICAgICAgICAgICAgbnVtYmVyID0gK251bWJlcjtcclxuICAgICAgICAgICAgICAgIGlmIChudW1iZXIgPCAwIHx8IG51bWJlciA+IDEyNykge1xyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yKFwicHJvZ3JhbSBudW1iZXIgaXMgb3V0IG9mIHJhbmdlICgwLTEyNylcIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBjb21tYW5kOiBcInByb2dyYW1fY2hhbmdlXCIsIG51bWJlcjogbnVtYmVyIH07XHJcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjNzQgPSBcIkRcIixcbiAgICAgICAgcGVnJGM3NSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIkRcIiwgZGVzY3JpcHRpb246IFwiXFxcIkRcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM3NiA9IGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9ICt2YWx1ZTtcclxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA8IDAgfHwgdmFsdWUgPiAxMjcpIHtcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcihcImNoYW5uZWwgYWZ0ZXJ0b3VjaCBpcyBvdXQgb2YgcmFuZ2UgKDAtMTI3KVwiKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IGNvbW1hbmQ6IFwiY2hhbm5lbF9hZnRlcnRvdWNoXCIsIHZhbHVlOiB2YWx1ZSB9O1xyXG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzc3ID0gXCJ0XCIsXG4gICAgICAgIHBlZyRjNzggPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ0XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ0XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNzkgPSBmdW5jdGlvbih2YWx1ZSkgeyByZXR1cm4geyBjb21tYW5kOiBcInRlbXBvXCIsIHZhbHVlOiArdmFsdWUgfTsgfSxcbiAgICAgICAgcGVnJGM4MCA9IFwiP1wiLFxuICAgICAgICBwZWckYzgxID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiP1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiP1xcXCJcIiB9LFxuICAgICAgICBwZWckYzgyID0gZnVuY3Rpb24oKSB7IHJldHVybiB7IGNvbW1hbmQ6IFwic3RhcnRfcG9pbnRcIiB9OyB9LFxuICAgICAgICBwZWckYzgzID0gXCJrXCIsXG4gICAgICAgIHBlZyRjODQgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJrXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJrXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjODUgPSBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSArdmFsdWU7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPCAtMTI3IHx8IHZhbHVlID4gMTI3KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IoXCJrZXkgc2hpZnQgaXMgb3V0IG9mIHJhbmdlICgtMTI3LTEyNylcIik7XHJcbiAgICAgICAgICAgICAgICB9IFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgY29tbWFuZDogXCJrZXlfc2hpZnRcIiwgdmFsdWU6IHZhbHVlIH07XHJcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjODYgPSBcIkNcIixcbiAgICAgICAgcGVnJGM4NyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIkNcIiwgZGVzY3JpcHRpb246IFwiXFxcIkNcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM4OCA9IGZ1bmN0aW9uKGNoYW5uZWwpIHtcclxuICAgICAgICAgICAgICAgIGNoYW5uZWwgPSArY2hhbm5lbDtcclxuICAgICAgICAgICAgICAgIGlmIChjaGFubmVsIDwgMSB8fCBjaGFubmVsID4gMTYpIHtcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcihcIk1JREkgY2hhbm5lbCBpcyBvdXQgb2YgcmFuZ2UgKDEtMTYpXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgY29tbWFuZDogXCJzZXRfbWlkaV9jaGFubmVsXCIsIGNoYW5uZWw6IGNoYW5uZWwgfTtcclxuICAgICAgICAgICAgfSxcblxuICAgICAgICBwZWckY3VyclBvcyAgICAgICAgICA9IDAsXG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyAgICAgID0gMCxcbiAgICAgICAgcGVnJGNhY2hlZFBvcyAgICAgICAgPSAwLFxuICAgICAgICBwZWckY2FjaGVkUG9zRGV0YWlscyA9IHsgbGluZTogMSwgY29sdW1uOiAxLCBzZWVuQ1I6IGZhbHNlIH0sXG4gICAgICAgIHBlZyRtYXhGYWlsUG9zICAgICAgID0gMCxcbiAgICAgICAgcGVnJG1heEZhaWxFeHBlY3RlZCAgPSBbXSxcbiAgICAgICAgcGVnJHNpbGVudEZhaWxzICAgICAgPSAwLFxuXG4gICAgICAgIHBlZyRyZXN1bHQ7XG5cbiAgICBpZiAoXCJzdGFydFJ1bGVcIiBpbiBvcHRpb25zKSB7XG4gICAgICBpZiAoIShvcHRpb25zLnN0YXJ0UnVsZSBpbiBwZWckc3RhcnRSdWxlRnVuY3Rpb25zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBzdGFydCBwYXJzaW5nIGZyb20gcnVsZSBcXFwiXCIgKyBvcHRpb25zLnN0YXJ0UnVsZSArIFwiXFxcIi5cIik7XG4gICAgICB9XG5cbiAgICAgIHBlZyRzdGFydFJ1bGVGdW5jdGlvbiA9IHBlZyRzdGFydFJ1bGVGdW5jdGlvbnNbb3B0aW9ucy5zdGFydFJ1bGVdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRleHQoKSB7XG4gICAgICByZXR1cm4gaW5wdXQuc3Vic3RyaW5nKHBlZyRyZXBvcnRlZFBvcywgcGVnJGN1cnJQb3MpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9mZnNldCgpIHtcbiAgICAgIHJldHVybiBwZWckcmVwb3J0ZWRQb3M7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGluZSgpIHtcbiAgICAgIHJldHVybiBwZWckY29tcHV0ZVBvc0RldGFpbHMocGVnJHJlcG9ydGVkUG9zKS5saW5lO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbHVtbigpIHtcbiAgICAgIHJldHVybiBwZWckY29tcHV0ZVBvc0RldGFpbHMocGVnJHJlcG9ydGVkUG9zKS5jb2x1bW47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXhwZWN0ZWQoZGVzY3JpcHRpb24pIHtcbiAgICAgIHRocm93IHBlZyRidWlsZEV4Y2VwdGlvbihcbiAgICAgICAgbnVsbCxcbiAgICAgICAgW3sgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24gfV0sXG4gICAgICAgIHBlZyRyZXBvcnRlZFBvc1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlcnJvcihtZXNzYWdlKSB7XG4gICAgICB0aHJvdyBwZWckYnVpbGRFeGNlcHRpb24obWVzc2FnZSwgbnVsbCwgcGVnJHJlcG9ydGVkUG9zKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckY29tcHV0ZVBvc0RldGFpbHMocG9zKSB7XG4gICAgICBmdW5jdGlvbiBhZHZhbmNlKGRldGFpbHMsIHN0YXJ0UG9zLCBlbmRQb3MpIHtcbiAgICAgICAgdmFyIHAsIGNoO1xuXG4gICAgICAgIGZvciAocCA9IHN0YXJ0UG9zOyBwIDwgZW5kUG9zOyBwKyspIHtcbiAgICAgICAgICBjaCA9IGlucHV0LmNoYXJBdChwKTtcbiAgICAgICAgICBpZiAoY2ggPT09IFwiXFxuXCIpIHtcbiAgICAgICAgICAgIGlmICghZGV0YWlscy5zZWVuQ1IpIHsgZGV0YWlscy5saW5lKys7IH1cbiAgICAgICAgICAgIGRldGFpbHMuY29sdW1uID0gMTtcbiAgICAgICAgICAgIGRldGFpbHMuc2VlbkNSID0gZmFsc2U7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaCA9PT0gXCJcXHJcIiB8fCBjaCA9PT0gXCJcXHUyMDI4XCIgfHwgY2ggPT09IFwiXFx1MjAyOVwiKSB7XG4gICAgICAgICAgICBkZXRhaWxzLmxpbmUrKztcbiAgICAgICAgICAgIGRldGFpbHMuY29sdW1uID0gMTtcbiAgICAgICAgICAgIGRldGFpbHMuc2VlbkNSID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGV0YWlscy5jb2x1bW4rKztcbiAgICAgICAgICAgIGRldGFpbHMuc2VlbkNSID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChwZWckY2FjaGVkUG9zICE9PSBwb3MpIHtcbiAgICAgICAgaWYgKHBlZyRjYWNoZWRQb3MgPiBwb3MpIHtcbiAgICAgICAgICBwZWckY2FjaGVkUG9zID0gMDtcbiAgICAgICAgICBwZWckY2FjaGVkUG9zRGV0YWlscyA9IHsgbGluZTogMSwgY29sdW1uOiAxLCBzZWVuQ1I6IGZhbHNlIH07XG4gICAgICAgIH1cbiAgICAgICAgYWR2YW5jZShwZWckY2FjaGVkUG9zRGV0YWlscywgcGVnJGNhY2hlZFBvcywgcG9zKTtcbiAgICAgICAgcGVnJGNhY2hlZFBvcyA9IHBvcztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBlZyRjYWNoZWRQb3NEZXRhaWxzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRmYWlsKGV4cGVjdGVkKSB7XG4gICAgICBpZiAocGVnJGN1cnJQb3MgPCBwZWckbWF4RmFpbFBvcykgeyByZXR1cm47IH1cblxuICAgICAgaWYgKHBlZyRjdXJyUG9zID4gcGVnJG1heEZhaWxQb3MpIHtcbiAgICAgICAgcGVnJG1heEZhaWxQb3MgPSBwZWckY3VyclBvcztcbiAgICAgICAgcGVnJG1heEZhaWxFeHBlY3RlZCA9IFtdO1xuICAgICAgfVxuXG4gICAgICBwZWckbWF4RmFpbEV4cGVjdGVkLnB1c2goZXhwZWN0ZWQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRidWlsZEV4Y2VwdGlvbihtZXNzYWdlLCBleHBlY3RlZCwgcG9zKSB7XG4gICAgICBmdW5jdGlvbiBjbGVhbnVwRXhwZWN0ZWQoZXhwZWN0ZWQpIHtcbiAgICAgICAgdmFyIGkgPSAxO1xuXG4gICAgICAgIGV4cGVjdGVkLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgIGlmIChhLmRlc2NyaXB0aW9uIDwgYi5kZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYS5kZXNjcmlwdGlvbiA+IGIuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHdoaWxlIChpIDwgZXhwZWN0ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKGV4cGVjdGVkW2kgLSAxXSA9PT0gZXhwZWN0ZWRbaV0pIHtcbiAgICAgICAgICAgIGV4cGVjdGVkLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBidWlsZE1lc3NhZ2UoZXhwZWN0ZWQsIGZvdW5kKSB7XG4gICAgICAgIGZ1bmN0aW9uIHN0cmluZ0VzY2FwZShzKSB7XG4gICAgICAgICAgZnVuY3Rpb24gaGV4KGNoKSB7IHJldHVybiBjaC5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpOyB9XG5cbiAgICAgICAgICByZXR1cm4gc1xuICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFwvZywgICAnXFxcXFxcXFwnKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1wiL2csICAgICdcXFxcXCInKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xceDA4L2csICdcXFxcYicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx0L2csICAgJ1xcXFx0JylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXG4vZywgICAnXFxcXG4nKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcZi9nLCAgICdcXFxcZicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxyL2csICAgJ1xcXFxyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXFx4MDAtXFx4MDdcXHgwQlxceDBFXFx4MEZdL2csIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHgwJyArIGhleChjaCk7IH0pXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xceDEwLVxceDFGXFx4ODAtXFx4RkZdL2csICAgIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHgnICArIGhleChjaCk7IH0pXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xcdTAxODAtXFx1MEZGRl0vZywgICAgICAgICBmdW5jdGlvbihjaCkgeyByZXR1cm4gJ1xcXFx1MCcgKyBoZXgoY2gpOyB9KVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXHUxMDgwLVxcdUZGRkZdL2csICAgICAgICAgZnVuY3Rpb24oY2gpIHsgcmV0dXJuICdcXFxcdScgICsgaGV4KGNoKTsgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZXhwZWN0ZWREZXNjcyA9IG5ldyBBcnJheShleHBlY3RlZC5sZW5ndGgpLFxuICAgICAgICAgICAgZXhwZWN0ZWREZXNjLCBmb3VuZERlc2MsIGk7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGV4cGVjdGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZXhwZWN0ZWREZXNjc1tpXSA9IGV4cGVjdGVkW2ldLmRlc2NyaXB0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhwZWN0ZWREZXNjID0gZXhwZWN0ZWQubGVuZ3RoID4gMVxuICAgICAgICAgID8gZXhwZWN0ZWREZXNjcy5zbGljZSgwLCAtMSkuam9pbihcIiwgXCIpXG4gICAgICAgICAgICAgICsgXCIgb3IgXCJcbiAgICAgICAgICAgICAgKyBleHBlY3RlZERlc2NzW2V4cGVjdGVkLmxlbmd0aCAtIDFdXG4gICAgICAgICAgOiBleHBlY3RlZERlc2NzWzBdO1xuXG4gICAgICAgIGZvdW5kRGVzYyA9IGZvdW5kID8gXCJcXFwiXCIgKyBzdHJpbmdFc2NhcGUoZm91bmQpICsgXCJcXFwiXCIgOiBcImVuZCBvZiBpbnB1dFwiO1xuXG4gICAgICAgIHJldHVybiBcIkV4cGVjdGVkIFwiICsgZXhwZWN0ZWREZXNjICsgXCIgYnV0IFwiICsgZm91bmREZXNjICsgXCIgZm91bmQuXCI7XG4gICAgICB9XG5cbiAgICAgIHZhciBwb3NEZXRhaWxzID0gcGVnJGNvbXB1dGVQb3NEZXRhaWxzKHBvcyksXG4gICAgICAgICAgZm91bmQgICAgICA9IHBvcyA8IGlucHV0Lmxlbmd0aCA/IGlucHV0LmNoYXJBdChwb3MpIDogbnVsbDtcblxuICAgICAgaWYgKGV4cGVjdGVkICE9PSBudWxsKSB7XG4gICAgICAgIGNsZWFudXBFeHBlY3RlZChleHBlY3RlZCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgU3ludGF4RXJyb3IoXG4gICAgICAgIG1lc3NhZ2UgIT09IG51bGwgPyBtZXNzYWdlIDogYnVpbGRNZXNzYWdlKGV4cGVjdGVkLCBmb3VuZCksXG4gICAgICAgIGV4cGVjdGVkLFxuICAgICAgICBmb3VuZCxcbiAgICAgICAgcG9zLFxuICAgICAgICBwb3NEZXRhaWxzLmxpbmUsXG4gICAgICAgIHBvc0RldGFpbHMuY29sdW1uXG4gICAgICApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXN0YXJ0KCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBbXTtcbiAgICAgIHMxID0gcGVnJHBhcnNldHJhY2soKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICB3aGlsZSAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMC5wdXNoKHMxKTtcbiAgICAgICAgICBzMSA9IHBlZyRwYXJzZXRyYWNrKCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNldHJhY2soKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gW107XG4gICAgICBzMiA9IHBlZyRwYXJzZWNvbW1hbmQoKTtcbiAgICAgIHdoaWxlIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMS5wdXNoKHMyKTtcbiAgICAgICAgczIgPSBwZWckcGFyc2Vjb21tYW5kKCk7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VuZXh0X3RyYWNrKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMyKHMxKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlbmV4dF90cmFjaygpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNTkpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjMztcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzUoKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VfKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBbXTtcbiAgICAgIGlmIChwZWckYzYudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3KTsgfVxuICAgICAgfVxuICAgICAgd2hpbGUgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwLnB1c2goczEpO1xuICAgICAgICBpZiAocGVnJGM2LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICBzMSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzcpOyB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZWNvbW1hbmQoKSB7XG4gICAgICB2YXIgczA7XG5cbiAgICAgIHMwID0gcGVnJHBhcnNlY29tbWVudCgpO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlbm90ZSgpO1xuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRwYXJzZXRpZSgpO1xuICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczAgPSBwZWckcGFyc2VyZXN0KCk7XG4gICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2VvY3RhdmUoKTtcbiAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2VvY3RhdmVfdXAoKTtcbiAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlb2N0YXZlX2Rvd24oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZW5vdGVfbGVuZ3RoKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlZ2F0ZV90aW1lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZXZlbG9jaXR5KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2V2b2x1bWUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2VwYW4oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlZXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlY29udHJvbF9jaGFuZ2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2Vwcm9ncmFtX2NoYW5nZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2VjaGFubmVsX2FmdGVydG91Y2goKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZXRlbXBvKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlc3RhcnRfcG9pbnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNla2V5X3NoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckcGFyc2VzZXRfbWlkaV9jaGFubmVsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2Vjb21tZW50KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzgpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjODtcbiAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gW107XG4gICAgICAgICAgczUgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNiA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzExKSB7XG4gICAgICAgICAgICBzNyA9IHBlZyRjMTE7XG4gICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTIpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgICAgIGlmIChzNyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczYgPSBwZWckYzEwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHM2O1xuICAgICAgICAgICAgczYgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgICAgIHM3ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEzKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gW3M2LCBzN107XG4gICAgICAgICAgICAgIHM1ID0gczY7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgICB3aGlsZSAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0LnB1c2goczUpO1xuICAgICAgICAgICAgczUgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM2ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzExKSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJGMxMTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEyKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICAgICAgICBpZiAoczcgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckYzEwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNjtcbiAgICAgICAgICAgICAgczYgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgICAgICAgczcgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMyk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IFtzNiwgczddO1xuICAgICAgICAgICAgICAgIHM1ID0gczY7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBpbnB1dC5zdWJzdHJpbmcoczMsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzExKSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJGMxMTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEyKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMTQoKTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMxNSkge1xuICAgICAgICAgICAgczIgPSBwZWckYzE1O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE2KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gW107XG4gICAgICAgICAgICBpZiAocGVnJGMxNy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM0ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE4KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMzLnB1c2goczQpO1xuICAgICAgICAgICAgICBpZiAocGVnJGMxNy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgczQgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxOCk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMTQoKTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZW5vdGUoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3LCBzOCwgczk7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAocGVnJGMxOS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gW107XG4gICAgICAgICAgICBpZiAocGVnJGMyMS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIyKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0LnB1c2goczUpO1xuICAgICAgICAgICAgICBpZiAocGVnJGMyMS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgczUgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMik7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgIHM3ID0gW107XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgczggPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczggPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM3LnB1c2goczgpO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IGlucHV0LnN1YnN0cmluZyhzNiwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzNiA9IHM3O1xuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczggPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJGMyNTtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjYpOyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHM5ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczgucHVzaChzOSk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckYzI1O1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI2KTsgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzOSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoczkgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzI3KHMyLCBzNCwgczYsIHM4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2V0aWUoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5NCkge1xuICAgICAgICAgIHMyID0gcGVnJGMyODtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjkpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczUgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUucHVzaChzNik7XG4gICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5zdWJzdHJpbmcoczQsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gW107XG4gICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckYzI1O1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI2KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB3aGlsZSAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM2LnB1c2goczcpO1xuICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICAgICAgICBzNyA9IHBlZyRjMjU7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzNyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNik7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzMwKHM0LCBzNik7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXJlc3QoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjMzE7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzMyKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM1ID0gW107XG4gICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1LnB1c2goczYpO1xuICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuc3Vic3RyaW5nKHM0LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IFtdO1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDYpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJGMyNTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNik7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgd2hpbGUgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNi5wdXNoKHM3KTtcbiAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDYpIHtcbiAgICAgICAgICAgICAgICAgICAgczcgPSBwZWckYzI1O1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgczcgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjYpOyB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGMzMyhzNCwgczYpO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VvY3RhdmUoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3LCBzODtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTExKSB7XG4gICAgICAgICAgczIgPSBwZWckYzM0O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzNSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0NSkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRjMzc7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzOCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRjMzY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczcgPSBbXTtcbiAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgIHM4ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNy5wdXNoKHM4KTtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgczggPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgczggPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gW3M2LCBzN107XG4gICAgICAgICAgICAgICAgczUgPSBzNjtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzM5KHM0KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlb2N0YXZlX3VwKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2MCkge1xuICAgICAgICAgIHMyID0gcGVnJGM0MDtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDEpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM0MigpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZW9jdGF2ZV9kb3duKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2Mikge1xuICAgICAgICAgIHMyID0gcGVnJGM0MztcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDQpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM0NSgpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZW5vdGVfbGVuZ3RoKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTA4KSB7XG4gICAgICAgICAgczIgPSBwZWckYzQ2O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0Nyk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICB3aGlsZSAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNS5wdXNoKHM2KTtcbiAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczYgPSBbXTtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ2KSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRjMjU7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjYpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHdoaWxlIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczYucHVzaChzNyk7XG4gICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ2KSB7XG4gICAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJGMyNTtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI2KTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNDgoczQsIHM2KTtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlZ2F0ZV90aW1lKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDExMykge1xuICAgICAgICAgIHMyID0gcGVnJGM0OTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAocGVnJGM1MS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM0ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzUyKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNTMoczQpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2V2ZWxvY2l0eSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTE3KSB7XG4gICAgICAgICAgczIgPSBwZWckYzU0O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1NSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICB3aGlsZSAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNS5wdXNoKHM2KTtcbiAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzU2KHM0KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNldm9sdW1lKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTgpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNTc7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzU4KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM1ID0gW107XG4gICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM1LnB1c2goczYpO1xuICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuc3Vic3RyaW5nKHM0LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNTkoczQpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VwYW4oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3LCBzODtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTEyKSB7XG4gICAgICAgICAgczIgPSBwZWckYzYwO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2MSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0NSkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRjMzc7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzOCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRjMzY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczcgPSBbXTtcbiAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgIHM4ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgd2hpbGUgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNy5wdXNoKHM4KTtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgczggPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgczggPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gW3M2LCBzN107XG4gICAgICAgICAgICAgICAgczUgPSBzNjtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzYyKHM0KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlZXhwcmVzc2lvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjkpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNjM7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzY0KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM1ID0gW107XG4gICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM1LnB1c2goczYpO1xuICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuc3Vic3RyaW5nKHM0LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjUoczQpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2Vjb250cm9sX2NoYW5nZSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczcsIHM4LCBzOSwgczEwO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2Nikge1xuICAgICAgICAgIHMyID0gcGVnJGM2NjtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNjcpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczUgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgd2hpbGUgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczUucHVzaChzNik7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5zdWJzdHJpbmcoczQsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDQpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJGM2ODtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2OSk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgICAgICBzOSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczEwID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHMxMCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChzMTAgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoczEwICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzOS5wdXNoKHMxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMxMCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMTAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChzOSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHM5ID0gaW5wdXQuc3Vic3RyaW5nKHM4LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgczggPSBzOTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHM5ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM3MChzNCwgczgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXByb2dyYW1fY2hhbmdlKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2NCkge1xuICAgICAgICAgIHMyID0gcGVnJGM3MTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzIpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczUgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgd2hpbGUgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczUucHVzaChzNik7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgICAgczYgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5zdWJzdHJpbmcoczQsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM3MyhzNCk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZWNoYW5uZWxfYWZ0ZXJ0b3VjaCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjgpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNzQ7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzc1KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM1ID0gW107XG4gICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHdoaWxlIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM1LnB1c2goczYpO1xuICAgICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuc3Vic3RyaW5nKHM0LCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNzYoczQpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2V0ZW1wbygpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTE2KSB7XG4gICAgICAgICAgczIgPSBwZWckYzc3O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3OCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICB3aGlsZSAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNS5wdXNoKHM2KTtcbiAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzc5KHM0KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlc3RhcnRfcG9pbnQoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYzKSB7XG4gICAgICAgICAgczIgPSBwZWckYzgwO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4MSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzgyKCk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNla2V5X3NoaWZ0KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNywgczg7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEwNykge1xuICAgICAgICAgIHMyID0gcGVnJGM4MztcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODQpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczUgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDUpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckYzM3O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzgpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczYgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckYzM2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gW107XG4gICAgICAgICAgICAgIGlmIChwZWckYzIzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICBzOCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHdoaWxlIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcucHVzaChzOCk7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IFtzNiwgczddO1xuICAgICAgICAgICAgICAgIHM1ID0gczY7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5zdWJzdHJpbmcoczQsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM4NShzNCk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXNldF9taWRpX2NoYW5uZWwoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczY7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDY3KSB7XG4gICAgICAgICAgczIgPSBwZWckYzg2O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4Nyk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlZyRjMjMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICB3aGlsZSAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNS5wdXNoKHM2KTtcbiAgICAgICAgICAgICAgICBpZiAocGVnJGMyMy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LnN1YnN0cmluZyhzNCwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzg4KHM0KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgcGVnJHJlc3VsdCA9IHBlZyRzdGFydFJ1bGVGdW5jdGlvbigpO1xuXG4gICAgaWYgKHBlZyRyZXN1bHQgIT09IHBlZyRGQUlMRUQgJiYgcGVnJGN1cnJQb3MgPT09IGlucHV0Lmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHBlZyRyZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChwZWckcmVzdWx0ICE9PSBwZWckRkFJTEVEICYmIHBlZyRjdXJyUG9zIDwgaW5wdXQubGVuZ3RoKSB7XG4gICAgICAgIHBlZyRmYWlsKHsgdHlwZTogXCJlbmRcIiwgZGVzY3JpcHRpb246IFwiZW5kIG9mIGlucHV0XCIgfSk7XG4gICAgICB9XG5cbiAgICAgIHRocm93IHBlZyRidWlsZEV4Y2VwdGlvbihudWxsLCBwZWckbWF4RmFpbEV4cGVjdGVkLCBwZWckbWF4RmFpbFBvcyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBTeW50YXhFcnJvcjogU3ludGF4RXJyb3IsXG4gICAgcGFyc2U6ICAgICAgIHBhcnNlXG4gIH07XG59KSgpO1xuIiwiaW1wb3J0IERlYnVnIGZyb20gXCIuL2ZyYW1lc3ludGhlc2lzL0RlYnVnXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBdWRpb01hbmFnZXIge1xyXG4gICAgY29uc3RydWN0b3Ioc3ludGhlc2l6ZXIsIGJ1ZmZlclNpemUgPSAxMDI0KSB7XHJcbiAgICAgICAgdGhpcy5zeW50aGVzaXplciA9IHN5bnRoZXNpemVyO1xyXG4gICAgICAgIHRoaXMuYnVmZmVyU2l6ZSA9IGJ1ZmZlclNpemU7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8gd2Via2l0QXVkaW9Db250ZXh0IGlzIGZvciBpT1MgOFxyXG4gICAgICAgICAgICB0aGlzLmNvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0ID8gbmV3IEF1ZGlvQ29udGV4dCgpIDogbmV3IHdlYmtpdEF1ZGlvQ29udGV4dCgpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgRGVidWcubG9nKFwiZXJyb3I6IFRoaXMgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IFdlYiBBdWRpbyBBUEkuXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuYnVmZmVyTCA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5idWZmZXJTaXplKTtcclxuICAgICAgICB0aGlzLmJ1ZmZlclIgPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuYnVmZmVyU2l6ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5zY3JpcHRQcm9jZXNzb3IgPSB0aGlzLmNvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKHRoaXMuYnVmZmVyU2l6ZSwgMCwgMik7XHJcbiAgICAgICAgdGhpcy5zY3JpcHRQcm9jZXNzb3Iub25hdWRpb3Byb2Nlc3MgPSBlID0+IHRoaXMucHJvY2VzcyhlKTtcclxuICAgICAgICB0aGlzLnNjcmlwdFByb2Nlc3Nvci5jb25uZWN0KHRoaXMuY29udGV4dC5kZXN0aW5hdGlvbik7XHJcblxyXG4gICAgICAgIC8vIFByZXZlbnQgR0NcclxuICAgICAgICAvLyByZWYuIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMjQzMzgxNDQvY2hyb21lLW9uYXVkaW9wcm9jZXNzLXN0b3BzLWdldHRpbmctY2FsbGVkLWFmdGVyLWEtd2hpbGVcclxuICAgICAgICB3aW5kb3cuc2F2ZWRSZWZlcmVuY2UgPSB0aGlzLnNjcmlwdFByb2Nlc3NvcjtcclxuICAgICAgICBcclxuICAgICAgICBEZWJ1Zy5sb2coXCIgIFNhbXBsaW5nIHJhdGUgOiBcIiArIHRoaXMuY29udGV4dC5zYW1wbGVSYXRlICsgXCIgSHpcIik7XHJcbiAgICAgICAgRGVidWcubG9nKFwiICBCdWZmZXIgc2l6ZSAgIDogXCIgKyB0aGlzLnNjcmlwdFByb2Nlc3Nvci5idWZmZXJTaXplICsgXCIgc2FtcGxlc1wiKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcHJvY2VzcyhlKSB7XHJcbiAgICAgICAgbGV0IG91dEwgPSBlLm91dHB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcclxuICAgICAgICBsZXQgb3V0UiA9IGUub3V0cHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDEpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuc3ludGhlc2l6ZXIucmVuZGVyKHRoaXMuYnVmZmVyTCwgdGhpcy5idWZmZXJSLCB0aGlzLmNvbnRleHQuc2FtcGxlUmF0ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmJ1ZmZlclNpemU7IGkrKykge1xyXG4gICAgICAgICAgICBvdXRMW2ldID0gdGhpcy5idWZmZXJMW2ldO1xyXG4gICAgICAgICAgICBvdXRSW2ldID0gdGhpcy5idWZmZXJSW2ldO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuIiwiaW1wb3J0IE15TWF0aCBmcm9tIFwiLi9mcmFtZXN5bnRoZXNpcy9NeU1hdGhcIjtcclxuaW1wb3J0IFZvaWNlIGZyb20gXCIuL1ZvaWNlXCI7XHJcblxyXG5jb25zdCBWT0lDRV9NQVggPSAzMjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENoYW5uZWwge1xyXG4gICAgcmVzZXQoKSB7XHJcbiAgICAgICAgdGhpcy52b2ljZXMgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IFZPSUNFX01BWDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMudm9pY2VzW2ldID0gbmV3IFZvaWNlKHRoaXMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5rZXlTdGF0ZSA9IFtdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEdlbmVyYWwgTUlESSBkZWZhdWx0XHJcbiAgICAgICAgdGhpcy52b2x1bWUgPSAxMDA7XHJcbiAgICAgICAgdGhpcy5wYW4gPSA2NDtcclxuICAgICAgICB0aGlzLmV4cHJlc3Npb24gPSAxMjc7XHJcblxyXG4gICAgICAgIHRoaXMuZGFtcGVyUGVkYWwgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgdGhpcy5waXRjaEJlbmQgPSAwO1xyXG4gICAgICAgIHRoaXMubW9kdWxhdGlvbldoZWVsID0gMDtcclxuICAgICAgICBcclxuICAgICAgICAvLyBwcmVhbGxvY2F0ZSBjaGFubmVsIGJ1ZmZlciB3aXRoIG1hcmdpblxyXG4gICAgICAgIHRoaXMuY2hhbm5lbEJ1ZmZlciA9IG5ldyBGbG9hdDMyQXJyYXkoNDA5Nik7XHJcbiAgICB9XHJcblxyXG4gICAgbm90ZU9uKG5vdGUsIHZlbG9jaXR5KSB7XHJcbiAgICAgICAgdGhpcy5rZXlTdGF0ZVtub3RlXSA9IHRydWU7XHJcblxyXG4gICAgICAgIC8vIHN0b3Agc2FtZSBub3Rlc1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgVk9JQ0VfTUFYOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMudm9pY2VzW2ldLmlzUGxheWluZygpICYmIHRoaXMudm9pY2VzW2ldLm5vdGUgPT09IG5vdGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudm9pY2VzW2ldLnN0b3AoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gcGxheSBub3RlXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBWT0lDRV9NQVg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMudm9pY2VzW2ldLmlzUGxheWluZygpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZvaWNlc1tpXS5wbGF5KG5vdGUsIHZlbG9jaXR5KTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIG5vdGVPZmYobm90ZSwgdmVsb2NpdHkpIHtcclxuICAgICAgICB0aGlzLmtleVN0YXRlW25vdGVdID0gZmFsc2U7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmRhbXBlclBlZGFsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIHN0b3Agbm90ZXNcdFx0XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBWT0lDRV9NQVg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy52b2ljZXNbaV0uaXNQbGF5aW5nKCkgJiYgdGhpcy52b2ljZXNbaV0ubm90ZSA9PT0gbm90ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy52b2ljZXNbaV0uc3RvcCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFsbE5vdGVzT2ZmKCkge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgVk9JQ0VfTUFYOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMudm9pY2VzW2ldLmlzUGxheWluZygpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZvaWNlc1tpXS5zdG9wKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZGFtcGVyUGVkYWxPbigpIHtcclxuICAgICAgICB0aGlzLmRhbXBlclBlZGFsID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBkYW1wZXJQZWRhbE9mZigpIHtcclxuICAgICAgICB0aGlzLmRhbXBlclBlZGFsID0gZmFsc2U7XHJcblxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgVk9JQ0VfTUFYOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMua2V5U3RhdGVbdGhpcy52b2ljZXNbaV0ubm90ZV0gPT09IGZhbHNlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZvaWNlc1tpXS5zdG9wKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByb2dyYW1DaGFuZ2UocHJvZ3JhbU51bWJlcikge1xyXG4gICAgfVxyXG5cclxuICAgIHNldFBpdGNoQmVuZChiZW5kKSB7XHJcbiAgICAgICAgdGhpcy5waXRjaEJlbmQgPSBiZW5kICogMiAvIDgxOTI7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0TW9kdWxhdGlvbldoZWVsKHdoZWVsKSB7XHJcbiAgICAgICAgdGhpcy5tb2R1bGF0aW9uV2hlZWwgPSB3aGVlbCAvIDEyNztcclxuICAgIH1cclxuICAgIFxyXG4gICAgc2V0Vm9sdW1lKHZvbHVtZSkge1xyXG4gICAgICAgIHRoaXMudm9sdW1lID0gdm9sdW1lO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBzZXRQYW4ocGFuKSB7XHJcbiAgICAgICAgdGhpcy5wYW4gPSBwYW47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHNldEV4cHJlc3Npb24oZXhwcmVzc2lvbikge1xyXG4gICAgICAgIHRoaXMuZXhwcmVzc2lvbiA9IGV4cHJlc3Npb247XHJcbiAgICB9XHJcblxyXG4gICAgcmVuZGVyKGJ1ZmZlckwsIGJ1ZmZlclIsIHNhbXBsZVJhdGUpIHtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlckwubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy5jaGFubmVsQnVmZmVyW2ldID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBWT0lDRV9NQVg7IGkrKykge1xyXG4gICAgICAgICAgICB0aGlzLnZvaWNlc1tpXS5yZW5kZXIodGhpcy5jaGFubmVsQnVmZmVyLCBidWZmZXJMLmxlbmd0aCwgc2FtcGxlUmF0ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCBnYWluID0gKHRoaXMudm9sdW1lIC8gMTI3KSAqICh0aGlzLmV4cHJlc3Npb24gLyAxMjcpO1xyXG4gICAgICAgIGxldCBnYWluTCA9IGdhaW4gKiBNeU1hdGguY2xhbXBlZExpbmVhck1hcCh0aGlzLnBhbiwgNjQsIDEyNywgMSwgMCk7XHJcbiAgICAgICAgbGV0IGdhaW5SID0gZ2FpbiAqIE15TWF0aC5jbGFtcGVkTGluZWFyTWFwKHRoaXMucGFuLCAwLCA2NCwgMCwgMSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWZmZXJMLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGJ1ZmZlckxbaV0gKz0gdGhpcy5jaGFubmVsQnVmZmVyW2ldICogZ2Fpbkw7XHJcbiAgICAgICAgICAgIGJ1ZmZlclJbaV0gKz0gdGhpcy5jaGFubmVsQnVmZmVyW2ldICogZ2FpblI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsImNvbnN0IFRFTVBPX0RFRkFVTFQgPSAxMjA7XHJcbmNvbnN0IElOVEVSVkFMID0gMSAvIDEwMDtcclxuXHJcbmNsYXNzIFRyYWNrIHtcclxuICAgIGNvbnN0cnVjdG9yKHBsYXllciwgcG9zLCBsZW5ndGgpIHtcclxuICAgICAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnBvcyA9IHBvcztcclxuICAgICAgICB0aGlzLmVuZFBvcyA9IHBvcyArIGxlbmd0aDtcclxuICAgICAgICB0aGlzLmZpbmlzaGVkID0gZmFsc2U7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5uZXh0RXZlbnRUaWNrID0gdGhpcy5yZWFkRGVsdGFUaWNrKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHVwZGF0ZShjdXJyZW50VGljaywgc2Vla2luZykge1xyXG4gICAgICAgIGlmICh0aGlzLmZpbmlzaGVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgd2hpbGUgKHRoaXMubmV4dEV2ZW50VGljayA8IGN1cnJlbnRUaWNrKSB7XHJcbiAgICAgICAgICAgIC8vIHNlbmQgTUlESSBtZXNzYWdlXHJcbiAgICAgICAgICAgIGxldCBzdGF0dXNCeXRlID0gdGhpcy5yZWFkQnl0ZSgpO1xyXG4gICAgICAgICAgICBsZXQgc3RhdHVzVXBwZXI0Yml0cyA9IHN0YXR1c0J5dGUgPj4gNDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIG1ldGEgZXZlbnRcclxuICAgICAgICAgICAgaWYgKHN0YXR1c0J5dGUgPT09IDB4ZmYpIHtcclxuICAgICAgICAgICAgICAgIGxldCBtZXRhRXZlbnRUeXBlID0gdGhpcy5yZWFkQnl0ZSgpO1xyXG4gICAgICAgICAgICAgICAgbGV0IGxlbmd0aCA9IHRoaXMucmVhZEJ5dGUoKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAobWV0YUV2ZW50VHlwZSA9PT0gMHg1MSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChsZW5ndGggPT09IDMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHF1YXJ0ZXJNaWNyb3NlY29uZHMgPSB0aGlzLnJlYWRCeXRlKCkgPDwgMTYgfCB0aGlzLnJlYWRCeXRlKCkgPDwgOCB8IHRoaXMucmVhZEJ5dGUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5ZXIucXVhcnRlclRpbWUgPSBxdWFydGVyTWljcm9zZWNvbmRzIC8gMTAwMDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucG9zICs9IGxlbmd0aDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gc3lzdGVtIGV4Y2x1c2l2ZSBtZXNzYWdlXHJcbiAgICAgICAgICAgIGlmIChzdGF0dXNCeXRlID09PSAweGYwKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgc3lzdGVtRXhjbHVzaXZlID0gW3N0YXR1c0J5dGVdO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB3aGlsZSAodHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBvcyA+PSB0aGlzLmVuZFBvcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBFcnJvcihcImlsbGVnYWwgc3lzdGVtIGV4bHVzaXZlIG1lc3NhZ2VcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGxldCBieXRlID0gdGhpcy5yZWFkQnl0ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChieXRlID09PSAweGY3KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBzeXN0ZW1FeGNsdXNpdmUucHVzaChieXRlKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRoaXMucGxheWVyLnN5bnRoZXNpemVyLnByb2Nlc3NNSURJTWVzc2FnZShzeXN0ZW1FeGNsdXNpdmUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBza2lwIHVuc3VwcG9ydGVkIDIgYnl0ZXMgbWVzc2FnZXNcclxuICAgICAgICAgICAgaWYgKHN0YXR1c0J5dGUgPT09IDB4ZjEgfHwgc3RhdHVzQnl0ZSA9PT0gMHhmMiB8fCBzdGF0dXNCeXRlID09PSAweGYzKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWRCeXRlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAoc3RhdHVzVXBwZXI0Yml0cykge1xyXG4gICAgICAgICAgICAgICAgLy8gMyBieXRlcyBtZXNzYWdlXHJcbiAgICAgICAgICAgICAgICBjYXNlIDB4ODpcclxuICAgICAgICAgICAgICAgIGNhc2UgMHg5OlxyXG4gICAgICAgICAgICAgICAgY2FzZSAweGE6XHJcbiAgICAgICAgICAgICAgICBjYXNlIDB4YjpcclxuICAgICAgICAgICAgICAgIGNhc2UgMHhlOlxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGFCeXRlMSA9IHRoaXMucmVhZEJ5dGUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGRhdGFCeXRlMiA9IHRoaXMucmVhZEJ5dGUoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWVraW5nICYmIChzdGF0dXNVcHBlcjRiaXRzID09PSAweDggfHwgc3RhdHVzVXBwZXI0Yml0cyA9PT0gMHg5KSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCBub3RlIG9uL29mZiB3aGVuIHNlZWtpbmdcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxheWVyLnN5bnRoZXNpemVyLnByb2Nlc3NNSURJTWVzc2FnZShbc3RhdHVzQnl0ZSwgZGF0YUJ5dGUxLCBkYXRhQnl0ZTJdKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAvLyAyIGJ5dGVzIG1lc3NhZ2VcclxuICAgICAgICAgICAgICAgIGNhc2UgMHhjOlxyXG4gICAgICAgICAgICAgICAgY2FzZSAweGQ6XHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZGF0YUJ5dGUxID0gdGhpcy5yZWFkQnl0ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsYXllci5zeW50aGVzaXplci5wcm9jZXNzTUlESU1lc3NhZ2UoW3N0YXR1c0J5dGUsIGRhdGFCeXRlMV0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnBvcyA+PSB0aGlzLmVuZFBvcykge1xyXG4gICAgICAgICAgICAgICAgLy8gZW5kIG9mIHRyYWNrIGRhdGFcclxuICAgICAgICAgICAgICAgIHRoaXMuZmluaXNoZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBuZXh0IGV2ZW50IHRpY2tcclxuICAgICAgICAgICAgdGhpcy5uZXh0RXZlbnRUaWNrICs9IHRoaXMucmVhZERlbHRhVGljaygpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgcmVhZEJ5dGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucGxheWVyLnNtZlt0aGlzLnBvcysrXTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmVhZERlbHRhVGljaygpIHtcclxuICAgICAgICBsZXQgdGljayA9IDA7XHJcbiAgICAgICAgbGV0IG47XHJcbiAgICAgICAgXHJcbiAgICAgICAgZG8ge1xyXG4gICAgICAgICAgICBuID0gdGhpcy5yZWFkQnl0ZSgpO1xyXG4gICAgICAgICAgICB0aWNrIDw8PSA3O1xyXG4gICAgICAgICAgICB0aWNrIHw9IChuICYgMHg3Zik7XHJcbiAgICAgICAgfSB3aGlsZSAobiAmIDB4ODApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0aWNrID4gMHhmZmZmZmZmKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgZGVsdGEgdGlja1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRpY2s7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFNNRlBsYXllciB7XHJcbiAgICBjb25zdHJ1Y3RvcihzeW50aGVzaXplcikge1xyXG4gICAgICAgIHRoaXMuc3ludGhlc2l6ZXIgPSBzeW50aGVzaXplcjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcGxheShzbWYsIHN0YXJ0VGljayA9IDApIHtcclxuICAgICAgICB0aGlzLnNtZiA9IHNtZjtcclxuICAgICAgICB0aGlzLnN0YXJ0VGljayA9IHN0YXJ0VGljaztcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnF1YXJ0ZXJUaW1lID0gNjAgKiAxMDAwIC8gVEVNUE9fREVGQVVMVDsgLy8gbXNcclxuICAgICAgICBcclxuICAgICAgICAvLyByZWFkIFNNRiBoZWFkZXJcclxuICAgICAgICBsZXQgcG9zID0gODtcclxuICAgICAgICBcclxuICAgICAgICBmdW5jdGlvbiByZWFkMmJ5dGVzKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gc21mW3BvcysrXSA8PCA4IHwgc21mW3BvcysrXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZnVuY3Rpb24gcmVhZDRieXRlcygpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHNtZltwb3MrK10gPDwgMjQgfCBzbWZbcG9zKytdIDw8IDE2IHwgc21mW3BvcysrXSA8PCA4IHwgc21mW3BvcysrXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IGZvcm1hdCA9IHJlYWQyYnl0ZXMoKTtcclxuICAgICAgICB0aGlzLnRyYWNrTnVtYmVyID0gcmVhZDJieXRlcygpO1xyXG4gICAgICAgIHRoaXMudGltZWJhc2UgPSByZWFkMmJ5dGVzKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZXJyb3IgY2hlY2tcclxuICAgICAgICBjb25zdCBTTUZfSEVBREVSID0gWzB4NGQsIDB4NTQsIDB4NjgsIDB4NjQsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDZdO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgU01GX0hFQURFUi5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5zbWZbaV0gIT0gU01GX0hFQURFUltpXSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibm90IGEgc3RhbmRhcmQgTUlESSBmaWxlXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChmb3JtYXQgIT09IDAgJiYgZm9ybWF0ICE9PSAxKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIndyb25nIFNNRiBmb3JtYXRcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChmb3JtYXQgPT09IDAgJiYgdGhpcy50cmFja051bWJlciAhPT0gMSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbGxlZ2FsIHRyYWNrIG51bWJlclwiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy50cmFja3MgPSBbXTtcclxuICAgICAgICBcclxuICAgICAgICAvLyByZWFkIHRyYWNrIGhlYWRlcnNcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudHJhY2tOdW1iZXI7IGkrKykge1xyXG4gICAgICAgICAgICBwb3MgKz0gNDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGxldCBsZW5ndGggPSByZWFkNGJ5dGVzKCk7XHJcbiAgICAgICAgICAgIHRoaXMudHJhY2tzLnB1c2gobmV3IFRyYWNrKHRoaXMsIHBvcywgbGVuZ3RoKSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBwb3MgKz0gbGVuZ3RoO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBzZXQgdXAgdGltZXJcclxuICAgICAgICB0aGlzLnByZXZUaW1lID0gRGF0ZS5ub3coKTtcclxuICAgICAgICB0aGlzLmN1cnJlbnRUaWNrID0gMDtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIXRoaXMuaW50ZXJ2YWxJZCkge1xyXG4gICAgICAgICAgICB0aGlzLmludGVydmFsSWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLm9uSW50ZXJ2YWwoKSwgSU5URVJWQUwpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgc3RvcCgpIHtcclxuICAgICAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWxJZCk7XHJcbiAgICAgICAgdGhpcy5pbnRlcnZhbElkID0gbnVsbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgb25JbnRlcnZhbCgpIHtcclxuICAgICAgICAvLyBjYWxjbGF0ZSBkZWx0YSB0aW1lXHJcbiAgICAgICAgbGV0IGN1cnJlbnRUaW1lID0gRGF0ZS5ub3coKTtcclxuICAgICAgICBsZXQgZGVsdGFUaW1lID0gY3VycmVudFRpbWUgLSB0aGlzLnByZXZUaW1lO1xyXG4gICAgICAgIHRoaXMucHJldlRpbWUgPSBjdXJyZW50VGltZTsgXHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IHRpY2tUaW1lID0gdGhpcy5xdWFydGVyVGltZSAvIHRoaXMudGltZWJhc2U7XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IHNlZWtpbmcgPSBmYWxzZTtcclxuICAgICAgICBpZiAodGhpcy5jdXJyZW50VGljayA8IHRoaXMuc3RhcnRUaWNrKSB7XHJcbiAgICAgICAgICAgIC8vIHNlZWsgdG8gc3RhcnQgdGljayBzbG93bHlcclxuICAgICAgICAgICAgLy8gdGhpcy5jdXJyZW50VGljayArPSBkZWx0YVRpbWUgKiAxMDAgLyB0aWNrVGltZTtcclxuICAgICAgICAgICAgLy8gaWYgKHRoaXMuY3VycmVudFRpY2sgPiB0aGlzLnN0YXJ0VGljaykge1xyXG4gICAgICAgICAgICAvLyBcdHRoaXMuY3VycmVudFRpY2sgPSB0aGlzLnN0YXJ0VGljaztcclxuICAgICAgICAgICAgLy8gfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5jdXJyZW50VGljayA9IHRoaXMuc3RhcnRUaWNrO1xyXG4gICAgICAgICAgICBzZWVraW5nID0gdHJ1ZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRUaWNrICs9IGRlbHRhVGltZSAvIHRpY2tUaW1lO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudHJhY2tzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMudHJhY2tzW2ldLnVwZGF0ZSh0aGlzLmN1cnJlbnRUaWNrLCBzZWVraW5nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gc3RvcCB3aGVuIGFsbCB0cmFja3MgZmluaXNoXHJcbiAgICAgICAgbGV0IHBsYXlpbmdUcmFjayA9IDA7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnRyYWNrcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAodGhpcy50cmFja3NbaV0uZmluaXNoZWQgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgICAgICAgICBwbGF5aW5nVHJhY2srKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocGxheWluZ1RyYWNrID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgRGVidWcgZnJvbSBcIi4vZnJhbWVzeW50aGVzaXMvRGVidWdcIjtcclxuaW1wb3J0IFBsYXRmb3JtIGZyb20gXCIuL2ZyYW1lc3ludGhlc2lzL1BsYXRmb3JtXCI7XHJcbmltcG9ydCBBdWRpb01hbmFnZXIgZnJvbSBcIi4vQXVkaW9NYW5hZ2VyXCI7XHJcbmltcG9ydCBDaGFubmVsIGZyb20gXCIuL0NoYW5uZWxcIjtcclxuXHJcbmNvbnN0IENIQU5ORUxfTUFYID0gMTY7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTeW50aGVzaXplciB7XHJcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmNoYW5uZWxzID0gW107XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBDSEFOTkVMX01BWDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbaV0gPSBuZXcgQ2hhbm5lbCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnJlc2V0KCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5hdWRpb01hbmFnZXIgPSBudWxsO1xyXG4gICAgICAgIGlmICghUGxhdGZvcm0uaXNpT1MoKSkge1xyXG4gICAgICAgICAgICB0aGlzLmNyZWF0ZUF1ZGlvTWFuYWdlcigpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgY3JlYXRlQXVkaW9NYW5hZ2VyKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5hdWRpb01hbmFnZXIpIHtcclxuICAgICAgICAgICAgRGVidWcubG9nKFwiSW5pdGlhbGl6aW5nIFdlYiBBdWRpb1wiKTtcclxuICAgICAgICAgICAgdGhpcy5hdWRpb01hbmFnZXIgPSBuZXcgQXVkaW9NYW5hZ2VyKHRoaXMpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXNldCgpIHtcclxuICAgICAgICBEZWJ1Zy5sb2coXCJJbml0aWFsaXppbmcgU3ludGhlc2l6ZXJcIik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBDSEFOTkVMX01BWDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbaV0ucmVzZXQoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJlbmRlcihidWZmZXJMLCBidWZmZXJSLCBzYW1wbGVSYXRlKSB7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBidWZmZXJMLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGJ1ZmZlckxbaV0gPSAwO1xyXG4gICAgICAgICAgICBidWZmZXJSW2ldID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBDSEFOTkVMX01BWDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbaV0ucmVuZGVyKGJ1ZmZlckwsIGJ1ZmZlclIsIHNhbXBsZVJhdGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgcHJvY2Vzc01JRElNZXNzYWdlKGRhdGEpIHtcclxuICAgICAgICBpZiAoIWRhdGEpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBhdm9pZCBpT1MgYXVkaW8gcmVzdHJpY3Rpb25cclxuICAgICAgICB0aGlzLmNyZWF0ZUF1ZGlvTWFuYWdlcigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCBzdGF0dXNCeXRlID0gZGF0YVswXTtcclxuICAgICAgICBpZiAoIXN0YXR1c0J5dGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBsZXQgc3RhdHVzVXBwZXI0Yml0cyA9IHN0YXR1c0J5dGUgPj4gNDtcclxuICAgICAgICBsZXQgY2hhbm5lbCA9IHN0YXR1c0J5dGUgJiAweGY7XHJcbiAgICAgICAgbGV0IG1pZGlDaGFubmVsID0gY2hhbm5lbCArIDE7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHN0YXR1c1VwcGVyNGJpdHMgPT09IDB4OSkge1xyXG4gICAgICAgICAgICBsZXQgbm90ZSA9IGRhdGFbMV07XHJcbiAgICAgICAgICAgIGxldCB2ZWxvY2l0eSA9IGRhdGFbMl07XHJcblxyXG4gICAgICAgICAgICB0aGlzLmxvZyhgQ2guICR7bWlkaUNoYW5uZWx9IE5vdGUgT24gIG5vdGU6ICR7bm90ZX0gdmVsb2NpdHk6ICR7dmVsb2NpdHl9YCk7XHJcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbY2hhbm5lbF0ubm90ZU9uKG5vdGUsIHZlbG9jaXR5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHN0YXR1c1VwcGVyNGJpdHMgPT09IDB4OCkge1xyXG4gICAgICAgICAgICBsZXQgbm90ZSA9IGRhdGFbMV07XHJcbiAgICAgICAgICAgIGxldCB2ZWxvY2l0eSA9IGRhdGFbMl07XHJcblxyXG4gICAgICAgICAgICB0aGlzLmxvZyhgQ2guICR7bWlkaUNoYW5uZWx9IE5vdGUgT2ZmIG5vdGU6ICR7bm90ZX0gdmVsb2NpdHk6ICR7dmVsb2NpdHl9YCk7XHJcbiAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbY2hhbm5lbF0ubm90ZU9mZihub3RlLCB2ZWxvY2l0eSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChzdGF0dXNVcHBlcjRiaXRzID09PSAweGMpIHtcclxuICAgICAgICAgICAgbGV0IHByb2dyYW1OdW1iZXIgPSBkYXRhWzFdO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5sb2coYENoLiAke21pZGlDaGFubmVsfSBQcm9ncmFtIENoYW5nZTogJHtwcm9ncmFtTnVtYmVyfWApO1xyXG4gICAgICAgICAgICB0aGlzLmNoYW5uZWxzW2NoYW5uZWxdLnByb2dyYW1DaGFuZ2UocHJvZ3JhbU51bWJlcik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChzdGF0dXNVcHBlcjRiaXRzID09PSAweGUpIHtcclxuICAgICAgICAgICAgbGV0IGxzYiA9IGRhdGFbMV07XHJcbiAgICAgICAgICAgIGxldCBtc2IgPSBkYXRhWzJdO1xyXG4gICAgICAgICAgICBsZXQgYmVuZCA9ICgobXNiIDw8IDcpIHwgbHNiKSAtIDgxOTI7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmxvZyhgQ2guICR7bWlkaUNoYW5uZWx9IFBpdGNoIGJlbmQ6ICR7YmVuZH1gKTtcclxuICAgICAgICAgICAgdGhpcy5jaGFubmVsc1tjaGFubmVsXS5zZXRQaXRjaEJlbmQoYmVuZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChzdGF0dXNVcHBlcjRiaXRzID09PSAweGIpIHtcclxuICAgICAgICAgICAgbGV0IGNvbnRyb2xOdW1iZXIgPSBkYXRhWzFdO1xyXG4gICAgICAgICAgICBsZXQgdmFsdWUgPSBkYXRhWzJdO1xyXG5cclxuICAgICAgICAgICAgaWYgKGNvbnRyb2xOdW1iZXIgPT09IDEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubG9nKGBDaC4gJHttaWRpQ2hhbm5lbH0gTW9kdWxhdGlvbiBXaGVlbDogJHt2YWx1ZX1gKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbY2hhbm5lbF0uc2V0TW9kdWxhdGlvbldoZWVsKHZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoY29udHJvbE51bWJlciA9PT0gNykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sb2coYENoLiAke21pZGlDaGFubmVsfSBDaGFubmVsIFZvbHVtZTogJHt2YWx1ZX1gKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbY2hhbm5lbF0uc2V0Vm9sdW1lKHZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoY29udHJvbE51bWJlciA9PT0gMTApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubG9nKGBDaC4gJHttaWRpQ2hhbm5lbH0gUGFuOiAke3ZhbHVlfWApO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jaGFubmVsc1tjaGFubmVsXS5zZXRQYW4odmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChjb250cm9sTnVtYmVyID09PSAxMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5sb2coYENoLiAke21pZGlDaGFubmVsfSBFeHByZXNzaW9uIENvbnRyb2xsZXI6ICR7dmFsdWV9YCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNoYW5uZWxzW2NoYW5uZWxdLnNldEV4cHJlc3Npb24odmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChjb250cm9sTnVtYmVyID09PSA2NCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlID49IDY0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2coYENoLiAke21pZGlDaGFubmVsfSBEYW1wZXIgUGVkYWwgT25gKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNoYW5uZWxzW2NoYW5uZWxdLmRhbXBlclBlZGFsT24oKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2coYENoLiAke21pZGlDaGFubmVsfSBEYW1wZXIgUGVkYWwgT2ZmYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jaGFubmVsc1tjaGFubmVsXS5kYW1wZXJQZWRhbE9mZigpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChjb250cm9sTnVtYmVyID09PSAxMjMpIHtcclxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubG9nKGBDaC4gJHttaWRpQ2hhbm5lbH0gQWxsIE5vdGVzIE9mZmApO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2hhbm5lbHNbY2hhbm5lbF0uYWxsTm90ZXNPZmYoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgbG9nKG1lc3NhZ2UpIHtcclxuICAgICAgICBpZiAodGhpcy5vcHRpb25zICYmIHRoaXMub3B0aW9ucy52ZXJib3NlKSB7XHJcbiAgICAgICAgICAgIERlYnVnLmxvZyhtZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbiIsImltcG9ydCBTcXVhcmVPc2NpbGxhdG9yIGZyb20gXCIuL29zY2lsbGF0b3JzL1NxdWFyZU9zY2lsbGF0b3JcIjtcclxuaW1wb3J0IFRyaWFuZ2xlT3NjaWxsYXRvciBmcm9tIFwiLi9vc2NpbGxhdG9ycy9UcmlhbmdsZU9zY2lsbGF0b3JcIjtcclxuXHJcbmNvbnN0IFNUQVRFX09GRiA9IDA7XHJcbmNvbnN0IFNUQVRFX0FUVEFDSyA9IDE7IC8vIG5vdCB1c2VkXHJcbmNvbnN0IFNUQVRFX0RFQ0FZID0gMjsgLy8gbm90IHVzZWRcclxuY29uc3QgU1RBVEVfU1VTVEFJTiA9IDM7XHJcbmNvbnN0IFNUQVRFX1JFTEVBU0UgPSA0O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVm9pY2Uge1xyXG4gICAgY29uc3RydWN0b3Ioc3ludGhlc2l6ZXIpIHtcclxuICAgICAgICB0aGlzLnN5bnRoZXNpemVyID0gc3ludGhlc2l6ZXI7XHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFNUQVRFX09GRjsgXHJcbiAgICB9XHJcbiAgICBcclxuICAgIHBsYXkobm90ZSwgdmVsb2NpdHkpIHtcclxuICAgICAgICB0aGlzLnN0YXRlID0gU1RBVEVfU1VTVEFJTjtcclxuICAgICAgICB0aGlzLm5vdGUgPSBub3RlO1xyXG4gICAgICAgIHRoaXMuZnJlcXVlbmN5ID0gNDQwICogTWF0aC5wb3coMiwgKG5vdGUgLSA2OSkgLyAxMik7XHJcbiAgICAgICAgdGhpcy52b2x1bWUgPSB2ZWxvY2l0eSAvIDEyNztcclxuICAgICAgICB0aGlzLnBoYXNlID0gMDtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLm9zY2lsbGF0b3IgPSBuZXcgU3F1YXJlT3NjaWxsYXRvcigpO1xyXG4gICAgICAgIC8vIHRoaXMub3NjaWxsYXRvciA9IG5ldyBUcmlhbmdsZU9zY2lsbGF0b3IoKTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLnZpYnJhdG9Pc2NpbGxhdG9yID0gbmV3IFRyaWFuZ2xlT3NjaWxsYXRvcigpO1xyXG4gICAgICAgIHRoaXMudmlicmF0b1BoYXNlID0gMDtcclxuICAgICAgICB0aGlzLnZpYnJhdG9GcmVxdWVuY3kgPSA4O1xyXG4gICAgICAgIHRoaXMudmlicmF0b0FtcGxpdHVkZSA9IDAuNTtcclxuICAgICAgICBcclxuICAgICAgICB0aGlzLm92ZXJzYW1wbGluZyA9IDQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHN0b3AoKSB7XHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFNUQVRFX1JFTEVBU0U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJlbmRlcihidWZmZXIsIGxlbmd0aCwgc2FtcGxlUmF0ZSkge1xyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlICE9PSBTVEFURV9PRkYpIHtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbGV0IGFtcGxpdHVkZSA9IHRoaXMuc3ludGhlc2l6ZXIubW9kdWxhdGlvbldoZWVsICogdGhpcy52aWJyYXRvQW1wbGl0dWRlO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBsZXQgdmlicmF0b1BlcmlvZCA9IHNhbXBsZVJhdGUgLyB0aGlzLnZpYnJhdG9GcmVxdWVuY3k7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnZpYnJhdG9QaGFzZSArPSAxIC8gdmlicmF0b1BlcmlvZDtcclxuICAgICAgICAgICAgICAgIGxldCB2aWJyYXRvT2Zmc2V0ID0gdGhpcy52aWJyYXRvT3NjaWxsYXRvci5nZXRTYW1wbGUodGhpcy52aWJyYXRvUGhhc2UpICogYW1wbGl0dWRlO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBsZXQgZnJlcXVlbmN5ID0gdGhpcy5ub3RlMmZyZXF1ZW5jeSh0aGlzLm5vdGUgKyB0aGlzLnN5bnRoZXNpemVyLnBpdGNoQmVuZCArIHZpYnJhdG9PZmZzZXQpO1xyXG4gICAgICAgICAgICAgICAgbGV0IHBlcmlvZCA9IHNhbXBsZVJhdGUgLyBmcmVxdWVuY3k7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgbGV0IHNhbXBsZSA9IDA7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMub3ZlcnNhbXBsaW5nOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBzYW1wbGUgKz0gdGhpcy5vc2NpbGxhdG9yLmdldFNhbXBsZSh0aGlzLnBoYXNlKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBoYXNlICs9IDEgLyBwZXJpb2QgLyB0aGlzLm92ZXJzYW1wbGluZztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJ1ZmZlcltpXSArPSBzYW1wbGUgLyB0aGlzLm92ZXJzYW1wbGluZyAqIHRoaXMudm9sdW1lICogMC4xO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU1RBVEVfUkVMRUFTRSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudm9sdW1lIC09IDAuMDA1O1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnZvbHVtZSAqPSAwLjk5OTk5O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy52b2x1bWUgPCAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFNUQVRFX09GRjtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlzUGxheWluZygpIHtcclxuICAgICAgICBpZiAodGhpcy5zdGF0ZSAhPT0gU1RBVEVfT0ZGKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIG5vdGUyZnJlcXVlbmN5KG5vdGUpIHtcclxuICAgICAgICByZXR1cm4gNDQwICogTWF0aC5wb3coMiwgKG5vdGUgLSA2OSkgLyAxMik7XHJcbiAgICB9XHJcbn1cclxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgRGVidWcge1xyXG4gICAgc3RhdGljIGNsZWFyKCkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJkZWJ1Z1wiKS5pbm5lckhUTUwgPSBcIlwiO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBzdGF0aWMgbG9nKG1lc3NhZ2UpIHtcclxuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBlbGVtZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJkZWJ1Z1wiKTtcclxuICAgICAgICBpZiAoZWxlbWVudCkge1xyXG4gICAgICAgICAgICBsZXQgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICAgICAgbGV0IHRleHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShtZXNzYWdlKTtcclxuICAgICAgICAgICAgZGl2LmFwcGVuZENoaWxkKHRleHQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZWxlbWVudC5hcHBlbmRDaGlsZChkaXYpO1xyXG4gICAgICAgICAgICB3aGlsZSAoZWxlbWVudC5zY3JvbGxIZWlnaHQgPiBlbGVtZW50LmNsaWVudEhlaWdodCkge1xyXG4gICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVDaGlsZChlbGVtZW50LmZpcnN0Q2hpbGQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIE15TWF0aCB7XHJcbiAgICBzdGF0aWMgcmFuZG9tKG1pbiwgbWF4KSB7XHJcbiAgICAgICAgcmV0dXJuIG1pbiArIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKTtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgY2xhbXAodmFsdWUsIG1pbiwgbWF4KVxyXG4gICAge1xyXG4gICAgICAgIGlmIChtaW4gPiBtYXgpIHtcclxuICAgICAgICAgICAgdmFyIHRlbXAgPSBtaW47XHJcbiAgICAgICAgICAgIG1pbiA9IG1heDtcclxuICAgICAgICAgICAgbWF4ID0gdGVtcDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh2YWx1ZSA8IG1pbikge1xyXG4gICAgICAgICAgICByZXR1cm4gbWluO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodmFsdWUgPiBtYXgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG1heDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBsaW5lYXJNYXAodmFsdWUsIHMwLCBzMSwgZDAsIGQxKVxyXG4gICAge1xyXG4gICAgICAgIHJldHVybiBkMCArICh2YWx1ZSAtIHMwKSAqIChkMSAtIGQwKSAvIChzMSAtIHMwKTtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgY2xhbXBlZExpbmVhck1hcCh2YWx1ZSwgczAsIHMxLCBkMCwgZDEpXHJcbiAgICB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xhbXAodGhpcy5saW5lYXJNYXAodmFsdWUsIHMwLCBzMSwgZDAsIGQxKSwgZDAsIGQxKTtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgZWFzZSh2YWx1ZSwgdGFyZ2V0LCBmYWN0b3IsIGRlbHRhVGltZSkge1xyXG4gICAgICAgIHJldHVybiB2YWx1ZSArICh0YXJnZXQgLSB2YWx1ZSkgKiAoMSAtIE1hdGguZXhwKC1mYWN0b3IgKiBkZWx0YVRpbWUpKTtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgcmFkaWFuKGRlZ3JlZSkge1xyXG4gICAgICAgIHJldHVybiBkZWdyZWUgKiAwLjAxNzQ1MzI5MjUxOTk0MzMwOyAvLyBNYXRoLlBJIC8gMTgwXHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGRlZ3JlZShyYWRpYW4pIHtcclxuICAgICAgICByZXR1cm4gcmFkaWFuICogNTcuMjk1Nzc5NTEzMDgyMzIwODsgLy8gMTgwIC8gTWF0aC5QSVxyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyB3cmFwKHZhbHVlLCBtaW4sIG1heCkge1xyXG4gICAgICAgIGxldCBuID0gKHZhbHVlIC0gbWluKSAlIChtYXggLSBtaW4pO1xyXG4gICAgICAgIHJldHVybiAobiA+PSAwKSA/IG4gKyBtaW4gOiBuICsgbWF4O1xyXG4gICAgfVxyXG59XHJcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFBsYXRmb3JtIHtcclxuICAgIHN0YXRpYyBpc2lPUygpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5pc2lQaG9uZSgpIHx8IHRoaXMuaXNpUGFkKCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHN0YXRpYyBpc2lQaG9uZSgpIHtcclxuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKFwiaVBob25lXCIpID49IDA7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHN0YXRpYyBpc2lQYWQoKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gXCJ1bmRlZmluZWRcIikge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gd2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZihcImlQYWRcIikgPj0gMDtcclxuICAgIH1cclxufVxyXG4iLCJleHBvcnQgeyBkZWZhdWx0IGFzIG1tbDJzbWYgfSBmcm9tIFwibW1sMnNtZlwiO1xyXG5leHBvcnQgeyBkZWZhdWx0IGFzIFN5bnRoZXNpemVyIH0gZnJvbSBcIi4vU3ludGhlc2l6ZXJcIjtcclxuZXhwb3J0IHsgZGVmYXVsdCBhcyBTTUZQbGF5ZXIgfSBmcm9tIFwiLi9TTUZQbGF5ZXJcIjtcclxuIiwiaW1wb3J0IE15TWF0aCBmcm9tIFwiLi4vZnJhbWVzeW50aGVzaXMvTXlNYXRoXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTcXVhcmVPc2NpbGxhdG9yIHtcclxuICAgIGdldFNhbXBsZShwaGFzZSkge1xyXG4gICAgICAgIGxldCBwID0gcGhhc2UgJSAxO1xyXG5cclxuICAgICAgICByZXR1cm4gcCA8IDAuNSA/IDEgOiAtMTtcclxuICAgIH1cclxufVxyXG4iLCJpbXBvcnQgTXlNYXRoIGZyb20gXCIuLi9mcmFtZXN5bnRoZXNpcy9NeU1hdGhcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFRyaWFuZ2xlT3NjaWxsYXRvciB7XHJcbiAgICBnZXRTYW1wbGUocGhhc2UpIHtcclxuICAgICAgICBsZXQgcCA9IHBoYXNlICUgMTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAocCA8IDAuMjUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIE15TWF0aC5saW5lYXJNYXAocCwgMCwgMC4yNSwgMCwgMSk7XHJcbiAgICAgICAgICAgIC8vIHJldHVybiBwICogNDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHAgPCAwLjc1KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBNeU1hdGgubGluZWFyTWFwKHAsIDAuMjUsIDAuNzUsIDEsIC0xKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIE15TWF0aC5saW5lYXJNYXAocCwgMC43NSwgMSwgLTEsIDApO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==
