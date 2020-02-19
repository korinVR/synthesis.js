/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/main.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "../../src/framesynthesis/Debug.js":
/*!******************************************************************!*\
  !*** D:/Git/JavaScript/synthesis.js/src/framesynthesis/Debug.js ***!
  \******************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"default\", function() { return Debug; });\nclass Debug {\r\n  static clear () {\r\n    if (typeof document === 'undefined') {\r\n      return\r\n    }\r\n\r\n    document.getElementById('debug').innerHTML = ''\r\n  }\r\n\r\n  static log (message) {\r\n    if (typeof document === 'undefined') {\r\n      return\r\n    }\r\n\r\n    const element = document.getElementById('debug')\r\n    if (element) {\r\n      const div = document.createElement('div')\r\n      const text = document.createTextNode(message)\r\n      div.appendChild(text)\r\n\r\n      element.appendChild(div)\r\n      while (element.scrollHeight > element.clientHeight) {\r\n        element.removeChild(element.firstChild)\r\n      }\r\n    }\r\n  }\r\n}\r\n\n\n//# sourceURL=webpack:///D:/Git/JavaScript/synthesis.js/src/framesynthesis/Debug.js?");

/***/ }),

/***/ "./src/VirtualKeyboard.js":
/*!********************************!*\
  !*** ./src/VirtualKeyboard.js ***!
  \********************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"default\", function() { return VirtualKeyboard; });\nclass VirtualKeyboard {\r\n  constructor (synthesizer) {\r\n    this.synthesizer = synthesizer\r\n\r\n    this.keyState = []\r\n    for (let i = 0; i < 88; i++) {\r\n      this.keyState[i] = false\r\n    }\r\n\r\n    const lowerKeys = [67, 70, 86, 71, 66, 78, 74, 77, 75, 188, 76, 190, 191]\r\n    const upperKeys = [69, 52, 82, 53, 84, 89, 55, 85, 56, 73, 57, 79, 80]\r\n\r\n    this.key2note = {}\r\n\r\n    for (let i = 0; i < lowerKeys.length; i++) {\r\n      this.key2note[lowerKeys[i]] = 60 + i\r\n    }\r\n    for (let i = 0; i < upperKeys.length; i++) {\r\n      this.key2note[upperKeys[i]] = 72 + i\r\n    }\r\n\r\n    document.body.addEventListener('keydown', event => this.onKeyDown(event))\r\n    document.body.addEventListener('keyup', evemt => this.onKeyUp(event))\r\n\r\n    this.damperPedal = false\r\n\r\n    this.createKeyboard()\r\n  }\r\n\r\n  onKeyDown (event) {\r\n    if (event.target.nodeName === 'INPUT' || event.target.nodeName === 'TEXTAREA') {\r\n      return\r\n    }\r\n\r\n    if (event.keyCode === 32 && this.damperPedal === false) {\r\n      this.damperPedal = true\r\n      this.synthesizer.processMIDIMessage([0xb0, 64, 127])\r\n    }\r\n\r\n    const note = this.key2note[event.keyCode]\r\n    if (this.keyState[note] === false) {\r\n      this.keyState[note] = true\r\n      this.noteOn(note)\r\n    }\r\n  }\r\n\r\n  onKeyUp (event) {\r\n    if (event.keyCode === 32) {\r\n      this.damperPedal = false\r\n      this.synthesizer.processMIDIMessage([0xb0, 64, 0])\r\n    }\r\n\r\n    const note = this.key2note[event.keyCode]\r\n    if (this.keyState[note] === true) {\r\n      this.keyState[note] = false\r\n      this.noteOff(note)\r\n    }\r\n  }\r\n\r\n  noteOn (note, velocity = 96) {\r\n    this.synthesizer.processMIDIMessage([0x90, note, velocity])\r\n  }\r\n\r\n  noteOff (note) {\r\n    this.synthesizer.processMIDIMessage([0x80, note, 0])\r\n  }\r\n\r\n  createKeyboard () {\r\n    const KEY_LENGTH = 120\r\n\r\n    const parent = document.getElementById('keyboard')\r\n\r\n    const canvas = document.createElement('canvas')\r\n    canvas.setAttribute('width', '1000')\r\n    canvas.setAttribute('height', '' + KEY_LENGTH)\r\n    parent.appendChild(canvas)\r\n\r\n    const KEYS = [\r\n      { dx: 0.4, black: false },\t// C\r\n      { dx: 0.6, black: true },\t// C#\r\n      { dx: 0.6, black: false },\t// D\r\n      { dx: 0.4, black: true },\t// D#\r\n      { dx: 1.0, black: false },\t// E\r\n      { dx: 0.35, black: false },\t// F\r\n      { dx: 0.65, black: true },\t// F#\r\n      { dx: 0.5, black: false },\t// G\r\n      { dx: 0.5, black: true },\t// G#\r\n      { dx: 0.65, black: false },\t// A\r\n      { dx: 0.35, black: true },\t// A#\r\n      { dx: 1.0, black: false }\t// B\r\n    ]\r\n\r\n    const wholeToneInterval = 28 // pixel\r\n\r\n    const context = canvas.getContext('2d')\r\n\r\n    const LOWEST_NOTE = 21\r\n    const HIGHEST_NOTE = 21 + 88\r\n    const START_KEY = 9\r\n\r\n    // draw white keys\r\n    let x = 0.5\r\n    let key = START_KEY\r\n\r\n    for (let note = LOWEST_NOTE; note < HIGHEST_NOTE; note++) {\r\n      if (!KEYS[key].black) {\r\n        const center = x * wholeToneInterval\r\n        const width = wholeToneInterval\r\n        const height = KEY_LENGTH\r\n\r\n        context.fillStyle = '#F8F8F8'\r\n        context.fillRect(center - width / 2, 0, width, height)\r\n\r\n        context.lineWidth = 0.5\r\n        context.strokeStyle = '#CCC'\r\n        context.beginPath()\r\n        context.moveTo(center - width / 2 - 0.5, 0)\r\n        context.lineTo(center - width / 2 - 0.5, KEY_LENGTH)\r\n        context.stroke()\r\n      }\r\n\r\n      x += KEYS[key].dx\r\n      if (++key >= KEYS.length) {\r\n        key = 0\r\n      }\r\n    }\r\n\r\n    // draw black keys\r\n    x = 0.5\r\n    key = START_KEY\r\n\r\n    for (let note = LOWEST_NOTE; note < HIGHEST_NOTE; note++) {\r\n      if (KEYS[key].black) {\r\n        const center = x * wholeToneInterval\r\n        const width = wholeToneInterval * 0.5\r\n        const height = KEY_LENGTH * 0.625\r\n\r\n        context.fillStyle = '#333'\r\n        context.fillRect(center - width / 2, 0, width, height)\r\n      }\r\n\r\n      x += KEYS[key].dx\r\n      if (++key >= KEYS.length) {\r\n        key = 0\r\n      }\r\n    }\r\n  }\r\n}\r\n\n\n//# sourceURL=webpack:///./src/VirtualKeyboard.js?");

/***/ }),

