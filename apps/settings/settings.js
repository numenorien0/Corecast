const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');;
const ffprobePath = require('@ffprobe-installer/ffprobe').path.replace('app.asar', 'app.asar.unpacked');
const path = require("path");
const fs = require("fs");
const { ipcRenderer } = require('electron');
const { RtAudio } = require("audify");
const { translation } = require('./local/local.js');
const { loadUserConfig, saveUserConfig, defaultConfig } = require('./js/preferences.js');

let cachedFormats = null;
let cachedCodecs = null;

export default class Settings extends HTMLElement {
    constructor(){
    super();
    this.needReload = false;
    this.rtAudio = new RtAudio();

    this.formatEncoderMap = {
        flv: ["libx264", "flv", "h264"],
        mp4: ["libx264", "mpeg4", "h264", "libx265", "h265"],
        mov: ["libx264", "mpeg4", "h264", "prores", "libx265", "h265"],
        mkv: ["libx264", "libx265", "mpeg4"],
        webm: ["libvpx", "libvpx-vp9"]
    };

    }

    async getCachedFormats() {
      if (cachedFormats) return cachedFormats;
    
      return new Promise((resolve, reject) => {
        ffmpeg.getAvailableFormats((err, formats) => {
          if (err) {
            console.error("Erreur lors de la récupération des formats vidéo :", err);
            return reject(err);
          }
          cachedFormats = formats;
          resolve(formats);
        });
      });
    }

    async getCachedCodecs() {
      if (cachedCodecs) return cachedCodecs;
    
      return new Promise((resolve, reject) => {
        ffmpeg.getAvailableCodecs((err, codecs) => {
          if (err) {
            console.error("Erreur lors de la récupération des encodeurs vidéo :", err);
            return reject(err);
          }
          cachedCodecs = codecs;
          resolve(codecs);
        });
      });
    }
    

  async saveConfig() {
    saveUserConfig(window.config);
    if(this.needReload){
      this.querySelector(".needReloadMessage").style.display = "flex";
    }
  }

  updateField(section, key, value) {
    window.config[section] = {
      ...window.config[section],
      [key]: value
    };
    this.saveConfig();
  }

  // Met à jour une valeur imbriquée (ex: output.recording)
  updateNestedField(parent, child, key, value) {
    window.config[parent][child] = {
      ...window.config[parent][child],
      [key]: value
    };
    this.saveConfig();
  }

