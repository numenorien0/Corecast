export default class AudioCompressor extends HTMLElement {
    constructor() {
        super();
        this.canvasWidth = 1000;
        this.canvasHeight = 400;
        this.input_id = this.getAttribute("input_id");

        this.compressorConfig = this.getDefaultCompressorConfig();
        this.loadConfigFromAttributes();

        // Pour le visualiseur audio
        this.audioContext = null;
        this.analyser = null;
        this.bufferLength = 0;
        this.dataArray = null;

        this.render();
    }

    loadConfigFromAttributes() {
        const compressorAttr = this.getAttribute("compressor");
        if (compressorAttr) {
            try {
                this.compressorConfig = JSON.parse(compressorAttr);
            } catch (error) {
                this.compressorConfig = this.getDefaultCompressorConfig();
            }
        }
    }

    getDefaultCompressorConfig() {
        return {
            threshold: -24, // dB
            knee: 30,       // dB
            ratio: 1,       // compression ratio
            attack: 0.003,  // seconds
            release: 0.25,  // seconds
            gain: 0
        };
    }

    render() {
        // On ajoute un visualiseur (canvas de 100x600) à gauche du canvas principal
        this.innerHTML = `
        <div class='compressor' style="display:flex; align-items: center;">
            <div class='compressor_visualizer'>
                <canvas class='visualizerCanvas' width="80" height="800"></canvas>
            </div>
            <canvas class='compressorCanvas' width="700" height="700"></canvas>
            <div class='compressor_controls'>
                <div class='control_row'>
                    ${this.renderControl("threshold", "Threshold", -60, 0, this.compressorConfig.threshold, "dB")}
                    ${this.renderControl("knee", "Knee", 0, 40, this.compressorConfig.knee, "dB")}
                </div>
                <div class='control_row'>
                    ${this.renderControl("ratio", "Ratio", 1, 20, this.compressorConfig.ratio, "")}
                    ${this.renderControl("attack", "Attack", 0.001, 1, this.compressorConfig.attack, "ms")}
                </div>
                <div class='control_row'>
                    ${this.renderControl("release", "Release", 0.05, 1, this.compressorConfig.release, "ms")}
                    ${this.renderControl("gain", "Gain", -15, 15, this.compressorConfig.gain, "dB")}
                </div>
            </div>
        </div>`;

        this.querySelectorAll("rotary-knob").forEach(input => {
            input.addEventListener("input", this.updateCompressor.bind(this));
        });

        // Exemple d'écouteur sur le canvas du compresseur
        const compCanvas = this.querySelector(".compressorCanvas");
        compCanvas.addEventListener("click", () => this.drawCompressorCurve());

        this.drawCompressorCurve();
    }

    renderControl(param, label, min, max, value, unit) {
        return `
            <div class='compressor_control'>
                <rotary-knob strokeWidth="5" style='width: 100px; height: 100px' data-param="${param}" min="${min}" max="${max}" step="${(max - min) / 100}" value="${value}"></rotary-knob>
                <label><span class='compressorLabel'>${label}</span><br/>
                    <span class='compressorValue' id="${param}-value">${param === "release" || param === "attack" ? (value * 100).toFixed(2) : value.toFixed(2)} ${unit}</span>
                </label>
            </div>`;
    }

    updateCompressor(event) {
        const param = event.target.dataset.param;
        let value = parseFloat(event.target.value);
        this.compressorConfig[param] = value;
        document.querySelector(`#${param}-value`).textContent =
            `${param === "release" || param === "attack" ? (value * 100).toFixed(2) : value.toFixed(2)} ${param === "ratio" ? "" : (param === "release" || param === "attack" ? "ms" : "dB")}`;
        this.sendConfig();
        this.drawCompressorCurve();
    }

    sendConfig(){
        window.opener.dispatchEvent(new CustomEvent("compressor-change", {
            detail: {
                compressor: this.compressorConfig,
                track: this.input_id
            }
        }));
    }

    drawCompressorCurve() {
        const canvas = this.querySelector(".compressorCanvas");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgb(18, 20, 21)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    
        const { threshold, knee, ratio } = this.compressorConfig;
        const margin = 50;
        const width = canvas.width - 2 * margin;
        const height = canvas.height - 2 * margin;
    
        function mapDbToX(db) {
            return margin + ((db + 60) / 60) * width;
        }
        function mapDbToY(db) {
            return canvas.height - margin - ((db + 60) / 60) * height;
        }
    
        // Axes
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin, margin);
        ctx.lineTo(margin, canvas.height - margin);
        ctx.lineTo(canvas.width - margin, canvas.height - margin);
        ctx.stroke();
    
        // Graduations verticales et horizontales (similaires à votre code existant)
        ctx.fillStyle = "#a3acb1";
        ctx.font = "12px Arial";
        for (let i = -60; i <= 0; i += 10) {
            const y = mapDbToY(i);
            ctx.fillText(i + " dB", margin - 40, y + 4);
            ctx.beginPath();
            ctx.moveTo(margin - 5, y);
            ctx.lineTo(margin, y);
            ctx.stroke();
        }
        for (let i = -60; i <= 0; i += 10) {
            const x = mapDbToX(i);
            ctx.fillText(i + " dB", x - 10, canvas.height - margin + 20);
            ctx.beginPath();
            ctx.moveTo(x, canvas.height - margin);
            ctx.lineTo(x, canvas.height - margin + 5);
            ctx.stroke();
        }
    
        // Courbe de compression (affichage de la courbe de transfert)
        ctx.strokeStyle = "#a3acb1";
        ctx.beginPath();
        ctx.moveTo(mapDbToX(-60), mapDbToY(-60));
        ctx.lineTo(mapDbToX(threshold), mapDbToY(threshold));
        for (let i = -60; i <= 0; i++) {
            const x = mapDbToX(i);
            const y = i > threshold ? mapDbToY(threshold + (i - threshold) / ratio) : mapDbToY(i);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    
        // Remplissage sous la courbe
        const gradient = ctx.createLinearGradient(0, mapDbToY(0), 0, canvas.height - margin);
        gradient.addColorStop(0, "#006eff");
        gradient.addColorStop(1, "#006eff00");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(mapDbToX(-60), canvas.height - margin);
        for (let i = -60; i <= 0; i++) {
            const x = mapDbToX(i);
            const y = i > threshold ? mapDbToY(threshold + (i - threshold) / ratio) : mapDbToY(i);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(mapDbToX(0), canvas.height - margin);
        ctx.closePath();
        ctx.fill();
    
        // Ligne du threshold
        ctx.strokeStyle = "red";
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(mapDbToX(threshold), margin);
        ctx.lineTo(mapDbToX(threshold), canvas.height - margin);
        ctx.stroke();
        ctx.setLineDash([]);
    
        // Affichage de la courbe finale
        ctx.strokeStyle = "#006eff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = -60; i <= 0; i += 0.5) {
            const x = mapDbToX(i);
            const y = i > threshold ? mapDbToY(threshold + (i - threshold) / ratio) : mapDbToY(i);
            if (i === -60) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
        }
        ctx.stroke();
    }

    connectedCallback() {
        this.boundCompressorStreamSent = (event) => {
            if (event.detail.track === this.input_id) {
                this.setAudioStream(event.detail.stream);
            }
        };
          
        window.opener.addEventListener("compressor-stream-sent", this.boundCompressorStreamSent);
        this.beforeUnloadHandler = () => this.cleanup();
        window.addEventListener("beforeunload", this.beforeUnloadHandler);
    }
    

    disconnectedCallback() {
        // Retrait du beforeUnload
        window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      
        // Checker l’existance de opener
        if (window.opener) {
          window.opener.removeEventListener("compressor-stream-sent", this.boundCompressorStreamSent);
        }
      
        if (this.audioContext) {
          this.audioContext.close();
        }
      }
      
      

    setAudioStream(stream) {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 128;
            // Augmenter le smoothing pour un rendu plus fluide
            this.analyser.smoothingTimeConstant = 0.9;
            this.bufferLength = this.analyser.frequencyBinCount;
            // Utilisation de Float32Array pour des données plus précises
            this.dataArray = new Float32Array(this.bufferLength);
        }
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
        this.updateVisualizer();
    }
    
    updateVisualizer() {
        if (!this.analyser) return;
        this.analyser.getFloatTimeDomainData(this.dataArray);
        let sumSq = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            let sample = this.dataArray[i];
            sumSq += sample * sample;
        }
        let rms = Math.sqrt(sumSq / this.bufferLength);
        let inputLevelDb = 20 * Math.log10(rms);
        if (!isFinite(inputLevelDb)) { inputLevelDb = -60; }
    
        const { threshold, ratio } = this.compressorConfig;
        let gainReduction = 0;
        if (inputLevelDb > threshold) {
            gainReduction = (inputLevelDb - threshold) * (1 - 1 / ratio);
        }
    
        let meterLevel = Math.min(gainReduction / 60, 1);
    
        // Lissage pour une animation fluide
        if (this.lastMeterLevel === undefined) {
            this.lastMeterLevel = meterLevel;
        } else {
            const smoothingFactor = 0.8;
            meterLevel = smoothingFactor * this.lastMeterLevel + (1 - smoothingFactor) * meterLevel;
            this.lastMeterLevel = meterLevel;
        }
    
        const canvas = this.querySelector(".visualizerCanvas");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    
        // Fond du visualiseur (sur tout le canvas)
        ctx.fillStyle = "#24292c";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    
        // Dessiner la barre bleue qui démarre à y = 0 (tout en haut)
        ctx.fillStyle = "#006eff";
        let barHeight = meterLevel * canvas.height;
        ctx.fillRect(0, 0, canvas.width, barHeight);
    
        // Fonction de mapping pour l'échelle en dB (0 dB en haut, -60 dB en bas)
        function mapDbToY(db) {
            return ((0 - db) / 60) * canvas.height;
        }
    
        // Ajouter une échelle en dB tous les 5 dB
        ctx.fillStyle ="rgba(255, 255, 255, 0.57)";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        // Pour chaque graduation de 0 à -60 dB
        for (let db = 0; db >= -60; db -= 5) {
            let y = mapDbToY(db);
    
            // Ajuster textBaseline pour éviter que le texte ne soit coupé
            if (db === 0) {
                ctx.textBaseline = "top";
                y += 10; // Décaler un peu vers le bas
            } else if (db === -60) {
                ctx.textBaseline = "bottom";
                y -= 10; // Décaler un peu vers le haut
            } else {
                ctx.textBaseline = "middle";
            }
            ctx.fillText(db + " dB", 20, y);
        }
    
        this._animFrameId = requestAnimationFrame(this.updateVisualizer.bind(this));
    }
    
    cleanup() {
        if (this._animFrameId) {
          cancelAnimationFrame(this._animFrameId);
          this._animFrameId = null;
        }
        if (this.audioContext) {
          this.audioContext.close(); 
          this.audioContext = null;
        }
      
        // Avant d’appeler removeEventListener
        if (window.opener) {
          window.opener.removeEventListener("compressor-stream-sent", this.boundCompressorStreamSent);
        }
      }
      
      
    
    
    
}
