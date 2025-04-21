const fs = require('fs');
const path = require('path');
const { webUtils } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');
const ffprobePath = require('@ffprobe-installer/ffprobe').path.replace('app.asar', 'app.asar.unpacked');
const { uuidv4, generateThumbnailToBase64, formatDuration, getVideoMetadata, getVideoDuration } = require('./js/utils.js');
const { translation } = require('./local/local.js');
const { Notyf } = require('notyf');
var notyf = new Notyf();
// Configuration de ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

export default class Playlist extends HTMLElement {
  constructor() {
    super();
    this.mediaplayer = parseInt(this.getAttribute("mediaplayer"));
    this.targetPath = process.cwd();
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
    const configData = this.getConfig();
    this.playlist = configData.playlist;
    this.config = configData.config;
    this.transcoding = [];
    this.config.selected = this.config.selected || 0;
    this.display = this.getAttribute("display");
    this.isTranscoding = false;
  }

  connectedCallback() {
    window.addEventListener("refreshPlaylist", () => {
      const configData = this.getConfig();
      this.playlist = configData.playlist;
      this.config = configData.config;
      this.render();
    });

    if (this.hasAttribute('target-path')) {
      this.targetPath = this.getAttribute('target-path');
    }
    this.render();
    this.setVideo(this.config.selected || 0);
    this.addEventListener('dragover', this.handleDragOver);
    this.addEventListener('drop', this.handleDrop);

    this.addEventListener("askNextVideo", () => {
      this.config.selected = (this.config.selected + 1) % this.playlist.length;
      this.setVideo(this.config.selected);
    });
    this.addEventListener("askPrevVideo", () => {
      this.config.selected = (this.config.selected - 1 + this.playlist.length) % this.playlist.length;
      this.setVideo(this.config.selected);
    });
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  async handleDrop(e) {
    e.preventDefault();
    const filePaths = [];
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (const file of e.dataTransfer.files) {
        const sourcePath = webUtils.getPathForFile(file);
        filePaths.push(sourcePath);
      }
    } else {
      const filePath = e.dataTransfer.getData('text/plain');
      if (filePath && typeof filePath === 'string') {
        filePaths.push(filePath);
      }
    }
    for (const sourcePath of filePaths) {
      await this.processFile(sourcePath);
    }
    this.saveConfig();
    this.render();
  }

