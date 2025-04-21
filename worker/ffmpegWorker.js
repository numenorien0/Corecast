const { parentPort } = require('worker_threads');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');;
const ffprobePath = require('@ffprobe-installer/ffprobe').path.replace('app.asar', 'app.asar.unpacked');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

const OUTPUT_FILE = '';

let ffmpegCommand;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);  // <-- Ajoute cette ligne
const ffmpegInputStream = new PassThrough();
let config = null; // Stockera la config d'initialisation

function startFFmpeg(config, id) {
    console.log(config);
    if (!ffmpegCommand) {
        ffmpegCommand = ffmpeg()
            .input(ffmpegInputStream)
            .inputFormat('mp4') // Vérifier que ce format correspond au flux reçu
            .videoCodec(config.codec || 'h264_videotoolbox')
            .addOption('-preset', 'veryfast')  // Rapidité d'encodage
            .videoBitrate(config.bitrate || "6000k")
            .size(config.resolution || "1920x1080")
            .fps(config.fps || "30")
            .audioCodec('aac')
            .audioBitrate('320k')
            .audioFrequency(config.sampleRate || 44100)
            .audioChannels(2)
            .format(config.format || "mp4")
            .output(config.output || OUTPUT_FILE)
            .on('start', (commandLine) => {
                console.log('FFmpeg lancé avec :', commandLine);
                parentPort.postMessage({
                    status: 'started',
                    message: `Flux commencé vers ${OUTPUT_FILE}`,
                    id: id
                });
            })
            .on('progress', (progress) => {
                if (progress.currentKbps) {
                    parentPort.postMessage({
                        status: 'bitrate',
                        bitrate: `${progress.currentKbps} kbits/s`,
                        id: id
                    });
                }
                if (progress.currentFps) {
                    parentPort.postMessage({
                        status: 'fps',
                        fps: `${progress.currentFps} fps`,
                        id: id
                    });
                }
            })
            .on('error', (err) => {
                console.error('Erreur FFmpeg:', err.message);
                parentPort.postMessage({ status: 'error', error: err.message, id: id });
            })
            .on('end', () => {
                console.log('FFmpeg terminé');
                parentPort.postMessage({ status: 'finished', id: id });
            })
            .run();
    }
}

// Gestion des messages depuis le main process
parentPort.on('message', (message) => {
    if (message.action === 'init') {
        // Stocker la configuration et démarrer FFmpeg
        config = message.config || {};
        startFFmpeg(config, message.id);
    } else if (message.action === 'start') {
        if (!ffmpegCommand) {
            // Si par hasard on n'a pas reçu la configuration d'initialisation
            console.error('Configuration non initialisée!');
            return;
        }
        // Ajouter les données reçues dans le flux
        ffmpegInputStream.write(message.inputStream);
    } else if (message.action === 'stop') {
        // Terminer proprement le flux d'entrée pour forcer ffmpeg à flush le buffer final
        console.log('Réception de l\'ordre d\'arrêt dans le worker.');
        ffmpegInputStream.end();
		parentPort.postMessage({
			status: "finished",
			id: message.id
		})
    }
});
