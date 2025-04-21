// socketManager.js
const WebSocket = require('ws');

class SocketManager {
  constructor(port = 12345) {
    this.port = port;
    this.wss = new WebSocket.Server({ port: this.port }, () => {
    });

    this.wss.on('connection', (ws) => {
      window.dispatchEvent(new CustomEvent("refreshCameraStatus"));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);

          if (data.action === 'switchCam') {
            window.dispatchEvent(new CustomEvent("switchCam", {
              detail: { camera: data.camera, to: data.to }
            }));
          }
          if (data.action === 'previewToPGM') {
            window.dispatchEvent(new CustomEvent("previewToPGM"));
          }
          if (data.action === 'displayLayer') {
            window.dispatchEvent(new CustomEvent("displayLayer", { detail : { index: data.index }}));
          }
          if (data.action === 'hideLayer') {
            window.dispatchEvent(new CustomEvent("hideLayer", { detail : { index: data.index }}));
          }
        } catch (err) {
          console.error('Erreur lors du parsing du message :', err);
        }
      });

      ws.on('close', () => {
      });
    });

    this.wss.on('error', (error) => {
      console.error("Erreur sur le serveur WebSocket :", error);
    });
  }

  broadcast(data) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

// On crée une instance unique et on l'exporte via l'objet global (window pour le navigateur)
if (!window.socketManager) {
  window.socketManager = new SocketManager(window.config.socket);
}

// Pas besoin d'exporter avec module.exports dans un contexte de navigateur