  async getFormats(configType = "streaming") {
    try {
      const formats = await this.getCachedFormats();
  
      const videoFormats = ['flv', 'mp4', 'mov', 'mkv', 'webm'];
      return videoFormats
        .filter(formatName => formats[formatName]?.canMux)
        .map(formatName => {
          const selected = window.config.output[configType].format === formatName ? "selected" : "";
          return `<option value="${formatName}" ${selected}>${formatName} - ${formats[formatName].description}</option>`;
        })
        .join("");
    } catch {
      return `<option>Erreur lors du chargement des formats vidéo</option>`;
    }
  }
  
  
  // Retourne une chaîne HTML contenant uniquement les encodeurs vidéo disponibles,
  // filtrée selon encoderFilter qui peut être une chaîne ou un tableau de chaînes
  async getEncoder(encoderFilter = "", configType = "streaming") {
    try {
      const codecs = await this.getCachedCodecs();
	
      return Object.entries(codecs)
        .filter(([encoderName, encoder]) => {
          const isVideo = encoder.type === 'video' || (encoder.flags?.includes('V') && encoder.flags?.includes('E'));
          if (!isVideo) return false;
  
          if (Array.isArray(encoderFilter) && encoderFilter.length > 0) {
            return encoderFilter.some(f => encoderName.toLowerCase().includes(f.toLowerCase()));
          }
  
          return typeof encoderFilter === "string"
            ? encoderName.toLowerCase().includes(encoderFilter.toLowerCase()) || encoderFilter === ""
            : true;
        })
        .map(([encoderName, encoder]) => {
          const selected = window.config.output[configType].encoder === encoderName ? "selected" : "";
          return `<option value="${encoderName}" ${selected}>${encoderName} - ${encoder.description}</option>`;
        })
        .join("");
    } catch {
      return `<option>Erreur lors du chargement des encodeurs vidéo</option>`;
    }
  }
  
  
  async render(tab = "settingstab1") {

    const streamingFormatsHTML = await this.getFormats("streaming");
    const streamingEncoderHTML = await this.getEncoder(this.formatEncoderMap[window.config.output.streaming.format] || "", "streaming");

    const recordingFormatsHTML = await this.getFormats("recording");
    const recordingEncoderHTML = await this.getEncoder(this.formatEncoderMap[window.config.output.recording.format] || "", "recording");

	const recording_isoFormatsHTML = await this.getFormats("recording_iso");
    const recording_isoEncoderHTML = await this.getEncoder(this.formatEncoderMap[window.config.output.recording_iso.format] || "", "recording_iso");

	const cachedFileEncoderHTML = await this.getEncoder(this.formatEncoderMap[window.config.output.cachedFile.format] || "" , "cachedFile");	

    this.innerHTML = `
      
      <div class="tabs_settings">
        <div class="slider_settings"></div>
        <div class="tab ${tab == "settingstab1" ? "active" : ""}" data-tab="settingstab1">${translation[window.config.general.language].general}</div>
        <div class="tab ${tab == "settingstab2" ? "active" : ""}" data-tab="settingstab2">${translation[window.config.general.language].video}</div>
        <div class="tab ${tab == "settingstab3" ? "active" : ""}" data-tab="settingstab3">${translation[window.config.general.language].audio}</div>
        <div class="tab ${tab == "settingstab4" ? "active" : ""}" data-tab="settingstab4">${translation[window.config.general.language].streaming} / ${translation[window.config.general.language].recording}</div>
        <div class="tab ${tab == "settingstab5" ? "active" : ""}" data-tab="settingstab5">${translation[window.config.general.language].shortcuts}</div>
        <div class="tab ${tab == "settingstab6" ? "active" : ""}" data-tab="settingstab6">${translation[window.config.general.language].controller}</div>

        </div>
      <div class="contents" style="padding: 0; padding-top: 30px; flex-direction: column; height: 100%; height: 500px; padding-bottom: 60px; overflow: auto">
      <div class='needReloadMessage'>
        <div class='needReloadtext'>
			    ${translation[window.config.general.language].needReload}
        </div>
        <button id="reload">${translation[window.config.general.language].reload}</button>
      </div>
        <div class="tab-content-settings ${tab == "settingstab1" ? "active" : ""}" id="settingstab1">
          <div class="settingsRow">
            <label for="general_language">${translation[window.config.general.language].language}</label>
            <select id="general_language" required>
                <option value="en" ${window.config.general.language == "en" ? "selected" : ""}>English</option>
                <option value="fr" ${window.config.general.language == "fr" ? "selected" : ""}>Français</option>
                <option value="nl" ${window.config.general.language == "nl" ? "selected" : ""}>Neederlands</option>
            </select>
          </div>
          

          <div class="settingsRow" id="scene_background_color_row">
            <label>${translation[window.config.general.language].backgroundColor}</label>
            <input type="color" id="scene_background_color" value="${window.config.general.background?.color || "#000000"}" />
          </div>


        </div>
        <div class="tab-content-settings ${tab == "settingstab2" ? "active" : ""}" id="settingstab2">
          <div class="settingsRow">
            <label for="video_definition">${translation[window.config.general.language].definition}</label>
            <select id="video_definition" required>
              <option ${window.config.video.definition == "1280x720" ? "selected": ""}>1280x720</option>
              <option ${window.config.video.definition == "1920x1080" ? "selected": ""}>1920x1080</option>
              <option ${window.config.video.definition == "3840x2160" ? "selected": ""}>3840x2160</option>
            </select>
          </div>
          <div class="settingsRow">
            <label for="video_framerate">${translation[window.config.general.language].framerate}</label>
            <select id="video_framerate" required>
              <option ${window.config.video.framerate == "24" ? "selected": ""}>24</option>
              <option ${window.config.video.framerate == "25" ? "selected": ""}>25</option>
              <option ${window.config.video.framerate == "30" ? "selected": ""}>30</option>
              <option ${window.config.video.framerate == "50" ? "selected": ""}>50</option>
              <option ${window.config.video.framerate == "60" ? "selected": ""}>60</option>
			  <option ${window.config.video.framerate == "100" ? "selected": ""}>100</option>
			  <option ${window.config.video.framerate == "120" ? "selected": ""}>120</option>
            </select>
          </div>
		  <div class="settingsRow">
              <label for="cachedFile_encoder">${translation[window.config.general.language].encoder_cached}</label>
              <select id="cachedFile_encoder" required>
                ${cachedFileEncoderHTML}
              </select>
            </div>
			<div class="settingsRow">
                <label for="cachedFile_destination">${translation[window.config.general.language].destination}</label>
                <div style='display: flex; gap: 7px'>
                    <input type="text" id="cachedFile_destination" required style="width: 100%" value="${window.config.output.cachedFile.destination}" />
                    <button style="width: 40px; height: 26px" class='dialogOpener' id="selectFolderButton_cached"><i class='bx bxs-folder-open' ></i></button>
                </div>    
            </div>
        </div>
        <div class="tab-content-settings ${tab == "settingstab3" ? "active" : ""}" id="settingstab3">
          <div class='settingsRow'>
              <label for="audioSelect">${translation[window.config.general.language].device} ${process.platform == 'win32' ? "Asio" : "AudioCore"}:</label>
              <select id="audioSelect">
                  <option value="">${translation[window.config.general.language].loading}...</option>
              </select>
            </div>
            
            <div class='settingsRow'>
              <label>Buffer size</label>
              <select id="bufferSize">
                <option ${window.config.audio.bufferSize == 32 ? "selected" : ""}>32</option>
                <option ${window.config.audio.bufferSize == 64 ? "selected" : ""}>64</option>
                <option ${window.config.audio.bufferSize == 128 ? "selected" : ""}>128</option>
                <option ${window.config.audio.bufferSize == 256 ? "selected" : ""}>256</option>
                <option ${window.config.audio.bufferSize == 512 ? "selected" : ""}>512</option>
                <option ${window.config.audio.bufferSize == 1024 ? "selected" : ""}>1024</option>
                <option ${window.config.audio.bufferSize == 2048 ? "selected" : ""}>2048</option>
                <option ${window.config.audio.bufferSize == 4096 ? "selected" : ""}>4096</option>
                </select>
            </div>
            <div class='settingsRow'>
              <label>${translation[window.config.general.language].sampleRate}</label>
              <select id="sampleRate">
                <option value="44100" ${window.config.audio.sampleRate == 44100 ? "selected" : ""}>44.1 khz</option>
                <option value="48000" ${window.config.audio.sampleRate == 48000 ? "selected" : ""}>48 khz</option>
              </select>
            </div>
            <div class='settingsRow'>
              <label>${translation[window.config.general.language].nbrInput}</label>
              <input type="number" id="inputNumber" value="${window.config.audio.inputNumber}"/>
            </div>
            <div class='settingsRow'>
              <label>${translation[window.config.general.language].nbrAux}</label>
              <input type="number" id="auxNumber" value="${window.config.audio.auxNumber}"/>
            </div>
        </div>
        <div class="tab-content-settings ${tab == "settingstab4" ? "active" : ""}" id="settingstab4">
          <fieldset style="display: flex; flex-direction: column; gap: 10px">
            <legend>${translation[window.config.general.language].streaming}</legend>
            <div class="settingsRow">
              <label for="streaming_destination">${translation[window.config.general.language].destination}</label>
              <input type="text" id="streaming_destination" required value="${window.config.output.streaming.destination}"/>
            </div>
            <div class="settingsRow">
              <label for="streaming_definition">${translation[window.config.general.language].definition}</label>
              <select id="streaming_definition" required>
                <option ${window.config.output.streaming.definition == "1280x720" ? "selected": ""}>1280x720</option>
                <option ${window.config.output.streaming.definition == "1920x1080" ? "selected": ""}>1920x1080</option>
                <option ${window.config.output.streaming.definition == "3840x2160" ? "selected": ""}>3840x2160</option>
              </select>
            </div>
            <div class="settingsRow">
              <label for="streaming_framerate">${translation[window.config.general.language].framerate}</label>
              <select id="streaming_framerate" required>
                <option ${window.config.output.streaming.framerate == "24" ? "selected": ""}>24</option>
                <option ${window.config.output.streaming.framerate == "25" ? "selected": ""}>25</option>
                <option ${window.config.output.streaming.framerate == "30" ? "selected": ""}>30</option>
                <option ${window.config.output.streaming.framerate == "50" ? "selected": ""}>50</option>
                <option ${window.config.output.streaming.framerate == "60" ? "selected": ""}>60</option>
              </select>
            </div>
            <div class="settingsRow">
              <label for="streaming_bitrate">${translation[window.config.general.language].bitrate}</label>
              <input type="number" id="streaming_bitrate" required value="${window.config.output.streaming.bitrate}"/>
            </div>
            <div class="settingsRow">
              <label for="streaming_format">${translation[window.config.general.language].format}</label>
              <select id="streaming_format" required>
                ${streamingFormatsHTML}
              </select>
            </div>
            <div class="settingsRow">
              <label for="streaming_encoder">${translation[window.config.general.language].encoder}</label>
              <select id="streaming_encoder" required>
                ${streamingEncoderHTML}
              </select>
            </div>
          </fieldset>
          <fieldset style="display: flex; flex-direction: column; gap: 10px">
            <legend>${translation[window.config.general.language].recording}</legend>
            <div class="settingsRow">
                <label for="recording_destination">${translation[window.config.general.language].destination}</label>
                <div style='display: flex; gap: 7px'>
                    <input type="text" id="recording_destination" required style="width: 100%" value="${window.config.output.recording.destination}" />
                    <button style="width: 40px; height: 26px" class='dialogOpener' id="selectFolderButton"><i class='bx bxs-folder-open' ></i></button>
                </div>    
            </div>
            <div class='settingsRow'>
                <label for="recording_fileName">${translation[window.config.general.language].fileName}</label>
                <div style='display: flex; gap: 7px'>
                    <input type="text" id="recording_fileName" required style="width: 100%" value="${window.config.output.recording.fileName || "output"}" />
                    <div style="width: 40px" id="filenameExtension">.${window.config.output.recording.format}</div>
                </div>
            </div>
            <div class="settingsRow">
              <label for="recording_definition">${translation[window.config.general.language].definition}</label>
              <select id="recording_definition" required>
                
                <option ${window.config.output.recording.definition == "1280x720" ? "selected": ""}>1280x720</option>
                <option ${window.config.output.recording.definition == "1920x1080" ? "selected": ""}>1920x1080</option>
                <option ${window.config.output.recording.definition == "3840x2160" ? "selected": ""}>3840x2160</option>
              </select>
            </div>
            <div class="settingsRow">
              <label for="recording_framerate">${translation[window.config.general.language].framerate}</label>
              <select id="recording_framerate" required>
                <option ${window.config.output.recording.framerate == "24" ? "selected": ""}>24</option>
                <option ${window.config.output.recording.framerate == "25" ? "selected": ""}>25</option>
                <option ${window.config.output.recording.framerate == "30" ? "selected": ""}>30</option>
                <option ${window.config.output.recording.framerate == "50" ? "selected": ""}>50</option>
                <option ${window.config.output.recording.framerate == "60" ? "selected": ""}>60</option>
              </select>
            </div>
            <div class="settingsRow">
              <label for="recording_bitrate">${translation[window.config.general.language].bitrate}</label>
              <input type="number" id="recording_bitrate" required value="${window.config.output.recording.bitrate}"/>
            </div>
            <div class="settingsRow">
              <label for="recording_format">${translation[window.config.general.language].format}</label>
              <select id="recording_format" required>
                ${recordingFormatsHTML}
              </select>
            </div>
            <div class="settingsRow">
              <label for="recording_encoder">${translation[window.config.general.language].encoder}</label>
              <select id="recording_encoder" required>
                ${recordingEncoderHTML}
              </select>
            </div>
          </fieldset>

		  <fieldset style="display: flex; flex-direction: column; gap: 10px">
            <legend>${translation[window.config.general.language].recording_iso}</legend>
            <div class="settingsRow">
                <label for="recording_destination_iso">${translation[window.config.general.language].destination}</label>
                <div style='display: flex; gap: 7px'>
                    <input type="text" id="recording_destination_iso" required style="width: 100%" value="${window.config.output.recording_iso.destination}" />
                    <button style="width: 40px; height: 26px" class='dialogOpener' id="selectFolderButton_iso"><i class='bx bxs-folder-open' ></i></button>
                </div>    
            </div>
            <div class='settingsRow'>
                <label for="recording_fileName_iso">${translation[window.config.general.language].fileName}</label>
                <div style='display: flex; gap: 7px'>
                    <input type="text" id="recording_fileName_iso" required style="width: 100%" value="${window.config.output.recording_iso.fileName || "output"}" />
                    <div style="" id="filenameExtension_iso">_cameraX.${window.config.output.recording_iso.format}</div>
                </div>
            </div>
            <div class="settingsRow">
              <label for="recording_definition_iso">${translation[window.config.general.language].definition}</label>
              <select id="recording_definition_iso" required>
                
                <option ${window.config.output.recording_iso.definition == "1280x720" ? "selected": ""}>1280x720</option>
                <option ${window.config.output.recording_iso.definition == "1920x1080" ? "selected": ""}>1920x1080</option>
                <option ${window.config.output.recording_iso.definition == "3840x2160" ? "selected": ""}>3840x2160</option>
              </select>
            </div>
            <div class="settingsRow">
              <label for="recording_framerate_iso">${translation[window.config.general.language].framerate}</label>
              <select id="recording_framerate_iso" required>
                <option ${window.config.output.recording_iso.framerate == "24" ? "selected": ""}>24</option>
                <option ${window.config.output.recording_iso.framerate == "25" ? "selected": ""}>25</option>
                <option ${window.config.output.recording_iso.framerate == "30" ? "selected": ""}>30</option>
                <option ${window.config.output.recording_iso.framerate == "50" ? "selected": ""}>50</option>
                <option ${window.config.output.recording_iso.framerate == "60" ? "selected": ""}>60</option>
              </select>
            </div>
            <div class="settingsRow">
              <label for="recording_bitrate_iso">${translation[window.config.general.language].bitrate}</label>
              <input type="number" id="recording_bitrate_iso" required value="${window.config.output.recording_iso.bitrate}"/>
            </div>
            <div class="settingsRow">
              <label for="recording_format_iso">${translation[window.config.general.language].format}</label>
              <select id="recording_format_iso" required>
                ${recording_isoFormatsHTML}
              </select>
            </div>
            <div class="settingsRow">
              <label for="recording_encoder_iso">${translation[window.config.general.language].encoder}</label>
              <select id="recording_encoder_iso" required>
                ${recording_isoEncoderHTML}
              </select>
            </div>
          </fieldset>



        </div>
        <div class="tab-content-settings ${tab == "settingstab5" ? "active" : ""}" id="settingstab5" style="width: 680px; flex-wrap: wrap; flex-direction: initial">
        
        <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].preview} - ${translation[window.config.general.language].cameras}</legend>
            <shortcut-input shortcut="cam1" label="${translation[window.config.general.language].camera} 1"></shortcut-input>
            <shortcut-input shortcut="cam2" label="${translation[window.config.general.language].camera} 2"></shortcut-input>
            <shortcut-input shortcut="cam3" label="${translation[window.config.general.language].camera} 3"></shortcut-input>
            <shortcut-input shortcut="cam4" label="${translation[window.config.general.language].camera} 4"></shortcut-input>
            <shortcut-input shortcut="cam5" label="${translation[window.config.general.language].camera} 5"></shortcut-input>
            <shortcut-input shortcut="cam6" label="${translation[window.config.general.language].camera} 6"></shortcut-input>
            <shortcut-input shortcut="cam7" label="${translation[window.config.general.language].camera} 7"></shortcut-input>
            <shortcut-input shortcut="cam8" label="${translation[window.config.general.language].camera} 8"></shortcut-input>
        </fieldset>

        <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].pgm} - ${translation[window.config.general.language].cameras}</legend>
            <shortcut-input shortcut="directcam1" label="${translation[window.config.general.language].camera} 1"></shortcut-input>
            <shortcut-input shortcut="directcam2" label="${translation[window.config.general.language].camera} 2"></shortcut-input>
            <shortcut-input shortcut="directcam3" label="${translation[window.config.general.language].camera} 3"></shortcut-input>
            <shortcut-input shortcut="directcam4" label="${translation[window.config.general.language].camera} 4"></shortcut-input>
            <shortcut-input shortcut="directcam5" label="${translation[window.config.general.language].camera} 5"></shortcut-input>
            <shortcut-input shortcut="directcam6" label="${translation[window.config.general.language].camera} 6"></shortcut-input>
            <shortcut-input shortcut="directcam7" label="${translation[window.config.general.language].camera} 7"></shortcut-input>
            <shortcut-input shortcut="directcam8" label="${translation[window.config.general.language].camera} 8"></shortcut-input>
        </fieldset>

        <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].multiviewer}</legend>
            <shortcut-input shortcut="switch" label="${translation[window.config.general.language].switch}"></shortcut-input>
            <shortcut-input shortcut="autoswitch" label="${translation[window.config.general.language].autoswitch}"></shortcut-input>
            <shortcut-input shortcut="startstream" label="${translation[window.config.general.language].startStream}"></shortcut-input>
            <shortcut-input shortcut="startrec" label="${translation[window.config.general.language].startRec}"></shortcut-input>
            <shortcut-input shortcut="startreciso" label="${translation[window.config.general.language].startRecIso}"></shortcut-input>
        </fieldset>
        <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].ptz}</legend>
            <shortcut-input shortcut="select_ptz1" label="${translation[window.config.general.language].selectPTZ} 1"></shortcut-input>
            <shortcut-input shortcut="select_ptz2" label="${translation[window.config.general.language].selectPTZ} 2"></shortcut-input>
            <shortcut-input shortcut="select_ptz3" label="${translation[window.config.general.language].selectPTZ} 3"></shortcut-input>
            <shortcut-input shortcut="select_ptz4" label="${translation[window.config.general.language].selectPTZ} 4"></shortcut-input>
            <shortcut-input shortcut="select_ptz5" label="${translation[window.config.general.language].selectPTZ} 5"></shortcut-input>
            <shortcut-input shortcut="select_ptz6" label="${translation[window.config.general.language].selectPTZ} 6"></shortcut-input>
            <shortcut-input shortcut="select_ptz7" label="${translation[window.config.general.language].selectPTZ} 7"></shortcut-input>
            <shortcut-input shortcut="select_ptz8" label="${translation[window.config.general.language].selectPTZ} 8"></shortcut-input>
            <hr>
            <shortcut-input shortcut="select_preset_ptz1" label="${translation[window.config.general.language].ptz} Preset 1"></shortcut-input>
         </fieldset>
        

          <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].graphics}</legend>
          ${ JSON.parse(localStorage.getItem("layersData") || "[]")
            .map((layer, index) => `<shortcut-input shortcut="toggle_layer${index + 1}" label="${translation[window.config.general.language].toggleLayer} ${index + 1}"></shortcut-input>`)
            .join('') }
          </fieldset>

          <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].scenes}</legend>
          ${ JSON.parse(localStorage.getItem("config-scenes") || "[]")
            .map((layer, index) => `<shortcut-input shortcut="apply_scene${index + 1}" label="${translation[window.config.general.language].displayScene} ${index + 1}"></shortcut-input>`)
            .join('') }
          </fieldset>

            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].player} 1</legend>
                <shortcut-input shortcut="play_player1" label="${translation[window.config.general.language].play}"></shortcut-input>
                <shortcut-input shortcut="next_player1" label="${translation[window.config.general.language].next}"></shortcut-input>
                <shortcut-input shortcut="prev_player1" label="${translation[window.config.general.language].prev}"></shortcut-input>
            </fieldset>

            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].player} 2</legend>
                <shortcut-input shortcut="play_player2" label="${translation[window.config.general.language].play}"></shortcut-input>
                <shortcut-input shortcut="next_player2" label="${translation[window.config.general.language].next}"></shortcut-input>
                <shortcut-input shortcut="prev_player2" label="${translation[window.config.general.language].prev}"></shortcut-input>
            </fieldset>

          
        </div>
        <div class="tab-content-settings ${tab == "settingstab6" ? "active" : ""}" id="settingstab6" style="width: 680px; flex-wrap: wrap; flex-direction: initial">
       
        
        <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].audio}</legend>
        <div class="audioTabs">
            
        </div>
        <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>Fader bank</legend>
            <div class="settingsRow">
              <label for="streaming_destination">${translation[window.config.general.language].faderByPage}</label>
              <input type="number" id="faderByPage" required value="${window.config.audio.faderByPage || 8}"/>
            </div>
            <midi-shortcut-input shortcut="faderbank_prev" label="fader bank -"></midi-shortcut-input>
            <midi-shortcut-input shortcut="faderbank_next" label="fader bank +"></midi-shortcut-input>
        </fieldset>
        </fieldset>

            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].preview} - ${translation[window.config.general.language].cameras}</legend>
            
                <midi-shortcut-input shortcut="cam1" label="${translation[window.config.general.language].camera} 1"></midi-shortcut-input>
                <midi-shortcut-input shortcut="cam2" label="${translation[window.config.general.language].camera} 2"></midi-shortcut-input>
                <midi-shortcut-input shortcut="cam3" label="${translation[window.config.general.language].camera} 3"></midi-shortcut-input>
                <midi-shortcut-input shortcut="cam4" label="${translation[window.config.general.language].camera} 4"></midi-shortcut-input>
                <midi-shortcut-input shortcut="cam5" label="${translation[window.config.general.language].camera} 5"></midi-shortcut-input>
                <midi-shortcut-input shortcut="cam6" label="${translation[window.config.general.language].camera} 6"></midi-shortcut-input>
                <midi-shortcut-input shortcut="cam7" label="${translation[window.config.general.language].camera} 7"></midi-shortcut-input>
                <midi-shortcut-input shortcut="cam8" label="${translation[window.config.general.language].camera} 8"></midi-shortcut-input>
            
            </fieldset>

            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].pgm} - ${translation[window.config.general.language].cameras}</legend>
                <midi-shortcut-input shortcut="directcam1" label="${translation[window.config.general.language].camera} 1"></midi-shortcut-input>
                <midi-shortcut-input shortcut="directcam2" label="${translation[window.config.general.language].camera} 2"></midi-shortcut-input>
                <midi-shortcut-input shortcut="directcam3" label="${translation[window.config.general.language].camera} 3"></midi-shortcut-input>
                <midi-shortcut-input shortcut="directcam4" label="${translation[window.config.general.language].camera} 4"></midi-shortcut-input>
                <midi-shortcut-input shortcut="directcam5" label="${translation[window.config.general.language].camera} 5"></midi-shortcut-input>
                <midi-shortcut-input shortcut="directcam6" label="${translation[window.config.general.language].camera} 6"></midi-shortcut-input>
                <midi-shortcut-input shortcut="directcam7" label="${translation[window.config.general.language].camera} 7"></midi-shortcut-input>
                <midi-shortcut-input shortcut="directcam8" label="${translation[window.config.general.language].camera} 8"></midi-shortcut-input>
            </fieldset>

            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].multiviewer}</legend>
                <midi-shortcut-input shortcut="tbar" label="${translation[window.config.general.language].switch} T-bar"></midi-shortcut-input>
                <midi-shortcut-input shortcut="switch" label="${translation[window.config.general.language].switch}"></midi-shortcut-input>
                <midi-shortcut-input shortcut="autoswitch" label="${translation[window.config.general.language].autoswitch}"></midi-shortcut-input>
                <midi-shortcut-input shortcut="startstream" label="${translation[window.config.general.language].startStream}"></midi-shortcut-input>
                <midi-shortcut-input shortcut="startrec" label="${translation[window.config.general.language].startRec}"></midi-shortcut-input>
                <midi-shortcut-input shortcut="startreciso" label="${translation[window.config.general.language].startRecIso}"></midi-shortcut-input>
            </fieldset>

            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].ptz}</legend>
                <midi-shortcut-input shortcut="select_ptz1" label="${translation[window.config.general.language].selectPTZ} 1"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_ptz2" label="${translation[window.config.general.language].selectPTZ} 2"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_ptz3" label="${translation[window.config.general.language].selectPTZ} 3"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_ptz4" label="${translation[window.config.general.language].selectPTZ} 4"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_ptz5" label="${translation[window.config.general.language].selectPTZ} 5"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_ptz6" label="${translation[window.config.general.language].selectPTZ} 6"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_ptz7" label="${translation[window.config.general.language].selectPTZ} 7"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_ptz8" label="${translation[window.config.general.language].selectPTZ} 8"></midi-shortcut-input>
                <hr>
                <midi-shortcut-input shortcut="select_preset_ptz1" label="${translation[window.config.general.language].ptz} Preset 1"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz2" label="${translation[window.config.general.language].ptz} Preset 2"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz3" label="${translation[window.config.general.language].ptz} Preset 3"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz4" label="${translation[window.config.general.language].ptz} Preset 4"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz5" label="${translation[window.config.general.language].ptz} Preset 5"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz6" label="${translation[window.config.general.language].ptz} Preset 6"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz7" label="${translation[window.config.general.language].ptz} Preset 7"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz8" label="${translation[window.config.general.language].ptz} Preset 8"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz9" label="${translation[window.config.general.language].ptz} Preset 9"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz10" label="${translation[window.config.general.language].ptz} Preset 10"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz11" label="${translation[window.config.general.language].ptz} Preset 11"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz12" label="${translation[window.config.general.language].ptz} Preset 12"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz13" label="${translation[window.config.general.language].ptz} Preset 13"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz14" label="${translation[window.config.general.language].ptz} Preset 14"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz15" label="${translation[window.config.general.language].ptz} Preset 15"></midi-shortcut-input>
                <midi-shortcut-input shortcut="select_preset_ptz16" label="${translation[window.config.general.language].ptz} Preset 16"></midi-shortcut-input>


                <midi-shortcut-input shortcut="ptz_move_left" label="${translation[window.config.general.language].ptz} Left"></midi-shortcut-input>
                <midi-shortcut-input shortcut="ptz_move_right" label="${translation[window.config.general.language].ptz} Right"></midi-shortcut-input>
                <midi-shortcut-input shortcut="ptz_move_top" label="${translation[window.config.general.language].ptz} Up"></midi-shortcut-input>
                <midi-shortcut-input shortcut="ptz_move_bottom" label="${translation[window.config.general.language].ptz} Down"></midi-shortcut-input>
                <midi-shortcut-input shortcut="ptz_zoom_in" label="${translation[window.config.general.language].ptz} Zoom In"></midi-shortcut-input>
                <midi-shortcut-input shortcut="ptz_zoom_out" label="${translation[window.config.general.language].ptz} Zoom Out"></midi-shortcut-input>
       
            </fieldset>

            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].graphics}</legend>
            ${ JSON.parse(localStorage.getItem("layersData") || "[]")
                .map((layer, index) => `<midi-shortcut-input shortcut="toggle_layer${index + 1}" label="${translation[window.config.general.language].toggleLayer} ${index + 1}"></midi-shortcut-input>`)
                .join('') }
            </fieldset>

            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].scenes}</legend>
            ${ JSON.parse(localStorage.getItem("config-scenes") || "[]")
                .map((layer, index) => `<midi-shortcut-input shortcut="apply_scene${index + 1}" label="${translation[window.config.general.language].displayScene} ${index + 1}"></midi-shortcut-input>`)
                .join('') }
            </fieldset>

            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].player} 1</legend>
                <midi-shortcut-input shortcut="play_player1" label="${translation[window.config.general.language].play}"></midi-shortcut-input>
                <midi-shortcut-input shortcut="next_player1" label="${translation[window.config.general.language].next}"></midi-shortcut-input>
                <midi-shortcut-input shortcut="prev_player1" label="${translation[window.config.general.language].prev}"></midi-shortcut-input>
            </fieldset>
            <fieldset style="display: flex; flex-direction: column; gap: 10px"> <legend>${translation[window.config.general.language].player} 2</legend>
                <midi-shortcut-input shortcut="play_player2" label="${translation[window.config.general.language].play}"></midi-shortcut-input>
                <midi-shortcut-input shortcut="next_player2" label="${translation[window.config.general.language].next}"></midi-shortcut-input>
                <midi-shortcut-input shortcut="prev_player2" label="${translation[window.config.general.language].prev}"></midi-shortcut-input>
            </fieldset>
        </div>
      </div>
    `;

      this.populateDeviceList();
      
  }
  
