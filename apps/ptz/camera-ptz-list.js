const { translation } = require('./local/local.js');
const { checkCameraReachability } = require("./js/visca-over-ip.js")
export default class PtzList extends HTMLElement {
  constructor() {
    super();
    this.configKey = this.getAttribute("config-key") || "cameras";
    this.cameras = [];
    // On utilise un Set pour mémoriser les index dépliés
    this.expandedCameras = new Set();
  }

  connectedCallback() {
    this.loadCameras();
    this.render();
  }

  loadCameras() {
    const stored = localStorage.getItem("config-" + this.configKey);
    if (stored) {
      try {
        this.cameras = JSON.parse(stored);
      } catch (e) {
        console.error("Erreur lors du parsing des caméras", e);
        this.cameras = [];
      }
    }
    // Si aucune caméra n'est définie, on initialise par défaut 8 caméras fixes
    if (!this.cameras.length) {
      this.cameras = Array.from({ length: 8 }, (_, i) => ({
        id: `camera${i + 1}`,
        name: `${translation[window.config.general.language].camera} ${i + 1}`,
        ip: "localhost",           // Par défaut, l'IP est "localhost"
        port: 52381,               // Port par défaut
        protocol: "visca-udp"
      }));
    }
    this.autoSave();
  }

  render() {
    this.innerHTML = `
      <style>
        
        .camera-header > .toggle-btn {
          border: none;
          background: transparent;
          cursor: pointer;
        }
        label {
          display: block;
          margin: 10px 0;
        }
        .select-btn {
          margin-left: 5px;
          cursor: pointer;
        }
      </style>
      <div class="camera-list">
        <div id="camera-selector"></div>
      </div>
    `;
    this.renderCameraSelector();

    window.addEventListener("selectPTZ", (e) => {
        document.querySelectorAll(".camera-header").forEach(element => {
            element.classList.remove("active");
        });
        this.querySelector(`[data-camera-id="${e.detail}"]`).classList.add("active");
    })
  }

  renderCameraSelector() {
    const selector = this.querySelector("#camera-selector");
    selector.innerHTML = "";

    this.cameras.forEach((camera, index) => {
      const item = document.createElement("div");
      item.classList.add("camera-item");

      // Entête : affichage du nom fixe, bouton de dépliage et bouton de sélection
      const header = document.createElement("div");
      header.classList.add("camera-header");
      header.classList.add("ptz-ctrl");

      // Bouton toggle pour déplier/replier
      const toggleBtn = document.createElement("button");
      toggleBtn.classList.add("toggle-btn");
      toggleBtn.classList.add("editPtz");
      // Change d'icône selon l'état : par exemple, "+" si replié et "–" si déplié
      toggleBtn.innerHTML = this.expandedCameras.has(index)
        ? '<i class="bx bx-chevron-down" ></i>'
        : '<i class="bx bx-chevron-right" ></i>';
      // Le clic sur ce bouton n'entraîne pas la sélection
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.expandedCameras.has(index)) {
          this.expandedCameras.delete(index);
        } else {
          this.expandedCameras.add(index);
        }
        this.renderCameraSelector();
      });
     

      // Titre de la caméra (non modifiable)
      const title = document.createElement("div");
      title.style.width = "100%";
      title.textContent = camera.name;
      header.appendChild(toggleBtn);
      header.appendChild(title);
      header.setAttribute("data-camera-id", camera.id);
      
      // Bouton de sélection
      const selectBtn = document.createElement("button");
      selectBtn.classList.add("select-btn");
      selectBtn.innerHTML = `<i class='bx bx-chevron-right' ></i>`;
      selectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        

        

        window.dispatchEvent(new CustomEvent("selectPTZ", { detail: camera.id }));
      });
      header.appendChild(selectBtn);

      // Permet également de déplier/replier en cliquant sur la zone d'en-tête
      header.addEventListener("click", () => {
        if (this.expandedCameras.has(index)) {
          this.expandedCameras.delete(index);
        } else {
          this.expandedCameras.add(index);
        }
        this.renderCameraSelector();
      });

      item.appendChild(header);

      // Affichage des détails si déplié
      if (this.expandedCameras.has(index)) {
        const details = document.createElement("div");
        details.classList.add("camera-details");
        
        details.innerHTML = `
            <label>${translation[window.config.general.language].protocol} :</label>
            <select name='protocol'>
                <option value='onvif' disabled ${camera.protocol == "onvif" ? "selected" : ""}>ONVIF</option>
                <option value='visca-udp' ${camera.protocol == "visca-udp" ? "selected" : ""}>Visco-over-ip (udp)</option>
            </select>
            <label>${translation[window.config.general.language].ip} :</label>
            <input style='width: calc(100% - 12px)' type="text" name="ip" value="${camera.ip}" />
            <span class='statusPTZCamera'></span>
            <label>${translation[window.config.general.language].port} :</label>
            <input style='width: calc(100% - 12px)' type="number" name="port" value="${camera.port}" />
        `;

        // Exemple d'utilisation :
        checkCameraReachability(camera.ip, camera.port, (reachable) => {
            if (reachable) {
                this.querySelector(".statusPTZCamera").innerHTML = translation[window.config.general.language].cameraReachable;
            } 
        });

        // Mise à jour des données lors de la modification
        details.querySelectorAll("input").forEach(input => {
          input.addEventListener("input", (e) => {
            if (input.name === "port") {
              camera[e.target.name] = parseInt(e.target.value, 10);
            } else {
              camera[e.target.name] = e.target.value;
            }

            if(input.name === "ip"){
                checkCameraReachability(camera.ip, parseInt(camera.port, 10), (reachable) => {
                    if (reachable) {
                        this.querySelector(".statusPTZCamera").innerHTML = translation[window.config.general.language].cameraReachable;
                    }
                });
            }

            this.autoSave();
          });
        });
        item.appendChild(details);
      }

      selector.appendChild(item);
    });
  }

  autoSave() {
    localStorage.setItem("config-" + this.configKey, JSON.stringify(this.cameras));
  }
}