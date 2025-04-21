const { translation } = require('./local/local.js');
const os = require('os');

function getDummyVideoTrack() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Capture le flux du canvas à une faible fréquence (1 fps suffit)
    const stream = canvas.captureStream(1);
    return stream.getVideoTracks()[0];
  }

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'IP non trouvée';
  }

function generateUniqueId() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const getRandomLetters = () => {
        let result = '';
        for (let i = 0; i < 4; i++) {
            const randomIndex = Math.floor(Math.random() * letters.length);
            result += letters[randomIndex];
        }
        return result;
    };

    localStorage.setItem("peerID", `${getRandomLetters()}-${getRandomLetters()}`);

    return `${getRandomLetters()}-${getRandomLetters()}`;
}
export default class intercomViewer extends HTMLElement {
    constructor() {
        super();
        this.peerID = localStorage.getItem("peerID") || generateUniqueId();
        this.localStream = null;
        this.combinedStream = new MediaStream();
        this.constraints = {
            width: 480,
            height: 270,
          };
          this.calls = {};
    }

    init_peer(){
        this.peer = new Peer(this.peerID, {/*host: "localhost", port: 9067, path: "/socket"*/});
        this.peer.on('call', (call) => {
            // Créer un nouveau MediaStream pour cet appel
            this.combinedStream = new MediaStream();
          
            // Ajouter systématiquement la piste audio du micro (si disponible)
            if (this.localStream) {
              this.localStream.getAudioTracks().forEach(track => {
                this.combinedStream.addTrack(track);
              });
            }
            this.calls[call.peer] = call;
            // Selon l'état de la checkbox, ajouter soit la vraie piste vidéo, soit une piste dummy
            if (window.output && window.output['pgm'] && this.querySelector("#sendVideoReturn").checked) {
              const videoTracks = window.output['pgm'].getVideoTracks();
              videoTracks.forEach(track => {
                track.applyConstraints(this.constraints).catch(err => console.error(err));
                this.combinedStream.addTrack(track);
              });
            } else {
                const dummyTrack = getDummyVideoTrack();
                this.combinedStream.addTrack(dummyTrack);
            }
          
            // Vous pouvez aussi attacher l'écouteur pour les changements de la checkbox ici
            this.querySelector("#sendVideoReturn").addEventListener("change", (e) => {
              const videoSender = call.peerConnection.getSenders().find(sender => sender.track && sender.track.kind === 'video');
              if (e.target.checked) {
                const videoTracks = window.output['pgm'].getVideoTracks();
                if (videoTracks && videoTracks.length > 0) {
                  const realVideoTrack = videoTracks[0];
                  realVideoTrack.applyConstraints(this.constraints).catch(err => console.error(err));
                  if (videoSender) {
                    videoSender.replaceTrack(realVideoTrack).catch(err => console.error(err));
                  }
                }
              } else {
                if (videoSender) {
                  const dummyTrack = getDummyVideoTrack();
                  videoSender.replaceTrack(dummyTrack).catch(err => console.error(err));
                }
              }
            });
          
            // Répondre à l'appel avec le nouveau stream qui contient l'audio
            call.answer(this.combinedStream);

            call.on('stream', (remoteStream) => {
                const audio = document.querySelector(`#${call.peer.split("_")[1]}`);
                audio.srcObject = remoteStream;
                document.querySelector(".intercomBtn[data-intercom='" + call.peer.split("_")[1] + "'] i").classList.add("bx-flashing");
                this.toggleIntercom(call.peer.split("_")[1], true);
            });

            call.on('close', () => {
                document.querySelector(".intercomBtn[data-intercom='" + call.peer.split("_")[1] + "'] i").classList.remove("bx-flashing");
                this.toggleIntercom(call.peer.split("_")[1], false);
            })

            call.on('disconnect', () => {
                document.querySelector(".intercomBtn[data-intercom='" + call.peer.split("_")[1] + "'] i").classList.remove("bx-flashing");
                this.toggleIntercom(call.peer.split("_")[1], false);
            })

            const conn = this.peer.connect(call.peer);
            conn.on('open', () => {
                const message = JSON.stringify({ action: 'videoStatus', pgm: window.pgm, preview: window.preview });
                conn.send(message);
            });

            conn.on('close', () => {
                document.querySelector(".intercomBtn[data-intercom='" + call.peer.split("_")[1] + "'] i").classList.remove("bx-flashing");
                this.toggleIntercom(call.peer.split("_")[1], false);
            });

            

            window.addEventListener("refreshCameraStatus", (e) => {
                const message = JSON.stringify({ action: 'videoStatus', pgm: window.pgm, preview: window.preview});
                conn.send(message);
            })
            
    
        });
    }

    connectedCallback() {
        this.localIP = getLocalIP();
        this.render();
        this.populateDevices();
        this.startLocalStream();
        this.displayQRCode();
        this.init_peer();

    }

