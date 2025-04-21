const { broadcast } = require('./js/streamdeck.js');
const { translation } = require('./local/local.js');
const { globalCropTransition, pushTransition, slideOverlayTransition, crossFade } = require('./js/transitions.js')
const { loadUserConfig, saveUserConfig, defaultConfig } = require('./js/preferences.js');

export default class multiviewer extends HTMLElement{


    constructor(){
        super();
        window.overlayCamera = 2
        window.preview = [
            {
                device: "camera2",
                width: "auto",
                x: "auto",
                y: 0
            }
        ];
        window.pgm = [
            {
                device: "camera1",
                width: "auto", 
                x: "auto", 
                y: "auto", 
                cropLeft: 0, 
                croptRight: 0, 
                cropTop: 0, 
                cropBottom: 0,
                opacity: 1, 
                radius: 0
            }
        ];

        window.master = [
            {device: "pgm", width: 100, x: 0, y: 0, cropLeft: 0, croptRight: 0, cropTop: 0, cropBottom: 0, opacity: 1, radius: 0},
            {device: "preview", width: 100, x: 0, y: 0, cropLeft: 0, croptRight: 0, cropTop: 0, cropBottom: 0, opacity: 0, radius: 0}
        ]

        window.preview_scene = [];
        window.overlay = {};
        window.overlay['pgm'] = [];
        window.overlay['preview'] = [];
        
        
        window.aux = {"aux1" : [{device: "preview", width: 100, x: 0, y: 0}, {device: "pgm", width: 100, x: 0, y: 0}], "aux2" : "", "aux3": "", "aux4": ""}
        window.autoswitch = window.config.general.autoswitch;
        window.transition = "cut";
    }

    updateVideoStatuses() {
        document.querySelectorAll("video-viewer").forEach((viewer) => {
            let id = viewer.getAttribute("uniq_id");
            
            if ((Array.isArray(window.pgm) && window.pgm.some(camera => camera.device === id)) || (window.preview.some(camera => camera.device === id) && window.master[1].opacity != 0)) {
                viewer.setAttribute("status", "pgm");
            } else if (Array.isArray(window.preview) && window.preview.some(camera => camera.device === id)) {
                viewer.setAttribute("status", "preview");
            } else {
                viewer.setAttribute("status", "none");
            }
        });
        window.dispatchEvent(new CustomEvent("refreshCameraStatus"));

    }

    applyScene(scene, to = "pgm"){
        const scenes = JSON.parse(localStorage.getItem("config-scenes")) || [];
        if(to == "pgm"){
            if(window.config.general.autoswitch){
                window.pgm = scenes[scene].config;
                console.log("scene to pgm")
            }
            else{
                console.log("scene to preview");
                window.preview = scenes[scene].config;
            }
        }
        else{
            //window.aux['preview_scene'] = scenes[scene].config;
            window.preview = scenes[scene].config;
        }
        
        this.updateVideoStatuses();
    }  

    switchCam(camera, to){
        if(to == "preview"){
            if(window.config.general.autoswitch){
                window.pgm = [{device: camera, width: JSON.parse(localStorage.getItem("selectedDevices"))[camera]?.width || "auto", x: "auto", y: "auto", blackFill: true}];
            }
            else{
                window.preview = [{device: camera, width: JSON.parse(localStorage.getItem("selectedDevices"))[camera]?.width || "auto", x: "auto", y: "auto", blackFill: true}];
            }
            
        }
        if(to == "pgm"){
            window.pgm = [{device: camera, width: "auto", x: "auto", y: "auto", blackFill: true}];
        }
        
        
        this.updateVideoStatuses();
    }
    