  updateSlider() {
    const activeTab = this.querySelector('.tabs_settings .tab.active');
    const slider = this.querySelector('.tabs_settings .slider_settings');
    if (activeTab && slider) {
      const offsetLeft = activeTab.offsetLeft;
      const width = activeTab.offsetWidth;
      slider.style.transform = `translateX(${offsetLeft}px)`;
      slider.style.width = `${width}px`;
    }
  }
  

  async populateDeviceList() {
    const select = this.querySelector("#audioSelect");
    select.innerHTML = "<option value=''>None</option>";

    try {
        const devices = await this.rtAudio.getDevices();
        const iconv = require('iconv-lite');
        devices.filter((d) => d.inputChannels > 0).forEach((device) => {
            const option = document.createElement("option");
            option.value = device.id;
            if(window.config.audio){
            if(window.config.audio.device == device.id){
              option.setAttribute("selected", "true");
            }
          }
          const buffer = Buffer.from(device.name, 'binary');
            option.textContent = `${device.name} (${device.inputChannels} canaux)`;
            select.appendChild(option);
        });
        if (devices.length === 0) {
            select.innerHTML = `<option value=''>${translation[window.config.general.language].none}</option>`;
        }
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des périphériques :", error);
        select.innerHTML = "<option value=''>Erreur lors du chargement</option>";
    }
}
  

