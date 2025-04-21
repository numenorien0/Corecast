const Stats = require('stats.js');
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

export default class main_viewer_webgl extends HTMLElement {
  constructor() {
    super();
    this.width = parseInt(this.getAttribute('canvas-width'), 10);
    this.height = parseInt(this.getAttribute('canvas-height'), 10);
    this.label = this.getAttribute('label');
    this.uniq_id = this.getAttribute('uniq_id');
  }

  connectedCallback() {
    this.render();
    // Initialisation du contexte WebGL
    this.initWebGL();
  }

  disconnectedCallback() {
    // Nettoyage éventuel si besoin
    if (this._gl) {
      // this._gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }

  render() {
    this.innerHTML = `
      <div class="video-container" style="position:relative;">
        <label>${this.label}</label>
        <canvas width="${this.width}" height="${this.height}" id="${this.uniq_id}"></canvas>
      </div>
    `;

    this.canvas = this.querySelector('canvas');

    // Dans ce canvas, on fera du WebGL
    // On aura besoin d'un "backbuffer" dans lequel on dessine, puis on le copie, etc.
    // Mais en WebGL on peut directement dessiner dans ce canvas.

    if (this.uniq_id === 'master' || this.uniq_id === 'preview') {
      const stream = this.canvas.captureStream();
      window.output[this.uniq_id] = stream;
    }

    if (this.uniq_id === 'master') {
      // On affiche les stats
      stats.dom.style.position = 'absolute';
      stats.dom.style.left = '10px';
      stats.dom.style.bottom = '0px';
      stats.dom.style.opacity = '0.5';
      stats.dom.style.top = 'initial';
      this.appendChild(stats.dom);
    }
  }

  initWebGL() {
    const gl = this.canvas.getContext('webgl', {
      alpha: false, // On gère nous-mêmes le fond
      preserveDrawingBuffer: false,
      desynchronized: true,
    });

    if (!gl) {
      console.error('WebGL non disponible');
      return;
    }
    this._gl = gl;

    // Activation du blending (pour la transparence)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Création du programme WebGL (vertex + fragment shader)
    this._program = this.createProgram(gl, this.vertexShaderSource(), this.fragmentShaderSource());

    // Récupération des emplacements des attributs/uniformes
    this._locations = {
      a_position: gl.getAttribLocation(this._program, 'a_position'),
      a_texCoord: gl.getAttribLocation(this._program, 'a_texCoord'),

      u_resolution: gl.getUniformLocation(this._program, 'u_resolution'),
      u_opacity: gl.getUniformLocation(this._program, 'u_opacity'),
      u_cropRect: gl.getUniformLocation(this._program, 'u_cropRect'), // x, y, width, height (dans la texture)
      u_drawRect: gl.getUniformLocation(this._program, 'u_drawRect'), // x, y, width, height (dans le canvas)
      u_canvasSize: gl.getUniformLocation(this._program, 'u_canvasSize'), // taille du canvas
      u_radius: gl.getUniformLocation(this._program, 'u_radius'),
      u_borderWidth: gl.getUniformLocation(this._program, 'u_borderWidth'),
      u_borderColor: gl.getUniformLocation(this._program, 'u_borderColor'),

      // GreenKey
      u_greenKeyActive: gl.getUniformLocation(this._program, 'u_greenKeyActive'),
      u_greenKeyTolerance: gl.getUniformLocation(this._program, 'u_greenKeyTolerance'),
      u_greenKeyColorDiff: gl.getUniformLocation(this._program, 'u_greenKeyColorDiff'),
      u_greenKeySmoothness: gl.getUniformLocation(this._program, 'u_greenKeySmoothness'),

      // Filtre
      u_brightness: gl.getUniformLocation(this._program, 'u_brightness'),
      u_contrast: gl.getUniformLocation(this._program, 'u_contrast'),
      u_saturate: gl.getUniformLocation(this._program, 'u_saturate'),
      u_hueRotate: gl.getUniformLocation(this._program, 'u_hueRotate'),

      u_backgroundMode: gl.getUniformLocation(this._program, 'u_backgroundMode'),
    };

    // Création des buffers (positions + texCoords)
    this._positionBuffer = gl.createBuffer();
    this._texCoordBuffer = gl.createBuffer();

    // On met en place la boucle de rendu
    // Vous pouvez conserver setInterval pour reproduire le comportement exact
    setInterval(() => this.draw(), 1000 / (window.config?.video?.framerate || 25));
  }

  // --- Shaders ---

  vertexShaderSource() {
    // a_position : coordonnées du quad en pixels
    // a_texCoord : coordonnées de texture (0..1)
    // u_canvasSize : dimensions du canvas
    // u_drawRect : x, y, width, height en pixels de l’endroit où on dessine
    return `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
		precision mediump float;

      uniform vec2 u_canvasSize;
      uniform vec4 u_drawRect;  // x, y, w, h

      varying vec2 v_texCoord;
      varying vec2 v_localPos; // position locale dans [0..1] pour gérer le radius en fragment

      void main() {
        // Normalisation du a_position (qui sera en [0..1]) et transformation en coordonnées clip
        // a_position sera directement multiplié en JS pour "coller" au rectangle de drawRect
        // On le reconstruit en clipSpace
        vec2 clipPos = (a_position / u_canvasSize) * 2.0 - 1.0;
        clipPos.y = -clipPos.y; // inversion Y
        gl_Position = vec4(clipPos, 0.0, 1.0);

        v_texCoord = a_texCoord;

        // v_localPos : position normalisée dans le rectangle
        // 0,0 en haut/gauche, 1,1 en bas/droite
        vec2 localPos = (a_position - vec2(u_drawRect.x, u_drawRect.y)) / vec2(u_drawRect.z, u_drawRect.w);
        v_localPos = localPos;
      }
    `;
  }

  fragmentShaderSource() {
    // On va :
    // 1) lire la texture (sampler2D)
    // 2) appliquer le greenKey si actif
    // 3) appliquer le filtre (brightness, contrast, saturate, hueRotate)
    // 4) arrondir les coins si radius > 0 (discard ou mise à 0 alpha)
    // 5) éventuellement dessiner la bordure (si borderWidth > 0) via un anneau
    // 6) composer l’alpha final avec l’opacité config.opacity
    return `
      precision mediump float;

      uniform sampler2D u_texture;
      uniform float u_opacity;
      uniform vec4 u_cropRect; // dans la texture (sourceX, sourceY, w, h)
      uniform vec4 u_drawRect; // dans le canvas (destX, destY, w, h)
      uniform vec2 u_resolution;   // taille de la texture (vidéo ou canvas)
      uniform vec2 u_canvasSize;   // taille du canvas WebGL
      uniform float u_radius;
      uniform float u_borderWidth;
      uniform vec4 u_borderColor;  // (r, g, b, 1)

      // GreenKey
      uniform bool  u_greenKeyActive;
      uniform float u_greenKeyTolerance;
      uniform float u_greenKeyColorDiff;
      uniform float u_greenKeySmoothness;

      // Filtres
      uniform float u_brightness;  // 100 => pas de modif. Ex: 120 => +20% luminosité
      uniform float u_contrast;    // 100 => pas de modif. Ex: 150 => +50% contraste
      uniform float u_saturate;    // 100 => pas de modif. Ex: 200 => saturé x2
      uniform float u_hueRotate;   // 0 => pas de rotation. Ex: 180 => inversion

      // Mode background (noir, etc.)
      uniform int   u_backgroundMode;

      varying vec2 v_texCoord;
      varying vec2 v_localPos; // [0..1] dans le rectangle de destination

      // Helpers pour les filtres
      vec4 doBrightnessContrast(vec4 color, float brightness, float contrast) {
        // brightness, contrast en pourcentage ex: 120 => +20%
        float b = brightness / 100.0;
        float c = contrast / 100.0;

        // brightness => color.rgb * b
        // centrage du contraste => color.rgb = (color.rgb - 0.5) * c + 0.5
        color.rgb *= b;
        color.rgb = (color.rgb - 0.5) * c + 0.5;
        return color;
      }

      vec4 doSaturate(vec4 color, float saturate) {
        // saturate en %, 100 => 1.0
        float s = saturate / 100.0;
        // Approche simplifiée : on calcule la luminance et on mixe
        float l = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
        color.rgb = mix(vec3(l), color.rgb, s);
        return color;
      }

      // Rotation de teinte (hue-rotate) : on peut utiliser la matrice
      // standard (approche HSL). On simplifie ici, car c’est plus verbeux
      // qu’indispensable pour la démo, mais l’idée y est.
      mat3 hueRotation(float angle) {
        // angle en degrés
        float rad = angle * 3.14159 / 180.0;
        float cosA = cos(rad);
        float sinA = sin(rad);
        // matrice de rotation basique dans l’espace "YIQ" approximé
        // (il existe plusieurs formules, en voici une)
        return mat3(
          0.299, 0.587, 0.114,
          0.299, 0.587, 0.114,
          0.299, 0.587, 0.114
        )
        + mat3(
          0.701, -0.587, -0.114,
          -0.299, 0.413, -0.114,
          -0.3, -0.588, 0.886
        ) * cosA
        + mat3(
          0.168, 0.330, -0.497,
          -0.328, 0.035, 0.292,
          1.25, -1.05, -0.203
        ) * sinA;
      }

      void main() {
        // Calcul des coordonnées de texture effectives (crop)
        // v_texCoord est en [0..1], on va mapper sur [sourceX..sourceX+width] / resolution
        // => cropRect est en pixels, resolution en pixels
        // => la portion effective en [0..1] c'est (u_cropRect.x / u_resolution.x) ...
        vec2 cropOrigin = vec2(u_cropRect.x, u_cropRect.y) / u_resolution;
        vec2 cropSize   = vec2(u_cropRect.z, u_cropRect.w) / u_resolution;

        // v_texCoord = [0..1], on veut aller dans [cropOrigin..cropOrigin+cropSize]
        vec2 realTexCoord = cropOrigin + v_texCoord * cropSize;

        // Récup couleur
        vec4 color = texture2D(u_texture, realTexCoord);

        // GreenKey
        if(u_greenKeyActive) {
          float r = color.r;
          float g = color.g;
          float b = color.b;

          // on reprend votre logique : si g > tolerance et (g - max(r,b)) > colorDiff => transparent
          float greenIntensity = g - max(r, b);

          // On manipule la tolérance en [0..255], ex: 100 => 0.39 en [0..1] si l’image est normalisée
          // Mais en WebGL, color.r,g,b sont déjà [0..1]. On peut adoucir la formule.
          float tol = u_greenKeyTolerance / 255.0;
          float diff = u_greenKeyColorDiff / 255.0;

          // NB: c’est un "simple" mapping, il faudra peut-être affiner si on veut le même rendu
          if (g > tol && greenIntensity > diff) {
            // Pixel clairement vert => 100% transparent
            color.a = 0.0;
          } else {
            // "zone limite" => lissage
            float smooth = u_greenKeySmoothness / 255.0; 
            float alphaFactor = max(
              (greenIntensity - (diff - smooth)) / smooth,
              (g - (tol - smooth)) / smooth
            );
            if(alphaFactor > 0.0) {
              alphaFactor = clamp(alphaFactor, 0.0, 1.0);
              color.a = color.a * (1.0 - alphaFactor);
            }
          }
        }

        // Filtres
        color = doBrightnessContrast(color, u_brightness, u_contrast);
        color = doSaturate(color, u_saturate);

        // Hue-rotate
        mat3 hueRot = hueRotation(u_hueRotate);
        color.rgb = hueRot * color.rgb;

        // On applique l’opacité globale
        color.a *= u_opacity;

        // Arrondi des coins (radius)
        // v_localPos [0..1]
        // distance au bord => on fait un test de "roundedRect"
        if(u_radius > 0.0) {
          float r = u_radius;
          // taille du rect en px
          float w = u_drawRect.z;
          float h = u_drawRect.w;

          // arrondi effectif => min(r, w/2, h/2)
          float rr = min(r, min(w, h) * 0.5);

          // distance du point aux bords
          // on check dans les 4 coins :
          // top-left, top-right, bottom-left, bottom-right
          // v_localPos.x / y => [0..1]
          float rx = v_localPos.x * w;
          float ry = v_localPos.y * h;

          // On identifie si on est dans un coin :
          // Ex coin haut-gauche => (rx < rr && ry < rr)
          // distance au coin => sqrt( (rx-rr)^2 + (ry-rr)^2 ) si coin top-left
          // On fait 4 conditions, ou on peut faire un if combiné
          // Simplifions la logique : on vérifie la distance au coin effectif
          // pour chaque coin, on détermine la position
          // S’il dépasse, on discard

          // coin top-left
          if(rx < rr && ry < rr) {
            float dx = rr - rx;
            float dy = rr - ry;
            if(dx*dx + dy*dy > rr*rr) {
              discard;
            }
          }

          // coin top-right
          if(rx > (w - rr) && ry < rr) {
            float dx = rx - (w - rr);
            float dy = rr - ry;
            if(dx*dx + dy*dy > rr*rr) {
              discard;
            }
          }

          // coin bottom-left
          if(rx < rr && ry > (h - rr)) {
            float dx = rr - rx;
            float dy = ry - (h - rr);
            if(dx*dx + dy*dy > rr*rr) {
              discard;
            }
          }

          // coin bottom-right
          if(rx > (w - rr) && ry > (h - rr)) {
            float dx = rx - (w - rr);
            float dy = ry - (h - rr);
            if(dx*dx + dy*dy > rr*rr) {
              discard;
            }
          }
        }

        // Dessin de la bordure si borderWidth > 0
        // On va calculer la distance au bord, si c’est < borderWidth, on colore en borderColor
        if(u_borderWidth > 0.0) {
          float w = u_drawRect.z;
          float h = u_drawRect.w;
          float bw = u_borderWidth;

          // xDist => min(rx, w-rx), yDist => min(ry, h-ry)
          // la distance au bord le plus proche
          float rx = v_localPos.x * w;
          float ry = v_localPos.y * h;

          float distToLeft   = rx;
          float distToRight  = w - rx;
          float distToTop    = ry;
          float distToBottom = h - ry;
          float distEdge     = min(min(distToLeft, distToRight), min(distToTop, distToBottom));

          // Pour gérer l’arrondi, on fait aussi un check dans les coins
          // On utilise la même logique que pour le discard, mais on regarde
          // si la distance est dans la zone d’arrondi
          float rr = 0.0;
          if(u_radius > 0.0) {
            rr = min(u_radius, min(w, h) * 0.5);
          }

          bool inCorner = false;
          float cornerDist = 999999.0;

          // top-left
          if(rx < rr && ry < rr) {
            float dx = rr - rx;
            float dy = rr - ry;
            cornerDist = sqrt(dx*dx + dy*dy);
            inCorner = true;
          }
          // top-right
          if(rx > (w - rr) && ry < rr) {
            float dx = rx - (w - rr);
            float dy = rr - ry;
            cornerDist = sqrt(dx*dx + dy*dy);
            inCorner = true;
          }
          // bottom-left
          if(rx < rr && ry > (h - rr)) {
            float dx = rr - rx;
            float dy = ry - (h - rr);
            cornerDist = sqrt(dx*dx + dy*dy);
            inCorner = true;
          }
          // bottom-right
          if(rx > (w - rr) && ry > (h - rr)) {
            float dx = rx - (w - rr);
            float dy = ry - (h - rr);
            cornerDist = sqrt(dx*dx + dy*dy);
            inCorner = true;
          }

          // Si on est dans un coin arrondi, la distance au « bord » c’est rr - cornerDist
          // autrement, c’est distEdge
          if(u_radius > 0.0 && inCorner) {
            // cornerDist = distance au centre de l’arc
            float distToArcEdge = rr - cornerDist;
			if (distToArcEdge < bw && distToArcEdge >= 0.0) {
				// Ancienne version "dégradé" :
				// float alphaMix = (bw - distToArcEdge) / bw;
				// alphaMix = clamp(alphaMix, 0.0, 1.0);
				// color.rgb = mix(color.rgb, u_borderColor.rgb, alphaMix);
				// color.a = mix(color.a, u_borderColor.a, alphaMix);

				// Nouvelle version "bordure franche" :
				color = u_borderColor;
			}
          } else {
            // On compare distEdge et borderWidth
            if (distEdge < bw) {
				// Ancienne version "dégradé" :
				// float alphaMix = (bw - distEdge) / bw;
				// alphaMix = clamp(alphaMix, 0.0, 1.0);
				// color.rgb = mix(color.rgb, u_borderColor.rgb, alphaMix);
				// color.a = mix(color.a, u_borderColor.a, alphaMix);

				// Nouvelle version "bordure franche" :
				color = u_borderColor;
			}
          }
        }

        // On écrit finalement la couleur
        gl_FragColor = color;
      }
    `;
  }

  createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  createProgram(gl, vsSource, fsSource) {
    const vs = this.createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  // --- Rendu global ---

  draw() {
    // L’équivalent de votre draw() dans la version 2D
    const gl = this._gl;
    if (!gl) return;

    if (this.uniq_id === 'master') {
      stats.begin();
    }

    // On configure la viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Déterminer la couleur de fond (background general)
    const bg = (window.config?.general?.background) || {};
    // Couleur => parse style ?
    let color = bg.color || 'black';

    // On convertit vite fait
    let bgColor = this.hexToRGB(color);
    // gl.clearColor(r, g, b, a)
    gl.clearColor(bgColor[0], bgColor[1], bgColor[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Récupérer la configuration
    let render;
    if (this.uniq_id === 'preview') {
      render = window.preview;
    } else if (this.uniq_id === 'pgm') {
      render = window.pgm;
    } else if (this.uniq_id === 'master') {
      render = window.master;
    } else {
      render = window.aux[this.uniq_id];
    }

    if (Array.isArray(render)) {
      render.forEach((camera) => {
        let mainElement = document.getElementById(camera.device);
        if (mainElement) {
          // si c’est un canvas .camera-canvas ou un <video>
          if (
            mainElement.classList.contains('camera-canvas') &&
            mainElement.getAttribute('player') != 'null'
          ) {
            mainElement = document.getElementById('player-' + mainElement.getAttribute('player'));
          }

          if (mainElement instanceof HTMLVideoElement || mainElement instanceof HTMLCanvasElement) {
            mainElement.mustUpdate = true;

            // Récup paramètres de correction
            let parameters = {};
            if (localStorage.getItem('selectedDevices')) {
              parameters = JSON.parse(localStorage.getItem('selectedDevices'))[camera.device] || {};
            }
            // Valeurs par défaut si manquantes
            const brightness = parameters.brightness ?? 100;
            const contrast = parameters.contrast ?? 100;
            const saturate = parameters.saturate ?? 100;
            const huerotate = parameters.huerotate ?? 0;

            // Dessin WebGL
            this.drawLayerGL(gl, mainElement, camera, {
              brightness: brightness,
              contrast: contrast,
              saturate: saturate,
              huerotate: huerotate,
            });
          }
        }
      });
    }

    // Gestion overlay pour "master"
    if (this.uniq_id === 'master') {
      const overlayElement = document.querySelector('#layerMaster');
      if (overlayElement) {
        overlayElement.mustUpdate = true;
        // On va dessiner la "layerMaster" sur tout l’écran
        // ou selon this.overlayConfig
        const overlayConfig = this.overlayConfig || {
          x: 0, y: 0, width: 100, height: 100,
        };
        this.drawLayerGL(gl, overlayElement, overlayConfig, {
          brightness: 100, contrast: 100, saturate: 100, huerotate: 0,
        });
      }
    }

    if (this.uniq_id === 'master') {
      stats.end();
    }
  }

  drawLayerGL(gl, mainElement, config, colorParams) {
    // 1) Créer la texture
    const tex = this.createOrUpdateTexture(gl, mainElement);

    // 2) Calculer le cropping
    // => on reprend votre logique (16/9 forcé, etc.)
    let videoWidth = mainElement instanceof HTMLVideoElement
      ? (mainElement.videoWidth || mainElement.width)
      : mainElement.width;
    let videoHeight = mainElement instanceof HTMLVideoElement
      ? (mainElement.videoHeight || mainElement.height)
      : mainElement.height;

    let offsetX = 0, offsetY = 0;
    const forcedRatio = 16 / 9;
    const actualRatio = videoWidth / videoHeight;
    if (actualRatio > forcedRatio) {
      // on modifie la hauteur
      const oldvideoHeight = videoHeight;
      videoHeight = videoWidth / forcedRatio;
      offsetY = (oldvideoHeight - videoHeight) / 2.0;
    } else if (actualRatio < forcedRatio) {
      // on modifie la largeur
      const oldVideoWidth = videoWidth;
      videoWidth = videoHeight * forcedRatio;
      offsetX = (oldVideoWidth - videoWidth) / 2.0;
    }

    // Crop
    const cropTop = config.cropTop ? parseFloat(config.cropTop) / 100.0 * videoHeight : 0;
    const cropBottom = config.cropBottom ? parseFloat(config.cropBottom) / 100.0 * videoHeight : 0;
    const cropLeft = config.cropLeft ? parseFloat(config.cropLeft) / 100.0 * videoWidth : 0;
    const cropRight = config.cropRight ? parseFloat(config.cropRight) / 100.0 * videoWidth : 0;

    const sourceX = offsetX + cropLeft;
    const sourceY = offsetY + cropTop;
    const sourceWidth = videoWidth - cropLeft - cropRight;
    const sourceHeight = videoHeight - cropTop - cropBottom;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return;
    }

    // 3) Calculer la taille de dessin dans le canvas
    let scale;
    let targetWidth;
    let targetHeight;
    if (config.width === 'auto' || config.height === 'auto') {
      scale = Math.min(this.canvas.width / videoWidth, this.canvas.height / videoHeight);
      targetWidth = videoWidth * scale;
      targetHeight = videoHeight * scale;
    } else if (config.width !== undefined) {
      targetWidth = (parseFloat(config.width) / 100.0) * this.canvas.width;
      scale = targetWidth / videoWidth;
      targetHeight = videoHeight * scale;
    } else if (config.height !== undefined) {
      targetHeight = (parseFloat(config.height) / 100.0) * this.canvas.height;
      scale = targetHeight / videoHeight;
      targetWidth = videoWidth * scale;
    } else {
      scale = Math.min(this.canvas.width / videoWidth, this.canvas.height / videoHeight);
      targetWidth = videoWidth * scale;
      targetHeight = videoHeight * scale;
    }

    let posX, posY;
    if (config.x === undefined || config.x === 'auto') {
      posX = (this.canvas.width - targetWidth) / 2.0;
    } else {
      posX = (parseFloat(config.x) / 100.0) * this.canvas.width;
    }

    if (config.y === undefined || config.y === 'auto') {
      posY = (this.canvas.height - targetHeight) / 2.0;
    } else {
      posY = (parseFloat(config.y) / 100.0) * this.canvas.height;
    }

    // Les rectangles de crop/draw
    // cropRect : en pixels sur la texture
    //   => (sourceX, sourceY, sourceWidth, sourceHeight)
    // drawRect : en pixels sur le canvas
    //   => (posX, posY, targetWidth, targetHeight)

    // 4) On utilise notre programme
    gl.useProgram(this._program);

    // 5) Configuration des buffers
    // Positions => le quad couvrant [posX..posX+targetWidth] x [posY..posY+targetHeight]
    // On va mettre 2 triangles
    const x1 = posX;
    const y1 = posY;
    const x2 = posX + targetWidth;
    const y2 = posY + targetHeight;

    const positions = new Float32Array([
      x1, y1,  x2, y1,  x1, y2,
      x2, y1,  x2, y2,  x1, y2,
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this._locations.a_position);
    gl.vertexAttribPointer(this._locations.a_position, 2, gl.FLOAT, false, 0, 0);

    // TexCoords => [0..1]
    // Un simple rectangle
    const texCoords = new Float32Array([
      0, 0,  1, 0,  0, 1,
      1, 0,  1, 1,  0, 1,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this._locations.a_texCoord);
    gl.vertexAttribPointer(this._locations.a_texCoord, 2, gl.FLOAT, false, 0, 0);

    // 6) Passage des uniformes
    // la texture, via texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);

    const opacity = config.opacity !== undefined
      ? Math.min(Math.max(parseFloat(config.opacity), 0), 1)
      : 1.0;

    gl.uniform1f(this._locations.u_opacity, opacity);

    // gl.uniform2f(this._locations.u_resolution, mainElement.videoWidth || mainElement.width,
    //   mainElement.videoHeight || mainElement.height);
	  gl.uniform2f(
		this._locations.u_resolution,
		videoWidth,
		videoHeight
	  );
	  

    gl.uniform4f(this._locations.u_cropRect, sourceX, sourceY, sourceWidth, sourceHeight);
    gl.uniform4f(this._locations.u_drawRect, posX, posY, targetWidth, targetHeight);
    gl.uniform2f(this._locations.u_canvasSize, this.canvas.width, this.canvas.height);

    // radius, border
    const radius = config.radius ? parseFloat(config.radius) : 0.0;
	
    const borderWidth = (config.borderWidth) ? parseFloat(config.borderWidth) : 0.0;
    let borderColor = [0, 0, 0, 1];
    if (config.borderColor) {
      borderColor = this.hexToRGB(config.borderColor, true);
    }
    gl.uniform1f(this._locations.u_radius, radius);
    gl.uniform1f(this._locations.u_borderWidth, borderWidth);
    gl.uniform4f(this._locations.u_borderColor, borderColor[0], borderColor[1], borderColor[2], borderColor[3]);

    // greenKey
    gl.uniform1i(this._locations.u_greenKeyActive, config.greenKeyActive ? 1 : 0);
    gl.uniform1f(this._locations.u_greenKeyTolerance, config.greenKeyTolerance || 100);
    gl.uniform1f(this._locations.u_greenKeyColorDiff, config.greenKeyColorDiff || 50);
    gl.uniform1f(this._locations.u_greenKeySmoothness, config.greenKeySmoothness || 30);

    // Filtres
    gl.uniform1f(this._locations.u_brightness, colorParams.brightness);
    gl.uniform1f(this._locations.u_contrast, colorParams.contrast);
    gl.uniform1f(this._locations.u_saturate, colorParams.saturate);
    gl.uniform1f(this._locations.u_hueRotate, colorParams.huerotate);

    // background mode
    gl.uniform1i(this._locations.u_backgroundMode, config.blackFill ? 1 : 0);

    // 7) Dessin
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  createOrUpdateTexture(gl, element) {
    // On créé ou on met à jour la texture (HTMLVideoElement ou HTMLCanvasElement)
    // On stocke la texture dans element.__webglTexture par ex.
    let tex = element.__webglTexture;
    if (!tex) {
      tex = gl.createTexture();
      element.__webglTexture = tex;
      // Configuration de base
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, tex);
    }

    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        element
      );
    } catch (e) {
      console.error('Erreur lors du texImage2D : ', e);
    }

    return tex;
  }

  hexToRGB(hex, includeAlpha = false) {
    // Convertit "black" => [0,0,0]
    // ou "#ff00ff" => [1, 0, 1]
    // On fait un petit parse
    let c = [0,0,0,1];
    if(!hex) return c;
    // si c’est un nom => on le mappe vite fait
    if(hex === 'black') return [0,0,0,1];
    if(hex === 'white') return [1,1,1,1];

    let tmp = hex.replace('#','');
    if(tmp.length===3) {
      // #abc => #aabbcc
      tmp = tmp[0]+tmp[0]+tmp[1]+tmp[1]+tmp[2]+tmp[2];
    }
    if(tmp.length===6) {
      let r = parseInt(tmp.substring(0,2),16)/255.0;
      let g = parseInt(tmp.substring(2,4),16)/255.0;
      let b = parseInt(tmp.substring(4,6),16)/255.0;
      c = [r,g,b,1];
    }
    return c;
  }
}

