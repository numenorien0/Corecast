const os = require('os');
const { app } = require('electron');

function getCpuLoad(callback) {
    if (0/*typeof process.getCPUUsage === 'function'*/) {
        const cpuUsage = process.getCPUUsage();
        const cpuLoad = cpuUsage.percentCPUUsage * 100; // Convertit en pourcentage
        callback(Number(cpuLoad.toFixed(2))); // Assure que c'est bien un nombre
    } else {
        // Fallback si `getCPUUsage` n'est pas disponible
        legacyCpuLoad(callback);
    }
}

function legacyCpuLoad(callback) {
    const startMeasure = cpuAverage();

    setTimeout(() => {
        const endMeasure = cpuAverage();

        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;

        let cpuLoad = totalDifference > 0 ? (1 - idleDifference / totalDifference) * 100 : 0;

        callback(Number(cpuLoad.toFixed(2))); // Garantit un retour valide
    }, 500);
}

function cpuAverage() {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;

    cpus.forEach(cpu => {
        totalIdle += cpu.times.idle;
        totalTick += Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
    });

    return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

function getRamUsage(callback) {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = (usedMem / totalMem) * 100;

    callback(Number(usagePercent.toFixed(2))); // Assure que c'est bien un nombre
}

module.exports = { getCpuLoad, getRamUsage };
