const { app, BrowserWindow, Menu, ipcMain, dialog, desktopCapturer, session, MessageChannelMain } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const express = require('express');
const https = require('https');
const fs = require('fs');
const selfsigned = require('selfsigned');
const { en, fr, nl } = require('./local/localization');
const configManager = require('./js/preferences');
const webServer = express();
const port = 3080;
const streamWorkers = new Map();
let mainWindow;
let openAtStartupFile = null;


///////ELECTRON CONFIGURATION////////////
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-audio-output-resampler');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('js-flags', '--expose_gc --max-old-space-size=128');
///////ELECTRON CONFIGURATION////////////

function start_https_server(){
	console.log("Starting HTTPS server...");
	const certDir = path.join(__dirname, 'cert');
	const keyPath = path.join(certDir, 'private.key');
	const certPath = path.join(certDir, 'certificate.crt');

	if (!fs.existsSync(certDir)) {
		fs.mkdirSync(certDir);
  	}

	if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
		console.log('Génération d’un certificat auto-signé...');
		const attrs = [{ name: 'commonName', value: 'localhost' }];
		const pems = selfsigned.generate(attrs, { days: 365 });
		fs.writeFileSync(keyPath, pems.private);
		fs.writeFileSync(certPath, pems.cert);
	}

	const httpsOptions = {
		key: fs.readFileSync(keyPath),
		cert: fs.readFileSync(certPath)
	};

	webServer.use('/nginx/:id', express.static(path.join(__dirname, 'nginx')));

	https.createServer(httpsOptions, webServer).listen(port, () => {
		console.log(`Serveur web HTTPS lancé sur https://localhost:${port}`);
	});
	  

}

function getAppLanguage() {
	const userConfig = configManager.loadUserConfig() || configManager.defaultConfig;
	const userLang = userConfig?.general?.language;
	const systemLang = app.getLocale().split("-")[0].toLowerCase();
	const chosen = ["fr", "nl", "en"].includes(userLang)
		? userLang
		: ["fr", "nl"].includes(systemLang)
		? systemLang
		: "en";

	return { en, fr, nl }[chosen];
}



app.on('open-file', (event, filePath) => {
	event.preventDefault(); // empêche le comportement par défaut
	if (mainWindow) {
		mainWindow.webContents.send('open-filePath', filePath);
	} else {
		openAtStartupFile = filePath;
	}
});
  
app.whenReady().then(() => {
	const lang = getAppLanguage();
	mainWindow = new BrowserWindow({
		width: 1920,
		height: 1080,
		icon: path.join(__dirname, 'assets', 'icons', 'icon.icns'),
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			nodeIntegrationInWorker: true,
			experimentalFeatures: true,
			backgroundThrottling: false,
			webviewTag: true
		}
	});
	
	
	mainWindow.webContents.setFrameRate(30);

	mainWindow.loadFile('index.html');
	
	const isMac = process.platform === 'darwin';

	const menuTemplate = [
		...(isMac ? [{
			label: lang.appName,
			submenu: [
			{ role: 'about', label: `À propos de ${lang.appName}` },
			{ label: lang.menu.settings, click: () => mainWindow.webContents.send('open-settings') },
			{ type: 'separator' },
			{ role: 'services' },
			{ type: 'separator' },
			{ role: 'hide', label: 'Masquer ' + lang.appName },
			{ role: 'hideothers', label: 'Masquer les autres' },
			{ role: 'unhide', label: 'Afficher tout' },
			{ type: 'separator' },
			{ role: 'quit', label: lang.menu.quit }
			]
		}] : []),
		{
		label: lang.menu.file,
		submenu: [
			{
				label: lang.menu.new,
				accelerator: 'CmdOrCtrl+N',
				click: () => {
					mainWindow.webContents.send('new-file');
				}
			},
			{
				label: lang.menu.save,
				accelerator: 'CmdOrCtrl+S',
				click: () => {
					mainWindow.webContents.send('save-file');
				}
			},
			{
				label: lang.menu.saveAs,
				accelerator: 'CmdOrCtrl+Shift+S',
				click: () => {
					mainWindow.webContents.send('save-file-as');
				}
			},
			{
				label: lang.menu.open,
				accelerator: 'CmdOrCtrl+O',
				click: () => {
					mainWindow.webContents.send('open-file');
				}
			},
			{ 
				type: 'separator' 
			},
			{
				label: lang.menu.quit,
				role: 'quit'
			}
		]
		},
		{
			label: lang.menu.edit,
			submenu: [
				{ role: 'cut', label: lang.menu.cut },
				{ role: 'copy', label: lang.menu.copy },
				{ role: 'paste', label: lang.menu.paste }
			]
		},
		{
			label: lang.menu.tools,
			submenu: [
				{
				label: lang.menu.devTools,
				accelerator: 'CmdOrCtrl+Alt+I',
				click: () => {
					mainWindow.webContents.openDevTools();
				}
				},
				{
					label: "Reload",
					accelerator: "CmdOrCtrl+R",
					click: () => {
						mainWindow.webContents.reload();
					}
				}
			]
		},
		{
			label: lang.menu.window,
			submenu: [
				{
					label: lang.menu.pgm,
					click: () => {
						mainWindow.webContents.send('open-pgm');
					}
				},
				{
					label: lang.menu.preview,
					click: () => {
						mainWindow.webContents.send('open-preview');
					}
				},
				{
					label: lang.menu.multiviewer,
					click: () => {
						mainWindow.webContents.send('open-multiviewer');
					}
				}
			]
		},
		{
			label: lang.menu.help,
			submenu: [
				{
					label: lang.menu.checkForUpdates,
					click: () => {
						autoUpdater.checkForUpdatesAndNotify();
					}
				}
			]
		}
	];
	
	const menu = Menu.buildFromTemplate(menuTemplate);
	Menu.setApplicationMenu(menu);

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		if (url === 'about:blank') {
		return {
			action: 'allow',
			overrideBrowserWindowOptions: {
				frame: true,
				fullscreenable: true,
				backgroundColor: 'black',
				webPreferences: {
					nodeIntegration: true,
					contextIsolation: false,
					nodeIntegrationInWorker: true,
					experimentalFeatures: true,
					backgroundThrottling: false,
					webviewTag: true
				}
			}
		}
		}
		return { action: 'deny' }
	})

	mainWindow.webContents.once('did-finish-load', () => {
		if (openAtStartupFile) {
			mainWindow.webContents.send('open-filePath', openAtStartupFile);
			openAtStartupFile = null;
		}
	});
});

