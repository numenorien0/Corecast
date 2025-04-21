const dgram = require('dgram');
const storePresetLookup = {
    1:  { headerByte: 0x3D, parameter: 0x00 },
    2:  { headerByte: 0x30, parameter: 0x01 },
    3:  { headerByte: 0x30, parameter: 0x02 },
    4:  { headerByte: 0x31, parameter: 0x03 },
    5:  { headerByte: 0x31, parameter: 0x04 },
    6:  { headerByte: 0x29, parameter: 0x05 },
    7:  { headerByte: 0x25, parameter: 0x06 },
    8:  { headerByte: 0x12, parameter: 0x07 },
    9:  { headerByte: 0x13, parameter: 0x08 },
    10: { headerByte: 0x14, parameter: 0x09 },
    11: { headerByte: 0x15, parameter: 0x0A },
    12: { headerByte: 0x16, parameter: 0x0B },
    13: { headerByte: 0x17, parameter: 0x0C },
    14: { headerByte: 0x18, parameter: 0x0D },
    15: { headerByte: 0x19, parameter: 0x0E },
    16: { headerByte: 0x1A, parameter: 0x0F }
};

function sendHomeCommand(port, IP) {
    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Erreur socket:', err);
        socket.close();
    });

    const payload = Buffer.from([
        0x01, 0x00, 0x00, 0x05,
        0x00, 0x00, 0x00, 0xEA,
        0x81, 0x01, 0x06, 0x04,
        0xFF
    ]);

    socket.bind(() => {
        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error('Erreur lors de l’envoi du payload :', err);
            } else {
                console.log('Commande envoyée (payload en hex) :', payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendTurnRightCommand(port, IP, panSpeed) {

    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        socket.close();
    });

    socket.bind(() => {
        // Ici, on remplace l'octet correspondant à la vitesse (dans ce cas le 14ème octet) par la valeur passée en paramètre.
        // Par exemple, dans votre payload initial, cet octet est 0x02.
        const payload = Buffer.from([
            0x01, 0x00, 0x00, 0x09,
            0x00, 0x00, 0x01, 0x58,
            0x81, 0x01, 0x06, 0x01,
            panSpeed, 0x00, 0x02, 0x03, 0xFF
        ]);

        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error('Erreur lors de l’envoi de la commande tourne à droite:', err);
            } else {
                console.log('Commande "tourner à droite" envoyée avec succès:', payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendTurnLeftCommand(port, IP, panSpeed) {
    panSpeed = 0x00 + panSpeed;
    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        socket.close();
    });

    socket.bind(() => {
        const payload = Buffer.from([
            0x01, 0x00, 0x00, 0x09,
            0x00, 0x00, 0x01, 0x58,
            0x81, 0x01, 0x06, 0x01,
            panSpeed, 0x00, 0x01, 0x03, 0xFF
        ]);

        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error('Erreur lors de l’envoi de la commande tourner à gauche:', err);
            } else {
                console.log('Commande "tourner à gauche" envoyée avec succès:', payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendTiltDownCommand(port, IP, tiltSpeed) {
    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        socket.close();
    });

    socket.bind(() => {
        // Le payload est construit en remplaçant l'octet de vitesse tilt (actuellement 0x11)
        // par la valeur passée en paramètre (tiltSpeed)
        const payload = Buffer.from([
            0x01, 0x00, 0x00, 0x09,
            0x00, 0x00, 0x01, 0x58,
            0x81, 0x01, 0x06, 0x01,
            0x01, tiltSpeed, 0x03, 0x02, 0xFF
        ]);

        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error('Erreur lors de l’envoi de la commande tilt down:', err);
            } else {
                console.log('Commande tilt down envoyée (payload en hex) :', payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendTiltUpCommand(port, IP, tiltSpeed) {

    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        socket.close();
    });

    socket.bind(() => {
        const payload = Buffer.from([
            0x01, 0x00, 0x00, 0x09,
            0x00, 0x00, 0x01, 0x58,
            0x81, 0x01, 0x06, 0x01,
            0x01, tiltSpeed, 0x03, 0x01, 0xFF
        ]);

        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error('Erreur lors de l’envoi de la commande tilt up:', err);
            } else {
                console.log('Commande tilt up envoyée (payload en hex) :', payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendZoomInCommand(port, IP, zoomSpeed) {
    // On suppose que zoomSpeed est déjà un nombre.
    // Affichage de débogage :
    zoomSpeed = 0x1F + zoomSpeed;
    console.log("zoomSpeed (décimal):", zoomSpeed, " - (hex):", zoomSpeed.toString(16));

    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        socket.close();
    });

    socket.bind(() => {
        // Remplacez l'élément 0x20 par la valeur de zoomSpeed.
        const payload = Buffer.from([
            0x01, 0x00, 0x00, 0x06,
            0x00, 0x00, 0x01, 0x8c,
            0x81, 0x01, 0x04, 0x07,
            zoomSpeed,   // Utilise la valeur passée en paramètre
            0xff
        ]);

        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error('Erreur lors de l’envoi de la commande Zoom In :', err);
            } else {
                console.log('Commande Zoom In envoyée (payload en hex) :', payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendZoomOutCommand(port, IP, zoomSpeed) {
    const computedZoomSpeed = 0x2F + zoomSpeed;
    console.log("Computed zoomSpeed (décimal):", computedZoomSpeed, " - (hex):", computedZoomSpeed.toString(16));

    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        socket.close();
    });

    socket.bind(() => {
        const payload = Buffer.from([
            0x01, 0x00, 0x00, 0x06,
            0x00, 0x00, 0x01, 0x8c,
            0x81, 0x01, 0x04, 0x07,
            computedZoomSpeed,  // Insère la valeur numérique calculée
            0xff
        ]);

        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error('Erreur lors de l’envoi de la commande Zoom Out :', err);
            } else {
                console.log('Commande Zoom Out envoyée (payload en hex) :', payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendZoomStopCommand(port, IP) {
    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        socket.close();
    });

    socket.bind(() => {
        const payload = Buffer.from([
            0x01, 0x00, 0x00, 0x06,
            0x00, 0x00, 0x01, 0x8c,
            0x81, 0x01, 0x04, 0x07,
            0x00, 0xff
        ]);

        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error('Erreur lors de l’envoi de la commande Zoom Stop:', err);
            } else {
                console.log('Commande Zoom Stop envoyée (payload en hex) :', payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendPanTiltStopCommand(port, IP) {
    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        socket.close();
    });

    socket.bind(() => {
        const payload = Buffer.from([
            0x01, 0x00, 0x00, 0x09,
            0x00, 0x00, 0x01, 0x58,
            0x81, 0x01, 0x06, 0x01,
            0x00, 0x00, 0x03, 0x03,
            0xFF
        ]);

        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error('Erreur lors de l’envoi de la commande pan/tilt stop:', err);
            } else {
                console.log('Commande pan/tilt stop envoyée (payload en hex) :', payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendPresetRecall(port, IP, preset) {
    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error('Erreur socket:', err);
        socket.close();
    });

    socket.bind(() => {
        const headerByte = preset + 0x2E;
        const header = [0x01, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, headerByte];
        const command = [0x81, 0x01, 0x04, 0x3F, 0x02, preset - 1, 0xFF];
        const payload = Buffer.from([...header, ...command]);

        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error(`Erreur lors de l’envoi du preset ${preset}:`, err);
            } else {
                console.log(`Commande Preset Recall ${preset} envoyée (payload en hex) :`, payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function sendStorePreset(port, IP, preset) {
    if (preset < 1 || preset > 16) {
        console.error("Le preset doit être compris entre 1 et 16.");
        return;
    }

    if (!(preset in storePresetLookup)) {
        console.error(`Aucune donnée définie pour le preset ${preset}.`);
        return;
    }

    const { headerByte, parameter } = storePresetLookup[preset];

    const header = [0x01, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, headerByte];
    const command = [0x81, 0x01, 0x04, 0x3F, 0x01, parameter, 0xFF];
    const payload = Buffer.from([...header, ...command]);
    const socket = dgram.createSocket('udp4');

    socket.on('error', (err) => {
        console.error("Erreur socket:", err);
        socket.close();
    });

    socket.bind(() => {
        socket.send(payload, 0, payload.length, port, IP, (err) => {
            if (err) {
                console.error(`Erreur lors de l’envoi de la commande de sauvegarde pour le preset ${preset}:`, err);
            } else {
                console.log(`Commande de sauvegarde pour le preset ${preset} envoyée (payload en hex) :`, payload.toString('hex'));
            }
            socket.close();
        });
    });
}

function checkCameraReachability(targetIP, targetPort, callback) {
  console.log("Target Port:", targetPort);
  const socket = dgram.createSocket('udp4');

  // Commande inquiry pour CAM_VersionInq (exemple)
  const payload = Buffer.from([0x81, 0x09, 0x00, 0x02, 0xFF]);
  let timeoutId;

  socket.on('message', (msg, rinfo) => {
    clearTimeout(timeoutId);
    console.log('Réponse reçue de la caméra:', msg.toString('hex'), "depuis", rinfo.address);
    socket.close();
    // Vous pouvez également renvoyer le message reçu si besoin
    callback(true, msg);
  });

  socket.on('error', (err) => {
    clearTimeout(timeoutId);
    console.error('Erreur sur le socket:', err);
    socket.close();
    callback(false, err);
  });

  // Liaison du socket sur un port éphémère (0)
  socket.bind(0, () => {
    console.log("Socket lié sur le port", socket.address().port);
    socket.send(payload, 0, payload.length, targetPort, targetIP, (err) => {
      if (err) {
        console.error('Erreur lors de l’envoi:', err);
        socket.close();
        callback(false, err);
      } else {
        console.log('Commande inquiry envoyée.');
        // Délai d'attente pour la réponse (1000ms ici)
        timeoutId = setTimeout(() => {
          console.warn("Aucune réponse reçue dans le délai imparti.");
          socket.close();
          callback(false, new Error("Timeout"));
        }, 1000);
      }
    });
  });
}



module.exports = { sendHomeCommand, sendTurnRightCommand, sendTurnLeftCommand, sendTiltDownCommand, sendTiltUpCommand, sendZoomInCommand, sendZoomOutCommand, sendZoomStopCommand, sendPanTiltStopCommand, sendPresetRecall, sendStorePreset, checkCameraReachability }