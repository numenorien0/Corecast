const Stats = require('stats.js');
const { FrameController } = require('./js/utils.js');
var stats = new Stats();
stats.showPanel( 0 );

export default class main_viewer extends HTMLElement {
	constructor(){
		super();
		this.width = this.getAttribute("canvas-width");
		this.height = this.getAttribute("canvas-height");
		this.label = this.getAttribute("label");
		this.uniq_id = this.getAttribute("uniq_id");
	}

	connectedCallback(){
		this.render();
		this.tempCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height);
		this.tempCtx = this.tempCanvas.getContext("2d", {alpha: true, willReadFrequently: false, desynchronized: true});
	}

	drawLayer(mainElement, config, black) {     
		 
		this.ctx.save();
		if (config.opacity !== undefined) {
			this.ctx.globalAlpha = Math.min(Math.max(parseFloat(config.opacity), 0), 1);
		}
	
		var offsetX = 0;
		var offsetY = 0;
		
		let videoWidth = mainElement instanceof HTMLVideoElement
		? (mainElement.videoWidth || mainElement.width)
		: mainElement.width;
	
		let videoHeight = mainElement instanceof HTMLVideoElement
		? (mainElement.videoHeight || mainElement.height)
		: mainElement.height;
	
		if(1){
			const forcedRatio = 16 / 9;
			const actualRatio = videoWidth / videoHeight;
	
			if (actualRatio > forcedRatio) {
				const oldvideoHeight = videoHeight;
				videoHeight = videoWidth / forcedRatio;
				offsetY = (oldvideoHeight - videoHeight) / 2
			} else if (actualRatio < forcedRatio) {
				const oldVideoWidth = videoWidth;
				videoWidth = videoHeight * forcedRatio;
				offsetX = (oldVideoWidth - videoWidth) / 2
			}
		}
	
		const cropTop    = config.cropTop    ? (parseFloat(config.cropTop)    / 100) * videoHeight : 0;
		const cropBottom = config.cropBottom ? (parseFloat(config.cropBottom) / 100) * videoHeight : 0;
		const cropLeft   = config.cropLeft   ? (parseFloat(config.cropLeft)   / 100) * videoWidth  : 0;
		const cropRight  = config.cropRight  ? (parseFloat(config.cropRight)  / 100) * videoWidth  : 0;
	
		const sourceX = cropLeft + offsetX;
		const sourceY = cropTop + offsetY;
		const sourceWidth  = videoWidth  - cropLeft - cropRight;
		const sourceHeight = videoHeight - cropTop - cropBottom;
	
		let targetWidth, targetHeight, scale;
	
		if (config.width === "auto" || config.height === "auto") {
			scale = Math.min(this.offscreen.width / videoWidth, this.offscreen.height / videoHeight);
			targetWidth = videoWidth * scale;
			targetHeight = videoHeight * scale;
		} else if (config.width !== undefined) {
			targetWidth = (parseFloat(config.width) / 100) * this.offscreen.width;
			scale = targetWidth / videoWidth;
			targetHeight = videoHeight * scale;
		} else if (config.height !== undefined) {
			targetHeight = (parseFloat(config.height) / 100) * this.offscreen.height;
			scale = targetHeight / videoHeight;
			targetWidth = videoWidth * scale;
		} else {
			scale = Math.min(this.offscreen.width / videoWidth, this.offscreen.height / videoHeight);
			targetWidth = videoWidth * scale;
			targetHeight = videoHeight * scale;
		}
	
		const posX = (config.x === undefined || config.x === "auto") 
		? (this.offscreen.width - targetWidth) / 2 
		: (parseFloat(config.x) / 100) * this.offscreen.width;
		const posY = (config.y === undefined || config.y === "auto") 
		? (this.offscreen.height - targetHeight) / 2 
		: (parseFloat(config.y) / 100) * this.offscreen.height;
	
		const drawX = posX + cropLeft * scale;
		const drawY = posY + cropTop * scale;
		const drawWidth = sourceWidth * scale;
		const drawHeight = sourceHeight * scale;
	
		if (config.radius) {
			const radius = parseFloat(config.radius);
			this.ctx.save();
			this.ctx.beginPath();
			this.ctx.moveTo(drawX + radius, drawY);
			this.ctx.lineTo(drawX + drawWidth - radius, drawY);
			this.ctx.quadraticCurveTo(drawX + drawWidth, drawY, drawX + drawWidth, drawY + radius);
			this.ctx.lineTo(drawX + drawWidth, drawY + drawHeight - radius);
			this.ctx.quadraticCurveTo(drawX + drawWidth, drawY + drawHeight, drawX + drawWidth - radius, drawY + drawHeight);
			this.ctx.lineTo(drawX + radius, drawY + drawHeight);
			this.ctx.quadraticCurveTo(drawX, drawY + drawHeight, drawX, drawY + drawHeight - radius);
			this.ctx.lineTo(drawX, drawY + radius);
			this.ctx.quadraticCurveTo(drawX, drawY, drawX + radius, drawY);
			this.ctx.closePath();
			this.ctx.clip();
		}
		if (sourceWidth <= 0 || sourceHeight <= 0 || drawWidth <= 0 || drawHeight <= 0) {
			return; // dimensions invalides
		}
		//this.tempCtx.start2D();  
		this.tempCanvas.width = drawWidth;
		this.tempCanvas.height = drawHeight;

		this.tempCtx.clearRect(0, 0, drawWidth, drawHeight);
		this.tempCtx.drawImage(
			mainElement,
			sourceX, sourceY, sourceWidth, sourceHeight,
			0, 0, drawWidth, drawHeight
		);
		
		// GreenKey avancé avec lissage des bords
		if (config.greenKeyActive) {
			
			const tolerance = config.greenKeyTolerance || 100;      // intensité verte minimale
			const colorDifference = config.greenKeyColorDiff || 50; // écart minimal entre G et R/B
			const smoothness = config.greenKeySmoothness || 30;     // Lissage des bords (typique : 20 à 50)

			const imageData = this.tempCtx.getImageData(0, 0, drawWidth, drawHeight);
			const data = imageData.data;

			for (let i = 0; i < data.length; i += 4) {
				const r = data[i];
				const g = data[i + 1];
				const b = data[i + 2];

				// calcul de la "pureté" du vert
				const greenIntensity = g - Math.max(r, b);

				if (g > tolerance && greenIntensity > colorDifference) {
					// Pixel clairement vert : totalement transparent
					data[i + 3] = 0;
				} else if (g > (tolerance - smoothness) && greenIntensity > (colorDifference - smoothness)) {
					// Pixel « limite » : applique une transparence progressive
					const alphaFactor = Math.max(
						(greenIntensity - (colorDifference - smoothness)) / smoothness,
						(g - (tolerance - smoothness)) / smoothness
					);
					data[i + 3] = data[i + 3] * (1 - alphaFactor); // Transparence graduelle
				}
			}
			try {
				this.tempCtx.putImageData(imageData, 0, 0);
			}
			catch (e) {
				console.error("Erreur lors de l'application du green key :", e);
			}
			
		}
		if (black && videoWidth) {
			this.ctx.fillStyle = "black";
			this.ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
		}
		
		if(this.tempCanvas.width && this.tempCanvas.height){
			this.ctx.drawImage(this.tempCanvas, drawX, drawY);
		}

		if (config.borderWidth && config.borderColor) {
            this.ctx.lineWidth = parseFloat(config.borderWidth);
            this.ctx.strokeStyle = config.borderColor;
            if (config.radius) {
                const radius = parseFloat(config.radius);
                this.ctx.beginPath();
                this.ctx.moveTo(drawX + radius, drawY);
                this.ctx.lineTo(drawX + drawWidth - radius, drawY);
                this.ctx.quadraticCurveTo(drawX + drawWidth, drawY, drawX + drawWidth, drawY + radius);
                this.ctx.lineTo(drawX + drawWidth, drawY + drawHeight - radius);
                this.ctx.quadraticCurveTo(drawX + drawWidth, drawY + drawHeight, drawX + drawWidth - radius, drawY + drawHeight);
                this.ctx.lineTo(drawX + radius, drawY + drawHeight);
                this.ctx.quadraticCurveTo(drawX, drawY + drawHeight, drawX, drawY + drawHeight - radius);
                this.ctx.lineTo(drawX, drawY + radius);
                this.ctx.quadraticCurveTo(drawX, drawY, drawX + radius, drawY);
                this.ctx.closePath();
                this.ctx.stroke();
            } else {
                this.ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
            }
        }
        

		if (config.radius) {
			this.ctx.restore();
		}
	
		this.ctx.restore();
		  

	}

	draw() {
		const render = this.uniq_id == "preview" ? window.preview : this.uniq_id == "pgm" ? window.pgm : this.uniq_id == "master" ? window.master : window.aux[this.uniq_id];
		if(this.uniq_id == "master"){
			stats.begin();
		}
		this.ctx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
		const bg = window.config.general?.background || {};
		
		this.ctx.fillStyle = bg.color || "black";
		this.ctx.fillRect(0, 0, this.offscreen.width, this.offscreen.height);
		

		if (Array.isArray(render)) {
			render.forEach(camera => {
				let mainElement = document.getElementById(camera.device);
				if(mainElement){
					if(mainElement.classList.contains("camera-canvas") && mainElement.getAttribute("player") != "null"){
						mainElement = document.getElementById("player-" + mainElement.getAttribute("player"));
					}

					if (mainElement instanceof HTMLVideoElement || mainElement instanceof HTMLCanvasElement) {
                        this.ctx.save();
						mainElement.mustUpdate = true;
                        const parameters = localStorage.getItem("selectedDevices") ? JSON.parse(localStorage.getItem("selectedDevices"))[camera.device] : {};
                        if(parameters){
                            this.ctx.filter = `brightness(${parameters.brightness}%) contrast(${parameters.contrast}%) saturate(${parameters.saturate}%) hue-rotate(${parameters.huerotate}deg)`;
                        }
						this.drawLayer(mainElement, camera, camera.blackFill ? true : false);
                        this.ctx.restore();
					}
				}
			});
		}

		if (this.uniq_id == "master") {
			const overlayConfig = this.overlayConfig || {
				x: 0, y: 0, width: 100, height: 100
			};
		
			const overlayElement = document.querySelector("#layerMaster");
			if (overlayElement) {
				overlayElement.mustUpdate = true;
				this.drawLayer(overlayElement, overlayConfig, false);
				
			}
		}

		

		this.visibleCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.visibleCtx.drawImage(this.offscreen, 0, 0);
		
		if(this.uniq_id == "master"){
			stats.end();
		}
		//requestAnimationFrame(this.draw.bind(this));
	}

	getVideoDimensions(video) {
		const videoRatio = video.videoWidth / video.videoHeight;
		const targetRatio = 16 / 9;
		let width, height;

		if (videoRatio > targetRatio) {
			width = this.canvas.width;
			height = this.canvas.width / videoRatio;
		} else {
			height = this.canvas.height;
			width = this.canvas.height * videoRatio;
		}

		return { width, height };
	}

	render(){
		this.innerHTML = `
			<div class="video-container">
			<label>${this.label}</label>
			<canvas width="${this.width}" height="${this.height}" id="${this.uniq_id}"></canvas>
			</div>
			`;
		this.canvas = this.querySelector('canvas');
		this.offscreen = new OffscreenCanvas(this.canvas.width, this.canvas.height);
		this.ctx = this.offscreen.getContext("2d");
		this.visibleCtx = this.canvas.getContext("2d", { alpha: false, willReadFrequently: false, desynchronized: true });
		//requestAnimationFrame(() => this.draw());
		// setInterval(() => this.draw(), 1000 / window.config.video.framerate);
		const controller = new FrameController(window.config.video.framerate, () => {
			this.draw()
		});
		controller.start();
		if(this.uniq_id == "master" || this.uniq_id == "preview"){
			

			const stream = this.canvas.captureStream();
			window.output[this.uniq_id] = stream;
		}
		if(this.uniq_id == "master"){
			stats.dom.style.position = 'absolute';
			stats.dom.style.left = '10px';
			stats.dom.style.bottom = '0px';	
			stats.dom.style.opacity = '0.5';
			stats.dom.style.top = 'initial';	
			this.appendChild( stats.dom );
		}
	}

	disconnectedCallback(){

	}
}