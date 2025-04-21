const { loadUserConfig, saveUserConfig, defaultConfig } = require('./js/preferences.js');

export default class shortcutInput extends HTMLElement {
  constructor() {
    super();
    this.label = this.getAttribute('label');
    this.shortcutId = this.getAttribute('shortcut');

    const storedShortcuts = loadUserConfig().shortcuts || {};
    this.keyCombination = storedShortcuts[this.shortcutId] || this.getAttribute('key') || '';

    // Bind de la méthode pour qu'elle garde le bon "this"
    this.onGlobalShortcutChanged = this.onGlobalShortcutChanged.bind(this);
  }

  connectedCallback() {
    this.render();
    // Ajoute l'écouteur global pour les changements de raccourcis
    document.addEventListener('shortcut-changed', this.onGlobalShortcutChanged);
  }

  disconnectedCallback() {
    document.removeEventListener('shortcut-changed', this.onGlobalShortcutChanged);
  }

  onGlobalShortcutChanged(e) {
    if (e.detail && e.detail.shortcut === this.keyCombination && e.detail.id !== this.shortcutId) {
      this.keyCombination = "";
      const input = this.querySelector('.inputShortcut');
      if (input) input.value = "";
      
      //setTimeout(() => {
        //const config = loadUserConfig();
        //config.shortcuts[this.shortcutId] = "";
        //saveUserConfig(config)
    //}, 1000);
    }
  }
  

  render() {
    this.innerHTML = `
      <div class='settingsRow'>
        <label>${this.label}</label>
        <input type="text" readonly class='inputShortcut'>
      </div>
    `;
    const inputShortcut = this.querySelector('.inputShortcut');
    inputShortcut.value = this.keyCombination;
    
    inputShortcut.addEventListener("keydown", (e) => {
      e.preventDefault();

      let keys = [];
      if (e.ctrlKey) keys.push("Ctrl");
      if (e.metaKey) keys.push("Cmd");
      if (e.altKey) keys.push("Alt");
      if (e.shiftKey) keys.push("Shift");
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        keys.push(e.key.charAt(0).toUpperCase() + e.key.slice(1));
      }
      this.keyCombination = keys.join(" + ");
      inputShortcut.value = this.keyCombination;
      
      // Met à jour la configuration utilisateur
      const config = loadUserConfig();
      if (!config.shortcuts) config.shortcuts = {};
      config.shortcuts[this.shortcutId] = this.keyCombination;

      const duplicateShortcut = Object.entries(config.shortcuts).find(
        ([key, value]) => value === this.keyCombination && key !== this.shortcutId
      );
      if(duplicateShortcut){
        config.shortcuts[duplicateShortcut[0]] = "";
      }
      saveUserConfig(config);

      // Déclenche un événement global en indiquant cette instance comme source
      document.dispatchEvent(new CustomEvent('shortcut-changed', {
        detail: { id: this.shortcutId, shortcut: this.keyCombination, source: this }
      }));
    });
  }

  get value() {
    return this.keyCombination;
  }

  set value(val) {
    this.keyCombination = val;
    const input = this.querySelector('.inputShortcut');
    if (input) input.value = val;
    const config = loadUserConfig();
    if (!config.shortcuts) config.shortcuts = {};
    config.shortcuts[this.shortcutId] = val;
    saveUserConfig(config);
  }
}
