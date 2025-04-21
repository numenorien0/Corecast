const { translation } = require('./local/local.js')
const { ipcRenderer } = require('electron');

export default class recordButtons extends HTMLElement {
    
    constructor() {
        super()
    }

    startStreaming(){
        this.startCanvasStreaming(window.output.master, 'stream', {
            output: window.config.output.streaming.destination,
            format: window.config.output.streaming.format,
            codec: window.config.output.streaming.encoder,
            bitrate: window.config.output.streaming.bitrate + 'k',
            fps: window.config.output.streaming.framerate,
            sampleRate: window.config.audio.sampleRate || 44100
        }, "2");
        window.dispatchEvent(new CustomEvent('streaming-started', { detail: { state: "started", id: '2' } }))
    }

    stopStreaming(){
        this.setFinishingState({ id: "2" })
        this.stopCanvasStreaming("2");
        window.dispatchEvent(new CustomEvent('streaming-started', { detail: { state: "stopped", id: '2' } }))
    }

    startRecording(){
        this.startCanvasStreaming(window.output.master, 'record', {
            output: window.config.output.recording.destination + '/' + window.config.output.recording.fileName + '.' + window.config.output.recording.format,
            format: window.config.output.recording.format,
            codec: window.config.output.recording.encoder,
            bitrate: window.config.output.recording.bitrate + 'k',
            fps: window.config.output.recording.framerate,
            sampleRate: window.config.audio.sampleRate || 44100
        }, "1")
        window.dispatchEvent(new CustomEvent('recording-started', { detail: { state: "started", id: '1' } }))
    }

    stopRecording(){
        this.setFinishingState({ id: "1" })
        this.stopCanvasStreaming("1");
        window.dispatchEvent(new CustomEvent('recording-started', { detail: { state: "stopped", id: '1' } }))
    }

    startIsoRecording(){
        Object.entries(window.input).forEach(camera => {
            this.startCanvasStreaming(camera[1], 'record', {
                output: window.config.output.recording_iso.destination + '/' + window.config.output.recording_iso.fileName + '_' + camera[0] + '.' + window.config.output.recording_iso.format,
                format: window.config.output.recording_iso.format,
                codec: window.config.output.recording_iso.encoder,
                bitrate: window.config.output.recording_iso.bitrate + 'k',
                fps: window.config.output.recording_iso.framerate,
                sampleRate: window.config.audio.sampleRate || 44100
            }, camera[0])
        })
        window.dispatchEvent(new CustomEvent('recording-iso-started', { detail: { state: "started", id: 'cameraStop' } }))
    }

    stopIsoRecording(){
        this.setFinishingState({ id: 'cameraStop' })
        Object.entries(window.input).forEach(camera => {
            this.stopCanvasStreaming(camera[0])
        })
        window.dispatchEvent(new CustomEvent('recording-iso-started', { detail: { state: "stopped", id: 'cameraStop' } }))
    }

    convertKValue(value) {
        if (typeof value === 'string') {
            value = value.trim()
            if (value.toLowerCase().endsWith('k')) {
                const numericPart = parseFloat(value.slice(0, -1))
                return numericPart * 1000
            }
        }
        return Number(value)
    }


    async startCanvasStreaming(stream, mode, config, id) {
        const combinedStream = new MediaStream()
        stream.getTracks().forEach(track => combinedStream.addTrack(track))
        window.outputAudio.master.stream.getTracks().forEach(track => combinedStream.addTrack(track))
        ipcRenderer.send('start-streaming', { info: 'Démarrage du stream', mode, config, id })
        window.mediaRecorder[id] = new MediaRecorder(combinedStream, {
            mimeType: 'video/mp4',
            audioBitsPerSecond: 256000,
            videoBitsPerSecond: this.convertKValue(config.bitrate) || 6000000
        })
        window.mediaRecorder[id].ondataavailable = async event => {
            if (event.data.size > 0) {
                const arrayBuffer = await event.data.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                ipcRenderer.send('stream-data', { data: buffer, id })
            }
        }
        window.mediaRecorder[id].start(2000)
        window.dispatchEvent(new CustomEvent('start-timer'))
    }

    stopCanvasStreaming(id) {
        if (window.mediaRecorder[id]) {
            window.mediaRecorder[id].onstop = () => {
                ipcRenderer.send('stop-streaming', { id })
                delete window.mediaRecorder[id]
                
            }
            window.mediaRecorder[id].stop()
        }
        window.dispatchEvent(new CustomEvent('stop-recording'))
    }

    getButton(dataId) {
        return dataId.startsWith('camera')
            ? document.querySelector('#startIsoRecordingButton')
            : document.querySelector(`.triggerRecButton[data-id="${dataId}"]`)
    }

    updateStreamIcon(btn, icon, extraClass = '') {
        const streamIconEl = btn.querySelector('.streamIcon')
        const newHtml = `<i class="${icon} ${extraClass}"></i>`
        if (streamIconEl.innerHTML !== newHtml) {
            streamIconEl.innerHTML = newHtml
        }
    }

    updateStreamContent(data, contentSelector) {
        const btn = this.getButton(data.id)
        if (btn.getAttribute('status') === 'active' || btn.getAttribute('status') === 'loading') {
            if (!data.id.startsWith('camera')) {
                const contentEl = btn.querySelector(contentSelector)
                const newValue = `${data.value}`
                if (contentEl.innerHTML !== newValue) {
                    contentEl.innerHTML = newValue
                }
            }
            btn.setAttribute('status', 'active')
            const icon = btn.getAttribute('icon')
            this.updateStreamIcon(btn, icon, 'bx-flashing')
        }
    }

