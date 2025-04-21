const grandiose = require("grandiose");
const { ipcRenderer } = require("electron");
const { FrameController } = require('./js/utils.js');
const { translation } = require('./local/local.js');
const { Notyf } = require('notyf');
var notyf = new Notyf();

export default class video_viewer extends HTMLElement {
	constructor() {
		super();
		this.uniq_id = this.getAttribute("uniq_id");
		this.label = this.getAttribute("label");
		this.status = this.getAttribute("status");
		this.lastSelected;
		this.devices;
		this.offscreen;
		window.ndiReceivers = window.ndiReceivers || {};
	}

	connectedCallback() {
		this.device = this.getLastSelectedDevice() || {};
		this.lastSelected = this.device?.device;
		this.render();
		
		this.start_camera(this.lastSelected);

		window.addEventListener("video-device-selected", (e) => {
			if (e.detail.unique_id === this.uniq_id) {
				const deviceId = e.detail.deviceId;
				this.lastSelected = deviceId;
				this.start_camera(this.lastSelected);
			}
		});

		window.addEventListener("camera-preferences-changed", (e) => {
			if (e.detail.unique_id === this.uniq_id) {
				this.applyFilter(e.detail.parameters);
			}
		})

		window.addEventListener("camera-renamed", (e) => {
			if (e.detail.unique_id === this.uniq_id) {
					this.querySelector("label").innerText = e.detail.parameters.name || this.label;
				
			}
		})

	}

    applyFilter(parameters) {
        if(parameters){
            this.querySelector("#"+this.uniq_id).style.filter = `brightness(${parameters.brightness}%) contrast(${parameters.contrast}%) saturate(${parameters.saturate}%) hue-rotate(${parameters.huerotate}deg)`;
        }
    }

	getLastSelectedDevice() {
		const storedData = JSON.parse(localStorage.getItem("selectedDevices")) || {};
		return storedData[this.uniq_id] || null;
	}

	cleanupNDIReceiver() {
		this._ndiActive = false;
		if (this.receiver && typeof this.receiver.dispose === "function") {
			this.receiver.dispose();
		}

		if (this._animationFrameId) {
			cancelAnimationFrame(this._animationFrameId);
			this._animationFrameId = null;
		}

		this.receiver = null;
		this.offscreen = null;
	}

	start_camera(deviceId) {
		this.cleanupNDIReceiver();
		if (this.stream instanceof MediaStream) {
			this.stream.getTracks().forEach(track => {
				try { track.stop(); } catch (e) {}
			});
			this.stream = null;
		}
		if (deviceId) {
			if (deviceId === "screen") {
				this.setDesktopStream();
			} else if (deviceId.startsWith("mediaplayer")) {
				let mediaplayer = parseInt(deviceId.split("-")[1]);
				this.setMediaPlayerStream(mediaplayer);
			} else if (deviceId === "none") {
				this.setVideoStream(null);
			} else if (deviceId.startsWith("NDI://")) {
				let ndiSource = deviceId.split("://")[1];
				this.setNDIStream(ndiSource);
			} else {
				this.setWebcamStream(deviceId);
			}
		}
	}

	disconnectedCallback() {
		this.cleanupNDIReceiver();
	}

