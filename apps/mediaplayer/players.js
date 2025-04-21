const { translation } = require('./local/local.js');

export default class playersContainer extends HTMLElement {
    constructor(){
      super();
    }
  
    render(){
      this.innerHTML = `
        <style>
         
        </style>
        <div class="players">
            <div class='select_background'>
                <div class="players_select">
                    <!-- Slider de fond -->
                    <div class="slider"></div>
                    <div class="segment active" data-player="1">${translation[window.config.general.language].player} 1</div>
                    <div class="segment" data-player="2">${translation[window.config.general.language].player} 2</div>
                </div>
            </div>
          <div class="players_view">
            <player-viewer unique_id="mediaplayer-1" mediaplayer="1" class="active"
              style="width: 100%; height: 100%; padding: 0; margin: 0"></player-viewer>
            <player-viewer unique_id="mediaplayer-2" mediaplayer="2"
              style="width: 100%; height: 100%; padding: 0; margin: 0"></player-viewer>
          </div>
        </div>
      `;
    }
  
    updateSlider() {
      const activeSegment = this.querySelector('.players_select .segment.active');
      const slider = this.querySelector('.players_select .slider');
      if (activeSegment && slider) {
        const offsetLeft = activeSegment.offsetLeft;
        const width = activeSegment.offsetWidth;
        slider.style.transform = `translateX(${offsetLeft}px)`;
        slider.style.width = `${width}px`;
      }
    }
  
    switchPlayer(playerNumber){
      // Active/désactive les segments
      const segments = this.querySelectorAll('.players_select .segment');
      segments.forEach(segment => {
        segment.classList.toggle('active', segment.dataset.player === playerNumber);
      });
      // Active/désactive les vues des players
      const players = this.querySelectorAll('.players_view > player-viewer');
      players.forEach(player => {
        player.classList.toggle('active', player.getAttribute('mediaplayer') === playerNumber);
      });
      // Met à jour la position et la largeur du slider
      this.updateSlider();
    }
  
    connectedCallback(){
      this.render();
      // On attend le rendu et la mise en page pour placer le slider correctement
      requestAnimationFrame(() => this.updateSlider());
      // Ajoute un event listener pour le switch entre les segments
      this.querySelectorAll('.players_select .segment').forEach(segment => {
        segment.addEventListener('click', (e) => {
          const playerNumber = e.target.dataset.player;
          this.switchPlayer(playerNumber);
        });
      });
    }
  
    disconnectedCallback(){
      // Nettoyage des event listeners si nécessaire
    }
  }
  
  