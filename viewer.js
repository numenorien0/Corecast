const { translation } = require('./local/local.js');

function createMultiviewerOutput(name) {
    pgmWindow[name] = window.open("", name);
    pgmWindow[name].document.write(`
        <html lang="fr">
        <head>
            <title>${name}</title>
            <style>
                html{
                    width: 100%; height: 100%;
                    font-family: sans-serif;
                }
                body {
                    margin: 0;
                    background: black;
                    display: flex;
                    flex-direction: column;
                    height: 100% !important;
                    width: 100% !important;
                    
                }
                .video{
                    position: relative;
                }
                .video::after{
                    content: attr(label);
                    position: absolute;
                    text-align: center;
                    width: fit-content;
                    color: white;
                    display: block;
                    background-color: rgba(0, 0, 0, 0.5);
                    padding: 5px 15px;
                    font-size: 12px;
                    border-radius: 5px;
                    left: 0;
                    right: 0;
                    bottom: 5px;
                    margin: auto;
                    z-index: 100;
                }
                .container{
                    display: flex;
                    flex-direction: column;
                    max-width: 100%;
                    max-height: 100%;
                    margin: auto;
                    aspect-ratio: 16/9;
                }
                .row {
                    display: flex;
                    flex-direction: row;
                    width: 100%;
                    margin: auto;
                    overflow: hidden;
                }
                    
                .row .video {
                   margin: auto;
                    background: #000;
                    aspect-ratio: 16 / 9;
                    width: calc(25% - 2px);
                    border: 1px solid gray;
                    display: flex;
                    
                }
                #row1 .video{
                    width: calc(50% - 2px);
                }
                video{
                    width: calc(100%);
                    height: calc(100%);
				}
                .video:has(video[status="preview"])::before{
					content: "";
					position: absolute;
					left: 0;
					top: 0;
					width: calc(100% - 10px);
					height: calc(100% - 10px);
					border: 5px solid rgb(0,216,0);
					z-index: 10;
					pointer-events: none;
                    
                }
                .video:has(video[status="pgm"])::before{
                    content: "";
					position: absolute;
					left: 0;
					top: 0;
					width: calc(100% - 10px);
					height: calc(100% - 10px);
					border: 5px solid rgb(216,0,0);
					z-index: 10;
					pointer-events: none;
                }
            </style>
        </head>
        <body>
            <div class='container'>
            <div class="row" id="row1">
                <div class='video' label="${translation[window.config.general.language].preview}">
                    <video id="preview" muted autoplay ></video>
                </div>
                <div class='video' label="${translation[window.config.general.language].pgm}">
                    <video id="pgm" muted label="PGM" autoplay></video>
                </div>
            </div>
            <div class="row" id="row2">
                <div class='video video-viewer-container' data-camera="camera1" default-label="${translation[window.config.general.language].camera} 1" label="Camera 1">
                    <video class='video-viewer' id="camera1" muted autoplay></video>
                </div>
                <div class='video video-viewer-container' label="Camera 2" default-label="${translation[window.config.general.language].camera} 2" data-camera="camera2">
                    <video class='video-viewer' id="camera2" muted autoplay></video>
                </div>
                <div class='video video-viewer-container' label="Camera 3" default-label="${translation[window.config.general.language].camera} 3" data-camera="camera3">
                    <video class='video-viewer' id="camera3" muted autoplay></video>
                </div>
                <div class='video video-viewer-container' label="Camera 4" data-camera="camera4" default-label="${translation[window.config.general.language].camera} 4">
                    <video class='video-viewer' id="camera4" muted autoplay></video>
                </div>
            </div>
            <div class="row" id="row3">
                <div class='video video-viewer-container' data-camera="camera5" default-label="${translation[window.config.general.language].camera} 5" label="Camera 5">
                    <video class='video-viewer' id="camera5" muted autoplay></video>
                </div>
                <div class='video video-viewer-container' data-camera="camera6" label="Camera 6" default-label="${translation[window.config.general.language].camera} 6">
                    <video class='video-viewer' id="camera6" muted autoplay></video>
                </div>
                <div default-label="${translation[window.config.general.language].camera} 7" class='video video-viewer-container' data-camera="camera7" label="Camera 7">
                    <video class='video-viewer' id="camera7" muted autoplay></video>
                </div>
                <div class='video video-viewer-container' data-camera="camera8" label="Camera 8" default-label="${translation[window.config.general.language].camera} 8">
                    <video class='video-viewer' id="camera8" muted autoplay></video>
                </div>
            </div>
            </div>
        </body>
        </html>
    `);
    pgmWindow[name].document.close();

    window.addEventListener('refreshCameraStatus', (e) => {
        refreshLocalStatus();
    });

    window.addEventListener('camera-renamed', (e) => {
        get_cam_name();
    });

	pgmWindow[name].document.addEventListener("keydown", (e) => {	
		const evt = new KeyboardEvent("keydown", {
			key: e.key,
			code: e.code,
			ctrlKey: e.ctrlKey,
			shiftKey: e.shiftKey,
			altKey: e.altKey,
			metaKey: e.metaKey,
			bubbles: true
		});
	
		// Propagation dans la fenêtre principale
		window.dispatchEvent(evt);
	});
	  

    refreshLocalStatus();
    get_cam_name();

    function get_cam_name(){
        const cam = JSON.parse(localStorage.getItem("selectedDevices"));
        pgmWindow[name].document.querySelectorAll(".video-viewer-container").forEach((viewer) => {
            let id = viewer.getAttribute("data-camera");
			let defaultName = viewer.getAttribute("default-label");
            viewer.setAttribute("label", cam[id].name || defaultName);        
        });
    }
    
    function refreshLocalStatus(){
        pgmWindow[name].document.querySelectorAll(".video-viewer").forEach((viewer) => {
            let id = viewer.getAttribute("id");
            
            if (Array.isArray(window.pgm) && window.pgm.some(camera => camera.device === id)) {
                viewer.setAttribute("status", "pgm");
            } else if (Array.isArray(window.preview) && window.preview.some(camera => camera.device === id)) {
                viewer.setAttribute("status", "preview");
            } else {
                viewer.setAttribute("status", "none");
            }
        });
    }

    window.addEventListener("video-device-selected", (e) => {
        
        setTimeout(() => {
            tryAssignAllStreams();
        }, 2000);
    })

    const tryAssignAllStreams = () => {
        const streams = {
            preview: window.output['preview'],
            pgm: window.output['master'],
            camera1: window.input['camera1'],
            camera2: window.input['camera2'],
            camera3: window.input['camera3'],
            camera4: window.input['camera4'],
            camera5: window.input['camera5'],
            camera6: window.input['camera6'],
            camera7: window.input['camera7'],
            camera8: window.input['camera8'],
        };
        const doc = pgmWindow[name].document;
        let allReady = true;

        for (const id in streams) {
            const videoEl = doc.getElementById(id);
            if (videoEl && streams[id]) {
                videoEl.srcObject = streams[id];
            } else if (!videoEl) {
                allReady = false;
            }
        }

        if (!allReady) {
            setTimeout(tryAssignAllStreams, 100);
        }
    };

    tryAssignAllStreams();
}

