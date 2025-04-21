export default class ProgressBar extends HTMLElement {
    constructor() {
        super();
        this.min = 0;
        this.max = 100;
        this.value = 0;
    }

    connectedCallback() {
        this.render();
        this.attachEventListeners();
    }

    render() {
        this.innerHTML = `
        <div class="custom-range-container" style="width: 100%; height: 5px; position: relative; cursor: pointer;">
            <div class="progress-bar" style="position: absolute; width: ${this.value}% ; height: 100%;"></div>
            <div class="thumb" style="position: absolute; left: ${this.value}%; transform: translateX(-50%);"></div>
        </div>
        `;
    }

    attachEventListeners() {
        const container = this.querySelector('.custom-range-container');
        const thumb = this.querySelector('.thumb');

        let isDragging = false;

        // Lorsque l'utilisateur clique sur la barre de progression, on met à jour la valeur du curseur
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            this.updateValue(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                this.updateValue(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value } }));
            }
            isDragging = false;
        });

        // Synchroniser la valeur avec la position de la souris
        this.updateValue = (e) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            // newValue en 0..1000
            let newValue = (x / rect.width) * (this.max - this.min) + this.min;
            newValue = Math.max(this.min, Math.min(this.max, newValue));
            this.value = newValue;
            this.updateUI();

            //this.dispatchEvent(new CustomEvent('input', { detail: { value: this.value } }));
        };
    }

    updateUI() {
        const progressBar = this.querySelector('.progress-bar');
        const thumb = this.querySelector('.thumb');
        
        // Conversion en pourcentage sur 0..100
        const percent = ((this.value - this.min) / (this.max - this.min)) * 100;
        
        progressBar.style.width = percent + '%';
        thumb.style.left = percent + '%';
      }
      

    get currentValue() {
        return this.value;
    }

    set currentValue(val) {
        this.value = Math.max(this.min, Math.min(this.max, val));
        this.updateUI();
    }
}
