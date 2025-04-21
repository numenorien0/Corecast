const { uuidv4 } = require('./js/utils.js');
const { translation } = require('./local/local.js');

export default class MacroEditor extends HTMLElement {
  constructor() {
    super();
    this.configKey = this.getAttribute("config-key") || "scenes";
    this.scenes = [];
    this.expandedScenes = new Set();
  }

  connectedCallback() {
    this.render();
    this.loadScenes();
    
  }

  loadScenes() {
    const stored = localStorage.getItem("config-" + this.configKey);
    if (stored) {
      try {
        this.scenes = JSON.parse(stored);
      } catch (e) {
        console.error("Erreur de parsing des scènes", e);
        this.scenes = [];
      }
    }
    if (!this.scenes.length) {
      this.scenes = [
        {
          name: "Scene 1",
          config: [
            {
              device: "none",
              width: "auto",
              x: "auto",
              y: "auto",
              blackFill: true,
              cropLeft: 0,
              cropRight: 0,
              cropTop: 0,
              cropBottom: 0,
              opacity: 1,
              borderWidth: 0,
              borderColor: "#000000",
              radius: 0,
              uuid: uuidv4()
            }
          ]
        }
      ];
    }
    window[this.configKey] = this.scenes;
    this.renderSceneSelector();
  }

  render() {
    this.innerHTML = `
      <div class='sceneContainer'>
        <div id="scene-selector"></div>
        <div class='bottom-action'>
          <button id="add-scene">${translation[window.config.general.language].addAScene}</button>
        </div>
      </div>
    `;
    this.querySelector("#add-scene").addEventListener("click", () => this.addScene());
  }