  async processFile(sourcePath) {
    let fileName = path.basename(sourcePath);
    const ext = path.extname(sourcePath).toLowerCase();

    // Si c'est une image PNG, on lance une conversion spécifique
    if (ext === '.png') {
      try {
        const outputName = 'conv_' + path.basename(sourcePath, ext) + '.webm';
        const outputPath = path.join(window.config.output.cachedFile.destination || window.appDir, outputName);
        await new Promise((resolve, reject) => {
          ffmpeg(sourcePath)
            .inputOptions(['-loop 1'])
            .outputOptions([
              '-t 2',             // Durée fixe de 2 secondes
              '-c:v libvpx-vp9',   // VP9 pour supporter le canal alpha
              '-pix_fmt yuva420p',
              '-crf 30',
              '-b:v 0'
            ])
            .on('start', commandLine => {
              console.log("Conversion PNG démarrée : " + commandLine);
              this.isTranscoding = true;
            })
            .on('progress', progress => {
              const percent = progress.percent ? progress.percent.toFixed(2) : 0;
              console.log("Progression de la conversion PNG : " + percent + "%");
            })
            .on('end', () => {
              console.log("Conversion PNG terminée : " + outputPath);
              this.isTranscoding = false;
              resolve();
            })
            .on('error', err => {
              console.error("Erreur lors de la conversion PNG :", err);
              notyf.error({message: 'Erreur de la conversion PNG'+err, duration: 5000, dismissible: true});

              this.isTranscoding = false;
              reject(err);
            })
            .save(outputPath);
        });
        const thumbnailBase64 = await generateThumbnailToBase64(outputPath);
        this.playlist.push({
          name: fileName,
          file: outputPath,
          thumbnail: thumbnailBase64,
          duration: 2,
          codec: 'vp9 (WebM, from PNG)',
          loading: false,
          loop: true,
          autoNext: false,
          uuid: uuidv4()
        });
        this.saveConfig();
        this.render();
      } catch (error) {
        console.error("Erreur lors du traitement du PNG", sourcePath, error);
        notyf.error({message: 'Erreur lors du traitement du PNG' + error, duration: 5000, dismissible: true});

      }
      return;
    }

    try {
      const metadata = await getVideoMetadata(sourcePath);
      const videoStreams = metadata.streams.filter(stream => stream.codec_type === 'video');
      if (videoStreams.length === 0) {
        notyf.error({message: 'Aucun flux vidéo trouvé', duration: 5000, dismissible: true});
        return;
      }
      let codec = videoStreams[0].codec_name.toLowerCase();
      const duration = parseFloat(metadata.format.duration);

      const needsConversion = (() => {
		// Liste des conteneurs supportés nativement
		const supportedContainers = ['.mp4', '.mov', '.webm'];
		// Si l'extension n'est pas dans la liste, on force la conversion
		if (!supportedContainers.includes(ext)) return true;
	  
		// Liste des codecs acceptés (note : h265 peut ne pas être supporté partout)
		const supportedCodecs = ['h264', 'h265', 'vp8', 'vp9'];
		// Si le codec n'est pas dans la liste, la conversion est nécessaire
		if (!supportedCodecs.includes(codec)) return true;
	  
		return false;
	  })();
	  
	  const hasAlpha = videoStreams[0].pix_fmt && videoStreams[0].pix_fmt.includes('a');
		console.log(hasAlpha, "alpha");

		if (needsConversion) {
		// Ajout d'un item "placeholder" pour indiquer le transcodage en cours
		const placeholderIndex = this.transcoding.length;
		this.isTranscoding = true;
		const placeholderItem = {
			name: fileName + " (Import: 0%)",
			file: sourcePath,
			thumbnail: "",
			duration: duration,
			codec: "transcodage en cours",
			loading: true,
			progress: 0
		};
		this.transcoding.push(placeholderItem);
		this.saveConfig();
		this.render();

		// Choix du format de sortie en fonction de la présence d'une couche alpha
		let outputName, outputPath;
		if (hasAlpha) {
			outputName = 'conv_' + path.basename(sourcePath, path.extname(sourcePath)) + '.webm';
		} else {
			outputName = 'conv_' + path.basename(sourcePath, path.extname(sourcePath)) + '.mp4';
		}
		outputPath = path.join(window.config.output.cachedFile.destination || window.appDir, outputName);

		// Construction de la commande ffmpeg avec filtrage et options adaptées
		const command = ffmpeg(sourcePath)
			.videoFilters('scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2');

		if (hasAlpha) {
			// Conversion en WebM pour conserver la couche alpha
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
		
		await new Promise((resolve, reject) => {
			command
			.on('start', commandLine => {
				console.log("Démarrage de la conversion : " + commandLine);
				this.isTranscoding = true;
			})
			.on('progress', progress => {
				const percent = progress.percent ? progress.percent.toFixed(2) : 0;
				placeholderItem.progress = percent;
				placeholderItem.name = fileName + ` (${translation[window.config.general.language].import}: ${percent} %)`;
				this.saveConfig();
				this.render();
			})
			.on('end', () => {
				console.log("Conversion terminée : " + outputPath);
				this.isTranscoding = false;
				this.transcoding = this.transcoding.filter(item => item !== placeholderItem);
				resolve();
			})
			.on('error', err => {
				console.error("Erreur lors de la conversion :", err);
                notyf.error({message: 'Erreur lors de la conversion : ' + err, duration: 5000, dismissible: true});

				this.isTranscoding = false;
				this.transcoding = this.transcoding.filter(item => item !== placeholderItem);
				reject(err);
			})
			.save(outputPath);
		});

		if (hasAlpha) {
			console.log("Utilisation du fichier WebM converti pour la lecture");
			codec = "vp9 (WebM)";
		} else {
			console.log("Utilisation du fichier MP4 converti pour la lecture");
			codec = "h264 (MP4)";
		}
		sourcePath = outputPath;
		fileName = path.basename(outputPath);
		}


      // Génération de la miniature et ajout à la playlist
      const thumbnailBase64 = await generateThumbnailToBase64(sourcePath);
      this.playlist.push({
        name: fileName,
        file: sourcePath,
        thumbnail: thumbnailBase64,
        duration: duration,
        codec: codec,
        loading: false,
        loop: false,
        autoNext: false,
        uuid: uuidv4()
      });
	  if(this.playlist.length === 1){
		this.config.selected = 0;
		this.setVideo(0);
	  }
      this.saveConfig();
      this.render();
    } catch (error) {
        notyf.error({message: 'Erreur lors du traitement du fichier' + error, duration: 5000, dismissible: true});

      console.error("Erreur lors du traitement du fichier", sourcePath, error);
    }
  }

  saveConfig() {
    const storedData = { playlist: this.playlist, config: this.config };
    localStorage.setItem("playlist-" + this.mediaplayer, JSON.stringify(storedData));
    window.dispatchEvent(new CustomEvent("refreshPlaylist"));
  }

  getConfig() {
    const storedData = JSON.parse(localStorage.getItem("playlist-" + this.mediaplayer)) || { playlist: [], config: {} };
    return storedData;
  }

  deleteItem(index) {
    index = parseInt(index, 10);
	
    this.playlist.splice(index, 1);
	if(this.config.selected == index) { this.config.selected = 0; this.setVideo(0);}
    this.saveConfig();
    this.render();
  }

  setVideo(index) {
    index = parseInt(index, 10);
    if (this.playlist[index]) {
      document.querySelector("media-player[mediaplayer='" + this.mediaplayer + "']").dispatchEvent(new CustomEvent("setVideo", { 
        detail: {
          file: this.playlist[index].file,
          autoNext: this.playlist[index].autoNext,
          loop: this.playlist[index].loop,
          uuid: this.playlist[index].uuid,
          codec: this.playlist[index].codec,
          thumbnail: this.playlist[index].thumbnail
        }
      }));
      this.config.selected = index;
      this.saveConfig();
      this.render();
    }
	else{
		document.querySelector("media-player[mediaplayer='" + this.mediaplayer + "']").dispatchEvent(new CustomEvent("setVideo", { 
			detail: {
			  file: "null"
			}
		}));
		this.saveConfig();
      	this.render();
	}
  }

  moveUp(index) {
    index = parseInt(index, 10);
    if (index > 0) {
      const item = this.playlist.splice(index, 1)[0];
      this.playlist.splice(index - 1, 0, item);
      if (this.config.selected === index) {
        this.config.selected = index - 1;
      }
      this.saveConfig();
      this.render();
    }
  }
  
  moveDown(index) {
    index = parseInt(index, 10);
    if (index < this.playlist.length - 1) {
      const item = this.playlist.splice(index, 1)[0];
      this.playlist.splice(index + 1, 0, item);
      if (this.config.selected === index) {
        this.config.selected = index + 1;
      }
      this.saveConfig();
      this.render();
    }
  }

  render() {
    let fileList = "";
    if (this.playlist.length < 1 && !this.isTranscoding) {
      fileList += `<h2 class='placeholder' style='text-align: center; padding: 15px'>
        ${translation[window.config.general.language].dragDropFileHere}
      </h2>`;
    } else {
      this.transcoding.forEach((item) => {
        fileList += `<div class='item loading line' data-file='${item.file}'>
          <div class='thumbnail' style='background-image: url(${item.thumbnail}); ${this.display === "inline" ? "display: none" : ""}'></div>
          <div class='item_name'>
            <div class='item_title'>${item.name}</div>
            <div class='item_duration'>${formatDuration(item.duration)}</div>
          </div>
        </div>`;
      });
      this.playlist.forEach((item, index) => {
        fileList += `<div class='item line ${index === this.config.selected ? "active" : ""}' data-file='${item.file}'>
            <div class='item_order'>
            <button class='top' data-item='${index}'><i class='bx bx-chevron-up' ></i></button>
            <div class='indexLayer' style='text-align: center'>${index + 1}</div>
            <button class='bottom' data-item='${index}'><i class='bx bx-chevron-down' ></i></button>
          </div>  
        <div class='thumbnail' style='background-image: url(${item.thumbnail}); ${this.display === "inline" ? "display: none" : ""}'></div>
          <div class='item_name' style='${this.display === "inline" ? "margin-left: 0px; padding: 0px 0px" : ""}'>
            <div class='item_title'>${item.name}</div>
            <div class='item_duration'>${formatDuration(item.duration)} / ${item.codec}  ${!fs.existsSync(item.file) ? "/ <span class='errorColor'> " + translation[window.config.general.language].filenoexist +"</span>": ""}</div>
            <div style="${(this.config.selected !== index && this.display === "inline") ? "display: none" : ""}" class='item_option'>
              <label class='label'>${translation[window.config.general.language].loop}<input style='margin-right: 0' type='checkbox' data-item='${index}' ${item.loop ? "checked" : ""} class='autoloopitem' /></label>
              <label class='label'>${translation[window.config.general.language].nextAuto}<input style='margin-right: 0' type='checkbox' ${item.autoNext ? "checked" : ""} data-item='${index}' class='autonextitem' /></label>
            </div>
          </div>
          <div class='item_right'>
            <div class='item_action'>
              <button style="${this.display === "inline" ? "display: none" : ""}" class='delete_item' data-item='${index}'><i class='bx bxs-trash' ></i></button>
                      <button style='${this.config.selected === index ? "pointer-events: none; opacity: 0.2" : ""}' class='select_item' data-item='${index}'>${this.config.selected === index ? '<i class="bx bx-chevron-right" ></i>' : '<i class="bx bx-chevron-right" ></i>'}</button>

              </div>
          </div>
          
        </div>`;
      });
    }
    this.innerHTML = `
      <div class="drop-zone" style="height: 100%; ${this.display === "inline" ? "" : "padding: 10px;"}">
        <div style="${this.display === "inline" ? "position: static; background: transparent" : ""}" class='settings_playlist'>
          <label class='label' for="autoNext"><input type='checkbox' class="autoNext" ${this.config.autoNext ? "checked" : ""}/> ${translation[window.config.general.language].nextAuto}</label>
          &nbsp; &nbsp;
          <label class='label' style="display: none" for="blackFill"><input class="blackFill" ${this.config.blackFill ? "checked" : ""} type="checkbox" /> black background</label>
        </div>
        <div style="${this.display === "inline" ? "padding: 0px; padding-bottom: 0px" : ""}" class='playlist_items'>
          ${fileList}
        </div>
        <div class='bottom-action'>
          <button id="importButton">${translation[window.config.general.language].importAFile}</button>
          <input type="file" id="fileInput" style="display:none" accept="image/*,video/*"/>
        </div>
      </div>
    `;

    const importButton = this.querySelector("#importButton");
    const fileInput = this.querySelector("#fileInput");
    if (importButton && fileInput) {
      importButton.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", async (e) => {
        const filePaths = [];
        if (e.target.files && e.target.files.length > 0) {
          for (const file of e.target.files) {
            const sourcePath = webUtils.getPathForFile(file);
            filePaths.push(sourcePath);
          }
        } else {
          const filePath = e.target.getData('text/plain');
          if (filePath && typeof filePath === 'string') {
            filePaths.push(filePath);
          }
        }
        for (const sourcePath of filePaths) {
          await this.processFile(sourcePath);
        }
      });
    }