	static get observedAttributes() {
		return ["status"];
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "status" && oldValue !== newValue) {
			this.status = newValue;
			this.updateStatus();
		}
	}

	updateStatus() {
		const container = this.querySelector(".video-container");
		if (container) {
			container.classList.remove("pgm", "preview", "none");
			container.classList.add(this.status || "none");

			if (this.status === "pgm") {
				window.dispatchEvent(
					new CustomEvent("camera-exposed", {
						detail: { device: this.lastSelected },
					})
				);
			}
			if (this.status === "none" || this.status === "preview") {
				window.dispatchEvent(
					new CustomEvent("camera-unexposed", {
						detail: { device: this.lastSelected },
					})
				);
			}
		}
	}

	async setDesktopStream() {
		try {
			const sources = await ipcRenderer.invoke('get-desktop-sources', {
				types: ['screen', 'window'],
				thumbnailSize: { width: 320, height: 180 }
			});
		
			const modal = document.createElement("div");
			modal.className = "screen-picker-modal";
		
			const grid = document.createElement("div");
			grid.className = "screen-picker-grid";
		
			modal.addEventListener("click", (e) => {
				if (e.target === modal) {
				document.body.removeChild(modal);
				}
			});
		
			sources.forEach(source => {
				const container = document.createElement("div");
				container.className = "screen-picker-item";
		
				const img = document.createElement("img");
				img.src = source.thumbnail.toDataURL();
				img.className = "screen-picker-thumbnail";
		
				const label = document.createElement("div");
				label.className = "screen-picker-label";
				label.textContent = source.name;
		
				container.appendChild(img);
				container.appendChild(label);
				grid.appendChild(container);
		
				container.onclick = async (e) => {
					e.stopPropagation(); // Empêche la fermeture via le fond
					document.body.removeChild(modal);
					try {
						const stream = await navigator.mediaDevices.getUserMedia({
						audio: false,
						video: {
							mandatory: {
							chromeMediaSource: 'desktop',
							chromeMediaSourceId: source.id
							}
						}
						});
			
						this.stream = stream;
						window.input[this.uniq_id] = stream;
						this.setVideoStream(stream);
					} catch (err) {
						notyf.error({message: 'Erreur lors de la capture d\'écran ' + err, duration: 5000, dismissible: true});
					}
				};
			});
		
			modal.appendChild(grid);
			document.body.appendChild(modal);
		} catch (error) {
			notyf.error({message: 'Erreur lors de la capture d\'écran ' + err, duration: 5000, dismissible: true});
		}
	}
  

	async setNDIStream(source) {
		const mediaSource = source.split("-_-");
		let sourceNDI = { name: mediaSource[1], urlAddress: mediaSource[0] };
	
		try {
			this.receiver = await grandiose.receive({
				source: sourceNDI,
				colorFormat: grandiose.COLOR_FORMAT_RGBX_RGBA,
				bandwidth: grandiose.BANDWIDTH_HIGHEST,
				allowVideoFields: false,
				name: "NDIReceiver"
			});
			window.ndiReceivers[this.uniq_id] = this.receiver;
			this._ndiActive = true;

			this.render("canvas");
			const canvas = this.querySelector(".camera-canvas");
			if (!canvas) return;

			const [w, h] = window.config.video.definition.split("x");
			canvas.width  = parseInt(w, 10);
			canvas.height = parseInt(h, 10);

			if (!this.offscreen) {
				this.offscreen = new OffscreenCanvas(canvas.width, canvas.height);
			}
			const offscreenCtx = this.offscreen.getContext("2d");
			const visibleCtx   = canvas.getContext("2d");

			const drawNDIFrame = async () => {
				if (!this._ndiActive) return;
		
				try {
					const frame = await this.receiver.video(1000);
			
					if (frame.type === "video") {
						const { xres, yres, data } = frame;
						const imageData = new ImageData(new Uint8ClampedArray(data), xres, yres);
						const bitmap = await createImageBitmap(imageData);

						const canvasWidth  = this.offscreen.width;
						const canvasHeight = this.offscreen.height;
						const imageAspect  = bitmap.width / bitmap.height;
						const canvasAspect = canvasWidth / canvasHeight;
			
						let drawWidth, drawHeight;
						if (imageAspect > canvasAspect) {
							drawWidth  = canvasWidth;
							drawHeight = canvasWidth / imageAspect;
						} else {
							drawHeight = canvasHeight;
							drawWidth  = canvasHeight * imageAspect;
						}
			
						const offsetX = (canvasWidth  - drawWidth)  / 2;
						const offsetY = (canvasHeight - drawHeight) / 2;

						offscreenCtx.clearRect(0, 0, canvasWidth, canvasHeight);
						offscreenCtx.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);

						visibleCtx.clearRect(0, 0, canvasWidth, canvasHeight);
						visibleCtx.drawImage(this.offscreen, 0, 0);
					}
				} catch (err) {

				}
			};
			const controller = new FrameController(window.config.video.framerate, () => {
				drawNDIFrame();
			});
			controller.start();
			//setInterval(drawNDIFrame, 1000 / window.config.video.framerate);
			this.stream = canvas.captureStream();
			window.input[this.uniq_id] = this.stream;

		} catch (error) {
			notyf.error({message: 'Erreur NDI ' + error, duration: 5000, dismissible: true});
		}
	}
  

	async setMediaPlayerStream(mediaplayer) {

		function drawCanvasMediaPlayer(player, self) {
			const video = document.querySelector("#player-" + player);
			const canvas = self.querySelector(".camera-canvas");
			if (!video || !canvas) return;
	
			self.offscreen = new OffscreenCanvas(canvas.width, canvas.height);
			const ctx = self.offscreen.getContext("2d");
	
			const renderFrame = () => {
				if (video instanceof HTMLVideoElement) {
					video.mustUpdate = true;
				}
				const videoWidth = video.videoWidth;
				const videoHeight = video.videoHeight;
				if (videoWidth > 0 && videoHeight > 0) {
					const canvasRatio = canvas.width / canvas.height;
					const videoRatio = videoWidth / videoHeight;
					let drawWidth, drawHeight;
	
					if (videoRatio > canvasRatio) {
						drawWidth = canvas.width;
						drawHeight = canvas.width / videoRatio;
					} else {
						drawHeight = canvas.height;
						drawWidth = canvas.height * videoRatio;
					}
	
					const offsetX = (canvas.width - drawWidth) / 2;
					const offsetY = (canvas.height - drawHeight) / 2;
	
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.fillStyle = "black";
					ctx.fillRect(0, 0, canvas.width, canvas.height);
					ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
	
					const visibleCtx = canvas.getContext("2d", { willReadFrequently: false });
					visibleCtx.clearRect(0, 0, canvas.width, canvas.height);
					visibleCtx.drawImage(self.offscreen, 0, 0);
					
				}

				video.requestVideoFrameCallback(renderFrame);
			};
	
			video.requestVideoFrameCallback(renderFrame);
		}

		try {
			const interval = setInterval(() => {
				if (window.mediaplayer && window.mediaplayer[mediaplayer]) {
					this.stream = window.mediaplayer[mediaplayer];
					window.input[this.uniq_id] = this.stream;
					this.render("canvas", mediaplayer);
					drawCanvasMediaPlayer(mediaplayer, this);
					clearInterval(interval);
				}
			}, 100);
		} catch (error) {
			notyf.error({message: 'Erreur ' + error, duration: 5000, dismissible: true});
		}
	}

	async setWebcamStream(deviceId) {
		if (deviceId !== "none") {
			try {
				const [width, height] = window.config.video.definition.split("x");
				this.stream = await navigator.mediaDevices.getUserMedia({
					video: {
						deviceId: { exact: deviceId },
						width: { min: 480, ideal: parseInt(width, 10), max: 3840 },
						height: { min: 270, ideal: parseInt(height, 10), max: 2160 },
						frameRate: { min: 20, ideal: 60, max: 120 },
					},
				});
				window.input[this.uniq_id] = this.stream;
				this.setVideoStream(this.stream);
			} catch (error) {
				notyf.error({message: 'Erreur. résolution ou framerate incompatible ' + error, duration: 5000, dismissible: true});

			}
		} else {
			this.setVideoStream(null);
		}
	}

	setVideoStream(stream) {
		this.render("video");
		const video = this.querySelector("video");
		if (video) {
			video.srcObject = stream;
		}
	}

	

	async render(type = "video", mediaplayer = null) {
		if (type === "canvas") {
			this.innerHTML = `
				<div class="video-container ${this.status}">
				<label>${this.device.name || this.label}</label>
				<canvas
					width="${parseInt(window.config.video.definition.split("x")[0]) / 2}"
					height="${parseInt(window.config.video.definition.split("x")[1]) / 2}"
					player="${mediaplayer}"
					id="${this.uniq_id}"
					class="camera-canvas"
				></canvas>
				</div>`;
		} else {
			this.innerHTML = `
				<div class="video-container ${this.status}">
				<label>${this.device.name || this.label}</label>
				<video width="240" height="135" class="camera-video" id="${this.uniq_id}" muted autoplay></video>
				</div>`;
		}

		this.applyFilter(this.getLastSelectedDevice());
	}
}