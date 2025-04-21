export default class ParametricEQ extends HTMLElement {
    constructor() {
        super();
        this.filters = [];
        this.canvasWidth = 1920;
        this.canvasHeight = 1080;
        this.input_id = this.getAttribute("input_id");

        this.filterConfigs;
        this.loadConfigFromAttributes();

        this.draggedFilterIndex = null;
        this.hoveredFilterIndex = null; // Suivi du survol
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;


        this.render();
    }

    loadConfigFromAttributes() {
        const filtersAttr = this.getAttribute("filters");

        if (filtersAttr) {
            try {
                this.filterConfigs = JSON.parse(filtersAttr);
            } catch (error) {
                this.filterConfigs = this.getDefaultFilters();
            }
        } else {
            this.filterConfigs = this.getDefaultFilters();
        }
    }

    getDefaultFilters() {
        return [
            { type: "none", frequency: 100, gain: 0, Q: 10 },
            { type: "none", frequency: 250, gain: 0, Q: 10 },
            { type: "none", frequency: 1000, gain: 0, Q: 10 },
            { type: "none", frequency: 4000, gain: 0, Q: 10 },
            { type: "none", frequency: 8000, gain: 0, Q: 10 }
        ];
    }

    getDefaultFiltersValue() {
        return [
            { type: "highpass", frequency: 100, gain: -15, Q: 5 },
            { type: "lowshelf", frequency: 250, gain: 0, Q: 1 },
            { type: "peaking", frequency: 1000, gain: 0, Q: 1 },
            { type: "highshelf", frequency: 4000, gain: 0, Q: 1 },
            { type: "lowpass", frequency: 8000, gain: -15, Q: 5 },
            { type: "none", frequency: 1000, gain: 0, Q: 1 }
        ];
    }

    render() {
        this.innerHTML = `
        <div class='eq'>
            <canvas width="1920" height="1080"></canvas>
            <div class='eq_filters'>
                ${this.filterConfigs.map((filter, index) => {
                    let options = '';
                    if (index === 0) {
                        options = `
                            <label><input type="radio" name="filter${index}" data-index="${index}" data-param="type" value="none" ${filter.type === "none" ? "checked" : ""}> <div class='filter_button'><img src='img/line.png' class=''></div></label>
                            <label><input type="radio" name="filter${index}" data-index="${index}" data-param="type" value="highpass" ${filter.type === "highpass" ? "checked" : ""}> <div class='filter_button'><img src='img/pass.png'></div></label>
                        `;
                    } else if (index === this.filterConfigs.length - 1) {
                        options = `
                            <label><input type="radio" name="filter${index}" data-index="${index}" data-param="type" value="none" ${filter.type === "none" ? "checked" : ""}> <div class='filter_button'><img src='img/line.png' class=''></div></label>
                            <label><input type="radio" name="filter${index}" data-index="${index}" data-param="type" value="lowpass" ${filter.type === "lowpass" ? "checked" : ""}> <div class='filter_button'><img src='img/pass.png' class='revert'></div></label>
                        `;
                    } else {
                        const validFilters = ["none", "lowshelf", "peaking", "highshelf"];
                        options = validFilters.map(type => `
                            <label><input type="radio" name="filter${index}" data-index="${index}" data-param="type" value="${type}" ${filter.type === type ? "checked" : ""}> <div class='filter_button'><img class='${type == "highshelf" ? "revert" : ""}' src='img/${type == "peaking" ? "peak" : type == "none" ? "line" : "shelf"}.png'></div></label>
                        `).join('');
                    }

                    return `
                        <div class='eq_filter'>
                            <div class="filter-options">
                                ${options}
                            </div>
                            <div class='filter_column ${filter.type == "none" ? "hide" : "" }'>
                                <div class='filter-title'><span id="freq-value-${index}">${Math.round(filter.frequency)} Hz</span></div>
                                <input type="range" data-index="${index}" data-param="frequency" min="${Math.log10(20)}" max="${Math.log10(20000)}" step="0.01" value="${Math.log10(filter.frequency)}">

                                <div class='filter-title'><span id="gain-value-${index}">${filter.gain} dB</span></div>
                                <input class='${filter.type === "highpass" || filter.type === "lowpass" ? "disable_gain" : ""}' type="range" data-index="${index}" data-param="gain" step="0.1" min="-15" max="15" value="${filter.type === "highpass" || filter.type === "lowpass" ? "-15" : filter.gain}" >

                                <div class='filter-title'><span id="q-value-${index}">${filter.Q.toFixed(1)}</span></div>
                                <input type="range" data-index="${index}" data-param="Q" min="0.1" max="15" step="0.1" value="${filter.Q}">
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;

        this.querySelectorAll("input, select").forEach(input => {
            input.addEventListener("input", this.updateFilter.bind(this));
        });

        this.canvas = this.querySelector("canvas");
        this.offscreen = new OffscreenCanvas(this.canvas.width, this.canvas.height);
        this.ctx = this.offscreen.getContext("2d");
        this.visibleCtx = this.canvas.getContext("2d", { alpha: false, willReadFrequently: false });

        this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
        this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
        this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
        this.canvas.addEventListener("mouseleave", this.handleMouseUp.bind(this));
        this.canvas.addEventListener("wheel", this.handleWheel.bind(this));

        this.drawEQCurve();
    }

    updateFilter(event) {
        const index = event.target.dataset.index;
        const param = event.target.dataset.param;
        let value = event.target.value;

        if (param === "frequency") {
            value = Math.pow(10, parseFloat(value));
            this.querySelector(`#freq-value-${index}`).textContent = `${Math.round(value)} Hz`;
        } else if (param === "gain") {
            value = parseFloat(value);
            this.querySelector(`#gain-value-${index}`).textContent = `${value} dB`;
        } else if (param === "Q") {
            value = parseFloat(value);
            this.querySelector(`#q-value-${index}`).textContent = `${value.toFixed(1)}`;
        }

        if (param === "type") {
            if (value === "none") {
                this.filterConfigs[index] = { type: "none", frequency: 0, gain: 0, Q: 1 };
            } else {
                this.filterConfigs[index] = this.getDefaultFiltersValue().find(f => f.type === value);
            }
            this.render();
        } else {
            this.filterConfigs[index][param] = value;
        }

        this.send_config();
        this.drawEQCurve();
    }

    send_config() {
        window.opener.dispatchEvent(new CustomEvent("eq-change", {
            detail: {
                eq: this.getEQSettings(),
                track: this.input_id
            }
        }));
    }

    getEQSettings() {
        return this.filterConfigs;
    }

    computeGain(frequency) {
        let totalGain = 0;
        const freqPoints = [20, 30, 40, 50, 60, 80, 100, 200, 300, 400, 500, 800, 1000, 2000, 3000, 4000, 6000, 8000, 10000, 20000];

        this.filterConfigs.forEach(filter => {
            if (filter.type === "none") return;

            const f0 = filter.frequency;
            const qFactor = Math.max(filter.Q, 0.1);
            let gain = 0;

            let lowerBound = freqPoints[0];
            let upperBound = freqPoints[freqPoints.length - 1];

            for (let i = 0; i < freqPoints.length; i++) {
                if (freqPoints[i] >= f0) {
                    lowerBound = freqPoints[Math.max(i - 1, 0)];
                    upperBound = freqPoints[i];
                    break;
                }
            }

            const logLower = Math.log10(lowerBound);
            const logUpper = Math.log10(upperBound);
            const logBandwidth = (logUpper - logLower) / qFactor;

            switch (filter.type) {
                case "highpass":
                    gain = filter.gain * (1 / (1 + Math.pow(frequency / f0, 2 * qFactor)));
                    break;
                case "lowshelf":
                    gain = filter.gain / (1 + Math.pow(frequency / f0, 2 * qFactor));
                    break;
                case "peaking":
                    const sigma = 0.3 / filter.Q; // vous pouvez ajuster ce coefficient si nécessaire
                    gain = filter.gain * Math.exp(-Math.pow(Math.log10(frequency) - Math.log10(f0), 2) / (2 * Math.pow(sigma, 2)));
                    break;
                    
                case "highshelf":
                    gain = filter.gain * (1 - 1 / (1 + Math.pow(frequency / f0, qFactor)));
                    break;
                case "lowpass":
                    gain = filter.gain * (1 - 1 / (1 + Math.pow(frequency / f0, 2 * qFactor)));
                    break;
            }
            totalGain += gain;
        });

        return totalGain;
    }

    drawEQCurve() {

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgb(18, 20, 21)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const margin = 100;
        const freqPoints = [20, 30, 40, 50, 60, 80, 100, 200, 300, 400, 500, 800, 1000, 2000, 3000, 4000, 6000, 8000, 10000, 20000];

        function mapFrequencyToX(freq, width) {
            const logMin = Math.log10(20);
            const logMax = Math.log10(20000);
            return margin + ((Math.log10(freq) - logMin) / (logMax - logMin)) * (width - 2 * margin);
        }

        function mapDbToY(db, height) {
            const minDb = -15;
            const maxDb = 15;
            return height - margin - ((db - minDb) / (maxDb - minDb)) * (height - 2 * margin);
        }

        // Ligne de 0 dB
        this.ctx.strokeStyle = "gray";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        const zeroDbY = mapDbToY(0, this.canvas.height);
        this.ctx.moveTo(margin, zeroDbY);
        this.ctx.lineTo(this.canvas.width - margin, zeroDbY);
        this.ctx.stroke();

        this.ctx.fillStyle = "white";
        this.ctx.font = "24px Arial";
        this.ctx.textAlign = "center";

        freqPoints.forEach(freq => {
            const x = mapFrequencyToX(freq, this.canvas.width);
            let label = freq >= 1000 ? `${freq / 1000}k` : freq.toString();
            this.ctx.strokeStyle = "black";
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.canvas.height - margin);
            this.ctx.lineTo(x, this.canvas.height - margin + 10);
            this.ctx.stroke();
            this.ctx.fillText(label, x, this.canvas.height - 20);
        });

        const dbValues = [15, 10, 5, 0, -5, -10, -15];
        this.ctx.textAlign = "right";
        dbValues.forEach(db => {
            const y = mapDbToY(db, this.canvas.height);
            this.ctx.strokeStyle = "#404040";
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(margin, y);
            this.ctx.lineTo(this.canvas.width - margin, y);
            this.ctx.stroke();
            this.ctx.fillText(`${db} dB`, margin - 5, y + 5);
        });

        const gradient = this.ctx.createLinearGradient(0, margin, 0, this.canvas.height - margin);
        gradient.addColorStop(0, "#006eff80");
        gradient.addColorStop(1, "#006eff00");
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();

        const numPoints = 200;
        let firstX = null;

        for (let i = 0; i < numPoints; i++) {
            const freq = Math.pow(10, Math.log10(20) + (i / numPoints) * (Math.log10(20000) - Math.log10(20)));
            let gainDb = this.computeGain(freq);
            const x = mapFrequencyToX(freq, this.canvas.width);
            const y = mapDbToY(gainDb, this.canvas.height);
            if (i === 0) {
                this.ctx.moveTo(x, y);
                firstX = x;
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.lineTo(this.canvas.width - margin, this.canvas.height - margin);
        this.ctx.lineTo(firstX, this.canvas.height - margin);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.strokeStyle = "#006eff";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        for (let i = 0; i < numPoints; i++) {
            const freq = Math.pow(10, Math.log10(20) + (i / numPoints) * (Math.log10(20000) - Math.log10(20)));
            let gainDb = this.computeGain(freq);
            const x = mapFrequencyToX(freq, this.canvas.width);
            const y = mapDbToY(gainDb, this.canvas.height);
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();

        // Dessiner les points de filtres avec un cercle agrandi au survol
        this.filterConfigs.forEach((filter, index) => {
            if (filter.type !== "none") {
                const x = mapFrequencyToX(filter.frequency, this.canvas.width);
                const y = mapDbToY(this.computeGain(filter.frequency), this.canvas.height);
                // Si le filtre est survolé, augmenter le rayon
                const radius = (this.hoveredFilterIndex === index) ? 16 : 12;
                this.ctx.fillStyle = "#c7c7c7";
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.strokeStyle = "#0015ff";
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
                this.canvas.dataset.index = index;
            }
        });

        this.visibleCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.visibleCtx.drawImage(this.offscreen, 0, 0);
    }

    handleMouseDown(event) {
        const canvas = this.querySelector("canvas");
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
    
        this.filterConfigs.forEach((filter, index) => {
            if (filter.type !== "none") {
                const x = this.mapFrequencyToX(filter.frequency, canvas.width);
                // Pour les filtres shelf, nous utilisons la position exacte de la souris comme point de départ
                const y = (filter.type === "lowshelf" || filter.type === "highshelf")
                    ? this.mapDbToY(filter.gain / 2, canvas.height)
                    : this.mapDbToY(this.computeGain(filter.frequency), canvas.height);
                const distance = Math.hypot(mouseX - x, mouseY - y);
                if (distance <= 12) {
                    this.draggedFilterIndex = index;
                    this.dragOffsetX = mouseX - x;
                    this.dragOffsetY = mouseY - y;
                    if (filter.type === "lowshelf" || filter.type === "highshelf") {
                        // Pour les filtres shelf, on enregistre la position Y de départ et le gain initial
                        filter._dragStartMouseY = mouseY;
                        filter._dragStartGain = filter.gain;
                    }
                }
            }
        });
    }
    
    handleMouseMove(event) {
        const canvas = this.querySelector("canvas");
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
    
        if (this.draggedFilterIndex !== null) {
            const filter = this.filterConfigs[this.draggedFilterIndex];
            // Mise à jour de la fréquence (commune à tous les filtres)
            const newFreq = this.mapXToFrequency(mouseX - this.dragOffsetX, canvas.width);
            filter.frequency = Math.max(20, Math.min(20000, newFreq));
    
            if (filter.type === "lowshelf" || filter.type === "highshelf") {
                let newGain = (this.mapYToDb(mouseY - this.dragOffsetY, canvas.height) * 2).toFixed(1);
                filter.gain = Math.max(-15, Math.min(15, newGain));                
            } else {
                let newGain = (this.mapYToDb(mouseY - this.dragOffsetY, canvas.height)).toFixed(1);;
                //newGain = Math.round(newGain * 2) / 2;
                if (filter.type !== "highpass" && filter.type !== "lowpass") {
                    filter.gain = Math.max(-15, Math.min(15, newGain));
                }
            }
            
            this.querySelector(`#freq-value-${this.draggedFilterIndex}`).textContent = `${Math.round(filter.frequency)} Hz`;
            this.querySelector(`#gain-value-${this.draggedFilterIndex}`).textContent = `${filter.gain} dB`;
            this.hoveredFilterIndex = this.draggedFilterIndex;
        
            this.send_config();
            this.drawEQCurve();
        } else {
            // Mise à jour de l'état de survol (hover)
            let foundHover = false;
            for (let i = 0; i < this.filterConfigs.length; i++) {
                const filter = this.filterConfigs[i];
                if (filter.type === "none") continue;
                const x = this.mapFrequencyToX(filter.frequency, canvas.width);
                const y = this.mapDbToY(this.computeGain(filter.frequency), canvas.height);
                if (Math.hypot(mouseX - x, mouseY - y) <= 12) {
                    this.hoveredFilterIndex = i;
                    foundHover = true;
                    break;
                }
            }
            if (!foundHover) {
                this.hoveredFilterIndex = null;
            }
            this.drawEQCurve();
        }
    }
    
    
    
    handleMouseUp() {
        this.draggedFilterIndex = null;
    }
    
    handleWheel(event) {
        event.preventDefault();
        const canvas = this.querySelector("canvas");
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;

        for (let i = 0; i < this.filterConfigs.length; i++) {
            let filter = this.filterConfigs[i];
            if (filter.type === "none") continue;
            const x = this.mapFrequencyToX(filter.frequency, canvas.width);
            const y = this.mapDbToY(this.computeGain(filter.frequency), canvas.height);
            const distance = Math.hypot(mouseX - x, mouseY - y);
            if (distance <= 12) {
                const delta = event.deltaY < 0 ? 0.1 : -0.1;
                let newQ = filter.Q + delta;
                newQ = Math.round(newQ * 10) / 10;
                filter.Q = Math.max(0.1, Math.min(15, newQ));
                this.querySelector(`#q-value-${i}`).textContent = filter.Q.toFixed(1);
                const slider = this.querySelector(`input[data-index="${i}"][data-param="Q"]`);
                if (slider) slider.value = filter.Q;
                this.send_config();
                this.drawEQCurve();
                break;
            }
        }
    }

    mapFrequencyToX(freq, width) {
        const margin = 100;
        const logMin = Math.log10(20);
        const logMax = Math.log10(20000);
        return margin + ((Math.log10(freq) - logMin) / (logMax - logMin)) * (width - 2 * margin);
    }

    mapDbToY(db, height) {
        const margin = 100;
        const minDb = -15;
        const maxDb = 15;
        return height - margin - ((db - minDb) / (maxDb - minDb)) * (height - 2 * margin);
    }

    mapXToFrequency(x, width) {
        const margin = 100;
        const logMin = Math.log10(20);
        const logMax = Math.log10(20000);
        return Math.pow(10, logMin + ((x - margin) / (width - 2 * margin)) * (logMax - logMin));
    }

    mapYToDb(y, height) {
        const margin = 100;
        const minDb = -15;
        const maxDb = 15;
        return maxDb - ((y - margin) / (height - 2 * margin)) * (maxDb - minDb);
    }
}
