const { loadUserConfig } = require("./js/preferences.js");
const { WebMidi } = require("webmidi");
const {midiToDbLinear, midiToPanLinear, convertMinMaxToMidi, getMidiChannel} = require("./js/utils.js");

var userConfig = loadUserConfig();
var storedMidiShortcuts = userConfig.midiShortcuts || {};

document.addEventListener('DOMContentLoaded', () => {
    midi_listener();
	start_listening();
});


function midi_listener() {
    window.WebMidi = WebMidi;
    window.WebMidi.enable({sysex: true}).then(() => {
        initMidiShortcuts();
        display_track_number();
    })
    .catch(err => console.error("⚠️ Erreur WebMIDI :", err));
}

function initMidiShortcuts() {

	if (!WebMidi.enabled) {
		WebMidi.enable({sysex: true})
		.then(setupListeners)
		.catch((err) => {
			console.error("Erreur WebMidi.enable :", err);
		});
	} else {
		setupListeners(); // si déjà enabled
	}

	function setupListeners() {
		if (WebMidi.inputs.length === 0) {
			console.warn("Aucune entrée MIDI détectée.");
			return;
		}

		WebMidi.inputs.forEach((input) => {
			input.addListener("midimessage", (e) => {
				if(window.isMidiListening) return;
				for (const [shortcutId, definition] of Object.entries(storedMidiShortcuts)) {
					const result = matchMidiEvent(e, definition);
						
					if (result && result.matched) {
						// Trouver la fonction d'action en fonction du nom "shortcutId"
						const actionFn = getActionFn(shortcutId);
						if (actionFn) {
							if ("value" in result) {
								actionFn(result.value);
							} else {
								actionFn();
							}
						} else {
							console.warn(`Aucune action trouvée pour le raccourci MIDI "${shortcutId}".`);
						}
						break;
					}
				}
			});
		});
	}
}

function matchMidiEvent(e, shortcutDef) {
	const [status, data1, data2] = e.data;
	const statusHigh = status & 0xf0; // ex: 0xB0, 0xE0, 0x90...
	const channel = (status & 0x0f) + 1; // canaux 1..16
	if(e.target.name == shortcutDef.deviceName){
		switch (shortcutDef.type) {
			case "cc":

			if (
				statusHigh === 0xb0 &&
				channel === shortcutDef.channel &&
				data1 === shortcutDef.controller
			) {
				return { matched: true, value: data2 };
			}
			break;

			case "pitchbend":
			if (statusHigh === 0xe0 && channel === shortcutDef.channel) {
				const bendValue = (data2 << 7) + data1 - 8192;
				return { matched: true, value: bendValue };
			}
			break;

			case "raw":
			const shortcutData = shortcutDef.data; // ex: [144, 34, 127]
			if (shortcutData.length !== e.data.length) return false;
			for (let i = 0; i < shortcutData.length-1; i++) {
				if (shortcutData[i] !== e.data[i]) return false;
			}
			return { matched: true, value: e.data[shortcutData.length-1] };
		}
	}

  	return false;
}

