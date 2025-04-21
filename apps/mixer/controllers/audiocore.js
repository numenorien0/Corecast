const { RtAudio, RtAudioFormat } = require("audify");

class audioCore {
    constructor() {
        this.rtAudio = new RtAudio();
        this.audioContext = window.sharedAudioContext
        window.inputMediaStream = {};
        window.inputMediaStreamPairs = {};
        this.audioBuffers = {};
        if(window.config.audio.device) {
            this.initializeAudio(parseInt(window.config.audio.device, 10), parseInt(window.config.audio.bufferSize, 10), parseInt(window.config.audio.sampleRate, 10) || 44100)
        }
        window.addEventListener("beforeunload", () => {
            if (this.rtAudio && this.rtAudio.isStreamOpen()) {
                this.rtAudio.stop();
                this.rtAudio.closeStream();
            }
            for (const key in window.inputMediaStream) {
                window.inputMediaStream[key].getTracks().forEach(track => track.stop());
            }
            for (const key in window.inputMediaStreamPairs) {
                window.inputMediaStreamPairs[key].getTracks().forEach(track => track.stop());
            }
        });
    }

    async initializeAudio(deviceId, bufferSize = 256, sampleRate = 48000) {

        if (!deviceId || deviceId == "none") {
            return;
        }

        const devices = await this.rtAudio.getDevices();
        let inputDevice = devices.find((d) => d.id == deviceId);
        if (!inputDevice) {
            return
        }

        try {
            
            const numChannels = inputDevice.inputChannels || 1;

            await this.audioContext.audioWorklet.addModule('worker/processor.js');
            const workletNode = new AudioWorkletNode(this.audioContext, 'buffer-processor', {
                processorOptions: { 
                    numChannels: numChannels,
                    bufferSize: bufferSize,
                    targetLatencySeconds: 0.10  // latence cible en secondes
                },
                outputChannelCount: [numChannels]
            });
              
              

            const splitter = this.audioContext.createChannelSplitter(numChannels);
            workletNode.connect(splitter);

            for (let i = 0; i < numChannels; i++) {
                const dest = this.audioContext.createMediaStreamDestination();
                splitter.connect(dest, i, 0);
                window.inputMediaStream[i + 1] = dest.stream;
                this.audioBuffers[i] = new Float32Array(bufferSize);
            }

            for (let i = 0; i < numChannels - 1; i += 2) {
                const pairKey = `${i + 1}+${i + 2}`;
                window.inputMediaStreamPairs[pairKey] = this.createStereoPair(splitter, i, i + 1);
            }
            
            this.rtAudio.openStream(
                null,
                { deviceId, nChannels: numChannels, firstChannel: 0 },
                RtAudioFormat.RTAUDIO_FLOAT32,
                sampleRate,
                //deviceSampleRate,
                bufferSize,
                "MyStream",
                (pcm) => {
                    const fullBuffer = new Float32Array(pcm.buffer);
                    const numFrames = fullBuffer.length / numChannels;
                    const channelBuffers = [];

                    for (let ch = 0; ch < numChannels; ch++) {
                        const channelData = new Float32Array(numFrames);
                        for (let i = 0; i < numFrames; i++) {
                            channelData[i] = fullBuffer[i * numChannels + ch];
                        }
                        channelBuffers.push(channelData);
                    }

                    workletNode.port.postMessage({ type: 'buffer', buffer: channelBuffers }); 
                }
            );

            this.rtAudio.start();
            window.dispatchEvent(new CustomEvent("refreshDevices"));

        } catch (error) {
        }
    }

    createStereoPair(splitter, ch1, ch2) {
        const merger = this.audioContext.createChannelMerger(2);
        splitter.connect(merger, ch1, 0);
        splitter.connect(merger, ch2, 1);
        const mediaStreamDestination = this.audioContext.createMediaStreamDestination();
        merger.connect(mediaStreamDestination);
        return mediaStreamDestination.stream;
    }
}

module.exports = audioCore;