const { webUtils } = require('electron');
const { uuidv4, FrameController } = require('./js/utils.js');
const { translation } = require('./local/local.js');

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

class LayerManager {
  constructor() {
    this.layers = [];
    this.editingIndex = null;
  }

  addLayer(layer) {
    this.layers.push(layer);
    this.notify();
  }

  updateLayer(index, newData) {
    Object.assign(this.layers[index], newData);
    this.notify();
  }

  removeLayer(index) {
    this.layers.splice(index, 1);
    if (this.editingIndex === index) {
      this.editingIndex = null;
    }
    this.notify();
  }

  notify() {
    const layersData = this.layers.map(layer => ({
      type: layer.type,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      visible: layer.visible,
      aspectRatio: layer.aspectRatio,
      autoPlay: layer.type === "video" ? layer.autoPlay : undefined,
      loop: layer.type === "video" ? layer.loop : undefined,
      label: layer.label,
      source: layer.source && layer.source.src ? layer.source.src.replace(/^file:\/\//, "") : null,
      hideWhenFinished: layer.type === "video" ? layer.hideWhenFinished : false,
      uuid: layer.uuid
    }));
    localStorage.setItem("layersData", JSON.stringify(layersData));
    window.dispatchEvent(new CustomEvent("layersUpdated", { detail: this.layers }));
  }

  loadLayers() {
    const data = localStorage.getItem("layersData");
    if (!data) return;
    try {
      const layersData = JSON.parse(data);
      layersData.forEach(layerData => {
        if (layerData.type === "image") {
          const img = new Image();
          img.src = "file://" + layerData.source;
          this.layers.push({
            type: "image",
            source: img,
            x: layerData.x,
            y: layerData.y,
            width: layerData.width,
            height: layerData.height,
            visible: layerData.visible,
            aspectRatio: layerData.aspectRatio,
            label: layerData.label || "",
            uuid: layerData.uuid
          });
        } else if (layerData.type === "video") {
          const video = document.createElement("video");
          video.src = "file://" + layerData.source;
          video.loop = layerData.loop || false;
          video.muted = true;
          if (layerData.autoPlay) {
            video.play().catch(err => console.error(err));
          }
          this.layers.push({
            type: "video",
            source: video,
            x: layerData.x,
            y: layerData.y,
            width: layerData.width,
            height: layerData.height,
            visible: layerData.visible,
            aspectRatio: layerData.aspectRatio,
            autoPlay: layerData.autoPlay,
            loop: layerData.loop,
            label: layerData.label || "",
            hideWhenFinished: layerData.hideWhenFinished || false,
            uuid: layerData.uuid
          });
        }
      });
      window.dispatchEvent(new CustomEvent("layersUpdated", { detail: this.layers }));
    } catch (err) {
      console.error("Erreur lors du chargement des layers depuis localStorage", err);
    }
  }
}

const layerManager = new LayerManager();
layerManager.loadLayers();

export default class LayerViewer extends HTMLElement {
  constructor() {
    super();
    this.layers = layerManager.layers;
    this.currentLayerIndex = null;
    this.main = this.getAttribute("main") === "true";
	
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.canvas = this.querySelector("#layerMaster");
	this.visibleCtx = this.canvas.getContext("2d");
    if (this.main) {
      if (this.canvas) {
        this.offscreen = new OffscreenCanvas(this.canvas.width, this.canvas.height);
        this.ctx = this.offscreen.getContext("2d", {willReadFrequently: false, desynchronized: true});
		const controller = new FrameController(window.config.video.framerate, () => {
			this.drawLayers();
		});
		controller.start();
        // setInterval(() => { this.drawLayers()}, 1000 / window.config.video.framerate);
      }

    }
    window.addEventListener("layersUpdated", (e) => {
      this.layers = e.detail;
      this.refreshLayerList();
    });
    this.refreshLayerList();
  }

