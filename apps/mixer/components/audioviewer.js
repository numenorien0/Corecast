const { RtAudio, RtAudioFormat } = require("audify");
const { Notyf } = require('notyf');
var notyf = new Notyf();

export default class audioviewer extends HTMLElement {
    constructor() {
        super();
    }

    async render() {        
        this.innerHTML = `
            <div class='mixer_console'>
                ${Array.from({ length: parseInt(window.config.audio.inputNumber) }, (_, i) => `<audio-track label="input ${i + 1}" type="aux" id="input${i + 1}"></audio-track>`).join('')}
                ${Array.from({ length: parseInt(window.config.audio.auxNumber) }, (_, i) => `<audio-track label="Aux ${i + 1}" type="aux" id="audio_aux${i + 1}"></audio-track>`).join('')}
            </div>
            <div class='mixer_sidebar'>
                <audio-track label="Output" type="output" id='master'></audio-track>
            </div>
        `;
    }

    

    

    connectedCallback() {
        this.render();

        
        var audioCore = require('./apps/mixer/controllers/audiocore.js');
        var inputOutputController = require('./apps/mixer/controllers/inputOutput.js');

        
        this.audioCore = new audioCore();
        this.input = {};
        this.output = {};

        for(var i = 0; i < parseInt(window.config.audio.inputNumber); i++) {
            this.input[`input${i + 1}`] = new inputOutputController({id: `input${i + 1}`});
        }

        for(var i = 0; i < parseInt(window.config.audio.auxNumber); i++) {
            this.output[`audio_aux${i + 1}`] = new inputOutputController({id: `audio_aux${i + 1}`});
        }

        this.output[`master`] = new inputOutputController({id: `master`});

        Array.from({ length: parseInt(window.config.audio.inputNumber) }, (_, i) => `<audio-trackid="input${i + 1}"></audio-track>`).join('')

        
    }
}