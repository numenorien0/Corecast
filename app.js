const fs = require('fs');
const path = require('path');
const os = require('os');
const { ipcRenderer } = require('electron');
const { getCpuLoad, getRamUsage } = require("./js/cpuInformations.js");
const { GrandioseFinder } = require('grandiose');
const { loadUserConfig, saveUserConfig, defaultConfig } = require('./js/preferences.js');
const { translation } = require('./local/local.js');
const { createMultiviewerOutput, createViewerOutput } = require('./viewer.js');


const homeDir = os.homedir(); 
window.appDir = homeDir

let userConfig = await loadUserConfig();

if (!userConfig) {
    document.querySelector('#welcome').style.display = "flex";
    document.querySelector('#welcome').addEventListener('click', () => {
        document.querySelector('#welcome').style.display = "none";
    });
    userConfig = defaultConfig;
    saveUserConfig(userConfig);
}

window.config = userConfig;  
document.querySelector('#welcomeMessage').innerText = translation[window.config.general.language].welcome;
document.querySelector('#clickToContinue').innerText = translation[window.config.general.language].clickToContinue;
    
    

if (!window.sharedAudioContext) {
    window.sharedAudioContext = new AudioContext({ latencyHint: "interactive", sampleRate: window.config.audio.sampleRate || 44100 });
    window.entryNode = window.sharedAudioContext.createGain();
  }

window.input = {};
window.output = {};
window.inputAudio = {};
window.outputAudio = {};
window.mediaplayer = [];
window.inputMediaStream = {}; 
window.inputMediaStreamPairs = {};
window.layers = null;
var peer
document.addEventListener('DOMContentLoaded', () => {
    peer = new Peer("hsdkfsudfnKJHBuyvbhbnuHKNBGH");
});
let previousSnapshot = getLocalStorageSnapshot();


setInterval(() => {
  getCpuLoad((load) => {
    document.getElementById('cpuLoad').innerText = `CPU : ${load.toFixed(2)}%`;
  });
  getRamUsage((usage) => {
    document.getElementById('ramLoad').innerText = `RAM : ${usage}%`;
  });
}, 2000);

let fileSave = "";

if(window.config.general.saveFile){
    document.title = "Corecast - " + path.basename(window.config.general.saveFile);
}
else{
	localStorage.clear();
}

ipcRenderer.on("open-pgm", () => {
    createViewerOutput(window.output['master'], "pgm");
});
  
ipcRenderer.on("open-preview", (e) => {
    createViewerOutput(window.output['preview'], "preview");
});

ipcRenderer.on("open-multiviewer", (e) => {
    createMultiviewerOutput("Multiviewer");
    console.log("ok")
});

ipcRenderer.on("open-settings", (e) => {
	document.querySelector("menu-bottom").openSettings();
});

ipcRenderer.on("new-file", (e) => {
	localStorage.clear();
	document.title = "My App - New File";
    ipcRenderer.send('reload');
});
  
ipcRenderer.on("save-file", (e) => {
    if (!window.config.general.saveFile) {
        ipcRenderer.invoke('save-file-dialog').then((result) => {
            if (result.canceled === false) {
                fileSave = result.filePath;
                window.config.general.saveFile = fileSave;
                saveUserConfig(window.config);
                saveLocalStorageToFile(result.filePath);
                previousSnapshot = getLocalStorageSnapshot();
                document.title = "Corecast - " + path.basename(fileSave);
            }
        });
    } else {
        saveUserConfig(window.config);
        saveLocalStorageToFile(window.config.general.saveFile);
        previousSnapshot = getLocalStorageSnapshot();
        document.title = "Corecast - " + path.basename(window.config.general.saveFile);
    }
});

ipcRenderer.on("save-file-as", (e) => {
    ipcRenderer.invoke('save-file-dialog').then((result) => {
        if (result.canceled === false) {
            fileSave = result.filePath;
            window.config.general.saveFile = fileSave;
            saveUserConfig(window.config);
            saveLocalStorageToFile(result.filePath);
            previousSnapshot = getLocalStorageSnapshot();
            document.title = "Corecast - " + path.basename(fileSave);
        }
    });
})
  
ipcRenderer.on("open-file", (e) => {
    ipcRenderer.invoke('open-file-dialog').then((result) => {
        if (result.canceled === false) {
            loadLocalStorageFromFile(result.filePaths[0], { clearBefore: true });
            fileSave = result.filePaths[0];
            document.title = "Corecast - " + path.basename(fileSave);
            window.config.general.saveFile = fileSave;
            saveUserConfig(window.config);
            saveLocalStorageToFile(fileSave);
            window.location.reload();
        }
    });
});
  
ipcRenderer.on("open-filePath", (e, filePath) => {
    loadLocalStorageFromFile(filePath, { clearBefore: true });
    fileSave = filePath;
    document.title = "Corecast - " + path.basename(fileSave);
    window.config.general.saveFile = fileSave;
    saveUserConfig(window.config);
    saveLocalStorageToFile(fileSave);
    window.location.reload();
});

function getLocalStorageSnapshot() {
    const snapshot = {};
	for (let i = 0; i < localStorage.length; i++) {
	    const key = localStorage.key(i);
	    snapshot[key] = localStorage.getItem(key);
	}
	return JSON.stringify(snapshot);
}
  
function watchLocalStorageChanges(interval = 1000) {
    setInterval(() => {
        const currentSnapshot = getLocalStorageSnapshot();
        if (currentSnapshot !== previousSnapshot) {
            if (window.config && window.config.general && window.config.general.saveFile) {
                const baseName = path.basename(window.config.general.saveFile);
                if (!document.title.endsWith('*')) {
                    document.title = "Corecast - " + baseName + "*";
                }
            } else {
                if (!document.title.endsWith('*')) {
                    document.title = "Corecast - New File*";
                }
            }
            previousSnapshot = currentSnapshot;
        }
    }, interval);
}

watchLocalStorageChanges();

const finder = new GrandioseFinder({ showLocalSources: true });
window.addEventListener("refreshNDI", (e) => {
    setTimeout(() => {
        pollNDISources();
    }, 1000)
});

function pollNDISources() {
    const sources = finder.getCurrentSources();
    window.dispatchEvent(new CustomEvent("ndi-sources-updated", {
        detail: { sources }
    }));
}

setTimeout(() => {
    pollNDISources();
}, 1000)

function saveLocalStorageToFile(filePath = path.join(__dirname, 'localStorageBackup.json')) {
    const data = {};

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
            const value = localStorage.getItem(key);
            JSON.parse(value);
            data[key] = value;
        } catch (e) {
        }
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}  

function loadLocalStorageFromFile(filePath = path.join(__dirname, 'localStorageBackup.json'), options = { clearBefore: true, parseValues: false }) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    if (options.clearBefore) {
        localStorage.clear();
    }

    for (const key in data) {
        localStorage.setItem(key, data[key]);
    }

    const result = {};
    for (const key in data) {
        try {
            result[key] = options.parseValues ? JSON.parse(data[key]) : data[key];
        } catch (e) {
            result[key] = null;
        }
    }
    return result;
}

window.addEventListener("beforeunload", () => {
    for (const key in pgmWindow) {
        const win = pgmWindow[key];
        if (win && !win.closed) {
            try {
                win.close();
            } catch (e) {}
        }
    }
});

// CHANGEMENT D'APPAREIL CONNECTE
navigator.mediaDevices.ondevicechange = async () => {
    const refreshDevices = new CustomEvent("refreshDevices", { detail: {}});
    window.dispatchEvent(refreshDevices);
};

