const { translation } = require('./local/local.js');
export default class menu extends HTMLElement {

    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {  
        this.innerHTML = `
            <div class="bottom_bar_left">
                <button id="OpenSettings" class="switchLeft"><i class='bx bxs-cog' ></i><br/>${translation[window.config.general.language].settings}</button>
            </div>
            <div class="persona_menu">
                <button target="multiviewer" id="multiViewer" class="active switch"><i class='bx bx-tv'></i><br/>${translation[window.config.general.language].multiviewer}</button>
                <button target="audioviewer" id="audioViewer" class="switch"><i class='bx bx-equalizer'></i><br/>${translation[window.config.general.language].mixer}</button>
                <button target="mediaplayer" id="playerViewer" class="switch"><i class='bx bxs-videos'></i><br/>${translation[window.config.general.language].mediaPlayers}</button>                
                <button target="ptz" id="ptzViewer" class="switch"><i class='bx bxs-camera-home'></i><br/>PTZ</button>
                <button target="intercom" id="intercomViewer" class="switch"><i class='bx bxs-phone-call'></i><br/>${translation[window.config.general.language].intercom}</button>
            </div>
            <div class="bottom_bar_right">
                <span> </span>
            </div>
        `;

        const buttons = this.querySelectorAll(".switch");
        const views = document.querySelectorAll(".mainViews");
        
        buttons.forEach(button => {
            button.addEventListener("click", () => {
            const target = button.getAttribute("target")
            views.forEach(view => {
                if (view.getAttribute("unique_id").toLowerCase() === target) {
                view.classList.add("active");
                view.classList.remove("inactive");
                } else {
                view.classList.add("inactive");
                view.classList.remove("active");
                }
            });
            
            buttons.forEach(btn => {
                if (btn === button) {
                btn.classList.add("active");
                btn.classList.remove("inactive");
                } else {
                btn.classList.add("inactive");
                btn.classList.remove("active");
                }
            });
            });
        });

        this.querySelector("#OpenSettings").addEventListener("click", () => {
            this.openSettings();
        })
    }

    openSettings() {
        document.querySelector("modal-view").setAttribute("title", "Settings");
        document.querySelector("modal-view").setAttribute("content", "<settings-view></settings-view>");
        document.querySelector("modal-view").setAttribute("show", "true");
    }

}