    generate_audio_mapping(){
        this.querySelector('.audioTabs').innerHTML = `<ul class="audioTab-headers">
            ${(() => {
                let headers = "";
                for (let i = 0; i < window.config.audio.faderByPage; i++) {
                    headers += `<li data-tab="track${i}" ${i === 0 ? 'class="active"' : ''}>${i + 1}</li>`;
                }
                headers += `<li data-tab="master">Master</li>`;
                return headers;
            })()}
            </ul>
            <div class="audioTab-contents">
            ${(() => {
                let contents = "";
                for (let i = 0; i < window.config.audio.faderByPage; i++) {
                contents += `
                    <div id="section_track${i}" class="audioTab-content" style="${i === 0 ? 'display: flex;' : ''}">
                        <fieldset style="display: flex; flex-direction: column; gap: 10px">
                            <legend>${translation[window.config.general.language].track}</legend>
                            <midi-shortcut-input shortcut="pan${i}" label="Pan track ${i + 1}"></midi-shortcut-input>
                            <midi-shortcut-input shortcut="volume${i}" label="Volume track ${i + 1}"></midi-shortcut-input>
                            <midi-shortcut-input shortcut="mute_track_${i}" label="Toggle mute track ${i + 1}"></midi-shortcut-input>
                            <midi-shortcut-input shortcut="solo_track_${i}" label="Toggle solo track ${i + 1}"></midi-shortcut-input>
                            <midi-shortcut-input shortcut="select_track_${i}" label="select track ${i + 1}"></midi-shortcut-input>
                        </fieldset>    
                    </div>
                `;
                }
                contents += `
                <div id="section_master" class="audioTab-content" style="display: none;">
                    <fieldset style="display: flex; flex-direction: column; gap: 10px">
                    <legend>${translation[window.config.general.language].audio} - Master</legend>
                    <midi-shortcut-input shortcut="panmaster" label="Pan Master"></midi-shortcut-input>
                    <midi-shortcut-input shortcut="volumemaster" label="Volume Master"></midi-shortcut-input>
                    <midi-shortcut-input shortcut="mute_track_master" label="Toggle mute master"></midi-shortcut-input>
                    </fieldset>
                </div>
                `;
                return contents;
            })()}
            </div>`;

            this.querySelectorAll('.audioTab-headers li').forEach(tab => {
                tab.addEventListener('click', function() {
                  // Enlever la classe active de tous les onglets
                  document.querySelectorAll('.audioTab-headers li').forEach(t => t.classList.remove('active'));
                  this.classList.add('active');
                  
                  // Masquer tous les contenus
                  document.querySelectorAll('.audioTab-content').forEach(content => content.style.display = 'none');
                  // Afficher le contenu correspondant à l'onglet cliqué
                  const tabId = "section_"+this.getAttribute('data-tab');
                  document.getElementById(tabId).style.display = 'flex';
                });
              });
    }

