const fs = require('fs');
const path = require('path');
const os = require('os');

function getAppDataPath() {
	const platform = os.platform();
	if (platform === 'win32') {
		return process.env.APPDATA || process.env.LOCALAPPDATA;
	} else if (platform === 'darwin') {
		return path.join(os.homedir(), 'Library', 'Application Support');
	} else {
		return path.join(os.homedir(), '.config');
	}
}

const appFolder = path.join(getAppDataPath(), 'corecast');
const configFilePath = path.join(appFolder, 'config.json');

if (!fs.existsSync(appFolder)) {
	fs.mkdirSync(appFolder, { recursive: true });
}

const defaultConfig = {
	general: {
		language: "fr",
		saveFile: "",
		autoswitch: false,
		background: {
			type: "color", // ou "image"
			color: "#000000",
			image: null
		}
	},
	video: {
		definition: "1920x1080",
		framerate: "60"
	},
	audio: {
		bufferSize: 512,
		device: "",
		inputNumber: "8",
		auxNumber: "2",
		faderByPage: 8,
		sampleRate: 48000
	},
	output: {
		recording: {
			destination: appFolder,
			fileName: "output",
			format: "mp4",
			encoder: "libx264",
			framerate: "60",
			bitrate: "25000",
			definition: "1920x1080"
		},
		recording_iso: {
			destination: appFolder,
			fileName: "output",
			format: "mp4",
			encoder: "libx264",
			framerate: "60",
			bitrate: "10000",
			definition: "1920x1080"
		},
		streaming: {
			destination: "",
			format: "flv",
			encoder: "libx264",
			framerate: "60",
			bitrate: "6000",
			definition: "1920x1080"
		},
		cachedFile: {
			format: "mp4",
			encoder: "libx264",
			destination: appFolder
		}
	},
	shortcuts: {
		cam1: "&",
		cam2: "É",
		cam3: "\"",
		cam4: "'",
		cam5: "(",
		cam6: "§",
		cam7: "È",
		cam8: "!",
		switch: "Enter",
		autoswitch: "Backspace",
		toggle_layer1: "A",
		toggle_layer2: "Z",
		toggle_layer3: "E",
		toggle_layer4: "R",
		toggle_layer5: "T",
		toggle_layer6: "Y",
		toggle_layer7: "U",
		toggle_layer8: "I",
		toggle_layer9: "O",
		toggle_layer10: "P",
		apply_scene1: "Shift + 1",
		apply_scene2: "Shift + 2",
		apply_scene3: "Shift + 3",
		apply_scene4: "Shift + 4",
		apply_scene5: "Shift + 5",
		apply_scene6: "Shift + 6",
		apply_scene7: "Shift + 7",
		apply_scene8: "Shift + 8",
		apply_scene9: "Shift + 9",
		apply_scene10: "Shift + 0",
		play_player1: "S",
		next_player1: "D",
		prev_player1: "Q",
		play_player2: "L",
		next_player2: "M",
		prev_player2: "K"
	}
};

function loadUserConfig() {
	if (fs.existsSync(configFilePath)) {
		try {
			const data = fs.readFileSync(configFilePath, 'utf-8');
			return JSON.parse(data);
		} catch (error) {
			console.error("Erreur lors de la lecture de la configuration :", error);
			return null;
		}
	}
	return null;
}

function saveUserConfig(config) {
	try {
		fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8');
		window.dispatchEvent(new CustomEvent("settings-updated", { detail: config }));
	} catch (error) {
		console.error("Erreur lors de la sauvegarde de la configuration :", error);
	}
}

module.exports = {
	loadUserConfig,
	saveUserConfig,
	defaultConfig,
	appFolder
};