    // Fonction pour créer une piste audio silencieuse
    createSilentAudioTrack() {
        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        // Connecter l'oscillateur au gain
        oscillator.connect(gainNode);
        // On démarre l'oscillateur
        oscillator.start();
        // On met le gain à 0 pour obtenir un signal silencieux
        gainNode.gain.value = 0;
        // Création d'une destination qui génère un MediaStream
        const dest = audioCtx.createMediaStreamDestination();
        gainNode.connect(dest);
        // La piste audio silencieuse est la première piste du stream destination
        return dest.stream.getAudioTracks()[0];
    }
  

    // Fonction pour mettre à jour l'envoi de l'audio sur un appel donné
    toggleAudioTransmission(call, sendAudio) {
        const audioSender = call.peerConnection?.getSenders().find(sender => sender.track && sender.track.kind === 'audio');
        if (audioSender) {
			if (sendAudio) {
				const originalAudioTrack = this.localStream.getAudioTracks()[0];
				audioSender.replaceTrack(originalAudioTrack).catch(err => console.error("Erreur lors de la réactivation de l'audio:", err));
			} else {
				const silentTrack = this.createSilentAudioTrack();
				audioSender.replaceTrack(silentTrack).catch(err => console.error("Erreur lors de la désactivation de l'audio:", err));
			}
        }
    }
  
  

    async populateDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputSelect = this.querySelector('#microphoneSelect');
        const audioOutputSelect = this.querySelector('#audioOutputSelect');

        devices.forEach(device => {
            if (device.kind === 'audioinput') {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Microphone ${audioInputSelect.length + 1}`;
                audioInputSelect.appendChild(option);
            }

            if (device.kind === 'audiooutput') {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Sortie audio ${audioOutputSelect.length + 1}`;
                audioOutputSelect.appendChild(option);
            }
        });