  // Attache les écouteurs sur tous les champs pour mettre à jour la config
  attachListeners() {
    // General

    

    this.querySelector('#general_language').addEventListener('change', (e) => {
      window.config.general.language = e.target.value;
      this.needReload = true;
      this.saveConfig();
    });
    
    // Video
    this.querySelector('#video_definition').addEventListener('change', (e) => {
      window.config.video.definition = e.target.value;
      this.needReload = true;
      this.saveConfig();
    });
    this.querySelector('#video_framerate').addEventListener('change', (e) => {
      window.config.video.framerate = e.target.value;
      this.needReload = true;
      this.saveConfig();
    });

    this.querySelector('#inputNumber').addEventListener('change', (e) => {
      window.config.audio.inputNumber = e.target.value;
      this.needReload = true;
      this.saveConfig();
    });

    this.querySelector("#sampleRate").addEventListener("change", (e) => {
      window.config.audio.sampleRate = e.target.value;
      this.needReload = true;
      this.saveConfig();
    })

    this.querySelector('#auxNumber').addEventListener('change', (e) => {
      window.config.audio.auxNumber = e.target.value;
      this.needReload = true;
      this.saveConfig();
    });

    this.querySelector("#audioSelect").addEventListener("change", (e) => {
      window.config.audio.device = e.target.value;
      this.needReload = true;
      this.saveConfig();
      
  });

  this.querySelector("#bufferSize").addEventListener("change", (e) => {
      window.config.audio.bufferSize = e.target.value;
      this.needReload = true;
      this.saveConfig();  
  });

  this.querySelector('#faderByPage').addEventListener('change', (e) => {
    window.config.audio.faderByPage = e.target.value;
    this.saveConfig();
    this.generate_audio_mapping();

  });

    // Streaming
    this.querySelector('#streaming_destination').addEventListener('change', (e) => {
      window.config.output.streaming.destination = e.target.value;
      this.saveConfig();
    });
    
    this.querySelector('#streaming_definition').addEventListener('change', (e) => {
      window.config.output.streaming.definition = e.target.value;
      this.saveConfig();
    });
    this.querySelector('#streaming_framerate').addEventListener('change', (e) => {
      window.config.output.streaming.framerate = e.target.value;
      this.saveConfig();
    });
    this.querySelector('#streaming_bitrate').addEventListener('change', (e) => {
      window.config.output.streaming.bitrate = e.target.value;
      this.saveConfig();
    });
    this.querySelector('#streaming_format').addEventListener('change', async (e) => {
      window.config.output.streaming.format = e.target.value;
      // Mettre à jour la liste des encodeurs en fonction du format sélectionné
      
      const allowedEncoders = this.formatEncoderMap[e.target.value] || "";
      const streamingEncoderSelect = this.querySelector('#streaming_encoder');
      streamingEncoderSelect.innerHTML = await this.getEncoder(allowedEncoders, "streaming");
      // Mettre à jour le champ encoder selon la nouvelle sélection (si besoin)
      window.config.output.streaming.encoder = streamingEncoderSelect.value;
      this.saveConfig();
    });
    this.querySelector('#streaming_encoder').addEventListener('change', (e) => {
      window.config.output.streaming.encoder = e.target.value;
      this.saveConfig();
    });
    
    // Recording
    this.querySelector('#recording_destination').addEventListener('change', (e) => {
      window.config.output.recording.destination = e.target.value;
      this.saveConfig();
    });
    this.querySelector('#recording_fileName').addEventListener('change', (e) => {
      window.config.output.recording.fileName = e.target.value;
      this.saveConfig();
    });
    this.querySelector('#recording_definition').addEventListener('change', (e) => {
      window.config.output.recording.definition = e.target.value;
      this.saveConfig();
    });
    this.querySelector('#recording_framerate').addEventListener('change', (e) => {
      window.config.output.recording.framerate = e.target.value;
      this.saveConfig();
    });
    this.querySelector('#recording_bitrate').addEventListener('change', (e) => {
      window.config.output.recording.bitrate = e.target.value;
      this.saveConfig();
    });
    this.querySelector('#recording_format').addEventListener('change', async (e) => {
      window.config.output.recording.format = e.target.value;
      document.getElementById('filenameExtension').innerText = `.${e.target.value}`;
      
      const allowedEncoders = this.formatEncoderMap[e.target.value] || "";
      const recordingEncoderSelect = this.querySelector('#recording_encoder');
      recordingEncoderSelect.innerHTML = await this.getEncoder(allowedEncoders, "recording");
      window.config.output.recording.encoder = recordingEncoderSelect.value;
      this.saveConfig();
    });
    this.querySelector('#recording_encoder').addEventListener('change', (e) => {
      window.config.output.recording.encoder = e.target.value;
      this.saveConfig();
    });
    
    this.querySelector("#scene_background_color").addEventListener("change", (e) => {
      window.config.general.background.color = e.target.value;
      this.saveConfig();
    });
    

	// Recording iso
    this.querySelector('#recording_destination_iso').addEventListener('change', (e) => {
		  window.config.output.recording_iso.destination = e.target.value;
		  this.saveConfig();
	  });
	  this.querySelector('#recording_fileName_iso').addEventListener('change', (e) => {
		window.config.output.recording_iso.fileName = e.target.value;
		this.saveConfig();
	  });
	  this.querySelector('#recording_definition_iso').addEventListener('change', (e) => {
		window.config.output.recording_iso.definition = e.target.value;
		this.saveConfig();
	  });
	  this.querySelector('#recording_framerate_iso').addEventListener('change', (e) => {
		window.config.output.recording_iso.framerate = e.target.value;
		this.saveConfig();
	  });
	  this.querySelector('#recording_bitrate_iso').addEventListener('change', (e) => {
		window.config.output.recording_iso.bitrate = e.target.value;
		this.saveConfig();
	  });
	  this.querySelector('#recording_format_iso').addEventListener('change', async (e) => {
		window.config.output.recording_iso.format = e.target.value;
		document.getElementById('filenameExtension_iso').innerText = `_cameraX.${e.target.value}`;
		
		const allowedEncoders = this.formatEncoderMap[e.target.value] || "";
		const recording_isoEncoderSelect = this.querySelector('#recording_encoder_iso');
		recording_isoEncoderSelect.innerHTML = await this.getEncoder(allowedEncoders, "recording_iso");
		window.config.output.recording_iso.encoder = recording_isoEncoderSelect.value;
		this.saveConfig();
	  });
	  this.querySelector('#recording_encoder_iso').addEventListener('change', (e) => {
		window.config.output.recording_iso.encoder = e.target.value;
		this.saveConfig();
	  });


	  this.querySelector("#cachedFile_encoder").addEventListener('change', (e) => {
		window.config.output.cachedFile.encoder = e.target.value;
		this.saveConfig();
	  });

    this.querySelector("#reload").addEventListener("click", () => {
      ipcRenderer.send('change-audio-buffer', window.config.audio.bufferSize);
    })

  }
  