function getActionFn(shortcutId) {

    if(shortcutId.startsWith("faderbank")) {
        
        return (value) => {
            if(value > 0){
                if(shortcutId == "faderbank_next") {
                    window.faderPage++
                }
                if(shortcutId == "faderbank_prev") {
                    if(window.faderPage > 0) window.faderPage--
                }
                
                window.dispatchEvent(new CustomEvent("refreshAudioTrack"));
                display_track_number();
            }
        }
    }

    if (shortcutId.startsWith("volume")) {
        const trackNum = shortcutId.replace("volume", "");
        let track = null;
        if(trackNum == "master"){
            track = "master";
        }
        else{
            track = window.audioTrack[parseInt(trackNum) + window.faderPage * window.fader];
        }
        return (value) => {
            const dbValue = midiToDbLinear(value);
            window.dispatchEvent(new CustomEvent("changeVolume", { detail: { track: track, volume: dbValue.toFixed(2) } }));
        };
    }

    if (shortcutId.startsWith("select_track_")) {
        const trackNum = shortcutId.replace("select_track_", "");
        let track = null;
        if(trackNum == "master"){
            track = "master";
        }
        else{
            track = window.audioTrack[parseInt(trackNum) + window.faderPage * window.fader];
        }
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("selectTrack", {detail: { track: track }}));
        };
    }

    if (shortcutId.startsWith("mute_track")) {
        const trackNum = shortcutId.replace("mute_track_", "");
        let track = null;
        if(trackNum == "master"){
            track = "master";
        }
        else{
            track = window.audioTrack[parseInt(trackNum) + window.faderPage * window.fader];
        }
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("toggle_mute", {detail: { track: track }}));
        };
    }

    if (shortcutId.startsWith("pan")) {
        const trackNum = shortcutId.replace("pan", "");
        let track = null;
        if(trackNum == "master"){
            track = "master";
        }
        else{
            track = window.audioTrack[parseInt(trackNum) + window.faderPage * window.fader];
        }
        return (value) => {
            const panValue = midiToPanLinear(value);
            console.log(track);
            window.dispatchEvent(new CustomEvent("changePan", {detail: { track: track, pan: panValue }}));
        };
    }

    if (shortcutId.startsWith("solo_track")) {
        const trackNum = shortcutId.replace("solo_track_", "");
        let track = null;
        if(trackNum == "master"){
            track = "master";
        }
        else{
            track = window.audioTrack[parseInt(trackNum) + window.faderPage * window.fader];
        }
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("toggle_solo", {detail: { track: track }}));
        };
    }

    if (shortcutId.startsWith("play_player")) {
        const player = shortcutId.replace("play_player", "");
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("play", { detail: { player: player } }));
        };
    }

    if (shortcutId.startsWith("next_player")) {
        const player = shortcutId.replace("next_player", "");
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("next", { detail: { player: player } }));
        };
    }

    if (shortcutId.startsWith("prev_player")) {
        const player = shortcutId.replace("prev_player", "");
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("prev", { detail: { player: player } }));
        };
    }

    if(shortcutId.startsWith("cam")){
        const camNum = shortcutId.replace("cam", "");
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("switchCam", { detail: { camera: `camera${camNum}`, to: "preview" } }));
        };
    }

    if(shortcutId.startsWith("directcam")){
        const camNum = shortcutId.replace("directcam", "");
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("switchCam", { detail: { camera: `camera${camNum}`, to: "pgm" } }));
        };
    }

    if(shortcutId.startsWith("toggle_layer")){
        const layerNum = parseInt(shortcutId.replace("toggle_layer", ""));
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("toggleLayer", { detail: { index: layerNum-1 } }));
        };
    }

    if(shortcutId.startsWith("apply_scene")){
        const sceneNum = parseInt(shortcutId.replace("apply_scene", ""));
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("applyScene", { detail: { scene: sceneNum-1 } }));
        };
    }

    if(shortcutId == "autoswitch"){
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("toggleAutoswitch"));
        };
    }

    if(shortcutId == "switch"){
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("previewToPGM"));
        };
    }

    if(shortcutId == "startstream"){
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("launch-stream"));
        };
    }

    if(shortcutId == "startrec"){
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("launch-recording"));
        };
    }

    if(shortcutId == "startreciso"){
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("launch-recording-iso"));
        };
    }

    if(shortcutId == "tbar"){
        return (value) => {
            window.dispatchEvent(new CustomEvent("progressTransition", { detail: { progress: value/ 127 * 100, invert: false } }));
        };
    }

    if(shortcutId.startsWith("select_ptz")){
        const ptzNum = shortcutId.replace("select_ptz", "");
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("selectPTZ", { detail: `camera${ptzNum}` }));
        };
    }

    if(shortcutId.startsWith("select_preset_ptz")){
        const ptzNum = shortcutId.replace("select_preset_ptz", "");
        return (value) => {
            if(value > 0) window.dispatchEvent(new CustomEvent("presetPTZ", { detail: { camera: document.querySelector(".ptz-ctrl.active").getAttribute("data-camera-id"), preset: ptzNum } }));
        };
    }

    if(shortcutId.startsWith("ptz_move")){
        const move = shortcutId.replace("ptz_move_", "");
        return (value) => {
            if(value == 0){
                window.dispatchEvent(new CustomEvent("ptz_move_stop", { detail: { move: move } }));
            }
            else{
                window.dispatchEvent(new CustomEvent("ptz_move", { detail: { move: move } }));
            }
        };
    }

    if(shortcutId.startsWith("ptz_zoom")){
        const zoom = shortcutId.replace("ptz_zoom_", "");
        return (value) => {
            if(value == 0){
                window.dispatchEvent(new CustomEvent("ptz_zoom_stop", { detail: { move: zoom } }));
            }
            else{

                window.dispatchEvent(new CustomEvent("ptz_zoom", { detail: { move: zoom } }));
            }
        };
    }

    return null;
}

