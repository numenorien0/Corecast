const { translation } = require('./local/local.js');
export default class AudioTrack extends HTMLElement {

    constructor() {
        super();
        this.visualizer = this.querySelector("audio-visualizer");
        this.label = this.getAttribute('label');
        this.nbrAux = parseInt(window.config.audio.auxNumber);
        this.auxIds = [];
        if (this.id !== "master" && !this.id.startsWith("audio_aux")) {
            for (let i = 1; i <= this.nbrAux; i++) {
                this.auxIds.push(`audio_aux${i}`);
            }
        }
        this.render();
        if (this.id !== "master" && !this.id.startsWith("audio_aux")) {
            this.populateDeviceList();
        }
        else{
            this.populateOutputDeviceList();
        }

        this.event();

    }

    async populateDeviceList() {
        const deviceSelect = this.querySelector('.deviceSelect');

        deviceSelect.innerHTML = `<option value="none">${translation[window.config.general.language].none}</option>`;
        const monoGroup = document.createElement('optgroup');
        monoGroup.label = "Canaux Mono (AudioCore)";

        Object.keys(window.inputMediaStream).forEach((key) => {
            const option = document.createElement('option');
            option.value = `inputMediaStream-${key}`;

            option.textContent = `Canal ${key}`;
            monoGroup.appendChild(option);
        });

        if (monoGroup.children.length > 0) {
            deviceSelect.appendChild(monoGroup);
        }

        const stereoGroup = document.createElement('optgroup');
        stereoGroup.label = "Paires Stéréo (AudioCore)";

        Object.keys(window.inputMediaStreamPairs).forEach((key) => {
            const option = document.createElement('option');
            option.value = `inputMediaStreamPairs-${key}`;

            option.textContent = `Piste ${key}`;
            stereoGroup.appendChild(option);
        });

        if (stereoGroup.children.length > 0) {
            deviceSelect.appendChild(stereoGroup);
        }

        const hr = document.createElement('hr');
        deviceSelect.appendChild(hr);

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === 'audioinput' && device.deviceId != "default");

        audioDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${deviceSelect.length + 1}`;
            deviceSelect.appendChild(option);
        });

        const hr2 = document.createElement('hr');
        deviceSelect.appendChild(hr2);

        let option = document.createElement('option');
        option.value = `mediaplayer-1`;
        option.textContent = `Mediaplayer #1`;
        deviceSelect.appendChild(option);