  render() {
    this.innerHTML = `
      <div class="layerContainer" id="dropZoneLayer">
        ${this.main ? `
          <div style="display: none" class="layer-left">
            <canvas style="display: none" id="layerMaster" width="${parseInt(window.config.video.definition.split("x")[0])}" height="${parseInt(window.config.video.definition.split("x")[1])}"></canvas>
            <video id="pgmForLayer" autoplay></video>
          </div>
        ` : ``}
        <div class="layer-right ${this.main ? "main" : ""}">
          
          <div id="layerList"></div>
          <div id="uploadPlaceholders"></div>
          <div class='bottom-action'>
            <button id="importButton">${translation[window.config.general.language].importAFile}</button>
            <input type="file" id="fileInput" style="display:none" accept="image/*,video/*"/>
          </div>
          <div id="conversionProgress" style="display:none;">
            <progress id="progressBar" value="0" max="100"></progress>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const importButton = this.querySelector("#importButton");
    const fileInput = this.querySelector("#fileInput");
    if (importButton && fileInput) {
      importButton.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type.startsWith("image/")) {
          this.addImageLayer(file);
        } else if (file.type.startsWith("video/")) {
          await this.convertAndAddVideoLayer(file);
        }
        fileInput.value = "";
      });
    }
  }

  setupDragAndDrop() {
    const dropZone = this.querySelector("#dropZoneLayer");
    if (!dropZone) return;
    ["dragenter", "dragover"].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });
    ["dragleave", "drop"].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.backgroundColor = "";
      }, false);
    });
    dropZone.addEventListener("drop", async (e) => {
      const file = e.dataTransfer.files[0];
      if (file) {
        if (file.type.startsWith("image/")) {
          this.addImageLayer(file);
        } else if (file.type.startsWith("video/")) {
          await this.convertAndAddVideoLayer(file);
        }
      }
    }, false);
  }

  addImageLayer(file) {
    const filePath = webUtils.getPathForFile(file);
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      const defaultWidthPercent = 100;
      const defaultWidthPx = 1920;
      const defaultHeightPx = defaultWidthPx / aspectRatio;
      const defaultHeightPercent = (defaultHeightPx / 1080) * 100;
      const layer = {
        type: "image",
        source: img,
        x: 0,
        y: 0,
        width: defaultWidthPercent,
        height: defaultHeightPercent,
        visible: false,
        aspectRatio,
        label: "",
        uuid: uuidv4()
      };
      layerManager.addLayer(layer);
    };
    img.onerror = () => {
      console.error("Erreur lors du chargement de l'image :", filePath);
    };
    img.src = "file://" + filePath;
  }

  async convertAndAddVideoLayer(file) {
	const filePath = webUtils.getPathForFile(file);
	const uploadPlaceholders = this.querySelector("#uploadPlaceholders");
	const placeholderItem = document.createElement("div");
	placeholderItem.classList.add("uploadPlaceholder");
	placeholderItem.innerHTML = `
	  <span class="uploadName">${file.name} </span>
	  <span class="uploadPercentage">(${translation[window.config.general.language].import}: 0%)</span>
	`;
	uploadPlaceholders.insertBefore(placeholderItem, uploadPlaceholders.firstChild);
	const progressContainer = this.querySelector("#conversionProgress");
	const progressBar = this.querySelector("#progressBar");
	progressContainer.style.display = "block";
  
	// Sauvegarde du fichier dans un répertoire temporaire
	const ffmpeg = require("fluent-ffmpeg");
	const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');
	const ffprobePath = require('@ffprobe-installer/ffprobe').path.replace('app.asar', 'app.asar.unpacked');
	const path = require("path");
	const fs = require("fs");
	ffmpeg.setFfmpegPath(ffmpegPath);
	ffmpeg.setFfprobePath(ffprobePath);
	const uniqueId = Date.now();
	const tempInputPath = path.join(window.config.output.cachedFile.destination || window.appDir, uniqueId + "_" + file.name);
	fs.writeFileSync(tempInputPath, Buffer.from(new Uint8Array(await file.arrayBuffer())));
  
	return new Promise((resolve, reject) => {
	  ffmpeg.ffprobe(tempInputPath, (err, metadata) => {
		if (err) {
		  console.error("Erreur ffprobe:", err);
		  uploadPlaceholders.removeChild(placeholderItem);
		  progressContainer.style.display = "none";
		  return reject(err);
		}
		// Extraction du flux vidéo
		const videoStream = metadata.streams.find(stream => stream.codec_type === "video");
		if (!videoStream) {
		  console.error("Aucun flux vidéo trouvé pour", filePath);
		  uploadPlaceholders.removeChild(placeholderItem);
		  progressContainer.style.display = "none";
		  return reject(new Error("No video stream found"));
		}
		let codec = videoStream.codec_name.toLowerCase();
		const hasAlpha = videoStream.pix_fmt && videoStream.pix_fmt.includes('a');
		// Pour la gestion des formats, on définit les conteneurs supportés
		const supportedContainers = ['.mp4', '.mov', '.webm'];
		const ext = path.extname(filePath).toLowerCase();
		const supportedCodecs = ['h264', 'h265', 'vp8', 'vp9'];
		// La conversion n'est pas nécessaire si le fichier est dans un conteneur supporté,
		// que son codec figure dans la liste et qu'il n'a pas de couche alpha.
		const needsConversion = (() => {
		  if (!supportedContainers.includes(ext)) return true;
		  if (!supportedCodecs.includes(codec)) return true;
		  if (hasAlpha) return true;
		  return false;
		})();
  
		if (!needsConversion) {
		  // Pas de conversion nécessaire : utilisation du fichier d'origine
		  progressContainer.style.display = "none";
		  uploadPlaceholders.removeChild(placeholderItem);
		  const video = document.createElement("video");
		  video.src = "file://" + filePath;
		  video.loop = false;
		  video.muted = true;
		  video.onloadedmetadata = () => {
			const aspectRatio = video.videoWidth / video.videoHeight;
			const defaultWidthPercent = 100;
			const defaultWidthPx = 1920;
			const defaultHeightPx = defaultWidthPx / aspectRatio;
			const defaultHeightPercent = (defaultHeightPx / 1080) * 100;
			const layer = {
				type: "video",
				source: video,
				x: 0,
				y: 0,
				width: defaultWidthPercent,
				height: defaultHeightPercent,
				visible: false,
				aspectRatio,
				autoPlay: true,
				loop: false,
				label: "",
				hideWhenFinished: false,
				uuid: uuidv4()
			};
			video.onended = () => {
				if (layer.hideWhenFinished) {
					layer.visible = false;
					layerManager.notify();
				}
			};
			layerManager.addLayer(layer);
			if (layer.autoPlay) {
				video.play().catch(err => console.error("Erreur lors du lancement de la vidéo :", err));
			}
			resolve();
		  }
		} else {
			let tempOutputPath;
		  	if (hasAlpha) {
				tempOutputPath = path.join(window.config.output.cachedFile.destination || window.appDir, uniqueId + "_" + path.parse(file.name).name + ".webm");
		  	} else {
				tempOutputPath = path.join(window.config.output.cachedFile.destination || window.appDir, uniqueId + "_" + path.parse(file.name).name + ".mp4");
		  	}
		  // Construction de la commande ffmpeg avec filtre de mise à l'échelle
		  	const command = ffmpeg(tempInputPath).videoFilters('scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2');
  
			if (hasAlpha) {
			// Conversion en WebM pour préserver la couche alpha
				command.outputOptions([
					'-c:v libvpx-vp9',
			  		'-pix_fmt yuva420p',
			  		'-crf 20',
			  		'-b:v 10000k'
				]);
		  	} else {
				const encoder = window.config.output.cachedFile.encoder; // ex: libx264, h264_nvenc...

            	command
                	.format('mp4')
                	.outputOptions([
                		`-c:v ${encoder}`,
						'-preset fast',
						'-pix_fmt yuv420p',
						'-r 30',
						'-b:v 5000k',
						'-maxrate 5000k',
						'-bufsize 10000k',
						'-c:a aac',
						'-b:a 192k',
						'-ac 2'
                	]);
		  	}
  
			command.on("progress", (progress) => {
			  		const percent = progress.percent ? progress.percent.toFixed(2) : 0;
			  		progressBar.value = percent;
			  		const percentageElem = placeholderItem.querySelector(".uploadPercentage");
			  		if (percentageElem) {
						percentageElem.textContent = `(${translation[window.config.general.language].import}: ${Math.floor(percent)}%)`;
			 		}
			})
			.on("end", () => {
				progressContainer.style.display = "none";
				uploadPlaceholders.removeChild(placeholderItem);
				const video = document.createElement("video");
				video.src = "file://" + tempOutputPath;
				video.loop = false;
				video.muted = true;
				video.onloadedmetadata = () => {
					const aspectRatio = video.videoWidth / video.videoHeight;
					const defaultWidthPercent = 100;
					const defaultWidthPx = 1920;
					const defaultHeightPx = defaultWidthPx / aspectRatio;
					const defaultHeightPercent = (defaultHeightPx / 1080) * 100;
					const layer = {
						type: "video",
						source: video,
						x: 0,
						y: 0,
						width: defaultWidthPercent,
						height: defaultHeightPercent,
						visible: true,
						aspectRatio,
						autoPlay: true,
						loop: false,
						label: "",
						hideWhenFinished: false,
						uuid: uuidv4()
					};
					video.onended = () => {
						if (layer.hideWhenFinished) {
						layer.visible = false;
						layerManager.notify();
						}
					};
					layerManager.addLayer(layer);
					if (layer.autoPlay) {
						video.play().catch(err => console.error("Erreur lors du lancement de la vidéo :", err));
					}
					resolve();
				};
			})
			.on("error", (err) => {
			  	console.error("Erreur lors du transcodage vidéo: ", err);
			  	progressContainer.style.display = "none";
			  	uploadPlaceholders.removeChild(placeholderItem);
			  	reject(err);
			})
			.save(tempOutputPath);
		}
	  });
	});
}
  

  refreshLayerList() {
    const listContainer = this.querySelector("#layerList");
    listContainer.innerHTML = "";
    if (this.layers.length < 1) {
      listContainer.innerHTML = `<h2 class='placeholder' style='text-align: center; padding: 15px'>${translation[window.config.general.language].dragDropFileHere}</h2>`;
    }
    this.layers.forEach((layer, index) => {
      const displayName = layer.label && layer.label.trim() !== "" ? layer.label : `Layer ${index + 1}`;
      const isEditing = layerManager.editingIndex === index;
      const paramsHTML = isEditing ? `
        <div class="layerParams" id="layerParams-${index}">
          <label>
            ${translation[window.config.general.language].label}: <input type="text" id="layerLabel-${index}" value="${layer.label || ''}"/>
          </label><br/>
          <label>
            X (%): <input type="range" min="-100" max="100" id="posX-${index}" value="${layer.x}"/>
          </label><br/>
          <label>
            Y (%): <input type="range" min="-100" max="100" id="posY-${index}" value="${layer.y}"/>
          </label><br/>
          <label>
            ${translation[window.config.general.language].size} (%): <input type="range" min="0" max="200" id="layerWidth-${index}" value="${layer.width}"/>
          </label><br/>
          ${layer.type === "video" ? `
            <div id="videoAutoPlayContainer-${index}">
              <label style='display: none'>
                ${translation[window.config.general.language].autoplay}: <input type="checkbox" id="autoPlayCheckbox-${index}" ${layer.autoPlay ? "checked" : ""}/>
              </label>
              <label>
                ${translation[window.config.general.language].loop}: <input type="checkbox" id="loopCheckbox-${index}" ${layer.loop ? "checked" : ""}/>
              </label><br/>
              <label>
                ${translation[window.config.general.language].hideWhenFinished}: <input type="checkbox" id="hideWhenFinishedCheckbox-${index}" ${layer.hideWhenFinished ? "checked" : ""}/>
              </label><br/>
            </div>
          ` : ""}
        </div>
      ` : "";
      const editIcon = isEditing ? '<i class="bx bx-chevron-down" ></i>' : '<i class="bx bx-chevron-right" ></i>';
      const layerDiv = document.createElement("div");
      layerDiv.classList.add("layerItem", "line");
      layerDiv.innerHTML = `
        <div data-index="${index}" class="layerHeader">
         <div class="topandbottomlayer">
            <button data-index="${index}" class="moveUp"><i class='bx bx-chevron-up' ></i></button>
            <div class='indexLayer' style='text-align: center'>${index + 1}</div>
            <button data-index="${index}" class="moveDown"><i class='bx bx-chevron-down' ></i></button>
          </div>
		  <button class="toggleVisibility ${layer.visible ? "visible" : "invisible"}" data-index="${index}">
            ${layer.visible ? '<i class="bx bxs-show" ></i>' : '<i class="bx bxs-hide" ></i>'}
          </button>
          <button data-index="${index}" class="editLayer">${editIcon}</button>
          <div class="layerName">${displayName}</div>
          
          
          <button data-index="${index}" class="deleteLayer"><i class='bx bxs-trash' ></i></button>
          
          
        </div>
        ${paramsHTML}
      `;
      listContainer.appendChild(layerDiv);
    });

    listContainer.querySelectorAll(".toggleVisibility").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"), 10);
        this.toggleLayer(index, !this.layers[index].visible);
      });
    });

    listContainer.querySelectorAll(".editLayer").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"), 10);
        layerManager.editingIndex = layerManager.editingIndex === index ? null : index;
        layerManager.notify();
      });
    });

    listContainer.querySelectorAll(".moveUp").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"), 10);
        if (index > 0) {
          [this.layers[index - 1], this.layers[index]] = [this.layers[index], this.layers[index - 1]];
          if (layerManager.editingIndex === index) {
            layerManager.editingIndex = index - 1;
          } else if (layerManager.editingIndex === index - 1) {
            layerManager.editingIndex = index;
          }
          layerManager.notify();
        }
      });
    });

    listContainer.querySelectorAll(".moveDown").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"), 10);
        if (index < this.layers.length - 1) {
          [this.layers[index + 1], this.layers[index]] = [this.layers[index], this.layers[index + 1]];
          if (layerManager.editingIndex === index) {
            layerManager.editingIndex = index + 1;
          } else if (layerManager.editingIndex === index + 1) {
            layerManager.editingIndex = index;
          }
          layerManager.notify();
        }
      });
    });

    listContainer.querySelectorAll(".deleteLayer").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute("data-index"), 10);
        layerManager.removeLayer(index);
      });
    });

    if (layerManager.editingIndex !== null) {
      this.attachFormListeners(layerManager.editingIndex);
    }
  }

  attachFormListeners(index) {
    const labelInput = this.querySelector(`#layerLabel-${index}`);
    const posXInput = this.querySelector(`#posX-${index}`);
    const posYInput = this.querySelector(`#posY-${index}`);
    const widthInput = this.querySelector(`#layerWidth-${index}`);
    const autoPlayInput = this.querySelector(`#autoPlayCheckbox-${index}`);
    const loopInput = this.querySelector(`#loopCheckbox-${index}`);
    const hideCheckbox = this.querySelector(`#hideWhenFinishedCheckbox-${index}`);
    
    const updateLayerLocally = () => {
      const layer = this.layers[index];
      layer.label = labelInput.value;
      layer.x = parseFloat(posXInput.value);
      layer.y = parseFloat(posYInput.value);
      layer.width = parseFloat(widthInput.value);
      const canvasElement = this.querySelector("#layerMaster");
      const canvas = canvasElement ? canvasElement : { width: 1920, height: 1080 };
      const newWidthPx = (layer.width / 100) * canvas.width;
      const newHeightPx = newWidthPx / layer.aspectRatio;
      layer.height = (newHeightPx / canvas.height) * 100;
      const heightDisplay = this.querySelector(`#layerHeightDisplay-${index}`);
      if (heightDisplay) {
        heightDisplay.textContent = layer.height.toFixed(2);
      }
      if (layer.type === "video") {
        layer.autoPlay = autoPlayInput.checked;
        layer.loop = loopInput.checked;
        layer.hideWhenFinished = hideCheckbox.checked;
        layer.source.loop = layer.loop;
        if (layer.visible && layer.autoPlay) {
          layer.source.play().catch(err => console.error("Erreur lors du lancement de la vidéo :", err));
        }
      }
    };

    const notifyOnRelease = debounce(() => {
      layerManager.notify();
    }, 50);

    if (hideCheckbox) {
      hideCheckbox.addEventListener("change", updateLayerLocally);
      hideCheckbox.addEventListener("pointerup", notifyOnRelease);
    }
    if (labelInput) {
      labelInput.addEventListener("input", updateLayerLocally);
      labelInput.addEventListener("change", notifyOnRelease);
    }
    if (posXInput) {
      posXInput.addEventListener("input", updateLayerLocally);
      posXInput.addEventListener("pointerup", notifyOnRelease);
    }
    if (posYInput) {
      posYInput.addEventListener("input", updateLayerLocally);
      posYInput.addEventListener("pointerup", notifyOnRelease);
    }
    if (widthInput) {
      widthInput.addEventListener("input", updateLayerLocally);
      widthInput.addEventListener("pointerup", notifyOnRelease);
    }
    if (autoPlayInput) {
      autoPlayInput.addEventListener("change", updateLayerLocally);
      autoPlayInput.addEventListener("pointerup", notifyOnRelease);
    }
    if (loopInput) {
      loopInput.addEventListener("change", updateLayerLocally);
      loopInput.addEventListener("pointerup", notifyOnRelease);
    }
  }

