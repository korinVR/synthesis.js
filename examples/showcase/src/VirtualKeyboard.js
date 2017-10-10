export default class VirtualKeyboard {
    constructor(synthesizer) {
        this.synthesizer = synthesizer;

        this.keyState = [];
        for (let i = 0; i < 88; i++) {
            this.keyState[i] = false;
        }

        let lowerKeys = [67, 70, 86, 71, 66, 78, 74, 77, 75, 188, 76, 190, 191];
        let upperKeys = [69, 52, 82, 53, 84, 89, 55, 85, 56, 73, 57, 79, 80];

        this.key2note = {};

        for (let i = 0; i < lowerKeys.length; i++) {
            this.key2note[lowerKeys[i]] = 60 + i;
        }
        for (let i = 0; i < upperKeys.length; i++) {
            this.key2note[upperKeys[i]] = 72 + i;
        }
        
        document.body.addEventListener("keydown", event => this.onKeyDown(event));
        document.body.addEventListener("keyup", evemt => this.onKeyUp(event));
        
        this.damperPedal = false;
        
        this.createKeyboard();
    }
    
    onKeyDown(event) {
        if (event.target.nodeName === "INPUT" || event.target.nodeName === "TEXTAREA") {
            return;
        }
        
        if (event.keyCode === 32 && this.damperPedal === false) {
            this.damperPedal = true;
            this.synthesizer.processMIDIMessage([0xb0, 64, 127]);
        }
        
        let note = this.key2note[event.keyCode];
        if (this.keyState[note] === false) {
            this.keyState[note] = true;
            this.noteOn(note);
        }
    }
    
    onKeyUp(event) {
        if (event.keyCode === 32) {
            this.damperPedal = false;
            this.synthesizer.processMIDIMessage([0xb0, 64, 0]);
        }
        
        let note = this.key2note[event.keyCode];
        if (this.keyState[note] === true) {
            this.keyState[note] = false;
            this.noteOff(note);
        }
    }
    
    noteOn(note, velocity = 96) {
        this.synthesizer.processMIDIMessage([0x90, note, velocity]);
    }
    
    noteOff(note) {
        this.synthesizer.processMIDIMessage([0x80, note, 0]);
    }
    
    createKeyboard() {
        const KEY_LENGTH = 120;
        
        let parent = document.getElementById("keyboard");
        
        let canvas = document.createElement("canvas");
        canvas.setAttribute("width", "1000");
        canvas.setAttribute("height", "" + KEY_LENGTH);
        parent.appendChild(canvas);
        
        const KEYS = [
            { dx: 0.4, black: false },	// C
            { dx: 0.6, black: true },	// C#
            { dx: 0.6, black: false },	// D
            { dx: 0.4, black: true },	// D#
            { dx: 1.0, black: false },	// E
            { dx: 0.35, black: false },	// F
            { dx: 0.65, black: true },	// F#
            { dx: 0.5, black: false },	// G
            { dx: 0.5, black: true },	// G#
            { dx: 0.65, black: false },	// A
            { dx: 0.35, black: true },	// A#
            { dx: 1.0, black: false }	// B
        ];
        
        let wholeToneInterval = 28; // pixel
        
        let context = canvas.getContext("2d");
        
        const LOWEST_NOTE = 21;
        const HIGHEST_NOTE = 21 + 88;
        const START_KEY = 9;
        
        // draw white keys
        let x = 0.5;
        let key = START_KEY;
        
        for (let note = LOWEST_NOTE; note < HIGHEST_NOTE; note++) {
            if (!KEYS[key].black) {
                let center = x * wholeToneInterval;
                let width = wholeToneInterval;
                let height = KEY_LENGTH;
                
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
        
        for (let note = LOWEST_NOTE; note < HIGHEST_NOTE; note++) {
            if (KEYS[key].black) {
                let center = x * wholeToneInterval;
                let width = wholeToneInterval * 0.5;
                let height = KEY_LENGTH * 0.625;
                
                context.fillStyle = "#333";
                context.fillRect(center - width / 2, 0, width, height);
            }
            
            x += KEYS[key].dx;
            if (++key >= KEYS.length) {
                key = 0;
            }
        }
    }
}