function start_listening(){
	const midiQueue = [];
	const QUEUE_INTERVAL = 0;
	let queueTimer = null;
	let volumePanTimeout = null;

	function processMidiQueue() {
		if (midiQueue.length === 0) {
			clearInterval(queueTimer);
			queueTimer = null;
			return;
		}
		const command = midiQueue.shift();
		if (command.channel && typeof command.channel[command.method] === 'function') {
			command.channel[command.method](command.note, command.options);
		}
	}

	function addMidiCommand(command) {
		midiQueue.push(command);
		if (queueTimer === null) {
			queueTimer = setInterval(processMidiQueue, QUEUE_INTERVAL);
		}
	}

	function resetVolumePanTimeout() {
		if (volumePanTimeout !== null) {
			clearTimeout(volumePanTimeout);
		}
		volumePanTimeout = setTimeout(() => {
			display_track_number();
			volumePanTimeout = null;
		}, 1000);
	}

	window.addEventListener('layersUpdated', (event) => {
		
		event.detail.forEach((element, key) => {
			const setting = loadUserConfig()["midiShortcuts"][`toggle_layer${key + 1}`];
			let velocity = 0;
			if(setting === undefined) return;
			const output = window.WebMidi?.getOutputByName(setting.deviceName);
			if (output) { 
				let channel = output.channels[getMidiChannel(setting.data[0])];
				if (element.visible) {
					addMidiCommand({
						channel: channel,
						method: 'playNote',
						note: setting.data[1],
						options: { rawAttack: 127 }
					});
				} else {
					addMidiCommand({
						channel: channel,
						method: 'stopNote',
						note: setting.data[1],
						options: { rawRelease: 0 }
					});
				}
			}
		});
	})

	window.addEventListener('ptz-selected', (event) => {
		let listOfCameras = JSON.parse(localStorage.getItem("selectedDevices"));

		for(const viewer in listOfCameras) {
			const cam = viewer.replace("camera", "");
			const setting = loadUserConfig()["midiShortcuts"][`select_ptz${cam}`];

			if(setting === undefined) return;
			const output = window.WebMidi?.getOutputByName(setting.deviceName);
			if (output) { 
				let channel = output.channels[getMidiChannel(setting.data[0])];
				if (event.detail.camera === viewer) {
					addMidiCommand({
						channel: channel,
						method: 'playNote',
						note: setting.data[1],
						options: { rawAttack: 127 }
					});
				} else {
					addMidiCommand({
						channel: channel,
						method: 'stopNote',
						note: setting.data[1],
						options: { rawRelease: 0 }
					});
				}
			}
		}
	})

	window.addEventListener("refreshCameraStatus", (e) => {
		const message = JSON.stringify({ 
			action: 'videoStatus', 
			pgm: window.pgm, 
			preview: window.preview 
		});
		window.socketManager.broadcast(message);
		let listOfCameras = JSON.parse(localStorage.getItem("selectedDevices"));

		for (const viewer in listOfCameras) {
			const cam = viewer.replace("camera", "");
			const setting = loadUserConfig()["midiShortcuts"][`cam${cam}`];
			if (!setting) continue;  

			const output = window.WebMidi?.getOutputByName(setting.deviceName);
			if (!output) continue;  

			let channel = output.channels[getMidiChannel(setting.data[0])];
			if (!channel) continue; 

			if (Array.isArray(window.preview) && window.preview.some(camera => camera.device === viewer)) {
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 127 }
				});
			} else {
				addMidiCommand({
					channel: channel,
					method: 'stopNote',
					note: setting.data[1],
					options: { rawRelease: 0 }
				});
			}

			const direct_setting = loadUserConfig()["midiShortcuts"][`directcam${cam}`];
			if (!direct_setting) continue;  

			const direct_output = window.WebMidi?.getOutputByName(direct_setting.deviceName);
			if (!direct_output) continue;  

			let direct_channel = direct_output.channels[getMidiChannel(direct_setting.data[0])];
			if (!direct_channel) continue; 

			if (Array.isArray(window.pgm) && window.pgm.some(camera => camera.device === viewer)) {
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: direct_setting.data[1],
					options: { rawAttack: 127 }
				});
			} else {
				addMidiCommand({
					channel: channel,
					method: 'stopNote',
					note: direct_setting.data[1],
					options: { rawRelease: 0 }
				});
			}

		}
	});

	window.addEventListener("autoswitchSetted", (e) => {
		const setting = loadUserConfig()["midiShortcuts"][`autoswitch`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { 
			let channel = output.channels[getMidiChannel(setting.data[0])];
			if (e.detail.state) {
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 127 }
				});
			} else {
				addMidiCommand({
					channel: channel,
					method: 'stopNote',
					note: setting.data[1],
					options: { rawRelease: 0 }
				});
			}
		}
	})

	window.addEventListener("volumeChanged", (e) => {
		if(e.detail.track === "master"){
			const setting = loadUserConfig()["midiShortcuts"][`volumemaster`];
			if(setting === undefined) return;
			const output = window.WebMidi?.getOutputByName(setting.deviceName);
			if (output) { output.sendControlChange(setting.controller, convertMinMaxToMidi(-60, 12, e.detail.volume), setting.channel)}
		}
		
		const setting = loadUserConfig()["midiShortcuts"][`volume${window.audioTrack.indexOf(e.detail.track) - (faderPage * fader)}`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { output.sendControlChange(setting.controller, convertMinMaxToMidi(-60, 12, e.detail.volume), setting.channel)}
		
		setLCDDisplay(window.audioTrack.indexOf(e.detail.track) - (faderPage * fader), "Volume", String(parseFloat(e.detail.volume).toFixed(2)), 0x14, "white");
		
		resetVolumePanTimeout();
		
	})

	window.addEventListener("trackMuted", (e) => {

		if(e.detail.track === "master"){
			const setting = loadUserConfig()["midiShortcuts"][`mute_track_master`];
			if(setting !== undefined){
				const output = window.WebMidi?.getOutputByName(setting.deviceName);
				if (output) { 
					let channel = output.channels[getMidiChannel(setting.data[0])];
					if (e.detail.muted) {
						addMidiCommand({
							channel: channel,
							method: 'playNote',
							note: setting.data[1],
							options: { rawAttack: 127 }
						});
					} else {
						addMidiCommand({
							channel: channel,
							method: 'stopNote',
							note: setting.data[1],
							options: { rawRelease: 0 }
						});
						addMidiCommand({
							channel: channel,
							method: 'playNote',
							note: setting.data[1],
							options: { rawAttack: 0 }
						});
					}
				}
			}
		}

		const setting = loadUserConfig()["midiShortcuts"][`mute_track_${window.audioTrack.indexOf(e.detail.track) - (faderPage * fader)}`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { 
			let channel = output.channels[getMidiChannel(setting.data[0])];
			if (e.detail.muted) {
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 127 }
				});
			} else {
				addMidiCommand({
					channel: channel,
					method: 'stopNote',
					note: setting.data[1],
					options: { rawRelease: 0 }
				});
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 0 }
				});
			}
		}

		

	})

	window.addEventListener("trackSelected", (e) => {

		if(e.detail.track === "master"){
			const setting = loadUserConfig()["midiShortcuts"][`select_track_master`];
			if(setting !== undefined){
				const output = window.WebMidi?.getOutputByName(setting.deviceName);
				if (output) { 
					let channel = output.channels[getMidiChannel(setting.data[0])];
					channel.playNote(setting.data[1], {rawAttack: e.detail.selected ? 127 : 0});
				}
			}
		}

		const setting = loadUserConfig()["midiShortcuts"][`select_track_${window.audioTrack.indexOf(e.detail.track) - (faderPage * fader)}`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { 
			let channel = output.channels[getMidiChannel(setting.data[0])];
			channel.playNote(setting.data[1], {rawAttack: e.detail.selected ? 127 : 0});
		}

		

	})

	window.addEventListener("trackSoloed", (e) => {
		const setting = loadUserConfig()["midiShortcuts"][`solo_track_${window.audioTrack.indexOf(e.detail.track) - (faderPage * fader)}`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { 
			let channel = output.channels[getMidiChannel(setting.data[0])];
			if (e.detail.solo) {
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 127 }
				});
			} else {
				addMidiCommand({
					channel: channel,
					method: 'stopNote',
					note: setting.data[1],
					options: { rawRelease: 0 }
				});
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 0 }
				});
			}
		}
	});

	window.addEventListener("played", (e) => {
		
		const setting = loadUserConfig()["midiShortcuts"][`play_player${e.detail.mediaplayer}`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { 
			let channel = output.channels[getMidiChannel(setting.data[0])];
			if (e.detail.state) {
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 127 }
				});
			} else {
				addMidiCommand({
					channel: channel,
					method: 'stopNote',
					note: setting.data[1],
					options: { rawRelease: 0 }
				});
			}
		}
	});

	window.addEventListener("panChanged", (e) => {

		if(e.detail.track === "master"){
			const setting = loadUserConfig()["midiShortcuts"][`panmaster`];
			if(setting === undefined) return;
			const output = window.WebMidi?.getOutputByName(setting.deviceName);
			if (output) { output.sendControlChange(setting.controller, convertMinMaxToMidi(-1, 1, e.detail.volume), setting.channel)}
		}
		const setting = loadUserConfig()["midiShortcuts"][`pan${window.audioTrack.indexOf(e.detail.track) - (faderPage * fader)}`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { output.sendControlChange(setting.controller, convertMinMaxToMidi(-1, 1, e.detail.pan), setting.channel)}
		
		setLCDDisplay(window.audioTrack.indexOf(e.detail.track) - (faderPage * fader), "Pan", String(e.detail.pan.toFixed(1)), 0x14, "white");

		resetVolumePanTimeout();
	})

	window.addEventListener("volumeVisualizer", (e) => {
		const setting = loadUserConfig()["midiShortcuts"][`volume${e.detail.track}`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output && e.detail.volume > 0) { output.sendControlChange(setting.controller+20, e.detail.volume > 0.01 && e.detail.volume <= 127 ? e.detail.volume*127 : 0, setting.channel)}
	});

	window.addEventListener("getAudioConfiguration", (e) => {
		const message = JSON.stringify({ action: 'getAudioConfiguration', configuration: localStorage.getItem('audio_conf')});
		window.socketManager.broadcast(message);
	});

	window.addEventListener("recording-started", (e) => {

		const setting = loadUserConfig()["midiShortcuts"][`startrec`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { 
			let channel = output.channels[getMidiChannel(setting.data[0])];
			console.log(e.detail);
			if (e.detail.state == "started") {
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 127 }
				});
			} else {
				addMidiCommand({
					channel: channel,
					method: 'stopNote',
					note: setting.data[1],
					options: { rawRelease: 0 }
				});
			}
		}
	})

	window.addEventListener("recording-iso-started", (e) => {

		const setting = loadUserConfig()["midiShortcuts"][`startreciso`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { 
			let channel = output.channels[getMidiChannel(setting.data[0])];
			if (e.detail.state == "started") {
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 127 }
				});
			} else {
				addMidiCommand({
					channel: channel,
					method: 'stopNote',
					note: setting.data[1],
					options: { rawRelease: 0 }
				});
			}
		}
	})

	window.addEventListener("streaming-started", (e) => {

		const setting = loadUserConfig()["midiShortcuts"][`startstream`];
		if(setting === undefined) return;
		const output = window.WebMidi?.getOutputByName(setting.deviceName);
		if (output) { 
			let channel = output.channels[getMidiChannel(setting.data[0])];
			if (e.detail.state == "started") {
				addMidiCommand({
					channel: channel,
					method: 'playNote',
					note: setting.data[1],
					options: { rawAttack: 127 }
				});
			} else {
				addMidiCommand({
					channel: channel,
					method: 'stopNote',
					note: setting.data[1],
					options: { rawRelease: 0 }
				});
			}
		}
	})

	window.addEventListener("settings-updated", (e) => {
		userConfig = loadUserConfig();
		storedMidiShortcuts = userConfig.midiShortcuts || {};
	})
	
	window.addEventListener("timer-update", (e) => {
		const timerStr = `${e.detail.hours}:${e.detail.minutes}:${e.detail.seconds}:${e.detail.centiseconds}`;
		displayTimerOnSegments(timerStr);
	});
}

