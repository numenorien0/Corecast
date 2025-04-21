// class BufferProcessor extends AudioWorkletProcessor {
//   constructor() {
//     super();
//     this.bufferQueue = [];
//     this.currentBuffer = null;
//     this.bufferIndex = 0;

//     this.port.onmessage = (event) => {
//       if (event.data && event.data.type === 'buffer') {
//         // Ajoute le nouveau buffer à la file d'attente
//         this.bufferQueue.push(event.data.buffer);
//         // Charge immédiatement un buffer si aucun n'est en cours
//         if (!this.currentBuffer) {
//           this.currentBuffer = this.bufferQueue.shift();
//           this.bufferIndex = 0;
//         }
//       }
//     };
//   }

//   process(inputs, outputs, parameters) {
//     const output = outputs[0];
//     const blockSize = output[0].length;
//     const numChannels = output.length;

//     // Si le buffer courant contient suffisamment d'échantillons pour traiter le bloc entier,
//     // on copie le bloc en une opération pour réduire le nombre d'itérations.
//     if (this.currentBuffer && (this.bufferIndex + blockSize <= this.currentBuffer[0].length)) {
//       for (let ch = 0; ch < numChannels; ch++) {
//         // Utilise set() pour copier le bloc complet d'un coup
//         output[ch].set(this.currentBuffer[ch].subarray(this.bufferIndex, this.bufferIndex + blockSize));
//       }
//       this.bufferIndex += blockSize;
//     } else {
//       // Sinon, on traite échantillon par échantillon
//       for (let frame = 0; frame < blockSize; frame++) {
//         if (!this.currentBuffer || this.bufferIndex >= this.currentBuffer[0].length) {
//           if (this.bufferQueue.length > 0) {
//             this.currentBuffer = this.bufferQueue.shift();
//             this.bufferIndex = 0;
//           } else {
//             // Pas de buffer disponible : on remplit de silence
//             for (let ch = 0; ch < numChannels; ch++) {
//               output[ch][frame] = 0;
//             }
//             continue;
//           }
//         }
//         for (let ch = 0; ch < numChannels; ch++) {
//           output[ch][frame] = this.currentBuffer[ch][this.bufferIndex];
//         }
//         this.bufferIndex++;
//       }
//     }

//     return true;
//   }
// }

// registerProcessor('buffer-processor', BufferProcessor);


class BufferProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.bufferQueue = [];
      this.currentBuffer = null;
      this.bufferIndex = 0;
  
      this.port.onmessage = (event) => {
        if (event.data && event.data.type === 'buffer') {
          this.bufferQueue.push(event.data.buffer);
          // Charge immédiatement s'il n'y a pas encore de buffer en cours
          if (!this.currentBuffer) {
            this.currentBuffer = this.bufferQueue.shift();
            this.bufferIndex = 0;
          }
        }
      };
    }
  
    process(inputs, outputs) {
      const output = outputs[0];
      const blockSize = output[0].length;
      const numChannels = output.length;
  
      let offset = 0; // position actuelle dans le bloc de sortie
  
      while (offset < blockSize) {
        // S'il n'y a pas de buffer en cours, on tente d'en charger un
        if (!this.currentBuffer || this.bufferIndex >= this.currentBuffer[0].length) {
          if (this.bufferQueue.length > 0) {
            this.currentBuffer = this.bufferQueue.shift();
            this.bufferIndex = 0;
          } else {
            // Aucune donnée de buffer disponible : on remplit la fin du bloc en silence
            for (let ch = 0; ch < numChannels; ch++) {
              output[ch].fill(0, offset, blockSize);
            }
            break; // Plus rien à copier
          }
        }
  
        // Nombre d'échantillons disponibles dans le buffer courant
        const available = this.currentBuffer[0].length - this.bufferIndex;
        // Nombre d'échantillons restant à remplir dans ce bloc
        const remaining = blockSize - offset;
        // Taille de la copie à réaliser
        const chunkSize = Math.min(available, remaining);
  
        // Copie du chunk pour chaque canal
        for (let ch = 0; ch < numChannels; ch++) {
          // Copie directe du sous-tableau [bufferIndex, bufferIndex+chunkSize)
          output[ch].set(
            this.currentBuffer[ch].subarray(this.bufferIndex, this.bufferIndex + chunkSize),
            offset
          );
        }
  
        // Mise à jour des indices
        offset += chunkSize;
        this.bufferIndex += chunkSize;
      }
  
      return true;
    }
  }
  
  registerProcessor('buffer-processor', BufferProcessor);
  