  renderSceneSelector() {
    const selector = this.querySelector("#scene-selector");
    selector.innerHTML = "";
    this.scenes.forEach((scene, index) => {
      const row = document.createElement("div");
      row.classList.add("line");
      row.classList.add("lineScene");

      

      const header = document.createElement("div");
      header.classList.add("scene-header");

        

      const rowNbr = document.createElement("div");
        rowNbr.classList.add("rowNbr");
        rowNbr.innerText = index + 1;
        header.appendChild(rowNbr);
        const container = document.createElement("scene-button");
      container.classList.add("launchScene");
      container.classList.add("launchSceneIcon");
      container.setAttribute("scene", index)
      header.appendChild(container);

      const editBtn = document.createElement("button");
      editBtn.classList.add("expandScene")
      editBtn.innerHTML = this.expandedScenes.has(index)
        ? '<i class="bx bx-chevron-down" ></i>'
        : '<i class="bx bx-chevron-right" ></i>';
        editBtn.addEventListener("click", () => {
        

        if (this.expandedScenes.has(index)) {
          this.expandedScenes.delete(index);
        } else {
          this.expandedScenes.add(index);
        }
        this.renderSceneSelector();
      });
      header.appendChild(editBtn);

      if (1) {
        
    //   } else {
  
        const title = document.createElement("div");
        title.innerHTML = scene.name;
        title.classList.add("scene-name");
        header.appendChild(title);
      }

      

      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = `<i class='bx bxs-trash' ></i>`;
      deleteBtn.classList.add("delete-scene");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteScene(index);
      });
      header.appendChild(deleteBtn);

      row.appendChild(header);

      if (this.expandedScenes.has(index)) {
        const details = this.renderSceneDetails(index);
        row.appendChild(details);
      }

      selector.appendChild(row);
      window.addEventListener("closeSidepanel", () => {
        if (this.expandedScenes.has(index)) {
          this.expandedScenes.delete(index);
          this.renderSceneSelector();
        }
        
      })
    });

    

  }

  renderSceneDetails(sceneIndex ) {
    const scene = this.scenes[sceneIndex];
    const container = document.createElement("div");
   
    container.classList.add("scene-details");
    container.innerHTML = `<scene-button class='launchScene' scene="${sceneIndex}"></scene-button>`;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = translation[window.config.general.language].label
    input.value = scene.name;
    input.classList.add("scene-name");
    input.addEventListener("change", (e) => {
      scene.name = e.target.value;
      this.autoSave();
      this.renderSceneSelector();
    });
    container.appendChild(input);
    window.dispatchEvent(new CustomEvent("applyScene", {detail: {scene: sceneIndex, to: "preview"}}));

    const addLayerBtn = document.createElement("button");
    addLayerBtn.innerHTML = `<i class='bx bx-plus' ></i> ${translation[window.config.general.language].layer}`;
    addLayerBtn.classList.add("addLayer");
    addLayerBtn.addEventListener("click", () => {
      this.addLayerForScene(sceneIndex);
      window.dispatchEvent(new CustomEvent("applyScene", {detail: {scene: sceneIndex, to: "preview_scene"}}));
    });
    container.appendChild(addLayerBtn);

    [...scene.config].reverse().forEach((layer, visualIndex) => {
      const layerIndex = scene.config.length - 1 - visualIndex;

    
      const layerDiv = document.createElement("div");
      layerDiv.classList.add("layer");
      layerDiv.style.padding = "5px";
      layerDiv.style.marginBottom = "5px";
      layerDiv.innerHTML = `
        <details close>
          <summary style='margin-top: 15px'>
            <div class='layerDetailHeader'>
              <label class='layerTitle'>${translation[window.config.general.language].layer} ${layerIndex + 1}<br/><span class='layer_subtitle'>${layer.device}</span></label>
              <div class='layerDetailAction'>
                <button data-layer-index="${layerIndex}" class="remove-layer">
                  <i class="fa-duotone fa-regular fa-trash"></i>
                </button>
                <button data-layer-index="${layerIndex}" class="move-up">
                  <i class="fa-duotone fa-regular fa-arrow-down"></i>
                </button>
                <button data-layer-index="${layerIndex}" class="move-down">
                  <i class="fa-duotone fa-regular fa-arrow-up"></i>
                </button>
              </div>
            </div>
          </summary>
        </div>
        
        <div class='device-row'>
          

          
          <label>${translation[window.config.general.language].device}:</label>
          <select name="device" style='width: 100%'>
          <option value="none" selected}>${translation[window.config.general.language].none}</option>
            ${Array.from({ length: 8 }, (_, i) => {
              const cam = `camera${i + 1}`;
              return `<option value="${cam}" ${layer.device === cam ? "selected" : ""}>Camera ${i + 1}</option>`;
            }).join("")}
          </select>
        </div>
        <label>${translation[window.config.general.language].settings}</label>
        <div class="input-group" style='margin-bottom: 30px'>
			<span class='autoLabel'>${translation[window.config.general.language].blackBackground}</span>  
          	<input type="checkbox" style='width: 19px !important; margin: 0' name="blackFill" ${layer.blackFill ? "checked" : ""}> 
        </div>
		<label>${translation[window.config.general.language].size}</label>
        <div class="input-group">
          <input type="checkbox" name="widthAuto" ${layer.width === 'auto' ? "checked" : ""}> 
          <span class='autoLabel'>${translation[window.config.general.language].auto}</span>  
          <input type="range" name="widthRange" min="0" max="200" step="1" value="${layer.width !== 'auto' ? layer.width : 100}" ${layer.width === 'auto' ? "disabled" : ""}>
          <input type="text" name="widthText" value="${layer.width !== 'auto' ? layer.width : 0}" size="3">
        </div>

        <label>X</label>
        <div class="input-group">
          <input type="checkbox" name="xAuto" ${layer.x === 'auto' ? "checked" : ""}> 
          <span class='autoLabel'>${translation[window.config.general.language].auto}</span>  
          <input type="range" name="xRange" min="-100" max="100" step="1" value="${layer.x !== 'auto' ? layer.x : 0}" ${layer.x === 'auto' ? "disabled" : ""}>
          <input type="text" name="xText" value="${layer.x !== 'auto' ? layer.x : 0}" size="3">
        </div>
        <label>Y</label>
        <div class="input-group">
          <input type="checkbox" name="yAuto" ${layer.y === 'auto' ? "checked" : ""}> 
          <span class='autoLabel'>${translation[window.config.general.language].auto}</span>  
          <input type="range" name="yRange" min="-100" max="100" step="1" value="${layer.y !== 'auto' ? layer.y : 0}" ${layer.y === 'auto' ? "disabled" : ""}>
          <input type="text" name="yText" value="${layer.y !== 'auto' ? layer.y : 0}" size="3">
        </div>
        <details close>
          <summary>${translation[window.config.general.language].cropSettings}</summary>
          <label>${translation[window.config.general.language].left}</label>
          <div class="input-group">
            <input type="range" name="cropLeft" min="0" max="100" step="1" value="${layer.cropLeft || 0}">
            <input type="text" name="cropLeftText" value="${layer.cropLeft || 0}" size="3">
          </div>
          <label>${translation[window.config.general.language].right}</label>
          <div class="input-group">
            <input type="range" name="cropRight" min="0" max="100" step="1" value="${layer.cropRight || 0}">
            <input type="text" name="cropRightText" value="${layer.cropRight || 0}" size="3">
          </div>
          <label>${translation[window.config.general.language].top}</label>
          <div class="input-group">
            <input type="range" name="cropTop" min="0" max="100" step="1" value="${layer.cropTop || 0}">
            <input type="text" name="cropTopText" value="${layer.cropTop || 0}" size="3">
          </div>
          <label>${translation[window.config.general.language].bottom}</label>
          <div class="input-group">
            <input type="range" name="cropBottom" min="0" max="100" step="1" value="${layer.cropBottom || 0}">
            <input type="text" name="cropBottomText" value="${layer.cropBottom || 0}" size="3">
          </div>
        </details>
        <details close>
          <summary>${translation[window.config.general.language].opacityAndRadius}</summary>
          <label>${translation[window.config.general.language].opacity}:</label>
          <div class="input-group">
            <input type="range" name="opacity" min="0" max="1" step="0.1" value="${layer.opacity !== undefined ? layer.opacity : 1}">
            <input type="text" name="opacityText" value="${layer.opacity !== undefined ? layer.opacity : 1}" size="3">
          </div>
          <label>${translation[window.config.general.language].radius}:</label>
          <div class="input-group">
            <input type="range" name="radius" min="0" max="100" step="1" value="${layer.radius || 0}">
            <input type="text" name="radiusText" value="${layer.radius || 0}" size="3">
          </div>
        </details>
        <details close>
          <summary>${translation[window.config.general.language].greenKey}</summary>
          <div class="input-group">
            <span class="autoLabel">Activer Green Key</span>
            <input type="checkbox" style='width: 19px !important; margin: 0' name="greenKeyActive" ${layer.greenKeyActive ? "checked" : ""}>
          </div>
          <label>${translation[window.config.general.language].tolerance}</label>
          <div class="input-group">
            <input type="range" name="greenKeyTolerance" min="0" max="255" step="1" value="${layer.greenKeyTolerance ?? 100}">
            <input type="number" name="greenKeyToleranceText" value="${layer.greenKeyTolerance ?? 100}" size="3">
          </div>
          <label>${translation[window.config.general.language].colorDifference}</label>
          <div class="input-group">
            <input type="range" name="greenKeyColorDiff" min="0" max="100" step="1" value="${layer.greenKeyColorDiff ?? 50}">
            <input type="number" name="greenKeyColorDiffText" value="${layer.greenKeyColorDiff ?? 50}" size="3">
          </div>
          <label>${translation[window.config.general.language].smoothness}</label>
          <div class="input-group">
            <input type="range" name="greenKeySmoothness" min="0" max="100" step="1" value="${layer.greenKeySmoothness ?? 30}">
            <input type="number" name="greenKeySmoothnessText" value="${layer.greenKeySmoothness ?? 30}" size="3">
          </div>
        </details>
        <details close>
            <summary>${translation[window.config.general.language].border}</summary>
            <div class="input-group">
                <input type="range" name="borderWidth" min="0" max="10" step="1" value="${layer.borderWidth ?? 0}">
                <input type="number" name="borderWidthText" value="${layer.borderWidth ?? 0}" size="3">
            </div>
            <div class="input-group">
                <input type="color" name="borderColor" min="0" max="10" step="1" value="${layer.borderColor ?? "#ffffff"}">
                <input type="text" style="font-family: monospace; width: 100px" name="borderColorText" value="${layer.borderColor ?? "#ffffff"}" size="3">
            </div>
        </details>
        </details>
      `;

      layerDiv.querySelector(".layerTitle").addEventListener("click", () => {
        layerDiv.classList.add("developped");
      })
      layerDiv.querySelectorAll("input, select").forEach(input => {
        input.addEventListener("input", () => {
          switch (input.name) {
            case "device":
              layer.device = input.value;
              break;

              case "borderColor": {
                const textInput = layerDiv.querySelector("input[name='borderColorText']");
                textInput.value = input.value;
                layer.borderColor = input.value;
                break;
              }
              case "borderColorText": {
                const rangeInput = layerDiv.querySelector("input[name='borderColor']");
                rangeInput.value = input.value;
                layer.borderColor = input.value;
                break;
              }
              case "borderWidth": {
                const textInput = layerDiv.querySelector("input[name='borderWidthText']");
                textInput.value = input.value;
                layer.borderWidth = parseFloat(input.value) || 0;
                break;
            }
            case "borderWidthText": {
                const rangeInput = layerDiv.querySelector("input[name='borderWidth']");
                rangeInput.value = input.value;
                layer.borderWidth = parseFloat(input.value) || 0;
                break;
            }
            case "widthRange": {
              const textInput = layerDiv.querySelector("input[name='widthText']");
              textInput.value = input.value;
              const autoCheckbox = layerDiv.querySelector("input[name='widthAuto']");
              if (!autoCheckbox.checked) {
                layer.width = input.value;
              }
              break;
            }
            case "widthText": {
              const rangeInput = layerDiv.querySelector("input[name='widthRange']");
              const autoCheckbox = layerDiv.querySelector("input[name='widthAuto']");
              if (!autoCheckbox.checked) {
                rangeInput.value = input.value;
                layer.width = input.value;
              }
              break;
            }
			case "blackFill": {
				const checkbox = layerDiv.querySelector("input[name='blackFill']");
				layer.blackFill = checkbox.checked;
				break;
			}
            case "widthAuto": {
              const rangeInput = layerDiv.querySelector("input[name='widthRange']");
              const textInput = layerDiv.querySelector("input[name='widthText']");
              rangeInput.disabled = input.checked;
              if (input.checked) {
                layer.width = "auto";
                textInput.value = "auto";
              } else {
                layer.width = rangeInput.value;
                textInput.value = rangeInput.value;
              }
              break;
            }
            case "xRange": {
              const textInput = layerDiv.querySelector("input[name='xText']");
              textInput.value = input.value;
              const autoCheckbox = layerDiv.querySelector("input[name='xAuto']");
              if (!autoCheckbox.checked) {
                layer.x = input.value;
              }
              break;
            }
            case "xText": {
              const rangeInput = layerDiv.querySelector("input[name='xRange']");
              const autoCheckbox = layerDiv.querySelector("input[name='xAuto']");
              if (!autoCheckbox.checked) {
                rangeInput.value = input.value;
                layer.x = input.value;
              }
              break;
            }
            case "xAuto": {
              const rangeInput = layerDiv.querySelector("input[name='xRange']");
              const textInput = layerDiv.querySelector("input[name='xText']");
              rangeInput.disabled = input.checked;
              if (input.checked) {
                layer.x = "auto";
                textInput.value = "auto";
              } else {
                layer.x = rangeInput.value;
                textInput.value = rangeInput.value;
              }
              break;
            }
            case "yRange": {
              const textInput = layerDiv.querySelector("input[name='yText']");
              textInput.value = input.value;
              const autoCheckbox = layerDiv.querySelector("input[name='yAuto']");
              if (!autoCheckbox.checked) {
                layer.y = input.value;
              }
              break;
            }
            case "yText": {
              const rangeInput = layerDiv.querySelector("input[name='yRange']");
              const autoCheckbox = layerDiv.querySelector("input[name='yAuto']");
              if (!autoCheckbox.checked) {
                rangeInput.value = input.value;
                layer.y = input.value;
              }
              break;
            }
            case "yAuto": {
              const rangeInput = layerDiv.querySelector("input[name='yRange']");
              const textInput = layerDiv.querySelector("input[name='yText']");
              rangeInput.disabled = input.checked;
              if (input.checked) {
                layer.y = "auto";
                textInput.value = "auto";
              } else {
                layer.y = rangeInput.value;
                textInput.value = rangeInput.value;
              }
              break;
            }
            case "cropLeft": {
              const textInput = layerDiv.querySelector("input[name='cropLeftText']");
              textInput.value = input.value;
              layer.cropLeft = parseFloat(input.value) || 0;
              break;
            }
            case "cropLeftText": {
              const rangeInput = layerDiv.querySelector("input[name='cropLeft']");
              rangeInput.value = input.value;
              layer.cropLeft = parseFloat(input.value) || 0;
              break;
            }
            case "cropRight": {
              const textInput = layerDiv.querySelector("input[name='cropRightText']");
              textInput.value = input.value;
              layer.cropRight = parseFloat(input.value) || 0;
              break;
            }
            case "cropRightText": {
              const rangeInput = layerDiv.querySelector("input[name='cropRight']");
              rangeInput.value = input.value;
              layer.cropRight = parseFloat(input.value) || 0;
              break;
            }
            case "cropTop": {
              const textInput = layerDiv.querySelector("input[name='cropTopText']");
              textInput.value = input.value;
              layer.cropTop = parseFloat(input.value) || 0;
              break;
            }
            case "cropTopText": {
              const rangeInput = layerDiv.querySelector("input[name='cropTop']");
              rangeInput.value = input.value;
              layer.cropTop = parseFloat(input.value) || 0;
              break;
            }
            case "cropBottom": {
              const textInput = layerDiv.querySelector("input[name='cropBottomText']");
              textInput.value = input.value;
              layer.cropBottom = parseFloat(input.value) || 0;
              break;
            }
            case "cropBottomText": {
              const rangeInput = layerDiv.querySelector("input[name='cropBottom']");
              rangeInput.value = input.value;
              layer.cropBottom = parseFloat(input.value) || 0;
              break;
            }
            case "opacity": {
              const textInput = layerDiv.querySelector("input[name='opacityText']");
              textInput.value = input.value;
              layer.opacity = parseFloat(input.value) || 0;
              break;
            }
            case "opacityText": {
              const rangeInput = layerDiv.querySelector("input[name='opacity']");
              rangeInput.value = input.value;
              layer.opacity = parseFloat(input.value) || 1;
              break;
            }
            case "radius": {
              const textInput = layerDiv.querySelector("input[name='radiusText']");
              textInput.value = input.value;
              layer.radius = parseFloat(input.value) || 0;
              break;
            }
            case "radiusText": {
              const rangeInput = layerDiv.querySelector("input[name='radius']");
              rangeInput.value = input.value;
              layer.radius = parseFloat(input.value) || 0;
              break;
            }
            case "greenKeyActive":
              layer.greenKeyActive = input.checked;
              break;
            case "greenKeyTolerance":
            case "greenKeyToleranceText":
              layer.greenKeyTolerance = parseInt(input.value, 10);
              layerDiv.querySelector("input[name='greenKeyTolerance']").value = layer.greenKeyTolerance;
              layerDiv.querySelector("input[name='greenKeyToleranceText']").value = layer.greenKeyTolerance;
              break;
            case "greenKeyColorDiff":
            case "greenKeyColorDiffText":
              layer.greenKeyColorDiff = parseInt(input.value, 10);
              layerDiv.querySelector("input[name='greenKeyColorDiff']").value = layer.greenKeyColorDiff;
              layerDiv.querySelector("input[name='greenKeyColorDiffText']").value = layer.greenKeyColorDiff;
              break;
            case "greenKeySmoothness":
            case "greenKeySmoothnessText":
              layer.greenKeySmoothness = parseInt(input.value, 10);
              layerDiv.querySelector("input[name='greenKeySmoothness']").value = layer.greenKeySmoothness;
              layerDiv.querySelector("input[name='greenKeySmoothnessText']").value = layer.greenKeySmoothness;
              break;
            default:
              break;
          }
          this.autoSave();
          //if(applyPreview.getAttribute("status") == "active"){
            window.dispatchEvent(new CustomEvent("applyScene", {detail: {scene: sceneIndex, to: "preview_scene"}}));
          //}

        });
      });

      layerDiv.querySelector(".remove-layer").addEventListener("click", (e) => {
        const idx = parseInt(e.target.getAttribute("data-layer-index"), 10);
        this.removeLayerForScene(sceneIndex, idx);
        window.dispatchEvent(new CustomEvent("applyScene", { detail: { scene: sceneIndex, to: "preview" } }));
      });
    
      layerDiv.querySelector(".move-up").addEventListener("click", (e) => {
        const idx = parseInt(e.target.getAttribute("data-layer-index"), 10);
        this.moveLayerUpForScene(sceneIndex, idx);
        window.dispatchEvent(new CustomEvent("applyScene", { detail: { scene: sceneIndex, to: "preview" } }));
      });
    
      layerDiv.querySelector(".move-down").addEventListener("click", (e) => {
        const idx = parseInt(e.target.getAttribute("data-layer-index"), 10);
        this.moveLayerDownForScene(sceneIndex, idx);
        window.dispatchEvent(new CustomEvent("applyScene", { detail: { scene: sceneIndex, to: "preview" } }));
      });
    
      container.appendChild(layerDiv);
    });

    

    return container;
  }

  addScene() {
    const newScene = {
      name: "new Scene",
      config: [
        {
          device: "camera1",
          width: "auto",
          x: "auto",
          y: "auto",
		  blackFill: true,
          cropLeft: 0,
          cropRight: 0,
          cropTop: 0,
          cropBottom: 0,
          opacity: 1,
          radius: 0,
          uuid: uuidv4()
        }
      ]
    };
    this.scenes.push(newScene);
    this.expandedScenes.add(this.scenes.length - 1);
    this.renderSceneSelector();
    this.autoSave();
  }

  deleteScene(index) {
    if (this.scenes.length <= 1) {
    }
    //if (confirm("Supprimer cette scène ?")) {
      this.scenes.splice(index, 1);
      this.expandedScenes.delete(index);
      this.renderSceneSelector();
      this.autoSave();
    //}
  }

  addLayerForScene(sceneIndex) {
    const newLayer = {
      device: "camera1",
      width: this.scenes[sceneIndex].config.length ? 50 : "auto" ,
      x: this.scenes[sceneIndex].config.length ? 4 : "auto",
      y: this.scenes[sceneIndex].config.length ? 6.5 : "auto",
      blackFill: true,
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
      opacity: 1,
      radius: 0,
      greenKeyActive: false,
      greenKeyTolerance: 100,
      borderColor: "#ffffff",
      borderWidth: 0
    };
    this.scenes[sceneIndex].config.push(newLayer);
    this.renderSceneSelector();
    this.autoSave();
  }

  removeLayerForScene(sceneIndex, layerIndex) {
    this.scenes[sceneIndex].config.splice(layerIndex, 1);
    this.renderSceneSelector();
    this.autoSave();
  }

  moveLayerUpForScene(sceneIndex, layerIndex) {
    if (layerIndex === 0) return;
    const layers = this.scenes[sceneIndex].config;
    [layers[layerIndex - 1], layers[layerIndex]] = [layers[layerIndex], layers[layerIndex - 1]];
    this.renderSceneSelector();
    this.autoSave();
  }

  moveLayerDownForScene(sceneIndex, layerIndex) {
    const layers = this.scenes[sceneIndex].config;
    if (layerIndex >= layers.length - 1) return;
    [layers[layerIndex + 1], layers[layerIndex]] = [layers[layerIndex], layers[layerIndex + 1]];
    this.renderSceneSelector();
    this.autoSave();
  }

  autoSave() {
    localStorage.setItem("config-" + this.configKey, JSON.stringify(this.scenes));
    window.dispatchEvent(new CustomEvent("macroUpdated"));
  }
}
