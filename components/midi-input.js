const { loadUserConfig, saveUserConfig } = require('./js/preferences.js');
export default class midiShortcutInput extends HTMLElement {

    constructor() {
        super();
        this.label = this.getAttribute('label');
        this.shortcutId = this.getAttribute('shortcut'); 
        // On récupère la config stockée s'il y en a
        const storedShortcuts = loadUserConfig().midiShortcuts || {};

        // On stocke la dernière "combinaison" Midi (ou un objet)
        this.midiCombination = storedShortcuts[this.shortcutId] || null;
        
        this.isListening = false; // Flag "en écoute"
        
        // Référence vers la callback
        this._midiMessageListener = this._onMidiMessage.bind(this);
    }

    connectedCallback() {
        this.render();
        window.addEventListener('midi-shortcut-changed', this.onGlobalShortcutChanged.bind(this));

    }

    disconnectedCallback() {
        window.removeEventListener('midi-shortcut-changed', this.onGlobalShortcutChanged.bind(this));
    }

    render() {
        this.innerHTML = `
            <div class="settingsRow">
                <label>${this.label}</label>
                <input type="text" readonly class="inputMidiShortcut" value="${this.formatMidiCombination(this.midiCombination)}">
                <button class="listenButton">Écouter</button>
            </div>
        `;
        
        const listenButton = this.querySelector('.listenButton');
        listenButton.addEventListener('click', () => {
            if(this.isListening == true){
                this.stopListening();
            }
            else{
                this.startListening();
            }
        });
    }

    /**
     * Callback quand un message MIDI est reçu
     */
    _onMidiMessage(e) {
        if (!this.isListening) return;

        // Status byte (ex. 0xB0 = CC, 0xE0 = pitchbend, 0x90 = noteOn, etc.)
        const status = e.data[0] & 0xf0;
        const channel = (e.data[0] & 0x0f) + 1;

        let shortcutInfo = null;
      
        if (status === 0xE0) {
          // Pitch Bend
          shortcutInfo = {
            type: "pitchbend",
            channel: channel
          };
        } else if (status === 0xB0) {
          // Control Change
          const ccNumber = e.data[1];
          shortcutInfo = {
            type: "cc",
            channel: channel,
            controller: ccNumber
          };
        } else {
          // Autres (notes, etc.)
          shortcutInfo = {
            type: "raw",
            data: Array.from(e.data)
          };
        }

        // On ajoute le nom du device (périphérique MIDI d'entrée)
        // e.target => instance de 'Input' WebMidi
        if (e.target && e.target.name) {
          shortcutInfo.deviceName = e.target.name;
        }
        
        // Sauvegarde
        this.saveShortcut(shortcutInfo);
        this.stopListening();
    }

    onGlobalShortcutChanged(e) {
        if (e.detail && JSON.stringify(e.detail.midiData) === JSON.stringify(this.midiCombination) && e.detail.id !== this.shortcutId) {
          this.midiCombination = "";
          const input = this.querySelector('.inputMidiShortcut');
          if (input) input.value = "";
            
            //setTimeout(() => {
                // const userConfig = loadUserConfig();
                // userConfig.midiShortcuts[this.shortcutId] = "";
                // saveUserConfig(userConfig);
           // }, 10);
            
        }
      }
      
    /**
     * Sauvegarde le raccourci dans la config.
     */
    saveShortcut(shortcutInfo) {
        // Met à jour l’affichage
        const inputField = this.querySelector('.inputMidiShortcut');
        inputField.value = this.formatShortcut(shortcutInfo);

        // Charger config
        const userConfig = loadUserConfig();
        if (!userConfig.midiShortcuts) userConfig.midiShortcuts = {};
      
        // Écrire dans la config
        userConfig.midiShortcuts[this.shortcutId] = shortcutInfo;
        
        this.midiCombination = shortcutInfo;

        const duplicateShortcut = Object.entries(userConfig.midiShortcuts).find(
            ([key, value]) => JSON.stringify(value) === JSON.stringify(this.midiCombination) && key !== this.shortcutId
        );
        if(duplicateShortcut){
            userConfig.midiShortcuts[duplicateShortcut[0]] = "";
        }

        saveUserConfig(userConfig);
        // On émet un événement custom si besoin
        window.dispatchEvent(new CustomEvent('midi-shortcut-changed', {
          detail: { 
            id: this.shortcutId, 
            midiData: shortcutInfo,
            source: this
          }
        }));
        
        
    }

    /**
     * Formate le shortcut pour l'input text
     */
    formatShortcut(info) {
        if (!info) return '';
        if (info.type === 'pitchbend') {
          return `Pitch Bend (canal ${info.channel}) [${info.deviceName || 'Device inconnu'}]`;
        } else if (info.type === 'cc') {
          return `CC #${info.controller} (canal ${info.channel}) [${info.deviceName || 'Device inconnu'}]`;
        } else if (info.type === 'raw') {
          return `Raw: [${info.data.join(', ')}] [${info.deviceName || 'Device inconnu'}]`;
        }
        return JSON.stringify(info);
    }

    startListening() {
        window.isMidiListening = true;
        this.isListening = true;
        const listenButton = this.querySelector('.listenButton');
        listenButton.innerText = 'Stop';
        window.WebMidi.inputs.forEach(input => {
          input.addListener('midimessage', this._midiMessageListener);
        });
    }
      
    stopListening() {
        window.isMidiListening = false;
        this.isListening = false;
        const listenButton = this.querySelector('.listenButton');
        listenButton.innerText = 'Écouter';
        window.WebMidi.inputs.forEach(input => {
          input.removeListener('midimessage', this._midiMessageListener);
        });
    }

    // Optionnel : si on veut un format plus complet
    formatMidiCombination(midiData) {
        if (!midiData) return '';
      
        if (Array.isArray(midiData)) {
          // cas "raw" direct ?
          return `[${midiData.join(', ')}]`;
        }
        // Objet
        if (typeof midiData === 'object') {
          if (midiData.type === 'cc') {
            return `CC #${midiData.controller} (canal ${midiData.channel}) [${midiData.deviceName || 'Device inconnu'}]`;
          } else if (midiData.type === 'pitchbend') {
            return `Pitch Bend (canal ${midiData.channel}) [${midiData.deviceName || 'Device inconnu'}]`;
          } else if (midiData.type === 'raw') {
            return `Raw: [${midiData.data.join(', ')}] [${midiData.deviceName || 'Device inconnu'}]`;
          }
          return JSON.stringify(midiData);
        }
      
        return midiData;
    }
}