/***/ "./src/main.js":
/*!*********************!*\
  !*** ./src/main.js ***!
  \*********************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../src/framesynthesis/Debug */ \"../../src/framesynthesis/Debug.js\");\n/* harmony import */ var _VirtualKeyboard__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./VirtualKeyboard */ \"./src/VirtualKeyboard.js\");\n\r\n\r\n\r\nlet synthesizer;\r\nlet smfPlayer;\r\n\r\nconst virtualKeyboard = new _VirtualKeyboard__WEBPACK_IMPORTED_MODULE_1__[\"default\"](synthesizer)\r\n\r\n_src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log('Initializing Web MIDI')\r\nif (navigator.requestMIDIAccess) {\r\n  navigator.requestMIDIAccess(/* { sysex: true } */).then(onMIDISuccess, onMIDIFailure)\r\n} else {\r\n  _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log('error: This browser does not support Web MIDI API.')\r\n}\r\n\r\nfunction onMIDISuccess (midiAccess) {\r\n  for (const input of midiAccess.inputs.values()) {\r\n    _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log(`  MIDI Input  id: ${input.id} manufacturer: ${input.manufacturer} name: ${input.name}`)\r\n\r\n    input.onmidimessage = onMIDIMessage\r\n  }\r\n\r\n  for (const output of midiAccess.outputs.values()) {\r\n    _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log(`  MIDI Output id: ${output.id} manufacturer: ${output.manufacturer} name: ${output.name}`)\r\n  }\r\n\r\n  _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log('Ready')\r\n}\r\n\r\nfunction onMIDIFailure (message) {\r\n  _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log(\"error: Can't initialize Web MIDI: \" + message)\r\n}\r\n\r\nfunction onMIDIMessage (event) {\r\n  // let s = \"MIDI message timestamp \" + event.timeStamp + \" : \";\r\n  // for (let i = 0; i < event.data.length; i++) {\r\n  //   s += \"0x\" + event.data[i].toString(16) + \" \";\r\n  // }\r\n\r\n  synthesizer.processMIDIMessage(event.data)\r\n}\r\n\r\nfunction initializeSynthesizer () {\r\n  if (!synthesizer) {\r\n    synthesizer = new synthesisjs.Synthesizer({ verbose: true })\r\n    smfPlayer = new synthesisjs.SMFPlayer(synthesizer)\r\n  }\r\n}\r\n\r\nfunction playSMF () {\r\n  initializeSynthesizer()\r\n\r\n  _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log('Play test SMF')\r\n\r\n  const tick = 24\r\n\r\n  const smf = new Uint8Array([\r\n    0x4d, 0x54, 0x68, 0x64,\r\n    0x00, 0x00, 0x00, 0x06,\r\n    0x00, 0x00,\r\n    0x00, 0x01,\r\n    0x00, 0x30,\r\n    0x4d, 0x54, 0x72, 0x6b,\r\n    0x00, 0x00, 0x00, 46,\r\n\r\n    0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,\r\n\r\n    0, 0x9f, 60, 96, tick, 0x8f, 60, 0,\r\n    0, 0x9f, 62, 96, tick, 0x8f, 62, 0,\r\n    0, 0x9f, 64, 96, tick, 0x8f, 64, 0,\r\n    0, 0x9f, 65, 96, tick, 0x8f, 65, 0,\r\n    0, 0x9f, 67, 96, tick, 0x8f, 67, 0])\r\n\r\n  smfPlayer.play(smf)\r\n}\r\n\r\nfunction stopSMF () {\r\n  _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log('Stop SMF')\r\n\r\n  smfPlayer.stop()\r\n\r\n  for (let i = 0; i < 16; i++) {\r\n    synthesizer.processMIDIMessage([0xb0 + i, 123, 0])\r\n  }\r\n}\r\n\r\n// export\r\nwindow.playSMF = playSMF\r\nwindow.stopSMF = stopSMF\r\n\r\nfunction playMML () {\r\n  initializeSynthesizer()\r\n\r\n  const mml = document.getElementById('mml').value\r\n  _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log('Convert MML: ' + mml)\r\n  try {\r\n    const opts = {}\r\n    const smf = synthesisjs.mml2smf(mml, opts)\r\n    _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log('Play SMF')\r\n    smfPlayer.play(smf, opts.startTick)\r\n  } catch (e) {\r\n    _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log(e.message)\r\n  }\r\n}\r\n\r\nfunction tweetMML () {\r\n  const mml = document.getElementById('mml').value\r\n  const mmlURL = 'https://framesynthesis.com/experiments/synthesis.js/?mml=' + encodeURIComponent(mml)\r\n\r\n  const url = 'https://twitter.com/intent/tweet?hashtags=synthesisjs&text=' + encodeURIComponent(mmlURL)\r\n  window.open(url, '_blank')\r\n}\r\n\r\nfunction downloadMIDIFile (filename) {\r\n  const mml = document.getElementById('mml').value\r\n  try {\r\n    const smf = synthesisjs.mml2smf(mml)\r\n\r\n    const blob = new Blob([smf], { type: 'application/x-midi' })\r\n\r\n    const a = document.createElement('a')\r\n    a.href = URL.createObjectURL(blob)\r\n    a.target = '_blank'\r\n    a.download = filename\r\n    a.click()\r\n  } catch (e) {\r\n    _src_framesynthesis_Debug__WEBPACK_IMPORTED_MODULE_0__[\"default\"].log(e.message)\r\n  }\r\n}\r\n\r\nwindow.playMML = playMML\r\nwindow.tweetMML = tweetMML\r\nwindow.downloadMIDIFile = downloadMIDIFile\r\n\r\nfunction synthesizerReset () {\r\n  synthesizer.reset()\r\n}\r\n\r\nwindow.synthesizerReset = synthesizerReset\r\n\r\n// set MML from query string\r\nif (location.search.startsWith('?mml=')) {\r\n  const mml = decodeURIComponent(location.search.substring(5))\r\n  document.getElementById('mml').value = mml\r\n}\r\n\n\n//# sourceURL=webpack:///./src/main.js?");

/***/ })

/******/ });