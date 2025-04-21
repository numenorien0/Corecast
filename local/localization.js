const { app } = require("electron");

// localization.js
const en = {
  appName: "CoreCast",
  menu: {
    file: "File",
    new: "New",
    save: "Save",
    saveAs: "Save as",
    open: "Open",
    quit: "Quit",
    edit: "Edit",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    tools: "Tools",
    devTools: "DevTools",
    window: "Window",
    pgm: "PGM",
    preview: "Preview",
    multiviewer: "Multiviewer",
    checkForUpdates: "Check for updates",
    help: "help",
    yes: "Yes",
    no: "No",
    settings: "Settings"
  },
  updater: {
    updateAvailable: "Update available, downloading...",
    updateInProgress: "An update is downloading. The application will restart automatically.",
    updateDownloaded: "An update has been downloaded. Do you want to restart the application to install the update?"
  }
};

const nl = {
    appName: "CoreCast",
    menu: {
        file: "Bestand",
        new: "Nieuw",
        save: "Opslaan",
        saveAs: "Opslaan als",
        open: "Openen",
        quit: "Afsluiten",
        edit: "Bewerken",
        undo: "Ongedaan maken",
        redo: "Opnieuw",
        cut: "Knippen",
        copy: "Kopiëren",
        paste: "Plakken",
        tools: "Gereedschap",
        devTools: "Ontwikkeltools",
        window: "Venster",
        pgm: "PGM",
        multiviewer: "Multiviewer",
        preview: "Voorvertoning",
        checkForUpdates: "Controleer op updates",
        help: "Help",
        yes: "Ja",
        no: "Nee",
        settings: "Instellingen"
    },
    updater: {
        updateAvailable: "Update beschikbaar, downloaden...",
        updateInProgress: "Een update wordt gedownload. De applicatie wordt automatisch opnieuw opgestart.",
        updateDownloaded: "Een update is gedownload. Wilt u de applicatie opnieuw opstarten om de update te installeren?"
    }
}

const fr = {
  appName: "CoreCast",
  menu: {
    file: "Fichier",
    new: "Nouveau",
    save: "Enregistrer",
    saveAs: "Enregistrer sous",
    open: "Ouvrir",
    quit: "Quitter",
    edit: "Édition",
    undo: "Annuler",
    redo: "Rétablir",
    cut: "Couper",
    copy: "Copier",
    paste: "Coller",
    tools: "Outils",
    devTools: "Outils de développement",
    window: "Fenêtre",
    pgm: "PGM",
    multiviewer: "Multiviewer",
    preview: "Aperçu",
    checkForUpdates: "Vérifier les mises à jour",
    help: "Aide",
    yes: "Oui",
    no: "Non",
    settings: "Paramètres"
  },
  updater: {
    updateAvailable: "Mise à jour disponible, téléchargement en cours...",
    updateInProgress: "Une mise à jour est en cours de téléchargement. L'application va redémarrer automatiquement.",
    updateDownloaded: "Une mise à jour a été téléchargée. Voulez-vous redémarrer l'application pour installer la mise à jour ?"
  }
};

module.exports = { en, fr, nl };
