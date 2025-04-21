const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');;
const ffprobePath = require('@ffprobe-installer/ffprobe').path.replace('app.asar', 'app.asar.unpacked');

function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
}

function generateThumbnailToBase64(videoPath, captureTime = '00:00:01') {
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    return new Promise((resolve, reject) => {
        const tempDir = window.appDir;
        const thumbFileName = 'thumb_' + path.basename(videoPath, path.extname(videoPath)) + '.png';
        const thumbPath = path.join(tempDir, thumbFileName);

        ffmpeg(videoPath)
            .on('end', () => {
                fs.readFile(thumbPath, (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    fs.unlink(thumbPath, () => {});
                    resolve('data:image/png;base64,' + data.toString('base64'));
                });
            })
            .on('error', (err) => {
                reject(err);
            })
            .screenshots({
                timestamps: [captureTime],
                filename: thumbFileName,
                folder: tempDir,
                size: '320x?'
            });
    });
}

function formatDuration(durationInSeconds) {
    const hours = Math.floor(durationInSeconds / 3600);
    const minutes = Math.floor((durationInSeconds % 3600) / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getVideoDuration(videoPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    return new Promise((resolve, reject) => {
      
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          return reject(err);
        }
        resolve(metadata.format.duration);
      });
    });
  }

function getVideoMetadata(videoPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                return reject(err);
            }
            resolve(metadata);
        });
    });
}

function midiToDbLinear(value) {
	const v = Math.max(0, Math.min(value, 127));
	const minDb = -60;
	const maxDb = 12;
	const dbRange = maxDb - minDb; // 72

	return minDb + (v / 127) * dbRange;
}
  
function midiToPanLinear(value) {
	const v = Math.max(0, Math.min(value, 127));
	return -1 + (v / 127) * 2;
}

const convertMinMaxToMidi = (min, max, value) => {
	const difference = (a, b) => Math.abs(a - b);
	return Math.round(((Math.max(min, Math.min(value, max)) + Math.abs(min)) / difference(min, max)) * 127);
}

function getMidiChannel(statusByte) {
	return (statusByte & 0x0F) + 1;
}

class FrameController {
    constructor(framerate, drawFunction) {
        this.framerate = framerate;
        this.drawFunction = drawFunction;
        this.interval = 1000 / framerate;
        this.lastTime = 0;
    }

    start() {
        const loop = (currentTime) => {
            // Convert time to milliseconds
            currentTime = currentTime || performance.now();
            const deltaTime = currentTime - this.lastTime;

            if (deltaTime >= this.interval) {
                this.drawFunction();
                this.lastTime = currentTime - (deltaTime % this.interval);
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }
}

module.exports = { uuidv4, FrameController, generateThumbnailToBase64, formatDuration, getVideoMetadata, getVideoDuration, midiToDbLinear, midiToPanLinear, convertMinMaxToMidi, getMidiChannel };
