const { sendHomeCommand, sendTurnRightCommand, sendTurnLeftCommand, sendTiltDownCommand, sendTiltUpCommand, sendZoomInCommand, sendZoomOutCommand, sendZoomStopCommand, sendPanTiltStopCommand, sendPresetRecall, sendStorePreset } = require("./js/visca-over-ip.js");
const { translation } = require('./local/local.js');
const { Notyf } = require('notyf');

var notyf = new Notyf();

export default class ptzControl extends HTMLElement{
    constructor(){
        super();
        this.targetIP = 'localhost';
        this.targetPort = 52381;
        this.speed = 3 // 1 à 16
        this.zoomSpeed = 3;
        this.camera = "";
        window.dispatchEvent(new CustomEvent("ptz-selected", {
            detail: {
                camera: this.camera
            }
        }));
    }

    movePTZ(direction){
        if(this.camera === "" && direction !== "stop"){
            notyf.error({message: translation[window.config.general.language].noCameraSelected, duration: 5000, dismissible: true});
        }
        switch(direction){
            case "top":
                this.top();
                break;
            case "bottom":
                this.bottom();
                break;
            case "left":
                this.left();
                break;
            case "right":
                this.right();
                break;
            case "stop":
                this.stopPan();
                break;
        }
    }

    zoomPTZ(direction){
        if(this.camera === "" && direction !== "stop"){
            notyf.error({message: translation[window.config.general.language].noCameraSelected, duration: 5000, dismissible: true});
        }
        switch(direction){
            case "in":
                this.zoomIn();
                break;
            case "out":
                this.zoomOut();
                break;
            case "stop":
                this.stopZoom();
                break;
        }
    }

    selectPTZ(cameraSelected){ 
        const camera = JSON.parse(localStorage.getItem("config-cameras")).find(el => el.id === cameraSelected);
        this.camera = camera.id;
        this.targetIP = camera.ip;
        this.targetPort = parseInt(camera.port);
        this.querySelector("#return").srcObject = window.input[this.camera];
        this.querySelector(".ptzMessage").style.display = "block";
        this.querySelector(".ptzMessage").innerHTML = translation[window.config.general.language].loading;
        this.querySelector("#return").onloadedmetadata = () => {
            this.querySelector(".ptzMessage").style.display = "none";
        }

        window.dispatchEvent(new CustomEvent("ptz-selected", {
            detail: {
                camera: this.camera
            }
        }));
    }

    home(){
        sendHomeCommand(this.targetPort, this.targetIP);
    }

    left(){
        sendTurnLeftCommand(this.targetPort, this.targetIP, this.speed);
    }

    top(){
        sendTiltUpCommand(this.targetPort, this.targetIP, this.speed);
    }

    bottom(){
        sendTiltDownCommand(this.targetPort, this.targetIP, this.speed);
    }

    right(){
        sendTurnRightCommand(this.targetPort, this.targetIP, this.speed);
    }

    stopPan(){
        sendPanTiltStopCommand(this.targetPort, this.targetIP);
    }

    zoomIn(){
        sendZoomInCommand(this.targetPort, this.targetIP, this.zoomSpeed);
    }
    zoomOut(){
        sendZoomOutCommand(this.targetPort, this.targetIP, this.zoomSpeed);
    }
    stopZoom(){
        sendZoomStopCommand(this.targetPort, this.targetIP);
    }