function autoUpdate(){
	autoUpdater.on('error', (err) => {
		console.error('Erreur lors de la mise à jour : ', err);
	});
	
	// Lancement de l'auto-update
	autoUpdater.checkForUpdatesAndNotify();
	
	autoUpdater.on('update-available', () => {
		console.log(lang.updater.updateAvailable);
		dialog.showMessageBox(mainWindow, {
			type: 'info',
			buttons: [],
			title: lang.appName,
			message: lang.updater.updateInProgress
		});
	});
	
	autoUpdater.on('update-downloaded', () => {
		dialog.showMessageBox(mainWindow, {
			type: 'question',
			buttons: [lang.menu.yes, lang.menu.no],
			defaultId: 0,
			cancelId: 1,
			title: lang.appName,
			message: lang.updater.updateDownloaded
		}).then(result => {
			if (result.response === 0) {
				autoUpdater.quitAndInstall();
			}
		});
	});
}



function start_listening_ipcMain(){
	ipcMain.handle('get-desktop-sources', async (event, options) => {
		const sources = await desktopCapturer.getSources(options);
		return sources;
	});
	
	
	ipcMain.handle('open-folder-dialog', async () => {
		const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
		return result;
	});
	
	ipcMain.handle('save-file-dialog', async () => {
		const result = await dialog.showSaveDialog({ 
			title: 'Sauvegarder le fichier',
			defaultPath: 'corecast-save.ccast',
			filters: [{ name: 'ccast', extensions: ['ccast'] }]
		 });
		return result;
	});
	
	ipcMain.handle('open-file-dialog', async () => {
		const result = await dialog.showOpenDialog({ 
			filters: [{ name: 'ccast', extensions: ['ccast'] }]
		 });
		return result;
	});
	
	ipcMain.on('change-audio-buffer', (event, newBufferSize) => {
		app.commandLine.appendSwitch('--audio-buffer-size', String(newBufferSize));
		console.log("buffer changed to "+newBufferSize)
		app.relaunch();
		app.exit();
	});
	
	ipcMain.on('restart', (event) => {
		app.relaunch();
		app.exit();
	});
	
	ipcMain.on('start-streaming', (event, streamInfo) => {
		mainWindow.webContents.send('stream_started', { value: true, id: streamInfo.id });
	
		const workerPath = path.join(__dirname, 'worker/ffmpegWorker.js');
		const ffmpegWorker = new Worker(workerPath);
		streamWorkers.set(streamInfo.id, ffmpegWorker);
		ffmpegWorker.postMessage({
			action: 'init',
			config: streamInfo.config,
			id: streamInfo.id
		});
	
		ffmpegWorker.on('message', (message) => {
			if (message.id !== streamInfo.id) return;
			if (message.status === 'finished') {
				mainWindow.webContents.send('stream_finished', { value: "finished", id: message.id });
				streamWorkers.delete(message.id);
			} else if (message.status === 'error') {
				mainWindow.webContents.send('stream_error', { value: message.error, id: message.id });
				streamWorkers.delete(message.id);
			} else if (message.status === 'fps') {
				mainWindow.webContents.send('stream_fps', { value: message.fps, id: message.id });
			} else if (message.status === 'bitrate') {
				mainWindow.webContents.send('stream_bitrate', { value: message.bitrate, id: message.id });
			} else if (message.status === 'started') {
				mainWindow.webContents.send('stream_started', { value: message.message, id: message.id });
			}
		});
	});
	
	ipcMain.on('reload', (event) => {
		app.relaunch();
		app.exit();
	})
	ipcMain.on('stream-data', (event, data) => {
		const { id, data: bufferData } = data;
		const worker = streamWorkers.get(id);
		if (worker) {
			worker.postMessage({
				action: 'start',
				inputStream: bufferData,
				id: id
			});
		}
	});
	
	ipcMain.on('stop-streaming', (event, info) => {
		const { id } = info;
		const worker = streamWorkers.get(id);
		if (worker) {
			setTimeout(() => {
				worker.postMessage({ action: 'stop', id: id });
			}, 2000)
		}
	});
}


autoUpdate();
start_listening_ipcMain();
start_https_server();