    previewToPGM(transition = window.transition, direction = "left", timing = 2000, progress){
        var opt = progress !== undefined ? {progress: progress} : {duration: timing, direction: direction};
        
        if(transition == "fade"){
            crossFade(opt, (e) => {
                window.dispatchEvent(new CustomEvent("updateTbar", {detail: {progress: e}}));
            }).then(() => {
				this.updateVideoStatuses();
				window.dispatchEvent(new CustomEvent("updateTbar", {detail: {progress: 100}}));
			});
        } else if (transition == "crop"){
            globalCropTransition(opt, direction, (e) => {
                window.dispatchEvent(new CustomEvent("updateTbar", {detail: {progress: e}}));
            }).then(() => {
				this.updateVideoStatuses();
				window.dispatchEvent(new CustomEvent("updateTbar", {detail: {progress: 100}}));
			});
        } else if (transition == "push"){
            pushTransition(opt, direction, (e) => {
                window.dispatchEvent(new CustomEvent("updateTbar", {detail: {progress: e}}));
            }).then(() => {
				this.updateVideoStatuses();
				window.dispatchEvent(new CustomEvent("updateTbar", {detail: {progress: 100}}));
			});
        } else if (transition == "slideOver"){ 
            slideOverlayTransition(opt, direction, (e) => {
                window.dispatchEvent(new CustomEvent("updateTbar", {detail: {progress: e}}));
            }).then(() => {
				this.updateVideoStatuses();
				window.dispatchEvent(new CustomEvent("updateTbar", {detail: {progress: 100}}));
			});
        } else {
            this.cut();
        }

    }

    cut(){
        let temp_view = window.pgm;
        window.pgm = window.preview;
        window.preview = temp_view;
        this.updateVideoStatuses();
    } 
    
    render(){
        const width =  window.config.video.definition.split("x")[0];
        const height = window.config.video.definition.split("x")[1];

        this.innerHTML = `
            
            <div class="multiviewer_table">
                <div class='multiviewer_row bottom_bar_viewer' style='height: 50px; margin-bottom: 5px'>
                    <div class='buttons-left'>
                        <button class='multiview_button ${window.config.general.autoswitch ? "active" : ""}' id="autoswitch"> ${translation[window.config.general.language].autoswitch}</button>
                    </div>
                    <div class='buttons-center'>
                        <div class='buttons-center-inner' style='margin: auto;width: 100%'>
                            <transition-component></transition-component>
                        </div>    
                    </div>
                    <div class='buttons-right'>
                        <button class='multiview_button' state="expand" id="fullScreenPGM"><i class='bx bx-expand' ></i> ${translation[window.config.general.language].fullscreen}</button>
                    </div>
                    
                </div>
                <div class="multiviewer_row" style="height: 50%">
                    <div class="multiviewer_cell" style="display: none">
                        <main-viewer canvas-width="${width}" canvas-height="${height}" uniq_id="pgm" label="AUX1"></main-viewer>
                    </div>
                    <div class="multiviewer_cell">
                        <main-viewer canvas-width="${width}" canvas-height="${height}" uniq_id="preview" label="${translation[window.config.general.language].preview}"></main-viewer>
                    </div>
                    
                    <div class="multiviewer_cell" style='position: relative'>
                        <main-viewer canvas-width="${width}" canvas-height="${height}" uniq_id="master" label="${translation[window.config.general.language].pgm}"></main-viewer>
                        <audio-visualizer style='position: absolute; right: 15px; top: 15px; bottom: 15px; ' data-id='master' color="green"></audio-visualizer>

                    </div>
                    
                </div>
                <div class="multiviewer_row" style="height: 25%">
                    <div class="multiviewer_cell">
                        <video-viewer uniq_id="camera1" status="none" label="${translation[window.config.general.language].camera} 1"></video-viewer>    
                    </div>
                    <div class="multiviewer_cell">
                        <video-viewer uniq_id="camera2" status="none" label="${translation[window.config.general.language].camera} 2"></video-viewer>
                    </div>
                    <div class="multiviewer_cell">
                        <video-viewer uniq_id="camera3" status="none" label="${translation[window.config.general.language].camera} 3"></video-viewer>
                    </div>
                    <div class="multiviewer_cell">
                        <video-viewer uniq_id="camera4" status="none" label="${translation[window.config.general.language].camera} 4"></video-viewer>
                    </div>
                </div>
                <div class="multiviewer_row" style="height: 25%">
                    <div class="multiviewer_cell">
                        <video-viewer uniq_id="camera5" status="none" label="${translation[window.config.general.language].camera} 5"></video-viewer>
                    </div>
                    <div class="multiviewer_cell">
                        <video-viewer uniq_id="camera6" status="none" label="${translation[window.config.general.language].camera} 6"></video-viewer>

                    </div>
                    <div class="multiviewer_cell">
                        <video-viewer uniq_id="camera7" status="none" label="${translation[window.config.general.language].camera} 7"></video-viewer>

                    </div>
                    <div class="multiviewer_cell">
                        <video-viewer uniq_id="camera8" status="none" label="${translation[window.config.general.language].camera} 8"></video-viewer>
                    </div>
                </div>
                
                
            </div>
                    

            <div class='multiviewer_sidepanel active'>
                <button id="sidepanel_button"><i class='bx bx-chevron-right' ></i></button>
                <side-panel></side-panel>          
            </div>
        `;

        this.querySelector('#sidepanel_button').addEventListener("click", (e) => {
            if(this.querySelector('.multiviewer_sidepanel.active')){
                window.dispatchEvent( new CustomEvent("closeSidepanel"));
                e.target.innerHTML = `<i class='bx bx-chevron-left' ></i>`;
                this.querySelector('.multiviewer_sidepanel').classList.remove("active")
            }else{
                e.target.innerHTML = `<i class='bx bx-chevron-right' ></i>`;
                this.querySelector('.multiviewer_sidepanel').classList.add("active")

            }
        })

       

        this.querySelector("#autoswitch").addEventListener("click", (e) => {
            this.toggle_autoswitch();
        })

        this.querySelector('#fullScreenPGM').addEventListener("click", (e) => {
            if(e.currentTarget.getAttribute("state") == "expand"){
                this.fullscreenPGM(true);
            }
            else{
                this.fullscreenPGM(false);
            }
        })

        this.querySelectorAll("video-viewer").forEach(element => {
            element.addEventListener("click", (e) => {
                window.dispatchEvent(new CustomEvent("switchCam", { 
                    detail: {
                        camera: e.currentTarget.getAttribute("uniq_id"), 
                        to: "preview"
                    }
                }));
            })
        })

        
    }

