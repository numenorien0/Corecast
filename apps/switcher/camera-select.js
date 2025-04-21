const { translation } = require('./local/local.js');
export default class CameraSelect extends HTMLElement {
    constructor(){
      super();
      this.unique_id = this.getAttribute("unique_id");
      this.label = this.getAttribute("label");
    }
  
    async connectedCallback(){
      // On initialise les préférences si elles n'existent pas
      this.initializeCameraPreferences();
  
      await this.render();
  
      // Écoute du custom event qui fournit les sources NDI
      window.addEventListener("ndi-sources-updated", (event) => {
        const ndiSources = event.detail.sources;
        this.updateNDIOptions(ndiSources);
      });
  
      // Rafraîchissement global
      window.addEventListener("refreshDevices", async (e) => {
        this.deviceId = this.getLastSelectedDevice()?.device;
        await this.render();
      });
    }
  
    // Initialise les préférences de caméra si elles n'existent pas
    initializeCameraPreferences() {
      const storedData = JSON.parse(localStorage.getItem("selectedDevices")) || {};
      if (!storedData[this.unique_id]) {
        storedData[this.unique_id] = {
          device: "none",
          name: "",
          contrast: 100,
          brightness: 100,
          huerotate: 0,
          saturate: 100,
          temperature: 5600
        };
        localStorage.setItem("selectedDevices", JSON.stringify(storedData));
      }
    }
    
    getLastSelectedDevice() {
      const storedData = JSON.parse(localStorage.getItem("selectedDevices")) || {};
      return storedData[this.unique_id] || null;
    }
    
    saveLastSelectedDevice(deviceId) {
      const storedData = JSON.parse(localStorage.getItem("selectedDevices")) || {};
      if (!storedData[this.unique_id]) {
        storedData[this.unique_id] = {};
      }
      storedData[this.unique_id].device = deviceId;
      this.lastSelected = deviceId;
      localStorage.setItem("selectedDevices", JSON.stringify(storedData));
    }
      