        option = document.createElement('option');
        option.value = `mediaplayer-2`;
        option.textContent = `Mediaplayer #2`;
        deviceSelect.appendChild(option);
    }

    populateOutputDeviceList() {
        const outputSelect = this.querySelector('.deviceOutputSelect');
        navigator.mediaDevices.enumerateDevices().then(devices => {
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
            outputSelect.innerHTML = '';
            audioOutputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Speaker ${outputSelect.length + 1}`;
                outputSelect.appendChild(option);
            });
        });
    }

    event(){

        window.addEventListener("refreshDevices", async (e) => {
            if (this.id !== "master" && !this.id.startsWith("audio_aux")) {
                this.populateDeviceList();
            }
            else{
                this.populateOutputDeviceList(); 
            }
        })

        window.addEventListener("volumeChanged", (e) => {
            if(e.detail.track == this.id){
                this.querySelector(".input_volume").value = e.detail.volume;
                this.querySelector(".volume").value = e.detail.volume;
            }
        });

        window.addEventListener('trackMuted', (e) => {
            if (e.detail.track == this.id) {
                this.querySelector('.mute').classList.toggle('muted', e.detail.muted);
            }
        });

        window.addEventListener('trackSoloed', (e) => {
            if (e.detail.track == this.id) {
                this.querySelector('.solo').classList.toggle('active', e.detail.solo);
            }
        });

        window.addEventListener("panChanged", (e) => {
            if(e.detail.track == this.id){
                this.querySelector(".pan").value = e.detail.pan;
            }
        })

        window.addEventListener('auxVolumeChanged', (e) => {
            if (e.detail.track == this.id) {
                const auxSend = this.querySelector(`.auxSend[data-aux="${e.detail.auxId}"]`);
                if (auxSend) {
                    auxSend.value = e.detail.volume;
                }
            }
        });

        window.addEventListener("audioInputChanged", (e) => {
            if(e.detail.track == this.id){
                this.querySelector(".deviceSelect").value = e.detail.device;
            }
        });

		window.addEventListener("audioOutputChanged", (e) => {
			if(e.detail.track == this.id){
				this.querySelector(".deviceOutputSelect").value = e.detail.device;
			}
		});

        window.addEventListener("delayChanged", (e) => {
            if(e.detail.track == this.id){
                this.querySelector("#delais").value = e.detail.delay;
            }
        });

		window.addEventListener("eq_bypassed", (e) => {
			if(e.detail.track == this.id){
				this.querySelector(".eq_button_launch").setAttribute('status', e.detail.state == false ? "active" : "inactive");
			}
		});

		window.addEventListener("compressor_bypassed", (e) => {
			if(e.detail.track == this.id){
				this.querySelector(".comp_button_launch").setAttribute('status', e.detail.state == false ? "active" : "inactive");
			}
		});

		window.addEventListener("noisegate_bypassed", (e) => {
			if(e.detail.track == this.id){
				this.querySelector(".noisegate_button_launch").setAttribute('status', e.detail.state == false ? "active" : "inactive");
			}
		});

        this.querySelector("#delais").addEventListener("change", (e) => {
            window.dispatchEvent(new CustomEvent("changeDelay", {
                detail: {
                    delay: e.target.value,
                    track: this.id
                }
            }));
        });

        this.querySelector(".reduce_delay").addEventListener("click", (e) => {
            window.dispatchEvent(new CustomEvent("removeDelay", {
                detail: {
                    track: this.id
                }
            }));
        })

        this.querySelector(".add_delay").addEventListener("click", (e) => {
            window.dispatchEvent(new CustomEvent("addDelay", {
                detail: {
                    track: this.id
                }
            }));
        })

        this.querySelector(".bypassEQ").addEventListener("click", (e) => {
            window.dispatchEvent(new CustomEvent("bypass_eq", { 
				detail: {
					track: this.id
				}
			}));
        })

        this.querySelector(".bypassNoisegate").addEventListener("click", (e) => {
            window.dispatchEvent(new CustomEvent("bypass_noisegate", { 
				detail: {
					track: this.id
				}
			}));
        })

        this.querySelector(".bypassCompressor").addEventListener("click", (e) => {
            window.dispatchEvent(new CustomEvent("bypass_compressor", { 
				detail: {
					track: this.id
				}
			}));
        })
        

        this.querySelector(".eq_button_launch")?.addEventListener("click", (e) => {   
           	window.dispatchEvent(new CustomEvent("openEq", {
                detail: {
                    track: this.id
                }
            }));

        })

        this.querySelector(".noisegate_button_launch")?.addEventListener("click", (e) => {   

            window.dispatchEvent(new CustomEvent("openNoiseGate", {
                detail: {
                    track: this.id
                }
            }));     
        })

        this.querySelector(".comp_button_launch")?.addEventListener("click", (e) => {
            window.dispatchEvent(new CustomEvent("openCompressor", {
                detail: {
                    track: this.id
                }
            }));
        })

        this.querySelectorAll('.auxSend').forEach(el => {
            el.addEventListener('input', (e) => {
                const auxId = el.getAttribute('data-aux');
                window.dispatchEvent(new CustomEvent("changeAuxSend", {
                    detail: {
                        auxId: auxId,
                        track: this.id,
                        volume: parseFloat(e.target.value)
                    }
                }))

            });
        });

        this.querySelector('.mute').addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent("toggle_mute", {
                detail: {
                    track: this.id
                }
            }));
        });

        this.querySelector('.solo').addEventListener('click', (e) => {
            window.dispatchEvent(new CustomEvent("toggle_solo", {
                detail: {
                    track: this.id
                }
            }));
        })

        this.querySelector(".pan")?.addEventListener("input", (e) => {
            window.dispatchEvent(new CustomEvent("changePan", {
                detail: {
                    pan: parseFloat(e.target.value),
                    track: this.id
                }
            }));
        })

        this.querySelector(".input_volume").addEventListener("change", (e) => {
            
            window.dispatchEvent(new CustomEvent("changeVolume", {
                detail: {
                    volume: e.target.value,
                    track: this.id
                }
            }));
        })

        this.querySelector('.volume').addEventListener('input', (e) => {
            window.dispatchEvent(new CustomEvent("changeVolume", {
                detail: {
                    volume: e.target.value,
                    track: this.id
                }
            }));
        });

        this.querySelector('.volume').addEventListener('dblclick', (e) => {
            window.dispatchEvent(new CustomEvent("changeVolume", {
                detail: {
                    volume: 0,
                    track: this.id
                }
            }));
        })

        this.querySelector('.deviceSelect')?.addEventListener('change', (e) => {
            window.dispatchEvent(new CustomEvent("changeAudioDevice", {
                detail: {
                    device: e.target.value,
                    track: this.id
                }
            }));
        });

        this.querySelector('.deviceOutputSelect')?.addEventListener('change', (e) => {
            window.dispatchEvent(new CustomEvent("changeAudioOutputDevice", {
				detail: {
					device: e.target.value,
					track: this.id
				}
			}));
        });
    }

    render() {
        this.dbScale = `
            <div class="dbScale">
                ${[12, 0, -12, -24, -36, -48, -60].map((db, i) => `<div class="dbValue" style="top: ${(i / 6) * 100}%">${db} dB</div>`).join('')}
            </div>`;

        const isMaster = this.id === "master";
        const isAux = this.id.startsWith("audio_aux");
        const auxSendView = `
        
        ${!isMaster && !isAux ? this.auxIds.map(auxId => `
            <div class='row-aux'>
                <label>${auxId.replace("audio_aux", "Aux ")}</label>
                <rotary-knob class="auxSend" width="30" height="30" data-aux="${auxId}" type="range" min="-60" max="12" step="0.1" value="-60"></rotary-knob>
            </div>`).join("") : ""}
        `;

        const panController = `
            <input type="range" class='pan' value="0" step="0.1" min="-1" max="1"/>
            <div class='pan_value'></div>
        `;

        const getCommonHTML = () => `
            <div class='effects'>
                <div class='plugin'><button class='bypass bypassNoisegate'><i class='bx bx-power-off' ></i></button><button status='active' class='button_plugin noisegate_button_launch'>${translation[window.config.general.language].noiseGate}</button></div>    
                <div class='plugin'><button class='bypass bypassCompressor'><i class='bx bx-power-off' ></i></button><button status="active" class='comp_button_launch button_plugin'>${translation[window.config.general.language].compressor}</button></div>
                <div class='plugin'><button class='bypass bypassEQ'><i class='bx bx-power-off' ></i></button><button status="active" class='eq_button_launch button_plugin'>${translation[window.config.general.language].eq}</button></div>
                
                <div class='plugin delaisRow'><label>${translation[window.config.general.language].delay} (ms)</label><div class='d-flex' style='gap: 5px'><button class='reduce_delay'><i class='bx bx-minus' ></i></button><input type="number" value="" id="delais" /><button class='add_delay'><i class='bx bx-plus' ></i></button></div></button></div>


            </div>
            <div class="auxSends">
        ${!isMaster && !isAux ? auxSendView : ""}
            </div>
            <div class='pan_container'>${panController}</div>
            <div class='input_volume_container'>
                <input type='number' class='input_volume' step="0.1" value="0" />
            </div>
            <div class="volumeVuMetre">
        ${this.dbScale}
                <input class="volume" orient="vertical" type="range" min="-60" max="12" step="0.1" value="0">
                <audio-visualizer data-id='${this.id}' color="green"></audio-visualizer>
            </div>
            <div class="muteSolo">
                <button class="mute">M</button>
                <button style='display: ${isMaster || isAux ? "none" : "inline-block"}' class="solo">S</button>
            </div>
        `;

        if (isMaster) {
            this.innerHTML = `
                <label class="track_title" for="volume">${this.label}</label>
                <select class="deviceOutputSelect"></select>
                ${getCommonHTML()}
            `;
            return;
        }

        if (isAux) {
            this.innerHTML = `
                <label class="track_title" for="volume">${this.label}</label>
                <select class="deviceOutputSelect"></select>
                ${getCommonHTML()}
            `;
            return;
        }

        this.innerHTML = `
            <label class="track_title" for="deviceSelect">${this.label}</label>
            <select class="deviceSelect"></select>
            ${getCommonHTML()}
        `;
    }

    disconnectedCallback() {
        this.querySelectorAll('.auxSend').forEach(el => {
            el.removeEventListener('input');
        });
        this.querySelector('.mute')?.removeEventListener('click');
        this.querySelector('.input_volume')?.removeEventListener('change');
        this.querySelector('.volume')?.removeEventListener('input');
        this.querySelector('.volume')?.removeEventListener('dblclick');
        this.querySelector('.deviceOutputSelect')?.removeEventListener('change');
        this.querySelector('.deviceSelect')?.removeEventListener('change');
    }

}