    toggle_autoswitch(state){
        let setting = loadUserConfig();
        console.log(setting.general.autoswitch)
        if(!state){
            setting.general.autoswitch = !setting.general.autoswitch;
        }
        else{
            setting.general.autoswitch = state;
        }
        saveUserConfig(setting);
        window.config.general.autoswitch = setting.general.autoswitch;
        if(setting.general.autoswitch){
            this.querySelector("#autoswitch").classList.add("active")
        }
        else{
            this.querySelector("#autoswitch").classList.remove("active")

        }

        window.dispatchEvent(new CustomEvent("autoswitchSetted", {detail: {state: setting.general.autoswitch}}));

    }

    fullscreenPGM(state = true){
        const viewer = document.querySelector(`main-viewer[uniq_id="master"]`);
        const button = this.querySelector("#fullScreenPGM");
    
        if(!viewer || !button){
            console.warn("main-viewer ou bouton fullscreen non trouvé");
            return;
        }
    
        if(state) {
            viewer.classList.add("fullscreen");
            button.setAttribute("state", "reduce");
            button.innerHTML = `<i class='bx bx-grid-small' ></i> Multiview`;
        } else {
            viewer.classList.remove("fullscreen");
            button.setAttribute("state", "expand");
            button.innerHTML = `<i class='bx bx-expand-alt' ></i> Fullscreen`;
        }
    }
    
    connectedCallback(){
        this.render();
        this.updateVideoStatuses();
		window.addEventListener("switchCam", (event) => {
			this.switchCam(event.detail.camera, event.detail.to);
		});
		
		window.addEventListener("previewToPGM", (event) => {
			this.previewToPGM(event.detail?.transition || "", event.detail?.direction || "", event.detail?.duration || 2000, event.detail?.progress);
		});

		window.addEventListener("applyScene", (event) => {
			this.applyScene(event.detail.scene, event.detail.to || "pgm");
		});
		
		window.addEventListener("toggleAutoswitch", (event) => {
			this.toggle_autoswitch();
		})
    }
}