var pgmWindow = []

function createViewerOutput(stream, name){
    pgmWindow[name] = window.open("", name);
    pgmWindow[name].document.write(`
        <html lang="fr" style="height: 100%; margin: 0; padding: 0">
        <head>
            <title>${name}</title>
        </head>
        <body style="background: #000; display: flex; height: 100%; width: 100%; margin: 0; padding: 0">
        <video id="outputVideo" muted autoplay style="width:100%;height:100%; margin: auto;"></video>
        </body>
        </html>
    `);
    pgmWindow[name].document.close();

	pgmWindow[name].document.addEventListener("keydown", (e) => {
		console.log("keydown dans la pop-up");
	
		const evt = new KeyboardEvent("keydown", {
			key: e.key,
			code: e.code,
			ctrlKey: e.ctrlKey,
			shiftKey: e.shiftKey,
			altKey: e.altKey,
			metaKey: e.metaKey,
			bubbles: true
		});
	
		// Propagation dans la fenêtre principale
		window.dispatchEvent(evt);
	});
  
    const tryAssignStream = () => {
      const video = pgmWindow[name].document.getElementById("outputVideo");
      if (video) {
        video.srcObject = stream;
      } else {
        setTimeout(tryAssignStream, 50);
      }
    };
    tryAssignStream();
}

module.exports = {
    createMultiviewerOutput,
    createViewerOutput
}