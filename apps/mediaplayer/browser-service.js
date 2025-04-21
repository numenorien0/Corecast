const fs = require('fs');
const path = require('path');

// Fonction utilitaire pour déterminer le type de fichier
function getFileType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const videoExt = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
  const audioExt = ['.mp3', '.wav', '.ogg'];
  const imageExt = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg'];
  
  if (videoExt.includes(ext)) {
    return 'vidéo';
  } else if (audioExt.includes(ext)) {
    return 'audio';
  } else if (imageExt.includes(ext)) {
    return 'image';
  } else {
    return 'autre';
  }
}

// Fonction pour formater la taille des fichiers
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default class FileBrowser extends HTMLElement {
  constructor() {
    super();
    this.currentPath = process.cwd();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    let entries;
    try {
      entries = fs.readdirSync(this.currentPath);
      // Tri des entrées par ordre alphabétique
      entries.sort((a, b) => a.localeCompare(b));
    } catch (err) {
      console.error('Erreur de lecture du dossier :', err);
      entries = [];
    }

    this.innerHTML = `
      <div class="file-browser">
        <h2 class='currentPath'><i class='bx bxs-folder-open' ></i> &nbsp;&nbsp;${this.currentPath}</h2>
        <ul>
          ${
            this.currentPath !== path.parse(this.currentPath).root
              ? `<li class="folder backFolder" data-path="${path.join(this.currentPath, '..')}" draggable="true">
                    <i class='bx bx-chevron-left' ></i> back
                  </li>`
              : ''
          }
          ${entries
            .map((entry) => {
              const fullPath = path.join(this.currentPath, entry);
              let isDirectory = false;
              let fileSize = '';
              try {
                const stats = fs.statSync(fullPath);
                isDirectory = stats.isDirectory();
                if (!isDirectory) {
                  fileSize = formatBytes(stats.size);
                }
              } catch (e) {
                console.error('Erreur de lecture de stat sur', fullPath, e);
              }
              // Si c'est un fichier, on détermine son type.
              const fileType = !isDirectory ? getFileType(entry) : '';
              return `<li class="${isDirectory ? 'folder' : 'file'}" data-path="${fullPath}" draggable="true">
                        ${
                          isDirectory
                            ? '<i class="bx bxs-folder" ></i>'
                            : fileType === "vidéo"
                              ? '<i class="bx bxs-videos" ></i>'
                              : fileType === "audio"
                                ? '<i class="bx bx-equalizer" ></i>'
                                : fileType === "image"
                                  ? '<i class="bx bx-image-alt" ></i>'
                                  : '<i class="bx bx-file-blank" ></i>'
                        }
                        ${entry}${isDirectory ? '/' : ''}
                        ${!isDirectory ? `<div class='filesize' style="display: inline-block; margin-left: 8px; font-size: 0.9em; color: gray;">${fileSize}</div>` : ''}
                      </li>`;
            })
            .join('')}
        </ul>
      </div>
    `;

    // Ajoute le listener "dragstart" pour chaque élément draggable
    this.querySelectorAll('li').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        const filePath = e.currentTarget.getAttribute('data-path');
        if (filePath) {
          e.dataTransfer.setData('text/plain', filePath);
        }
      });

      // Pour naviguer dans un dossier via double-clic
      if (el.classList.contains('folder')) {
        el.addEventListener('dblclick', (e) => {
          const newPath = e.currentTarget.getAttribute('data-path');
          try {
            if (fs.statSync(newPath).isDirectory()) {
              this.currentPath = newPath;
              this.render();
            }
          } catch (err) {
            console.error('Erreur lors de l\'accès au dossier :', err);
          }
        });
      }
    });
  }
}