//////////////////////////////////////////////////////////////////////
// Fonctions pour gérer l'affichage sur les écrans LCD de la X-Touch//
//////////////////////////////////////////////////////////////////////
function clearLCD() {
    for (let i = 0; i < 8; i++) {
        setLCDDisplay(i, "", "", 0x14, "white");
    }
}

function display_track_number(){
    clearLCD();
    for(var i = 0; i<window.fader; i++){
        setLCDDisplay(i, window.audioTrack[i+window.faderPage*window.fader], "", 0x14, "white");
    }
}

function setLCDDisplay(lcdNumber, upperText, lowerText, deviceId = 0x14, color = "white", invertUpper = false, invertLower = false){
    lcdNumber = Math.max(0, Math.min(lcdNumber, 7));
    const colorMap = {
      black: 0,
      red: 1,
      green: 2,
      yellow: 3,
      blue: 4,
      magenta: 5,
      cyan: 6,
      white: 7
    };
    let colorCode = colorMap[color.toLowerCase()] !== undefined ? colorMap[color.toLowerCase()] : 7;
    
    let cc = colorCode;
    if (invertUpper) cc |= 0x10;
    if (invertLower) cc |= 0x20;
  
    upperText = (upperText || "").slice(0, 7).padEnd(7, " ");
    lowerText = (lowerText || "").slice(0, 7).padEnd(7, " ");
  
    let charCodes = [];
    for (let i = 0; i < 7; i++) {
      charCodes.push(upperText.charCodeAt(i));
    }
    for (let i = 0; i < 7; i++) {
      charCodes.push(lowerText.charCodeAt(i));
    }
  
    const sysExMessage = [
      0xF0,             // Début SysEx
      0x00, 0x20, 0x32, // ID fabricant (pour X-Touch)
      deviceId,         // Device id (0x14 ou 0x15)
      0x4C,             // Code LCD (4C)
      lcdNumber,        // Numéro du LCD (0..7)
      cc,               // Options (couleur et inversion)
      ...charCodes,     // 14 caractères (ligne supérieure puis inférieure)
      0xF7              // Fin SysEx
    ];
  
    const output = WebMidi.getOutputByName("X-Touch");
    if (output) {
      output.send(sysExMessage);
      //console.log("Message LCD envoyé :", sysExMessage.map(b => b.toString(16)));
    } else {
      console.warn("Périphérique X-Touch non trouvé !");
    }
}
 


