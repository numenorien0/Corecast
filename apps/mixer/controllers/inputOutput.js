class inputOutputController {
    constructor(opt) {
        this.id = opt.id;
        this.config = this.getConfig();
        this.audioContext = window.sharedAudioContext;
        this.stream = null;
        this.tmp_volume = 1;
        this.pluginWindows = {};
        
        //init volume
        this.volumeNode = this.audioContext.createGain();

        //init aux send
        if (this.id !== "master" && !this.id.startsWith("audio_aux")) {

            this.volumeNode.connect(window.entryNode);

            if (!window.auxEntry) { window.auxEntry = {} }
            this.nbrAux = parseInt(window.config.audio.auxNumber);
            this.tmp_aux_send = {};
            this.auxIds = [];

            for (let i = 1; i <= this.nbrAux; i++) {
                this.tmp_aux_send[`audio_aux${i}`] = 0;
                this.auxIds.push(`audio_aux${i}`);
            }
            this.auxSends = {};
            this.auxIds.forEach(auxId => {
                if (!window.auxEntry[auxId]) {
                    window.auxEntry[auxId] = this.audioContext.createAnalyser();
                }
                this.auxSends[auxId] = this.audioContext.createGain();
                this.auxSends[auxId].gain.value = 0;
                this.auxSends[auxId].connect(window.auxEntry[auxId]);
            });
        }

        //init panner
        this.panner = this.audioContext.createStereoPanner();

        //init EQ
        this.eq;
        this.init_eq();

        //init compressor
        this.compressor;
        this.compressorOutput = this.audioContext.createMediaStreamDestination();
        this.init_compressor();
        
        //init delay
        this.delayNode = this.audioContext.createDelay(0.1); 
        
        //init noise gate
        this.audioContext.audioWorklet.addModule('worker/noise-gate-processor.js').then(() => {
            this.noiseGateNode = new AudioWorkletNode(this.audioContext, 'noise-gate-processor');
        
            if(this.config.eq_data) this.apply_eq(this.config.eq_data, false);
            if(this.config.compressor_data) this.apply_compressor(this.config.compressor_data, false);
            if(this.config.eq_bypass === undefined || this.config.eq_bypass === true) this.bypass_eq(true);
            if(this.config.compressor_bypass === undefined || this.config.compressor_bypass === true) this.bypass_compressor(true);
            if(this.config.noisegate_data) this.apply_noisegate(this.config.noisegate_data, false);
            if(this.config.noisegate_bypass === undefined || this.config.noisegate_bypass === true) this.bypass_noisegate(true);
            if(this.config.delais === undefined) this.config.delais = 0;
            this.apply_delay(this.config.delais, false);
            this.apply_pan(this.config.pan || 0);
            this.changeVolume(this.config.volume || 0, true);
            if(this.config.isMuted === undefined || this.config.isMuted === false) this.config.isMuted = false;
            if(this.config.isMuted == true) this.mute(this.volumeNode.gain);
			if(this.config.isSolo === undefined || this.config.isSolo === false) this.config.isSolo = false;
            this.init_solo();
            if(this.id != "master" && !this.id.startsWith("audio_aux")){
                this.auxIds.forEach(id => {
                    this.changeAuxVolume(id, this.config?.auxSends?.[id] ?? -60, true)
                })

                if(this.config.device && this.config.device != null) {
                    this.startStream(this.config.device)
                }
            }

            if (this.id === "master") {
                this.initMasterTrack();
            } else if (this.id.startsWith("audio_aux")) {
                this.initAuxTrack();
            }

            this.event();

        });
    }

    saveConfig() {
        const storedData = JSON.parse(localStorage.getItem("audio_conf")) || {};
        storedData[this.id] = this.config;
        localStorage.setItem("audio_conf", JSON.stringify(storedData));
    }

    getConfig() {
        const storedData = JSON.parse(localStorage.getItem("audio_conf")) || {};
        return storedData[this.id] || {};
    }

    getGlobalConfig(){
        const storedData = JSON.parse(localStorage.getItem("audio_conf")) || {};
        return storedData;
    }

    openPluginWindow(pluginType, title, width, height, content) {
        // Crée une clé unique à partir du type et d'un timestamp
        const uniqueKey = `${pluginType}_${new Date().getTime()}`;
        const win = window.open("", title, `width=${width},height=${height},resizable=no`);
        if (win) {
            win.document.write(content);
            win.document.close();

            this.pluginWindows[uniqueKey] = win;

            if(pluginType == "Compressor"){
                win.onload = () => {
                    window.dispatchEvent(new CustomEvent("compressor-stream-sent", {
                        detail: {
                            stream: this.compressorOutput.stream,
                            track: this.id
                        }
                    }));
                }

            }
        } else {
            console.error("Impossible d'ouvrir la fenêtre pour", pluginType);
        }
    }

    event(){

        window.addEventListener('refreshAudioTrack', (e) => {
            window.dispatchEvent(new CustomEvent("volumeChanged", {
                detail: {
                    track: this.id,
                    volume: this.config.volume
                }
            }));
            window.dispatchEvent(new CustomEvent("trackSoloed", {
                detail: {
                    track: this.id,
                    solo: this.config.isSolo
                }
            }));
            window.dispatchEvent(new CustomEvent("panChanged", {
                detail: {
                    track: this.id,
                    pan: this.config.pan
                }
            }));
            window.dispatchEvent(new CustomEvent("trackMuted", {
                detail: {
                    track: this.id,
                    muted: this.config.isMuted
                }
            }));
            if(this.auxIds){
                this.auxIds.forEach(id => {
                    window.dispatchEvent(new CustomEvent("auxVolumeChanged", {
                        detail: {
                            track: this.id,
                            auxId: id,
                            volume: this.config.auxSends[id]
                        }
                    }));
                })
            }
            window.dispatchEvent(new CustomEvent("delayChanged", {
                detail: {
                    track: this.id,
                    delay: this.config.delais
                }
            }));


        })

        window.addEventListener('eq-change', (e) => {
            if(e.detail.track == this.id){
                this.apply_eq(e.detail.eq, true);
                this.bypass_eq(false);
            }
        });

        window.addEventListener("noisegate-change", (e) => {
            if(e.detail.track == this.id){
                this.apply_noisegate(e.detail.noisegate, true);
                this.bypass_noisegate(false);
            }
        })

        window.addEventListener("compressor-change", (e) => {
            if(e.detail.track == this.id){
                this.apply_compressor(e.detail.compressor, true);
                this.bypass_compressor(false);
            }
        });

        window.addEventListener('init_solo', (e) => {
            this.init_solo();
        });

        window.addEventListener('changeAudioDevice', (e) => {
            if(e.detail.track == this.id){
                this.changeInput(e.detail.device);
            }
        });

		window.addEventListener("changeAudioOutputDevice", (e) => {
			if(e.detail.track == this.id){
				this.setOutput(e.detail.device);
			}
		});

		window.addEventListener("bypass_eq", (e) => {
			if(e.detail.track == this.id) this.bypass_eq(e.detail.state || !this.config.eq_bypass);
		})

		window.addEventListener("bypass_compressor", (e) => {
			if(e.detail.track == this.id) this.bypass_compressor(e.detail.state || !this.config.compressor_bypass);
		})

		window.addEventListener("bypass_noisegate", (e) => {
			if(e.detail.track == this.id) this.bypass_noisegate(e.detail.state || !this.config.noisegate_bypass);
		})

        window.addEventListener("openEq", (e) => {
            if (e.detail.track == this.id) {
                const contentEQ = `
                    <!DOCTYPE html>
                    <html lang="fr">
                    <head>
                        <meta charset="UTF-8">
                        <title>EQ - ${this.id}</title>
                        <link rel="stylesheet" href="css/style.css">
                    </head>
                    <body style="padding: 15px">
                        <eq-parametric filters='${JSON.stringify(this.config.eq_data)}' input_id='${this.id}'></eq-parametric>
                        <script type="module">
                        import EqParametric from "./apps/mixer/audio_plugins/eq.js";
                        if (!customElements.get("eq-parametric")) {
                            customElements.define("eq-parametric", EqParametric);
                        }
                        </script>
                    </body>
                    </html>`;
                this.openPluginWindow("EQ", "EQ - "+this.id, 930, 800, contentEQ);
            }
        });

        // Événement pour ouvrir l'interface NoiseGate
        window.addEventListener("openNoiseGate", (e) => {
            if (e.detail.track == this.id) {
                const contentNG = `
                    <!DOCTYPE html>
                    <html lang="fr">
                    <head>
                        <meta charset="UTF-8">
                        <title>Noise Gate - ${this.id}</title>
                        <link rel="stylesheet" href="css/style.css">
                    </head>
                    <body style="padding: 15px">
                        <audio-noisegate noisegate='${JSON.stringify(this.config.noisegate_data)}' input_id='${this.id}'></audio-noisegate>
                        <script type="module">
                        import AudioNoiseGate from "./apps/mixer/audio_plugins/audioNoiseGate.js";
                        import RotaryKnob from "./components/knob.js";
                        if (!customElements.get("audio-noisegate")) {
                            customElements.define("audio-noisegate", AudioNoiseGate);
                        }
                        if (!customElements.get("rotary-knob")) {
                            customElements.define("rotary-knob", RotaryKnob);
                        }
                        </script>
                    </body>
                    </html>`;
                this.openPluginWindow("NoiseGate", "Noise Gate - "+this.id, 530, 700, contentNG);
            }
        });

    // Événement pour ouvrir l'interface Compressor
        window.addEventListener("openCompressor", (e) => {
            if (e.detail.track == this.id) {
                const contentComp = `
                    <!DOCTYPE html>
                    <html lang="fr">
                    <head>
                        <meta charset="UTF-8">
                        <title>Compressor - ${this.id}</title>
                        <link rel="stylesheet" href="css/style.css">
                    </head>
                    <body style="padding: 15px">
                        <audio-compressor compressor='${JSON.stringify(this.config.compressor_data)}' input_id='${this.id}'></audio-compressor>
                        <script type="module">
                        import AudioCompressor from "./apps/mixer/audio_plugins/audioCompressor.js";
                        import RotaryKnob from "./components/knob.js";
                        if (!customElements.get("audio-compressor")) {
                            customElements.define("audio-compressor", AudioCompressor);
                        }
                        if (!customElements.get("rotary-knob")) {
                            customElements.define("rotary-knob", RotaryKnob);
                        }
                        </script>
                    </body>
                    </html>`;
                this.openPluginWindow("Compressor", "Compressor - "+this.id, 830, 560, contentComp);
            }
        });


        window.addEventListener('changeVolume', (e) => {
            if(e.detail.track == this.id){
                this.changeVolume(e.detail.volume);
            }
        });

        window.addEventListener('changeAuxSend', (e) => {
            if(e.detail.track == this.id){
                this.changeAuxVolume(e.detail.auxId, e.detail.volume, true);
            }
        });

        window.addEventListener('changePan', (e) => {
            if(e.detail.track == this.id){
                this.apply_pan(e.detail.pan);
            }
        });

        window.addEventListener('toggle_mute', (e) => {
            if(e.detail.track == this.id){
                this.toggle_mute(this.volumeNode.gain);
            }
        })

        window.addEventListener('toggle_solo', (e) => {
            if(e.detail.track == this.id){
                this.toggle_solo();
            }
        })

        window.addEventListener("changeDelay", (e) => {
            if(e.detail.track == this.id){
                this.apply_delay(e.detail.delay, true);
            }
        });

        window.addEventListener("addDelay", (e) => {
            if(e.detail.track == this.id){
                this.apply_delay(this.config.delais + 1, false);
            }
        });

        window.addEventListener("removeDelay", (e) => {
            if(e.detail.track == this.id){
                this.apply_delay(this.config.delais > 0 ? this.config.delais - 1 : 0, false);
            }
        });

    }

    setOutput(value){
        if(value){
            if(this.id === "master"){
                this.changeOutputDevice(value, this.masterAudioElement);
            }
            else{
                this.changeOutputDevice(value, this.auxAudioElement);
            }
        }
    }

    async startStream(deviceId) {
        var isMediaplayer = deviceId.startsWith("mediaplayer");
        var isChannels = deviceId.startsWith("inputMediaStream");
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (deviceId === "none") {
            return;
        }

        if (deviceId != "default" && !isMediaplayer && !isChannels) {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: { 
                    deviceId: { exact: deviceId },
                    video: false,
                    echoCancellation: false, autoGainControl: false, sampleSize: 16, channelCount: 2, latency: 0, noiseCancellation: false, sampleRate: 48000
                }
            });
            this.initInputTrack(this.stream);
        } else if (isMediaplayer) {
            let mediaplayer = parseInt(deviceId.split("-")[1]);
            const interval = setInterval(() => {
                if (window.mediaplayer && window.mediaplayer[mediaplayer]) {
                    this.stream = window.mediaplayer[mediaplayer].clone();
                    this.initInputTrack(this.stream);
                    clearInterval(interval);
                }
            }, 100);
        } else if (isChannels) {
            let channel = deviceId.split("-")[1];

            if(!channel.includes("+")){
                const interval = setInterval(() => {
                    if(window.inputMediaStream && window.inputMediaStream[parseInt(channel)]){
                        this.stream = window.inputMediaStream[parseInt(channel)].clone();
                        this.initInputTrack(this.stream, true);
                        clearInterval(interval);
                    }
                }, 100)
            }
            else{
                const interval = setInterval(() => {
                    if(window.inputMediaStream && window.inputMediaStreamPairs[channel]){
                        this.stream = window.inputMediaStreamPairs[channel].clone();
                        this.initInputTrack(this.stream);
                        clearInterval(interval);

                    }
                }, 100)
            }
        }

        window.dispatchEvent(new CustomEvent("audioInputChanged", {
            detail: {
                track: this.id,
                device: deviceId
            }
        }));
    }

    initInputTrack(stream, merge = false){
        this.stream = stream;
        this.audioSource = this.audioContext.createMediaStreamSource(this.stream);
        if(merge === true){
            const splitter = this.audioContext.createChannelSplitter(2);
            this.audioSource.connect(splitter);
            const merger = this.audioContext.createChannelMerger(1);
            splitter.connect(merger, 0, 0);
            splitter.connect(merger, 1, 0);
            this.audioSource = merger;
        }

        this.audioSource.connect(this.noiseGateNode);
        this.noiseGateNode.connect(this.compressor);
        this.compressor.connect(this.compressorGain);
        this.compressorGain.connect(this.eq["low"]);
        this.eq["low"].connect(this.eq["mid-low"]);
        this.eq["mid-low"].connect(this.eq["mid"]);
        this.eq["mid"].connect(this.eq["mid-high"]);
        this.eq["mid-high"].connect(this.eq["high"]);
        this.eq["high"].connect(this.delayNode);
        this.delayNode.connect(this.panner);

        if (this.auxSends) {
            for (const auxId in this.auxSends) {
                this.panner.connect(this.auxSends[auxId]);
            }
        }
        this.panner.connect(this.volumeNode);
        this.destination = this.audioContext.createMediaStreamDestination();
        this.volumeNode.connect(this.destination); 

        const audioStream = this.destination.stream;
        window.inputAudio[this.id] = audioStream;


        const channelCount = merge ? 1 : this.stream.getAudioTracks()[0].getSettings().channelCount;
        window.dispatchEvent(new CustomEvent("setVisualiser", { 
            detail: {
                stream: audioStream,
                channelCount: channelCount,
                track: this.id
            }
        }));
    }
  
    initMasterTrack() {
        window.outputAudio[this.id] = this.audioContext.createMediaStreamDestination();

        window.entryNode.disconnect();
        window.entryNode.connect(this.noiseGateNode);
        this.noiseGateNode.connect(this.compressor);
        this.compressor.connect(this.compressorGain);
        this.compressorGain.connect(this.eq["mid-low"]);
        this.eq["low"].connect(this.eq["mid-low"]);
        this.eq["mid-low"].connect(this.eq["mid"]);
        this.eq["mid"].connect(this.eq["mid-high"]);
        this.eq["mid-high"].connect(this.eq["high"]);
        this.eq["high"].connect(this.panner);
        this.panner.connect(this.volumeNode);
        this.volumeNode.connect(window.outputAudio[this.id]);
        this.masterAudioElement = new Audio();
        this.masterAudioElement.srcObject = window.outputAudio[this.id].stream;
        this.masterAudioElement.autoplay = true;
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent("setVisualiser", { 
                detail: {
                    stream: window.outputAudio[this.id].stream,
                    channelCount: 2,
                    track: this.id
                }
            }));
        }, 500);

        this.setOutput(this.config.device)
    }

    initAuxTrack() {

        this.auxDestination = this.audioContext.createMediaStreamDestination();
        window.auxEntry[this.id].disconnect(); 

        window.auxEntry[this.id].connect(this.noiseGateNode);
        this.noiseGateNode.connect(this.compressor);
        this.compressor.connect(this.compressorGain);
        this.compressorGain.connect(this.eq["mid-low"]);
        this.eq["low"].connect(this.eq["mid-low"]);
        this.eq["mid-low"].connect(this.eq["mid"]);
        this.eq["mid"].connect(this.eq["mid-high"]);
        this.eq["mid-high"].connect(this.eq["high"]);
        this.eq["high"].connect(this.panner);
        this.panner.connect(this.volumeNode);
        this.volumeNode.connect(this.auxDestination);
        window.outputAudio[this.id] = this.auxDestination;
        this.auxAudioElement = new Audio();
        this.auxAudioElement.srcObject = this.auxDestination.stream;
        this.auxAudioElement.autoplay = true;

        const audioStream = this.auxDestination.stream;
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent("setVisualiser", { 
                detail: {
                    stream: audioStream,
                    channelCount: 2,
                    track: this.id
                }
            }));
        }, 500)

        this.setOutput(this.config.device)

    }

    apply_eq(eq_data, save = false){

        const eqBands = ["low", "mid-low", "mid", "mid-high", "high"];
        eq_data.forEach((filterData, index) => {
        const bandName = eqBands[index];
        if (this.eq[bandName]) {
            this.eq[bandName].type = filterData.type === "none" ? "peaking" : filterData.type;
            this.eq[bandName].frequency.value = filterData.type === "none" ? 1000 : filterData.frequency;
            this.eq[bandName].gain.value = filterData.type === "none" ? 0 : filterData.gain;
            this.eq[bandName].Q.value = filterData.type === "none" ? 1 : filterData.Q;
        }
        });

		if(save){
			this.config.eq_data = eq_data;
		}
        this.saveConfig();
    }

	apply_compressor(compressor_data, save = false){
        this.compressor.threshold.value = compressor_data.threshold 
        this.compressor.knee.value = compressor_data.knee; 
        this.compressor.ratio.value = compressor_data.ratio; 
        this.compressor.attack.value = compressor_data.attack;
        this.compressor.release.value = compressor_data.release;
        const dB = parseFloat(compressor_data.gain);
        const linearGain = Math.pow(10, dB / 20);
        this.compressorGain.gain.value = linearGain.toFixed(2);
		if(save){
			this.config.compressor_data = compressor_data;
		}
        this.saveConfig();
    }

    apply_noisegate(noisegate_data, save = false){
		
        this.noiseGateNode.parameters.get('threshold').value = noisegate_data.threshold;
        this.noiseGateNode.parameters.get('attack').value = noisegate_data.attack;
        this.noiseGateNode.parameters.get('reduction').value =  noisegate_data.reduction;
        this.noiseGateNode.parameters.get('release').value = noisegate_data.release;
		if(save){
			this.config.noisegate_data = noisegate_data;
		}
        this.saveConfig();
		
    }

    bypass_noisegate(enable = false){
        this.config.noisegate_bypass = enable;
        if (enable) {
            this.noiseGateNode.parameters.get('threshold').value = 0;
            this.noiseGateNode.parameters.get('reduction').value =  0;
            this.noiseGateNode.parameters.get('attack').value =  0.01;
            this.noiseGateNode.parameters.get('release').value =  0.1;
        } else {
            if(this.config.noisegate_data){
				this.apply_noisegate(this.config.noisegate_data, false);
            }
            
        }
        this.saveConfig();
		window.dispatchEvent(new CustomEvent("noisegate_bypassed", {
			detail: {
				state: this.config.noisegate_bypass, 
				track: this.id
			}
		}));
    }

    bypass_eq(enable = false) {
        this.config.eq_bypass = enable;
        if (enable) {
            const eqBands = ["low", "mid-low", "mid", "mid-high", "high"];

            eqBands.forEach((filterData, index) => {
                const bandName = eqBands[index]; 
                if (this.eq[bandName]) {
                    this.eq[bandName].type = "peaking" 
                    this.eq[bandName].frequency.value = 1000
                    this.eq[bandName].gain.value = 0
                    this.eq[bandName].Q.value = 1
                }
            });
        } else {
            if(this.config.eq_data){
                this.apply_eq(this.config.eq_data, false);
            }
        }
        this.saveConfig();
		window.dispatchEvent(new CustomEvent("eq_bypassed", {
			detail: {
				state: this.config.eq_bypass, 
				track: this.id
			}
		}));
    }

	bypass_compressor(enable = false){
        this.config.compressor_bypass = enable;
        if (enable) {
            this.compressor.threshold.value = -24; // dB
            this.compressor.knee.value = 30; // dB
            this.compressor.ratio.value = 1; // compression ratio
            this.compressor.attack.value = 0.003; // seconds
            this.compressor.release.value = 0.25; // seconds
            this.compressorGain.gain.value = 1;
        } else {
            if(this.config.compressor_data){
				this.apply_compressor(this.config.compressor_data, false);
            }
            
        }
        this.saveConfig();
		window.dispatchEvent(new CustomEvent("compressor_bypassed", {
			detail: {
				state: this.config.compressor_bypass, 
				track: this.id
			}
		}));
    }

    init_compressor(){
        this.compressorGain = this.audioContext.createGain();
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;
        this.compressorGain.gain.value = 1;

        this.compressor.connect(this.compressorOutput)

    }

    init_eq() {
        const eqBands = {
        low: 100, "mid-low": 250, mid: 1000, "mid-high": 3500, high: 10000
        };

        this.eq = {}; 

        for (const [band, freq] of Object.entries(eqBands)) {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = "peaking";  
            filter.frequency.value = freq; 
            filter.Q.value = 1; 
            filter.gain.value = 0;
            this.eq[band] = filter; 
        }
    }

    init_solo(){
        window.dispatchEvent(new CustomEvent("trackSoloed", {
            detail: {
                track: this.id,
                solo: this.config.isSolo ? true : false
            }
        }));  
        if (this.id !== "master" && !this.id.startsWith("audio_aux")) {
            if(this.isThereASoloTrack()){
                if(this.config.isSolo){
                    this.config.mutedBeforeSolo = this.config.isMuted; 
                    if(this.config.isMuted){
                        this.unmute(this.volumeNode.gain);
                        this.config.isMuted = false;
                    }
                }
                else {
                    if(this.config.mutedBeforeSolo === undefined){
                        this.config.mutedBeforeSolo = this.config.isMuted; 
                    }
                    if(this.config.isMuted == false){
                        this.mute(this.volumeNode.gain);
                    }

                }
            }
            else {
                if(this.hasOwnProperty("config") && this.config.hasOwnProperty("mutedBeforeSolo")){
                    if(this.config.mutedBeforeSolo === false){
                        if(this.config.isMuted){
                            this.unmute(this.volumeNode.gain);
                        }
                    } else {
                        if(this.config.isMuted == false){
                            this.mute(this.volumeNode.gain);
                        }
                    }
                    delete this.config.mutedBeforeSolo;
                }
            }
        }
    }

    apply_delay(value, save = false){
        this.delayNode.delayTime.value = value / 1000;
		this.config.delais = value;
        this.saveConfig();
        window.dispatchEvent(new CustomEvent("delayChanged", {
            detail: {
                track: this.id,
                delay: this.config.delais
            }
        }));
    }

    apply_pan(value){
        this.panner.pan.value = parseFloat(value);
        this.config.pan = parseFloat(value);
        this.saveConfig();
        window.dispatchEvent(new CustomEvent("panChanged", {
            detail: {
                track: this.id,
                pan: value
            }
        }));
    }

    isThereASoloTrack(){
        const config = this.getGlobalConfig();
        return Object.values(config).some(trackConfig => trackConfig.isSolo === true);
    }

    set_solo(){
        this.config.isSolo = true;
        this.saveConfig();
        this.init_solo();
        window.dispatchEvent(new CustomEvent("init_solo", {
            detail: {}
        }))
    }

    unset_solo(){
        this.config.isSolo = false;
        this.saveConfig();

        window.dispatchEvent(new CustomEvent("init_solo", {
            detail: {}
        }))
    }

    toggle_solo(){
        if (this.config.isSolo) {
            this.unset_solo();
        } else {
            this.set_solo();
        }
    }

    mute(node = this.volumeNode.gain) {
        if(1/*node.value != 0*/){
            this.tmp_volume = node.value;
        }
        node.value = 0;

        if (this.auxSends) {
            this.auxIds.forEach(id => {
                this.tmp_aux_send[id] = this.auxSends[id].gain.value;
                this.auxSends[id].gain.value = 0;
            });
        }
        this.config.isMuted = true;
        window.dispatchEvent(new CustomEvent("trackMuted", {
            detail: {
                track: this.id,
                muted: true
            }
        }));
    }

    unmute(node = this.volumeNode.gain) {
        node.value = this.tmp_volume;
        if (this.auxSends) {
            this.auxIds.forEach(id => {
                this.auxSends[id].gain.value = this.tmp_aux_send[id];
            });
        }
        this.config.isMuted = false;
        window.dispatchEvent(new CustomEvent("trackMuted", {
            detail: {
                track: this.id,
                muted: false
            }
        }));    
    }

    toggle_mute(node = this.volumeNode.gain) {
        if(!this.isThereASoloTrack()){
            if (this.config.isMuted) {
                this.unmute(node);
            } else {
                this.mute(node);
            }
            this.saveConfig();
        }
    }

    changeAuxVolume(auxId, value, force = false){
        const dB = parseFloat(value);
        const linearGain = Math.pow(10, dB / 20).toFixed(2);
        if (this.auxSends && this.auxSends[auxId]) {
            if(this.config.isMuted == false || force){
                this.auxSends[auxId].gain.value = linearGain;
            }
            else{
                this.tmp_aux_send[auxId] = linearGain;
            }
        }        
        if(!this.config.auxSends) this.config.auxSends = {}
        this.config.auxSends[auxId] = value;
        this.saveConfig();
        window.dispatchEvent(new CustomEvent("auxVolumeChanged", {
            detail: {
                track: this.id,
                auxId: auxId,
                volume: value
            }
        }));
    }

    changeVolume(value, force = false) {
        const dB = parseFloat(value);
        const linearGain = Math.pow(10, dB / 20);
        if(this.config.isMuted == false || force){
            this.volumeNode.gain.value = linearGain.toFixed(2);
        }
        else{
            this.tmp_volume = linearGain.toFixed(2);
        }
        this.config.volume = parseFloat(value);
        this.saveConfig();
        window.dispatchEvent(new CustomEvent("volumeChanged", {
            detail: {
                track: this.id,
                volume: value
            }
        }));
    }

    changeInput(value) {
        this.startStream(value); 
        this.config.device = value;
        this.saveConfig();
        
    }

    changeOutputDevice(deviceId, audioElement){
        if (audioElement && typeof audioElement.setSinkId === 'function') {
            audioElement.setSinkId(deviceId).then(() => {
                this.config.device = deviceId;
                this.saveConfig();
				window.dispatchEvent(new CustomEvent("audioOutputChanged", {
					detail: {
						track: this.id,
						device: deviceId
					}
				}));
            }).catch(err => console.error("Error setting master output device:", err));
        }
    }
}

module.exports = inputOutputController;