        audioInputSelect.addEventListener('change', () => {
            this.startLocalStream();
        });
    }

    async startLocalStream() {
        const audioInputSelect = this.querySelector('#microphoneSelect');
        const deviceId = audioInputSelect.value;
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track => track.stop();
            });
        }
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: deviceId ? { exact: deviceId } : undefined }
            });
            this.toggleMute(false);
        } catch (error) {
            console.error("Erreur lors de l'accès au microphone :", error);
        }
    }

    render() {
        this.innerHTML = `
            <div class="intercom_viewer">
            <div class='m-auto'>
            <div class="intercom_viewer_header" style='display: flex; flex-direction: row; gap: 10px;'>
                <div style='margin: auto; margin-right: 30px'>
                    <div style='text-align: left; font-weight: bold; margin-bottom: 15px; font-size: 16px'>${translation[window.config.general.language].connexion}</div>                    
                    <div class='ip' style='text-align: left'>https://${this.localIP}:3080/nginx/</div>
                    <div style='display: flex; flex-direction: row; gap: 10px; margin-top: 7px'>
                        <div style='' class='peerID'>${this.peerID}</div>
                        <button style='' id='refreshID'><i class='bx bx-reset'></i></button>
                    </div>
                </div>
                <img id='qrImage' src='' alt='QR Code' style='width: 100px; height: 100px; border-radius: 10px; margin-right: auto'>

            </div>
                <div class="intercom_viewer_body">
                    <div class="intercom_viewer_input">
                        <div class='m-auto inputsColumn' style='text-align: left; display: flex; flex-direction: column; gap: 15px'>
                            <div class='m-auto'>
                                <label for="microphoneSelect">${translation[window.config.general.language].selectMicrophone}</label>
                                <select id="microphoneSelect"></select>
                            </div>
                            <div class='m-auto'>
                                <label for="audioOutputSelect">${translation[window.config.general.language].selectOutput}</label>
                                <select id="audioOutputSelect"></select>    
                            </div>
      
                        </div>
                    </div>
                    <div class="intercom_viewer_list">
                        <div class="intercom_controls">
                            
                        </div>
                        <div class="intercom_camera_row">
                            <button class="camera-slot" id="toggleMute"><i class='bx bxs-microphone' ></i></button>
                            <button class="intercomBtn camera-slot" data-intercom="intercom1" data-id="1"><i class='bx bx-radio-circle-marked' ></i>1</button>
                            <button class="intercomBtn camera-slot" data-intercom="intercom2" data-id="2"><i class='bx bx-radio-circle-marked' ></i>2</button>
                            <button class="intercomBtn camera-slot" data-intercom="intercom3" data-id="3"><i class='bx bx-radio-circle-marked' ></i>3</button>
                            <button class="intercomBtn camera-slot" data-intercom="intercom4" data-id="4"><i class='bx bx-radio-circle-marked' ></i>4</button>
                        </div>
                        <div class="intercom_camera_row">
                            <button class="activate-all-btn">All</button>
                            <button class="intercomBtn camera-slot" data-intercom="intercom5" data-id="5"><i class='bx bx-radio-circle-marked' ></i>5</button>
                            <button class="intercomBtn camera-slot" data-intercom="intercom6" data-id="6"><i class='bx bx-radio-circle-marked' ></i>6</button>
                            <button class="intercomBtn camera-slot" data-intercom="intercom7" data-id="7"><i class='bx bx-radio-circle-marked' ></i>7</button>
                            <button class="intercomBtn camera-slot" data-intercom="intercom8" data-id="8"><i class='bx bx-radio-circle-marked' ></i>8</button>
                        </div>
                    </div>
                    <div class="intercom_viewer_output">
                        <div class='m-auto' style='text-align: center; display: flex; gap: 15px'>
                         <div class='m-auto'>
                                <input class="volume" id="intercomVolume" style='height: 160px' orient="vertical" type="range" min="0" max="100" step="1" value="80">
                            </div>
                            
                           
                            <audio id='intercom1' class='intercomAudio'></audio>
                            <audio id='intercom2' class='intercomAudio' ></audio>
                            <audio id='intercom3' class='intercomAudio' ></audio>
                            <audio id='intercom4' class='intercomAudio' ></audio>
                            <audio id='intercom5' class='intercomAudio' ></audio>
                            <audio id='intercom6' class='intercomAudio' ></audio>
                            <audio id='intercom7' class='intercomAudio' ></audio>
                            <audio id='intercom8' class='intercomAudio' ></audio>  
                        </div>
                    </div>
                </div>
                <div style='text-align: center'>
                    ${translation[window.config.general.language].enableReturn} <input type="checkbox" style='margin-left: 5px' checked id="sendVideoReturn">
                </div>
                </div>

            </div>
        `;

        this.querySelectorAll(".intercomBtn").forEach(button => {
            button.addEventListener("click", (e) => {
                this.toggleIntercom(e.target.dataset.intercom, !e.target.classList.contains("active"));
            });
        });

        this.querySelector(".activate-all-btn").addEventListener("click", (e) => {
            
            this.querySelectorAll(".intercomBtn").forEach(button => {
                console.log(button);
                this.toggleIntercom(button.dataset.intercom, !button.classList.contains("active"));
            });
            
        });

        this.querySelector("#refreshID").addEventListener("click", () => {
            this.peerID = generateUniqueId();
            this.querySelector(".peerID").innerHTML = this.peerID;
            this.displayQRCode();
            this.init_peer();
        });

        this.querySelector("#intercomVolume").addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.changeOutputVolume(volume);
        });

        
        


        this.querySelector("#toggleMute").addEventListener("click", () => {
            this.toggleMute();
        });
        this.querySelector("#audioOutputSelect").addEventListener("change", (e) => {
            this.changeOutput(e.target.value);
        })

    }

    displayQRCode() {
        const QRCode = require('qrcode');

        const dataToEncode = `https://${this.localIP}:3080/nginx/${this.peerID}`;

        // Génère un QR Code en Data URL
        QRCode.toDataURL(dataToEncode, { errorCorrectionLevel: 'H' }, function(err, url) {
            if (err) {
                console.error('Erreur lors de la génération du QR Code :', err);
                return;
            }
            // Affecte la Data URL à l'attribut src de l'image pour l'afficher
            document.getElementById('qrImage').src = url;
        });
    }

    changeOutputVolume(volume) {
        this.querySelectorAll(".intercomAudio").forEach(audio => {
            audio.volume = volume;
        });
    }
    changeOutput(deviceId) {
        this.querySelectorAll(".intercomAudio").forEach(audio => {
            audio.setSinkId(deviceId);
        });
    }
  

    toggleIntercom(id, newState) {
		const audio = document.querySelector(`#${id}`);
		const btn = document.querySelector(`.intercomBtn[data-intercom='${id}']`);
		const callKey = `${this.peerID}_${id}`;

		if (typeof newState === 'undefined') {
		  newState = audio.paused;  
		}

		btn.classList.toggle("active", newState);

		this.toggleAudioTransmission(this.calls[callKey], newState);
	  
		if (newState) {
		  //audio.canplaythrough = () => {
			audio.play().catch(err => console.warn("Erreur lors du play :", err));
		  
		} else {
		  // Sinon on met l’audio en pause
		  audio.pause();
		}
	  }
	  

    toggleMute(state){
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                if(state) {
                    track.enabled = state;
                }
                else {
                    track.enabled = !track.enabled;
                }
                if(!track.enabled) {
                    this.querySelector("#toggleMute").classList.remove('active')
                    this.querySelector("#toggleMute").innerHTML = "<i class='bx bxs-microphone-off' ></i>";
                }
                else {
                    this.querySelector("#toggleMute").classList.add('active')
                    this.querySelector("#toggleMute").innerHTML = "<i class='bx bxs-microphone' ></i>";
                }
            });
        }
    }

}