function displayTimerOnSegments(timerStr, deviceId = 0x14) {
	const parts = timerStr.split(":");
	if (parts.length < 4) {
		console.error("Le format du timer doit être HH:MM:SS:MS");
		return;
	}
	const HH = parts[0].padStart(2, "0").slice(0, 2);
	const MM = parts[1].padStart(2, "0").slice(0, 2);
	const SS = parts[2].padStart(2, "0").slice(0, 2);
	const MS = parts[3].padStart(2, "0").slice(0, 2);

	const sevenSegmentMap = {
		' ': 0x00,
		'0': 0x3F, 
		'1': 0x06, 
		'2': 0x5B, 
		'3': 0x4F, 
		'4': 0x66, 
		'5': 0x6D, 
		'6': 0x7D, 
		'7': 0x07, 
		'8': 0x7F, 
		'9': 0x6F, 
		'-': 0x40 
	};

	const segments = new Array(12).fill(sevenSegmentMap[' ']);
	segments[0] = sevenSegmentMap[HH.charAt(0)] || sevenSegmentMap[' '];
	segments[1] = sevenSegmentMap[HH.charAt(1)] || sevenSegmentMap[' '];
	segments[3] = sevenSegmentMap[MM.charAt(0)] || sevenSegmentMap[' '];
	segments[4] = sevenSegmentMap[MM.charAt(1)] || sevenSegmentMap[' '];
	segments[6] = sevenSegmentMap[SS.charAt(0)] || sevenSegmentMap[' '];
	segments[7] = sevenSegmentMap[SS.charAt(1)] || sevenSegmentMap[' '];
	segments[9] = sevenSegmentMap[MS.charAt(0)] || sevenSegmentMap[' '];
	segments[10] = sevenSegmentMap[MS.charAt(1)] || sevenSegmentMap[' '];

	const d1 = (1 << 2) | (1 << 5); // 0x04 | 0x20 = 0x24
	const d2 = (1 << 1);            // 0x02

	// Construction du message SysEx selon le format :
	// F0 00 20 32 dd 37 s1 .. s12 d1 d2 F7
	const sysExMessage = [
		0xF0,             // Début SysEx
		0x00, 0x20, 0x32, // Identifiant fabricant
		deviceId,         // Device id (0x14 pour X-Touch, 0x15 pour X-Touch-Ext)
		0x37,             // Code de commande pour les segments
		...segments,      // s1 à s12
		d1,               // d1 : points pour displays 1 à 7
		d2,               // d2 : points pour displays 8 à 12
		0xF7              // Fin SysEx
	];

	// Envoi du message via WebMidi
	const output = WebMidi.getOutputByName("X-Touch");
	if (output) {
		output.send(sysExMessage);
	} else {
		console.warn("Périphérique X-Touch non trouvé !");
	}
}
  
  