  toggleLayer(layerIndex, state) {
    if (layerIndex < 0 || layerIndex >= this.layers.length) {
        console.warn("Index de layer invalide :", layerIndex);
        return;
    }

    const layer = this.layers[layerIndex];

    if (typeof state === 'undefined') {
        state = !layer.visible;
    }

    layer.visible = state;

    if (layer.type === "video") {
        layer.source.loop = layer.loop;
        if (layer.visible) {
            layer.source.play().catch(err => console.error("Erreur lors du lancement de la vidéo :", err));
        } else {
            layer.source.pause();
           // layer.source.currentTime = 0;
        }
        layer.source.onended = () => {
            if (layer.hideWhenFinished) {
                this.toggleLayer(layerIndex, false);
            }
        };
    }

    layerManager.notify();
}

  
  	drawLayers() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.layers.forEach(layer => {
			if (!layer.visible) {
				if (layer.type === "video") {
					layer.source.currentTime = 0;
				}
				return;
			}

			const widthPx = (layer.width / 100) * this.canvas.width;
			const heightPx = (layer.height / 100) * this.canvas.height;
			const xPx = (layer.x / 100) * (this.canvas.width - widthPx);
			const yPx = (layer.y / 100) * (this.canvas.height - heightPx);
			this.ctx.drawImage(layer.source, xPx, yPx, widthPx, heightPx);
		});
		
		this.visibleCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.visibleCtx.drawImage(this.offscreen, 0, 0);
		
	}
}
