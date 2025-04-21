export default class RotaryKnob extends HTMLElement {
    constructor() {
        super();
        this.min = this.hasAttribute("min") ? parseFloat(this.getAttribute("min")) : 0;
        this.max = this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : 100;
        this.step = parseFloat(this.getAttribute("step")) || 1;
        const valueAttr = this.getAttribute("value");
        this._value = valueAttr !== null ? parseFloat(valueAttr) : (this.min + this.max) / 2;

        this.strokeWidth = this.getAttribute("strokeWidth") || 10;
        
        this.dragging = false;
        this.lastY = 0;

        this.render();
    }

    render() {
        this.innerHTML = `
            <style>
                .knob-container {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }
                .knob-container svg {
                    transform: rotate(-90deg);
                }
                .progress {

                }
                .value-container {
                    display: flex;
                    justify-content: center;
                    margin-top: 5px;
                }
                .value-input {
                    width: 50px;
                    height: 20px;
                    font-size: 14px;
                    text-align: center;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background: #222;
                    color: white;
                }
            </style>
            <div class="knob-container">
                <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#24292c"
                            stroke-width="${this.strokeWidth}" fill="none"></circle>
                    <circle class="progress" cx="50" cy="50" r="40" stroke="#006eff"
                            stroke-width="${this.strokeWidth}" fill="none"
                            stroke-dasharray="0 251.2" stroke-linecap="round"></circle>
                </svg>
            </div>
            <div class="value-container">
                <input type="hidden" class="value-input" value="${this._value}">
            </div>
        `;

        this.knob = this.querySelector(".knob-container");
        this.progressCircle = this.querySelector(".progress");
        this.valueInput = this.querySelector(".value-input");

        this.updateUI();

        // Gestions des évènements
        this.knob.addEventListener("mousedown", (e) => this.startDrag(e));
        document.addEventListener("mousemove", (e) => this.handleDrag(e));
        document.addEventListener("mouseup", () => this.stopDrag());

        this.valueInput.addEventListener("change", (e) => this.handleInputChange(e));
    }

    // ---------------------------
    // GESTION DU DRAG
    // ---------------------------

    startDrag(event) {
        this.dragging = true;
        this.lastY = event.clientY;
        event.preventDefault();
    }

    handleDrag(event) {
        if (!this.dragging) return;

        const deltaY = this.lastY - event.clientY;
        this.lastY = event.clientY;

        // Ajuster la sensibilité à votre convenance
        let valueDelta = deltaY * (this.max - this.min) / 100;
        let oldValue = this._value;

        this.value = this._clampAndStep(this._value + valueDelta);

        // Déclencher 'input' uniquement si la valeur a changé
        if (this._value !== oldValue) {
            this.dispatchEvent(new Event("input"));
        }
    }

    stopDrag() {
        this.dragging = false;
        // On émet "change" à la fin du drag, comme un <input type="range">
        this.dispatchEvent(new Event("change"));
    }

    // ---------------------------
    // GESTION DE L'INPUT TEXT
    // ---------------------------

    handleInputChange(event) {
        let newValue = parseFloat(event.target.value);
        if (!isNaN(newValue)) {
            let oldValue = this._value;
            this.value = this._clampAndStep(newValue);
            if (this._value !== oldValue) {
                this.dispatchEvent(new Event("input"));
            }
        } else {
            // Annuler et revenir à l'ancienne valeur si saisie invalide
            this.valueInput.value = this._value;
        }
    }

    // ---------------------------
    // GET/SET de "value"
    // ---------------------------
    get value() {
        return this._value;
    }

    set value(newValue) {
        // Seule la mise à jour de this._value + UI
        // --> PAS de this.dispatchEvent("input") ici
        this._value = this._clampAndStep(newValue);
        this.updateUI();
    }

    // Méthode utilitaire pour clamp + step
    _clampAndStep(num) {
        // Respect des bornes
        num = Math.min(Math.max(num, this.min), this.max);
        // Step
        return Math.round(num / this.step) * this.step;
    }

    // ---------------------------
    // Mise à jour de l'UI
    // ---------------------------
    updateUI() {
        if (this.progressCircle) {
            const percent = (this._value - this.min) / (this.max - this.min);
            const circumference = 2 * Math.PI * 40;
            const offset = circumference * (1 - percent);
            this.progressCircle.setAttribute("stroke-dasharray", `${circumference} ${circumference}`);
            this.progressCircle.setAttribute("stroke-dashoffset", offset);
        }
        if (this.valueInput) {
            this.valueInput.value = this._value;
        }
    }

    // ---------------------------
    // Méthodes du cycle de vie
    // ---------------------------
    connectedCallback() {
        this.updateUI();
    }

    // ...
}
