class NoiseGateProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        {
          name: 'threshold',      // seuil en dB
          defaultValue: -40,      // -40 dB par défaut
          minValue: -100,
          maxValue: 0,
          automationRate: 'k-rate'
        },
        {
          name: 'reduction',      // réduction en dB
          defaultValue: -80,
          minValue: -100,
          maxValue: 0,
          automationRate: 'k-rate'
        },
        {
          name: 'attack', // temps d'attaque en secondes
          defaultValue: 0.01,
          minValue: 0,
          maxValue: 1,
          automationRate: 'a-rate'
        },
        {
          name: 'release', // temps de release en secondes
          defaultValue: 0.1,
          minValue: 0,
          maxValue: 1,
          automationRate: 'a-rate'
        }
      ];
    }
  
    constructor() {
      super();
      this.currentGain = 1;
    }
  
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      const output = outputs[0];
  
      // Conversion des paramètres de dB en linéaire
      const thresholdDB = parameters.threshold[0];
      const thresholdLinear = Math.pow(10, thresholdDB / 20);
  
      const reductionDB = parameters.reduction[0];
      const reductionLinear = Math.pow(10, reductionDB / 20);
  
      // Attack/Release en nombre d'échantillons (attention au sampleRate)
      const attackTime = parameters.attack.length > 0 ? parameters.attack[0] : 0.01;
      const releaseTime = parameters.release.length > 0 ? parameters.release[0] : 0.1;
      const attackCoeff = 1 - Math.exp(-1 / (attackTime * sampleRate));
      const releaseCoeff = 1 - Math.exp(-1 / (releaseTime * sampleRate));
  
      // Pour chaque canal
      for (let channel = 0; channel < input.length; channel++) {
        for (let i = 0; i < input[channel].length; i++) {
          const sample = input[channel][i];
          // Déterminez le gain cible en fonction du niveau du signal
          const targetGain = (Math.abs(sample) < thresholdLinear) ? reductionLinear : 1;
  
          // Appliquer un lissage selon attack ou release
          if (targetGain < this.currentGain) {
            // Attaque : descente rapide vers targetGain
            this.currentGain += attackCoeff * (targetGain - this.currentGain);
          } else {
            // Release : montée plus lente vers 1
            this.currentGain += releaseCoeff * (targetGain - this.currentGain);
          }
          output[channel][i] = sample * this.currentGain;
        }
      }
      return true;
    }
  }
  
  registerProcessor('noise-gate-processor', NoiseGateProcessor);
  