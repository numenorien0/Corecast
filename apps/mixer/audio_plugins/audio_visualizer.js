// import { setVuMeterLevelMCU } from '../../MCcontrol.js'
export default class AudioVisualizer extends HTMLElement {

    constructor() {
        super();
        this.stream = null;
        this.audioContext = window.sharedAudioContext;
        this.leftAnalyser = null;
        this.rightAnalyser = null;
        this.visualizerSplitter = null;
        this.animationFrameId = null;
        this.id = this.getAttribute('data-id');
        this.color = this.getAttribute("color") || "lime";

        // Variables de lissage
        this.smoothedLeftAmplitude = 0;
        this.smoothedRightAmplitude = 0;
    }

    connectedCallback() {
        this.render();
        this.updateCanvasVisibility();
        window.addEventListener("setVisualiser", (e) => {
            if (e.detail.track === this.id) {
                this.setStream(e.detail.stream, e.detail.numberOfChannels);
            }
        })
    }

    static get observedAttributes() {
        return ["color"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "color") {
            this.color = newValue;
        }
    }

    setStream(stream, numberOfChannels) {
        this.stream = stream;
        if (!this.stream) return;

        const audioTracks = this.stream.getAudioTracks();
        if (!audioTracks.length) return;

        this.setupAnalyserNodes(numberOfChannels);
    }

    setupAnalyserNodes(numberOfChannels) {
        if (numberOfChannels === 1) {
            this.leftAnalyser = this.audioContext.createAnalyser();
            this.rightAnalyser = null;

            const source = this.audioContext.createMediaStreamSource(this.stream);
            source.connect(this.leftAnalyser);
        } else {
            this.visualizerSplitter = this.audioContext.createChannelSplitter(2);

            const source = this.audioContext.createMediaStreamSource(this.stream);
            source.connect(this.visualizerSplitter);

            this.leftAnalyser = this.audioContext.createAnalyser();
            this.rightAnalyser = this.audioContext.createAnalyser();

            this.visualizerSplitter.connect(this.leftAnalyser, 0);
            this.visualizerSplitter.connect(this.rightAnalyser, 1);
        }

        this.updateCanvasVisibility();
        this.startVisualizer();
    }

    updateCanvasVisibility() {
        // Avec un canvas unique, cette méthode peut être adaptée si besoin.
    }

    // Version modifiée de fillMeterSegment avec x et width en paramètres
    fillMeterSegment(ctx, x, areaWidth, canvasHeight, lower, upper, fillColor) {
        if (upper <= lower) return;
        const y = canvasHeight - upper * canvasHeight;
        const height = (upper - lower) * canvasHeight;
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, areaWidth, height);
    }

    startVisualizer() {
        if (!this.leftAnalyser) return;
        const canvas = this.querySelector('.vuMeter');
        if (!canvas) return;
        //const ctx = canvas.getContext('2d');
        // const ctx = enableWebGLCanvas(  canvas );
        this.offscreen = new OffscreenCanvas(canvas.width, canvas.height);
        // On récupère le contexte 2D de l'offscreen canvas
        const ctx = this.offscreen.getContext("2d");
        const bufferLength = this.leftAnalyser.fftSize;
        const leftDataArray = new Uint8Array(bufferLength);
        const rightDataArray = this.rightAnalyser ? new Uint8Array(bufferLength) : null;

        // Seuils
        const yellowThreshold = 0.8;
        const redThreshold = 0.95;

        // Facteur de lissage
        const alpha = 0.8;

        const draw = () => {
            // ctx.start2D();
            this.animationFrameId = requestAnimationFrame(draw);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // --- Canal gauche ---
            this.leftAnalyser.getByteTimeDomainData(leftDataArray);
            let maxLeftAmplitude = 0;
            for (let i = 0; i < bufferLength; i++) {
                const sample = (leftDataArray[i] - 128) / 128; // Normalisation entre -1 et 1
                maxLeftAmplitude = Math.max(maxLeftAmplitude, Math.abs(sample));
            }
            this.smoothedLeftAmplitude = alpha * this.smoothedLeftAmplitude + (1 - alpha) * maxLeftAmplitude;
            const ampLeft = this.smoothedLeftAmplitude;
            if(this.id) {
                window.dispatchEvent(new CustomEvent("volumeVisualizer", { detail: { track: this.id, volume: ampLeft }}));
            }

            // --- Canal droit (si présent) ---
            let ampRight = 0;
            if (this.rightAnalyser && rightDataArray) {
                this.rightAnalyser.getByteTimeDomainData(rightDataArray);
                let maxRightAmplitude = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const sample = (rightDataArray[i] - 128) / 128;
                    maxRightAmplitude = Math.max(maxRightAmplitude, Math.abs(sample));
                }
                this.smoothedRightAmplitude = alpha * this.smoothedRightAmplitude + (1 - alpha) * maxRightAmplitude;
                ampRight = this.smoothedRightAmplitude;
            }

            const canvasHeight = canvas.height;
            if (!this.rightAnalyser) {
                // Mode mono : une seule barre sur tout le canvas
                this.fillMeterSegment(ctx, 0, canvas.width, canvasHeight, 0, Math.min(ampLeft, yellowThreshold), this.color);
                if (ampLeft > yellowThreshold) {
                    this.fillMeterSegment(ctx, 0, canvas.width, canvasHeight, yellowThreshold, Math.min(ampLeft, redThreshold), "yellow");
                }
                if (ampLeft > redThreshold) {
                    this.fillMeterSegment(ctx, 0, canvas.width, canvasHeight, redThreshold, ampLeft, "red");
                }
            } else {
                // Mode stéréo : deux barres côte à côte
                const halfWidth = canvas.width / 2;
                // Barre canal gauche
                this.fillMeterSegment(ctx, 0, halfWidth, canvasHeight, 0, Math.min(ampLeft, yellowThreshold), this.color);
                if (ampLeft > yellowThreshold) {
                    this.fillMeterSegment(ctx, 0, halfWidth, canvasHeight, yellowThreshold, Math.min(ampLeft, redThreshold), "yellow");
                }
                if (ampLeft > redThreshold) {
                    this.fillMeterSegment(ctx, 0, halfWidth, canvasHeight, redThreshold, ampLeft, "red");
                }
                // Barre canal droit
                this.fillMeterSegment(ctx, halfWidth, halfWidth, canvasHeight, 0, Math.min(ampRight, yellowThreshold), this.color);
                if (ampRight > yellowThreshold) {
                    this.fillMeterSegment(ctx, halfWidth, halfWidth, canvasHeight, yellowThreshold, Math.min(ampRight, redThreshold), "yellow");
                }
                if (ampRight > redThreshold) {
                    this.fillMeterSegment(ctx, halfWidth, halfWidth, canvasHeight, redThreshold, ampRight, "red");
                }
            }
            const visibleCtx = canvas.getContext("2d");
      
            visibleCtx.clearRect(0, 0, canvas.width, canvas.height);
            visibleCtx.drawImage(this.offscreen, 0, 0);
            // ctx.finish2D();
        };

        draw();
    }

    disconnectedCallback() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    render() {
        // On utilise un seul canvas ici
        this.innerHTML = `
            <div class="vumeter" style="display: flex; gap: 4px;">
                <canvas class="vuMeter" width="40" height="200"></canvas>
            </div>
        `;
    }
}
