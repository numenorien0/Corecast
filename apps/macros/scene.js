export default class SceneButton extends HTMLElement {
  constructor() {
    super();
    this.scene = this.getAttribute("scene");
  }

  connectedCallback() {
    window.addEventListener("macroUpdated", () => this.render());
    this.render();
  }

  static get observedAttributes() {
    return ["scene"];
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "scene") {
      this.scene = newValue !== null ? parseInt(newValue, 10) : null;
      this.render();
    }
  }
  
  render() {
    const macros = JSON.parse(localStorage.getItem("config-scenes")) || [];
    this.innerHTML = "";
    
    // Taille de référence du conteneur (similaire aux dimensions de l'offscreen canvas)
    const containerWidth = 200;
    const containerHeight = 112.5;
    const svgNS = "http://www.w3.org/2000/svg";
    
    const scene = macros[this.scene];
    const btn = document.createElement("button");
    btn.classList.add("scene-button");
    
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${containerWidth} ${containerHeight}`);
    svg.style.display = "block";
    svg.style.marginTop = "0px";
    
    // Fond du conteneur pour visualiser les bords
    const bgRect = document.createElementNS(svgNS, "rect");
    bgRect.setAttribute("x", 0);
    bgRect.setAttribute("y", 0);
    bgRect.setAttribute("width", containerWidth);
    bgRect.setAttribute("height", containerHeight);
    bgRect.setAttribute("fill", "#eee");
    svg.appendChild(bgRect);
    
    scene?.config?.forEach(el => {
      // Si la largeur est "auto", on considère la vidéo en occupant tout le conteneur
      // Sinon, on calcule la largeur en % du conteneur.
      const widthPercent = el.width === "auto" ? 100 : parseFloat(el.width);
      const videoWidth = (widthPercent / 100) * containerWidth;
      // On suppose un ratio 16:9 (donc hauteur = largeur * 9/16)
      const videoHeight = videoWidth * (9 / 16);
      
      // Calcul des valeurs de crop en pixels, comme dans votre drawLayer
      const cropLeft   = el.cropLeft   ? (parseFloat(el.cropLeft)   / 100) * videoWidth  : 0;
      const cropRight  = el.cropRight  ? (parseFloat(el.cropRight)  / 100) * videoWidth  : 0;
      const cropTop    = el.cropTop    ? (parseFloat(el.cropTop)    / 100) * videoHeight : 0;
      const cropBottom = el.cropBottom ? (parseFloat(el.cropBottom) / 100) * videoHeight : 0;
      
      // La zone source effective après crop
      const effectiveWidth  = videoWidth  - cropLeft - cropRight;
      const effectiveHeight = videoHeight - cropTop - cropBottom;
      
      // Positionnement global de la vidéo dans le conteneur
      const posX = (el.x === undefined || el.x === "auto")
        ? (containerWidth - videoWidth) / 2
        : (parseFloat(el.x) / 100) * containerWidth;
      const posY = (el.y === undefined || el.y === "auto")
        ? (containerHeight - videoHeight) / 2
        : (parseFloat(el.y) / 100) * containerHeight;
      
      // La zone effective affichée est décalée par le crop
      const effectiveX = posX + cropLeft;
      const effectiveY = posY + cropTop;
      
      // Dessin de la zone effective
      const effectiveRect = document.createElementNS(svgNS, "rect");
      effectiveRect.setAttribute("x", effectiveX);
      effectiveRect.setAttribute("y", effectiveY);
      effectiveRect.setAttribute("width", effectiveWidth);
      effectiveRect.setAttribute("height", effectiveHeight);
      effectiveRect.setAttribute("fill", "#24292c");
      effectiveRect.setAttribute("stroke", "#a3acb1");
      effectiveRect.setAttribute("stroke-width", 4);
      svg.appendChild(effectiveRect);
      
      // Affichage du numéro de caméra (extraction des chiffres de "device")
      const camNumber = el.device.replace(/\D/g, "");
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", effectiveX + effectiveWidth / 2);
      text.setAttribute("y", effectiveY + effectiveHeight / 2);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      // La taille de la police est proportionnelle à la zone effective
      const fontSize = Math.min(effectiveWidth, effectiveHeight) * 0.25;
      text.setAttribute("font-size", fontSize.toString());
      text.setAttribute("fill", "white");
      text.textContent = camNumber;
      svg.appendChild(text);
    });
    
    btn.appendChild(svg);
    this.appendChild(btn);
    btn.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("applyScene", { detail: { scene: this.scene } }));
    });
  }
}
