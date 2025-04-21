const { translation } = require('./local/local.js');

export default class sidePanel extends HTMLElement{
    constructor(){
      super();
    }
  
    render(){
      this.innerHTML = `
        <style>
          
        </style>
        <div class="tabs">
          <!-- Slider de fond -->
          <div class="slider"></div>
          <div class="tab active" data-tab="tab1">${translation[window.config.general.language].player} 1</div>
          <div class="tab" data-tab="tab2">${translation[window.config.general.language].player} 2</div>
          <div class="tab" data-tab="tab3">${translation[window.config.general.language].scenes}</div>
          <div class="tab" data-tab="tab4">${translation[window.config.general.language].cameras}</div>
          <div class="tab" data-tab="tab5">${translation[window.config.general.language].graphics}</div>
        </div>
        <div class="contents">
          <div class="tab-content active" id="tab1">
            <mini-player player="1"></mini-player>
            <playlist-service style='margin-left: -10px; width: calc(100% + 20px)' display="inline" mediaplayer="1"></playlist-service>
          </div>
          <div class="tab-content" id="tab2">
            <mini-player player="2"></mini-player>
            <playlist-service style='margin-left: -10px; width: calc(100% + 20px)' display="inline" mediaplayer="2"></playlist-service>
          </div>
          <div class="tab-content" id="tab3">
            <macro-editor></macro-editor>
          </div>
          <div class="tab-content" style='position: relative' id="tab4">
            <div style='height: 100%; overflow: auto; width: calc(100% + 20px); margin-left: -10px; padding-bottom: 50px'>
            <camera-select class="line" unique_id="camera1" label="${translation[window.config.general.language].camera} 1"></camera-select>
            <camera-select class="line" unique_id="camera2" label="${translation[window.config.general.language].camera} 2"></camera-select>
            <camera-select class="line" unique_id="camera3" label="${translation[window.config.general.language].camera} 3"></camera-select>
            <camera-select class="line" unique_id="camera4" label="${translation[window.config.general.language].camera} 4"></camera-select>
            <camera-select class="line" unique_id="camera5" label="${translation[window.config.general.language].camera} 5"></camera-select>
            <camera-select class="line" unique_id="camera6" label="${translation[window.config.general.language].camera} 6"></camera-select>
            <camera-select class="line" unique_id="camera7" label="${translation[window.config.general.language].camera} 7"></camera-select>
            <camera-select class="line" unique_id="camera8" label="${translation[window.config.general.language].camera} 8"></camera-select>
            </div>
            <div class='ndi-refresh'>
              <div class='ndi-refresh-message'>
              ${translation[window.config.general.language].ndi_refresh_message}
              </div>
              <button id="refreshNDI">${translation[window.config.general.language].start}</button>
            </div>
          </div>
          <div class="tab-content" id="tab5">
            <layer-viewer main="true" style="margin-left: -10px; width: calc(100% + 20px)"></layer-viewer>
          </div>
        </div>
      `;
    }
  
    updateSlider() {
      const activeTab = this.querySelector('.tabs .tab.active');
      const slider = this.querySelector('.tabs .slider');
      if(activeTab && slider) {
        const offsetLeft = activeTab.offsetLeft;
        const width = activeTab.offsetWidth;
        slider.style.transform = `translateX(${offsetLeft}px)`;
        slider.style.width = `${width}px`;
      }
    }
  
    connectedCallback(){
      this.render();

      this.querySelector("#refreshNDI").addEventListener("click", (e) => {
        window.dispatchEvent(new CustomEvent("refreshNDI"));
        this.querySelector("#refreshNDI").innerHTML = `<i class='bx bx-refresh bx-spin' ></i>`;
      });

      window.addEventListener("ndi-sources-updated", (e) => {
        this.querySelector("#refreshNDI").innerHTML = translation[window.config.general.language].refresh;
      });

      // Attendre le rendu pour placer correctement le slider
      requestAnimationFrame(() => this.updateSlider());
      this.querySelectorAll('.tabs .tab').forEach(tab => {
        tab.addEventListener('click', () => {
          // Désactive tous les onglets et masque tous les contenus
          this.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
          this.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
          // Active l'onglet cliqué
          tab.classList.add('active');
          // Affiche le contenu correspondant
          const target = tab.getAttribute('data-tab');
          this.querySelector(`#${target}`).classList.add('active');
          // Met à jour la position du slider
          this.updateSlider();
        });
      });
    }
  }
    