    render(){
        this.innerHTML = `
        <div class="ptz-controller">
            
            <div class="ptz-video ptz-section" style='display: flex; position: relative'>
                <h2 style='' class='ptzMessage'>${translation[window.config.general.language].selectAPTZ}</h2>
                <video autoplay muted id='return'></video>
            </div>
            <div class='ptz-controls'>
                <div class='ptz-container' style='display: flex; flex-direction: column; width: 250px'>
                    
                    
                        <div class="ptz-section" style='text-align: center; width: 100%'>
                            <h3>${translation[window.config.general.language].speed}</h3>
                            <div class='speedControlContainer'>
                                <button class='decreasePanSpeed speedControl'>-</button>
                                <input class='vertical' type="number" id="speed" min="1" max="16" value="${this.speed}">
                                <button class='increasePanSpeed speedControl'>+</button>
                            </div>
                            <label class='sliderLabel' for="speed">${translation[window.config.general.language].tiltPan}</label>
                        </div>
                        <div class="ptz-section" style='text-align: center; width: 100%'>
                            <div class='speedControlContainer'>
                                <button class='decreaseZoomSpeed speedControl'>-</button>    
                                <input class='vertical' type="number" id="zoomspeed" min="1" max="16" value="${this.zoomSpeed}">
                                <button class='increaseZoomSpeed speedControl'>+</button>
                            </div>
                            <label class='sliderLabel' for="speed">${translation[window.config.general.language].zoom}</label>
                        </div>
                    
                </div>
                <div class='ptz-container' style="width: 300px">
                    <div class="ptz-section controls">
                        <h3>${translation[window.config.general.language].direction}</h3>
                        <div style='display: flex; flex-direction: column'>
                            <div style='display: flex; margin: auto'><button id="tiltUp"><i class='bx bxs-up-arrow' ></i></button></div>
                            <div style='display: flex; margin: auto'><button id="panLeft"><i class='bx bxs-left-arrow' ></i></button><button id="home"><i class='bx bxs-home-alt-2' ></i></button><button id="panRight"><i class='bx bxs-right-arrow' ></i></button></div>
                            <div style='display: flex; margin: auto'><button id="tiltDown"><i class='bx bxs-down-arrow' ></i></button></div>
                        </div>
                    </div>
                </div>
                <div class='ptz-container' style='width: 100px'>
                    <div class="ptz-section controls">
                        <h3>${translation[window.config.general.language].zoom}</h3>
                        <button id="zoomIn"><i class='bx bxs-zoom-in' ></i></button><br/>
                        <button id="zoomOut"><i class='bx bxs-zoom-out' ></i></button>
                    </div>
                </div>
                <div class='ptz-container'>
                    <div class="ptz-section">
                        <h3>${translation[window.config.general.language].presets}</h3>
                        <div id="presets">
                            ${[...Array(16).keys()].map(i => `
                                <fieldset class="preset">
                                    <legend>${i+1}</legend>
                                    <button class="presetRecall" data-preset="${i+1}"><i class='bx bx-play' ></i></button>
                                    <button class="presetStore" data-preset="${i+1}"><i class='bx bx-plus' ></i></button>
                                </fieldset>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
        `;

       
    
        this.querySelector(".increasePanSpeed").addEventListener("click", (e) => {
            var speed = parseInt(this.querySelector("#speed").value);
            if(speed <= 15){
                speed += 1;
                this.speed = speed;
                this.querySelector("#speed").value = speed;
            }
        })

        this.querySelector(".decreasePanSpeed").addEventListener("click", (e) => {
            var speed = parseInt(this.querySelector("#speed").value);
            if(speed >= 1){
                speed -= 1;
                this.speed = speed;
                this.querySelector("#speed").value = speed;
            }
        })


        this.querySelector(".increaseZoomSpeed").addEventListener("click", (e) => {
            var speed = parseInt(this.querySelector("#zoomspeed").value);
            if(speed <= 15){
                speed += 1;
                this.zoomSpeed = speed;
                this.querySelector("#zoomspeed").value = speed;
            }
        })

        this.querySelector(".decreaseZoomSpeed").addEventListener("click", (e) => {
            var speed = parseInt(this.querySelector("#zoomspeed").value);
            if(speed >= 1){
                speed -= 1;
                this.zoomSpeed = speed;
                this.querySelector("#zoomspeed").value = speed;
            }
        })


        const speedInput = this.querySelector('#speed');
        speedInput.addEventListener('input', (e) => {
            this.speed = parseInt(e.target.value, 10);
            console.log('Vitesse mise à jour :', this.speed);
        });

        const zoomspeedInput = this.querySelector('#zoomspeed');
        zoomspeedInput.addEventListener('input', (e) => {
            this.zoomSpeed = parseInt(e.target.value, 10);
            console.log('Vitesse mise à jour :', this.zoomSpeed);
        });
    
        // Boutons directionnels
        this.querySelector('#home').addEventListener('click', () => {
            this.home();
        });
        this.querySelector('#panLeft').addEventListener('mousedown', () => {
            this.left();
        });
        this.querySelector('#panRight').addEventListener('mousedown', () => {
            this.right();
        });
        this.querySelector('#tiltUp').addEventListener('mousedown', () => {
            this.top();
        });
        this.querySelector('#tiltDown').addEventListener('mousedown', () => {
            this.bottom();
        });

        this.querySelectorAll('#panLeft, #tiltDown, #tiltUp, #panRight').forEach(element => {
            element.addEventListener('mouseup', () => {
                this.stopPan();
            })
        
        })
        // Boutons Zoom
        this.querySelector('#zoomIn').addEventListener('mousedown', () => {
            this.zoomIn();
        });
        this.querySelector('#zoomOut').addEventListener('mousedown', () => {
            this.zoomOut();
        });

        this.querySelectorAll('#zoomOut, #zoomIn').forEach(element => {
            element.addEventListener('mouseup', () => {
                this.stopZoom();
            });
        })

    
    
        // Boutons Presets
        const presetRecallButtons = this.querySelectorAll('.presetRecall');
        presetRecallButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const preset = parseInt(e.target.getAttribute('data-preset'), 10);
                sendPresetRecall(this.targetPort, this.targetIP, preset);
            });
        });
        const presetStoreButtons = this.querySelectorAll('.presetStore');
        presetStoreButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const preset = parseInt(e.target.getAttribute('data-preset'), 10);
                sendStorePreset(this.targetPort, this.targetIP, preset);
                const html = e.target.innerHTML;
                e.target.innerHTML = `<i class='bx bx-check' ></i>`;
                e.target.classList.add("setted");

                setTimeout(() => {
                    e.target.innerHTML = html;
                    e.target.classList.remove("setted");
                }, 2000);
            });
        });
    }

    connectedCallback(){
        this.render();
    }
}