    this.querySelector('.autoNext').addEventListener("change", (e) => {
      this.config.autoNext = e.target.checked;
      this.saveConfig();
    });
    this.querySelector('.blackFill').addEventListener("change", (e) => {
      this.config.blackFill = e.target.checked;
      this.saveConfig();
    });
    this.querySelectorAll(".autoloopitem").forEach(button => {
      button.addEventListener("change", (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-item'), 10);
        this.playlist[index].loop = e.currentTarget.checked;
        this.saveConfig();
      });
    });
    this.querySelectorAll(".autonextitem").forEach(button => {
      button.addEventListener("change", (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-item'), 10);
        this.playlist[index].autoNext = e.currentTarget.checked;
        this.saveConfig();
      });
    });
    this.querySelectorAll(".select_item").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-item'), 10);
        this.setVideo(index);
      });
    });
    this.querySelectorAll(".delete_item").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-item'), 10);
        this.deleteItem(index);
      });
    });
    this.querySelectorAll(".top").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-item'), 10);
        this.moveUp(index);
      });
    });
    this.querySelectorAll(".bottom").forEach(button => {
      button.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-item'), 10);
        this.moveDown(index);
      });
    });
  }

  disconnectedCallback() {
    this.removeEventListener('dragover', this.handleDragOver);
    this.removeEventListener('drop', this.handleDrop);
  }
}