const { translation } = require('./local/local.js');

export default class TransitionComponent extends HTMLElement {
	constructor() {
	  super();
      this.invert = false;
	}

	connectedCallback() {
	  this.innerHTML = `
		<div class="transition-container">
		  <select id="transition" style='margin: 0 auto'>
			<option value="cut">Cut</option>
			<option value="fade">Fade</option>
			<option value="slideOver">SlideOver</option>
			<option value="push">Push</option>
			<option value="crop">Crop</option>
		  </select>
		  <select id="direction" style="display:none; margin-right: 0; width: 50px">
			<option value="left">→</option>
			<option value="right">←</option>
            <option value="up">↓</option>
            <option value="down">↑</option>
		  </select>
		    <input type="number" id="duration" value="1000" style='width: 50px !important; padding: 5px' placeholder="${translation[window.config.general.language].durationMs}" min="0">
            <input type='range' id='tbar' min='0' max='100' value='0' style='display: none; width: 300px; margin: 0 auto; display: none;'>
		  <button id="switch">${translation[window.config.general.language].switch}</button>
		</div>
	  `;

	  const allowedWithDirection = ["crop", "push", "slideOver"];
	  const transitionSelect = this.querySelector("#transition");
	  const directionSelect = this.querySelector("#direction");
	  const durationInput = this.querySelector("#duration");
	  const switchButton = this.querySelector("#switch");
      const tbar = this.querySelector("#tbar");

	  transitionSelect.addEventListener("change", () => {
		if (allowedWithDirection.includes(transitionSelect.value)) {
		  directionSelect.style.display = "inline-block";
		} else {
		  directionSelect.style.display = "none";
		}
	  });

	  switchButton.addEventListener("click", () => {
	    const transition = transitionSelect.value;
		const duration = parseInt(durationInput.value) || 2000;
		const direction = allowedWithDirection.includes(transition) ? directionSelect.value : null;

		const eventDetail = { transition, direction, duration };

		window.dispatchEvent(new CustomEvent("previewToPGM", { detail: eventDetail }));
	  });

      window.addEventListener('updateTbar', (e) => {
        if(e.detail.progress == 100){
            this.invert = !this.invert;
        }
      })

      window.addEventListener('progressTransition', (e) => {
        this.progressTransition(this.invert ? 100 - e.detail.progress : e.detail.progress);
      });

	}

    progressTransition(progress){
        const allowedWithDirection = ["crop", "push", "slideOver"];
	    const transitionSelect = this.querySelector("#transition");
	    const directionSelect = this.querySelector("#direction");
	    const durationInput = this.querySelector("#duration");

        const value = progress;
        const transition = transitionSelect.value;
		const duration = parseInt(durationInput.value) || 2000;
		const direction = allowedWithDirection.includes(transition) ? directionSelect.value : null;
		if(transition == "cut" && (value != 100 && value != 0)){
			return;
		}
		const eventDetail = { transition, direction, duration, progress: value };
        window.dispatchEvent(new CustomEvent("previewToPGM", { detail: eventDetail}));
    }

  }