  async connectedCallback() {
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath); 
    await this.render();
    this.generate_audio_mapping();
    requestAnimationFrame(() => this.updateSlider());
    
    // Gestion des tabs
    this.querySelectorAll('.tabs_settings .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.querySelectorAll('.tabs_settings .tab').forEach(t => t.classList.remove('active'));
        this.querySelectorAll('.tab-content-settings').forEach(content => content.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-tab');
        this.querySelector(`#${target}`).classList.add('active');
        this.updateSlider();
      });
    });
    
    // Pour la section Streaming
    const streamingFormatSelect = this.querySelector('#streaming_format');
    if (streamingFormatSelect) {
      streamingFormatSelect.addEventListener('change', async (e) => {
        const format = e.target.value;
        const allowedEncoders = this.formatEncoderMap[format] || "";
        const streamingEncoderSelect = this.querySelector('#streaming_encoder');
        streamingEncoderSelect.innerHTML = await this.getEncoder(allowedEncoders, "streaming");
      });
    }
    
    // Pour la section Recording
    const recordingFormatSelect = this.querySelector('#recording_format');
    if (recordingFormatSelect) {
      recordingFormatSelect.addEventListener('change', async (e) => {
        const format = e.target.value;
        const allowedEncoders = this.formatEncoderMap[format] || "";
        const recordingEncoderSelect = this.querySelector('#recording_encoder');
        recordingEncoderSelect.innerHTML = await this.getEncoder(allowedEncoders, "recording");
      });
    }

	 // Pour la section Recording iso
	 const recording_isoFormatSelect = this.querySelector('#recording_format_iso');
	 if (recording_isoFormatSelect) {
	   recording_isoFormatSelect.addEventListener('change', async (e) => {
		 const format = e.target.value;
		 const allowedEncoders = this.formatEncoderMap[format] || "";
		 const recording_isoEncoderSelect = this.querySelector('#recording_encoder_iso');
		 recording_isoEncoderSelect.innerHTML = await this.getEncoder(allowedEncoders, "recording_iso");
	   });
	 }

     if (!this.folderListenersAttached) {
        const selectFolderButton = this.querySelector('#selectFolderButton');
        if (selectFolderButton) {
          selectFolderButton.addEventListener('click', async () => {
            ipcRenderer.invoke('open-folder-dialog')
              .then(result => {
                if (result.canceled === false) {
                  const destInput = this.querySelector("#recording_destination");
                  destInput.value = result.filePaths[0];
                  window.config.output.recording.destination = result.filePaths[0];
                  this.saveConfig();
                }
              })
              .catch(err => console.error(err));
          });
        }
    
        const selectFolderButton_cached = this.querySelector('#selectFolderButton_cached');
        if (selectFolderButton_cached) {
          selectFolderButton_cached.addEventListener('click', async () => {
            ipcRenderer.invoke('open-folder-dialog')
              .then(result => {
                if (result.canceled === false) {
                  const destInput = this.querySelector("#cachedFile_destination");
                  destInput.value = result.filePaths[0];
                  window.config.output.cachedFile.destination = result.filePaths[0];
                  this.saveConfig();
                }
              })
              .catch(err => console.error(err));
          });
        }
    
        const select_isoFolderButton = this.querySelector('#selectFolderButton_iso');
        if (select_isoFolderButton) {
          select_isoFolderButton.addEventListener('click', async () => {
            ipcRenderer.invoke('open-folder-dialog')
              .then(result => {
                if (result.canceled === false) {
                  const destInput = this.querySelector("#recording_destination_iso");
                  destInput.value = result.filePaths[0];
                  window.config.output.recording_iso.destination = result.filePaths[0];
                  this.saveConfig();
                }
              })
              .catch(err => console.error(err));
          });
        }

        
    
        this.folderListenersAttached = true;
    }
    
    this.attachListeners();
  }
}