    setLoadingState(data) {
        const btn = this.getButton(data.id)
        btn.setAttribute('status', 'loading')
        this.updateStreamIcon(btn, 'bx-loader-alt', 'bx-spin')
    }

    setFinishingState(data) {
        const btn = this.getButton(data.id)
        btn.setAttribute('status', 'finishing')
        this.updateStreamIcon(btn, 'bx-loader-alt', 'bx-spin')
    }

    setFinishedState(data) {
        const btn = this.getButton(data.id)
        btn.setAttribute('status', 'nonactive')
        const icon = btn.getAttribute('icon')
        this.updateStreamIcon(btn, icon)
    }

    toggle_stream(){
        const startStreamButton = this.querySelector('#startStreamButton');
        console.log("toggle_stream")
        if (startStreamButton.getAttribute('status') === 'nonactive') {
            this.startStreaming();
        } else if (startStreamButton.getAttribute('status') === 'active') {
            this.stopStreaming();
        }
    }

    toggle_recording(){
        const startRecordingButton = this.querySelector('#startRecordingButton')
        if (startRecordingButton.getAttribute('status') === 'nonactive') {
            this.startRecording()
        } else if (startRecordingButton.getAttribute('status') === 'active') {
            this.stopRecording();
        }
    }

    toggle_recording_iso(){
        const startIsoRecordingButton = this.querySelector('#startIsoRecordingButton')
        if (startIsoRecordingButton.getAttribute('status') === 'nonactive') {
            this.startIsoRecording();
        } else if (startIsoRecordingButton.getAttribute('status') === 'active') {
            this.stopIsoRecording();
        }
    }

    connectedCallback() {
        this.render()
        window.mediaRecorder = []

        const startStreamButton = this.querySelector('#startStreamButton')
        const startIsoRecordingButton = this.querySelector('#startIsoRecordingButton')
        const startRecordingButton = this.querySelector('#startRecordingButton')

        startStreamButton.addEventListener('click', e => {
            if (e.target.getAttribute('status') === 'nonactive') {
                this.startStreaming();
            } else if (e.target.getAttribute('status') === 'active') {
                this.stopStreaming();
            }
        })

        startIsoRecordingButton.addEventListener('click', e => {
            if (e.target.getAttribute('status') === 'nonactive') {
                this.startIsoRecording();
            } else if (e.target.getAttribute('status') === 'active') {
                this.stopIsoRecording();
            }
        })

        startRecordingButton.addEventListener('click', e => {
            if (e.target.getAttribute('status') === 'nonactive') {
                this.startRecording()
            } else if (e.target.getAttribute('status') === 'active') {
                this.stopRecording();
            }
        })

        ipcRenderer.on('stream_fps', (event, data) => {
            this.updateStreamContent(data, '.fps')
        })

        ipcRenderer.on('stream_bitrate', (event, data) => {
            this.updateStreamContent(data, '.bitrate')
        })

        ipcRenderer.on('stream_started', (event, data) => {
            this.setLoadingState(data)
        })

        ipcRenderer.on('stream_finished', (event, data) => {
            this.setFinishedState(data)
        })

        ipcRenderer.on('stream_error', (event, data) => {
            this.setFinishedState(data)
        });

        window.addEventListener("beforeunload", (event) => {
            ipcRenderer.send('set-app-switch', { switchName: 'js-flags', value: '--expose_gc --max-old-space-size=128' });
            document.querySelector("#loader").style.display = "flex";

            for (const key in window.mediaRecorder) {
                if (window.mediaRecorder[key]) {
                    this.stopCanvasStreaming(key);
                }
            }
            ipcRenderer.send('stop-streaming-all', { info: "Arrêt de tous les streams" });

            for (const key in window.inputMediaStream) {
                window.inputMediaStream[key].getTracks().forEach(track => track.stop());
            }

            for (const key in window.inputMediaStreamPairs) {
                window.inputMediaStreamPairs[key].getTracks().forEach(track => track.stop());
            }
        });
    }

  render() {
    this.innerHTML = `
        <button id="startStreamButton" status="nonactive" icon="bx bx-broadcast" class="triggerRecButton" data-id="2">
            <div class="recordButtonInner">
                <div class="streamIcon"><i class="bx bx-broadcast"></i></div>
                <div class="streamLabel">
                    <div class="streamTitle">${translation[window.config.general.language].streamLabel}</div>
                    <div class="stream-detail">
                        <span class="fps"></span>
                        <span class="bitrate"></span>
                    </div>
                </div>
            </div>
        </button>
        <button id="startRecordingButton" status="nonactive" icon="bx bxs-circle" class="triggerRecButton" data-id="1">
            <div class="recordButtonInner">
                <div class="streamIcon"><i class="bx bxs-circle"></i></div>
                <div class="streamLabel">
                    <div class="streamTitle">${translation[window.config.general.language].recordLabel}</div>
                        <div class="stream-detail">
                            <span class="fps"></span>
                            <span class="bitrate"></span>
                        </div>
                    </div>
                </div>
            </div>
        </button>
        <button id="startIsoRecordingButton" status="nonactive" icon="bx bxs-layer" class="triggerRecButton" data-id="3">
            <div class="recordButtonInner">
                <div class="streamIcon"><i class="bx bxs-layer"></i></div>
                <div class="streamLabel">
                    <div class="streamTitle">${translation[window.config.general.language].record_isoLabel}</div>
                    <div class="stream-detail">
                        <span class="fps"></span>
                        <span class="bitrate"></span>
                    </div>
                </div>
            </div>
        </button>
    `
  }
}
