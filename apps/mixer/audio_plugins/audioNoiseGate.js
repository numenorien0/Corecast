export default class AudioNoiseGate extends HTMLElement {
    constructor() {
      super();
      this.canvasWidth = 500;
      this.canvasHeight = 500;
      this.input_id = this.getAttribute("input_id");
  
      // On charge la configuration noisegate depuis l'attribut ou la configuration par défaut
      this.noiseGateConfig = this.getAttribute("noisegate") || this.getDefaultNoiseGateConfig();
      this.loadConfigFromAttributes();
      this.render();
    }
  
    loadConfigFromAttributes() {
      const noiseGateAttr = this.getAttribute("noisegate");
      if (noiseGateAttr) {
        try {
          this.noiseGateConfig = JSON.parse(noiseGateAttr);
        } catch (error) {
          this.noiseGateConfig = this.getDefaultNoiseGateConfig();
        }
      }
    }
  
    getDefaultNoiseGateConfig() {
      return {
        threshold: -40, // Seuil en dB
        reduction: -80, // Réduction appliquée en dessous du seuil (en dB)
        attack: 0.01,   // Attack en secondes
        release: 0.1    // Release en secondes
      };
    }
  
    render() {
      this.innerHTML = `
        <div class="noisegate">
          <canvas class="noiseGateCanvas" style='width: 500px; height: 500px' width="${this.canvasWidth}" height="${this.canvasHeight}"></canvas>
          <div class="noisegate_controls">
            <div class="control_row">
              ${this.renderControl("threshold", "Threshold", -80, 0, this.noiseGateConfig.threshold, "dB")}
              ${this.renderControl("reduction", "Reduction", -100, 0, this.noiseGateConfig.reduction, "dB")}
              ${this.renderControl("attack", "Attack", 0, 1, this.noiseGateConfig.attack, "s")}
              ${this.renderControl("release", "Release", 0, 1, this.noiseGateConfig.release, "s")}
            </div>
          </div>
        </div>
      `;
  
      this.querySelectorAll("rotary-knob").forEach(input => {
        input.addEventListener("input", this.updateNoiseGate.bind(this));
      });
  
      this.drawNoiseGateCurve();
    }
  
    renderControl(param, label, min, max, value, unit) {
      return `
        <div class="noisegate_control">
          <rotary-knob strokeWidth="5" style="width: 100px; height: 100px" 
                        data-param="${param}" min="${min}" max="${max}" step="${(max - min) / 100}" 
                        value="${value}"></rotary-knob>
          <label>
            <span class="noiseGateLabel">${label}</span><br/>
            <span class="noiseGateValue" id="${param}-value">${value.toFixed(2)} ${unit}</span>
          </label>
        </div>
      `;
    }
  
    updateNoiseGate(event) {
      const param = event.target.dataset.param;
      let value = parseFloat(event.target.value);
      this.noiseGateConfig[param] = value;
      // Pour attack et release, afficher "s" (secondes), sinon "dB"
      document.querySelector(`#${param}-value`).textContent = `${value.toFixed(2)} ${param === 'attack' || param === 'release' ? 's' : 'dB'}`;
      this.sendConfig();
      this.drawNoiseGateCurve();
    }
  
    sendConfig() {
      window.opener.dispatchEvent(new CustomEvent("noisegate-change", {
        detail: {
          noisegate: this.noiseGateConfig,
          track: this.input_id
        }
      }));
    }
  
    drawNoiseGateCurve() {
      const canvas = this.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgb(18, 20, 21)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  
      // Définition des marges et dimensions de la zone de dessin
      const margin = 50;
      const width = canvas.width - 2 * margin;
      const height = canvas.height - 2 * margin;
  
      // Fonctions de mapping pour l'axe horizontal (entrée) et vertical (sortie)
      // On considère ici un domaine de -80 dB à 0 dB.
      const mapDbToX = (db) => margin + ((db + 80) / 80) * width;
      const mapDbToY = (db) => margin + ((0 - db) / 80) * height;
  
      // Dessiner les axes
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin, canvas.height - margin);
      ctx.lineTo(canvas.width - margin, canvas.height - margin);
      ctx.moveTo(margin, margin);
      ctx.lineTo(margin, canvas.height - margin);
      ctx.stroke();
  
      // Graduations axe horizontal
      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      for (let db = -80; db <= 0; db += 20) {
        const x = mapDbToX(db);
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - margin);
        ctx.lineTo(x, canvas.height - margin + 5);
        ctx.stroke();
        ctx.fillText(db + " dB", x - 10, canvas.height - margin + 20);
      }
      // Graduations axe vertical
      for (let db = -80; db <= 0; db += 20) {
        const y = mapDbToY(db);
        ctx.beginPath();
        ctx.moveTo(margin - 5, y);
        ctx.lineTo(margin, y);
        ctx.stroke();
        ctx.fillText(db + " dB", margin - 40, y + 4);
      }
  
      // Fonction de transformation du noise gate (seulement basée sur threshold et reduction)
      const threshold = this.noiseGateConfig.threshold; // en dB
      const reduction = this.noiseGateConfig.reduction;     // en dB
      const noiseGateOutput = (x) => {
        if (x < threshold) {
          return Math.max(x + reduction, -80);
        }
        return x;
      };
  
      // Tracer la courbe du noise gate
      ctx.strokeStyle = "#006eff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const numPoints = 200;
      for (let i = 0; i <= numPoints; i++) {
        const inputDb = -80 + (i / numPoints) * 80;
        const outputDb = noiseGateOutput(inputDb);
        const x = mapDbToX(inputDb);
        const y = mapDbToY(outputDb);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
  
      // Tracer la ligne verticale indiquant le seuil
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      const thresholdX = mapDbToX(threshold);
      ctx.beginPath();
      ctx.moveTo(thresholdX, margin);
      ctx.lineTo(thresholdX, canvas.height - margin);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  