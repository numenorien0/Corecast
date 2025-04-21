export default class playerviewer extends HTMLElement {
    constructor() {
      super();
      this.mediaplayer = this.getAttribute("mediaplayer");
    }
  
    connectedCallback() {
      this.render();
  
    }
  
    render() {
      this.innerHTML = `
        <div class='player-table'>
          <div class="player-left">
            <div class='player-engine'>
              <media-player mediaplayer="${this.mediaplayer}"></media-player>
            </div>
            <div class='media-playlist'>
            <div class='settings_player'>
              settings
            </div>
            <browser-service></browser-service>
            
            </div>
          </div>
          <div class='player-right'>
            <playlist-service style="background: #353b3f; box-shadow: -40px -100px 100px rgba(0,0,0,0.1) inset;" class='main' main="true" mediaplayer="${this.mediaplayer}"></playlist-service>
            
          </div>
        </div>
      `;
    }
    
    disconnectedCallback() {

    }
  }
    
  