    async render(){
      this.selected = this.getLastSelectedDevice();
      this.lastSelected = this.selected?.device || null;
      const devices = await navigator.mediaDevices.enumerateDevices()
        .then(devices => devices.filter(device => device.kind === "videoinput"));
    
      let options = `<option value="none" selected>${translation[window.config.general.language].none}</option>`;
    
      devices.forEach(device => {
        options += `<option ${device.deviceId === this.lastSelected ? "selected" : ""} value="${device.deviceId}">${device.label || "Caméra"}</option>`;
      });
      options += "<hr>";
      options += `<option ${"screen" === this.lastSelected ? "selected" : ""} value="screen">Capture d'écran</option>`;
      options += "<hr>";
      options += `<option ${"mediaplayer-1" === this.lastSelected ? "selected" : ""} value="mediaplayer-1">Mediaplayer #1</option>`;
      options += `<option ${"mediaplayer-2" === this.lastSelected ? "selected" : ""} value="mediaplayer-2">Mediaplayer #2</option>`;
      if (this.ndiOptionsHTML) {
        options += "<hr>" + this.ndiOptionsHTML;
      }

      this.innerHTML = `
        <div class='selectCameraRow'>
                  <button class='displayCameraOption'><i class='bx bx-chevron-right' ></i></button>

          <label class="labelCamera">${this.label}</label>
          <select class="select_source">${options}</select>
        </div>
        <div class='configCamera' style='margin-top: 25px; display: none'>
        <div style='display: flex; margin-bottom: 30px'>
            <label for='name' style='width: 100px; margin: auto; text-align: right; margin-right: 15px;'>${translation[window.config.general.language].label}</label><input style='margin-top: auto; margin-bottom: auto' type='text' name='name' value='${this.selected?.name || ""}' placeholder='' style='width: 100%; margin-bottom: 10px; padding: 5px;'>
          </div>
            <div style='display: flex;'>
            <div class='cameraConfigElement'>
            <label>${translation[window.config.general.language].contrast}</label>
            <rotary-knob class='knobFilter' name='contrast' value='${this.selected?.contrast || 100}' default='100' min='0' max='200' step='1'></rotary-knob>
          </div>
          <div class='cameraConfigElement'>
            <label>${translation[window.config.general.language].brightness}</label>
            <rotary-knob class='knobFilter' name='brightness' value='${this.selected?.brightness || 100}' default='100' min='0' max='200' step='1'></rotary-knob>
          </div>
          <div class='cameraConfigElement'>
            <label>${translation[window.config.general.language].hueRotate}</label>
            <rotary-knob class='knobFilter' name='huerotate' value='${this.selected?.huerotate || 0}' min='0' default='0' max='360' step='1'></rotary-knob>
          </div>
          <div class='cameraConfigElement'>
            <label>${translation[window.config.general.language].saturation}</label>
            <rotary-knob class='knobFilter' name='saturate' value='${this.selected?.saturate || 100}' default='100' min='0' max='200' step='1'></rotary-knob>
          </div>
          <div class='cameraConfigElement'>
            <label>&nbsp;</label>
            <button id='resetConfigCamera' style='background: transparent; width: 25px; height: 25px; margin-top: -3px; margin-right: -20px; padding: 2px; font-size: 12px; border-radius: 50%'><i class='bx bx-reset' ></i></button>
          </div>
          </div>

        </div>
      `;
    
      this.querySelector(".displayCameraOption").addEventListener("click", (e) => {
        if(this.querySelector('.configCamera').style.display == "none"){
            e.target.innerHTML = `<i class='bx bx-chevron-down' ></i>`;
            this.querySelector('.configCamera').style.display = "block";
        }  
        else{
            e.target.innerHTML = `<i class='bx bx-chevron-right' ></i>`;
            this.querySelector('.configCamera').style.display = "none";
        }
      })
      // Gestion du changement de caméra
      this.querySelector("select").addEventListener("change", (e) => {
        const deviceId = e.target.value;
        if(deviceId === "none") { 
          this.saveLastSelectedDevice(null);
        } else {
          this.saveLastSelectedDevice(deviceId);
        }
        window.dispatchEvent(new CustomEvent("video-device-selected", {
          detail: {
            deviceId: deviceId,
            unique_id: this.unique_id
          },
          bubbles: true
        }));
      });
    
      

      // Gestion des changements des rotary-knobs (préférences)
      const knobs = this.querySelectorAll(".knobFilter");

      this.querySelector("#resetConfigCamera").addEventListener("click", (e) => {
        knobs.forEach(knob => {
            const defaultValue = parseInt(knob.getAttribute("default"));
            knob.value = defaultValue;
            const param = knob.getAttribute("name");
            this.saveCameraPreference(param, defaultValue);
            window.dispatchEvent(new CustomEvent("camera-preferences-changed", {
                detail: {
                  unique_id: this.unique_id,
                  parameters: this.getLastSelectedDevice()
                },
                bubbles: true
              }));
        }
        );
    })

      knobs.forEach(knob => {
        knob.addEventListener("input", (e) => {
          const param = knob.getAttribute("name");
          const value = e.target.value;
          this.saveCameraPreference(param, value);
          window.dispatchEvent(new CustomEvent("camera-preferences-changed", {
            detail: {
              unique_id: this.unique_id,
              parameters: this.getLastSelectedDevice()
            },
            bubbles: true
          }));
        });

        this.querySelector("input[name='name']").addEventListener("input", (e) => {
            this.saveCameraPreference("name", e.target.value);
            window.dispatchEvent(new CustomEvent("camera-renamed", {
            detail: {
                unique_id: this.unique_id,
                parameters: this.getLastSelectedDevice()
            },
            bubbles: true
            }));
        });

        
        knob.addEventListener("dblclick", (e) => {
            const defaultValue = parseInt(e.currentTarget.getAttribute("default"));
            console.log(defaultValue);
            knob.value = defaultValue;
            // Met à jour la valeur via le setter pour déclencher updateUI()          
            const param = knob.getAttribute("name");
            this.saveCameraPreference(param, defaultValue);
            window.dispatchEvent(new CustomEvent("camera-preferences-changed", {
                detail: {
                    unique_id: this.unique_id,
                    parameters: this.getLastSelectedDevice()
                },
                bubbles: true
            }));
          });
          
      });
    }
    
    // Enregistre une préférence (ex : contrast, brightness, etc.) dans localStorage
    saveCameraPreference(parameter, value) {
      const storedData = JSON.parse(localStorage.getItem("selectedDevices")) || {};
      if (!storedData[this.unique_id]) {
        storedData[this.unique_id] = {};
      }
      storedData[this.unique_id][parameter] = value;
      localStorage.setItem("selectedDevices", JSON.stringify(storedData));
    }
    
    updateNDIOptions(ndiSources) {
      const uniqueSources = ndiSources.reduce((acc, source) => {
        if (!acc.find(s => s.urlAddress === source.urlAddress)) {
          acc.push(source);
        }
        return acc;
      }, []);
    
      this.lastSelected = this.getLastSelectedDevice()?.device;
      let newNDIOptions = "";
      uniqueSources.forEach(source => {
        const optionValue = `NDI://${source.urlAddress}-_-${source.name}`;
        newNDIOptions += `<option ${optionValue === this.lastSelected ? "selected" : ""} value="${optionValue}">NDI : ${source.name}</option>`;
      });
    
      if (this.ndiOptionsHTML !== newNDIOptions) {
        this.ndiOptionsHTML = newNDIOptions;
        this.render();
      }
    }
  }
  