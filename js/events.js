const { sendPresetRecall } = require("./js/visca-over-ip.js");
const { loadUserConfig, saveUserConfig, defaultConfig } = require('./js/preferences.js');
window.faderPage = 0;
window.fader = 8;
window.audioTrack = getOrderedAudioConfKeys();

function getOrderedAudioConfKeys() {
	const confString = loadUserConfig();
	if (!confString) return [];

	const inputs = [];
	const aux = [];
	let masterKey = null;

	for(var i = 0; i < confString.audio.inputNumber; i++){
		inputs.push(`input${i + 1}`);
	}
	for(var i = 0; i < confString.audio.auxNumber; i++){
		aux.push(`audio_aux${i + 1}`);
	}

	inputs.sort((a, b) => {
		const numA = parseInt(a.replace("input", ""), 10);
		const numB = parseInt(b.replace("input", ""), 10);
		return numA - numB;
	});

	aux.sort((a, b) => {
		const numA = parseInt(a.replace("audio_aux", ""), 10);
		const numB = parseInt(b.replace("audio_aux", ""), 10);
		return numA - numB;
	});

	const orderedKeys = [...inputs, ...aux];
	orderedKeys.push("master");
	return orderedKeys;
}

window.addEventListener("presetPTZ", (e) => {
    const camera = JSON.parse(localStorage.getItem("config-cameras")).find(el => el.id === e.detail.camera);
    sendPresetRecall(camera.port, camera.ip, e.detail.preset);
})

window.addEventListener("selectPTZ", (e) => {
    document.querySelector("ptz-control").selectPTZ(e.detail);
})

window.addEventListener("ptz_move", (e) => {
    document.querySelector("ptz-control").movePTZ(e.detail.move);
})

window.addEventListener("ptz_move_stop", (e) => {
    document.querySelector("ptz-control").movePTZ("stop");
})

window.addEventListener("ptz_zoom", (e) => {
    document.querySelector("ptz-control").zoomPTZ(e.detail.move);
})

window.addEventListener("ptz_zoom_stop", (e) => {
    document.querySelector("ptz-control").zoomPTZ("stop");
})

window.addEventListener("toggleLayer", (event) => {
    document.querySelector("layer-viewer[main=true]").toggleLayer(event.detail.index);   
});

window.addEventListener("displayLayer", (event) => {
    document.querySelector("layer-viewer[main=true]").toggleLayer(event.detail.index, true);
    
});
window.addEventListener("hideLayer", (event) => {
    document.querySelector("layer-viewer[main=true]").toggleLayer(event.detail.index, false);
});

window.addEventListener("play", (event) => {
    document.querySelector(`media-player[mediaplayer='${event.detail.player}']`).play();
});

window.addEventListener("next", (event) => {
    document.querySelector(`media-player[mediaplayer='${event.detail.player}']`).next();
}); 

window.addEventListener("prev", (event) => {
    document.querySelector(`media-player[mediaplayer='${event.detail.player}']`).prev();
});

window.addEventListener("launch-stream", (event) => {
    document.querySelector('record-buttons').toggle_stream();
})
window.addEventListener("launch-recording", (event) => {
    document.querySelector('record-buttons').toggle_recording();
})
window.addEventListener("launch-recording-iso", (event) => {
    document.querySelector('record-buttons').toggle_recording_iso();
});

















