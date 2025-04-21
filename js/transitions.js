function globalCropTransition(opt, direction = "left", onProgress) {
	return new Promise((resolve, reject) => {
        const aux1Layers = window.master;

        if (!aux1Layers || !Array.isArray(aux1Layers)) {
            return reject(new Error("window.aux['aux1'] doit exister et être un tableau."));
        }

        const previewLayer = aux1Layers.find(layer => layer.device === "preview");
        const pgmLayer = aux1Layers.find(layer => layer.device === "pgm");
        
        let startTime = null;
        previewLayer.opacity = 1;
        if(opt.progress !== undefined) {
            if (direction === "left") {
                previewLayer.cropRight = 100 - opt.progress;
            } else if (direction == "right") {
                previewLayer.cropLeft = 100 - opt.progress;
            } else if (direction == "up") {
                previewLayer.cropBottom = 100 - opt.progress;
            } else if (direction == "down") {
                previewLayer.cropTop = 100 - opt.progress;
            }
            if( opt.progress < 100) {
                if(onProgress) onProgress(opt.progress);
            }
            else {
                finish();
            }
        }
        else{
            if (direction === "left") {
                previewLayer.cropRight = 100;
            } else if (direction == "right") {
                previewLayer.cropLeft = 100;
            } else if (direction == "up") {
                previewLayer.cropBottom = 100;
            } else if (direction == "down") {
                previewLayer.cropTop = 100;
            }

            function animate(timestamp) {
                if (!startTime) {
                    startTime = timestamp;
                }

                const elapsed = timestamp - startTime;
                const progress = Math.min(elapsed / opt.duration, 1) * 100;

                if (direction === "left") {
                    previewLayer.cropRight = 100 - progress;
                }
                else if (direction == "right") {
                    previewLayer.cropLeft = 100 - progress;
                }
                else if (direction == "up") {
                    previewLayer.cropBottom = 100 - progress;
                }
                else if (direction == "down") {
                    previewLayer.cropTop = 100 - progress;
                }

                if (progress < 100) {
                    if(onProgress) onProgress(progress);
                    requestAnimationFrame(animate);
                } else {         
                    finish();
                }
            }
            requestAnimationFrame(animate);
        }
        function finish(){
            const tmp = window.pgm;
            const tmp_preview = window.preview;
            window.pgm = tmp_preview;

            setTimeout(() => {
                previewLayer.cropLeft = 0;
                previewLayer.cropRight = 0;
                previewLayer.cropTop = 0;
                previewLayer.cropBottom = 0;
                previewLayer.opacity = 0;
                window.preview = tmp;
                resolve();
            }, 100);
            
        }
    });
}

function pushTransition(opt, direction = "left", onProgress) {
    return new Promise((resolve, reject) => {
        const aux1Layers = window.master;

        const previewLayer = aux1Layers.find(layer => layer.device === "preview");
        const pgmLayer = aux1Layers.find(layer => layer.device === "pgm");

        let startTime = null;
        previewLayer.opacity = 1;

        if(opt.progress !== undefined) {
            if (direction === "left") {
                previewLayer.x = -100 + opt.progress;
                pgmLayer.x = opt.progress;
            } else if (direction == "right") {
                previewLayer.x = 100 - opt.progress;
                pgmLayer.x = -opt.progress;
            } else if (direction == "up") {
                previewLayer.y = -100 + opt.progress;
                pgmLayer.y = opt.progress;
            } else if (direction == "down") {
                previewLayer.y = 100 - opt.progress;
                pgmLayer.y = -opt.progress;
            }
            if( opt.progress < 100) {
                if(onProgress) onProgress(opt.progress);
            }
            else {
                finish();
            }
        }
        else{
            if (direction === "left") {
                previewLayer.x = -100;
                pgmLayer.x = 0;
            } else if (direction == "right") {
                previewLayer.x = 100;
                pgmLayer.x = 0;
            } else if (direction == "up") {
                previewLayer.y = -100;
                pgmLayer.y = 0;
            } else if (direction == "down") {
                previewLayer.y = 100;
                pgmLayer.y = 0;
            }

            function animate(timestamp) {
                if (!startTime) {
                    startTime = timestamp;
                }

                const elapsed = timestamp - startTime;
                const progress = Math.min(elapsed / opt.duration, 1) * 100;

                if (direction === "left") {
                    previewLayer.x = -100 + progress;
                    pgmLayer.x = progress;
                } else if (direction == "right") {
                    previewLayer.x = 100 - progress;
                    pgmLayer.x = -progress;
                } else if (direction == "up") {
                    previewLayer.y = -100 + progress;
                    pgmLayer.y = progress;
                } else if (direction == "down") {
                    previewLayer.y = 100 - progress;
                    pgmLayer.y = -progress;
                }
                

                if (progress < 100) {
                    if(onProgress) onProgress(progress);
                    requestAnimationFrame(animate);
                } else {         
                    finish();                    
                }
            }
            requestAnimationFrame(animate);
        }
        function finish(){
            const tmp = window.pgm;
            const tmp_preview = window.preview;
            window.pgm = tmp_preview;

            setTimeout(() => {
                pgmLayer.x = 0;
                pgmLayer.y = 0;
                previewLayer.x = 0;
                previewLayer.y = 0;
                previewLayer.opacity = 0;
                window.preview = tmp;
                resolve();
            }, 100);
        }
    });	
}
    
function slideOverlayTransition(opt, direction = "left", onProgress) {
    return new Promise((resolve, reject) => {
        const aux1Layers = window.master;

        const previewLayer = aux1Layers.find(layer => layer.device === "preview");
        const pgmLayer = aux1Layers.find(layer => layer.device === "pgm");
        let startTime = null;
        previewLayer.opacity = 1;
        if(opt.progress !== undefined) {
            if (direction === "left") {
                previewLayer.x = -100 + opt.progress;
            } else if (direction == "right") {
                previewLayer.x = 100 - opt.progress;
            } else if (direction == "up") {
                previewLayer.y = -100 + opt.progress;
            } else if (direction == "down") {
                previewLayer.y = 100 - opt.progress;
            }
            if( opt.progress < 100) {
                if(onProgress) onProgress(opt.progress);
            }
            else {
                finish();
            }
        }
        else{
            if (direction === "left") {
                previewLayer.x = -100;
            } else if (direction == "right") {
                previewLayer.x = 100;
            } else if (direction == "up") {
                previewLayer.y = -100;
            } else if (direction == "down") {
                previewLayer.y = 100;
            }

            function animate(timestamp) {
                if (!startTime) {
                    startTime = timestamp;
                }

                const elapsed = timestamp - startTime;
                const progress = Math.min(elapsed / opt.duration, 1) * 100;

                if (direction === "left") {
                    previewLayer.x = -100 + progress;
                } else if (direction == "right") {
                    previewLayer.x = 100 - progress;
                } else if (direction == "up") {
                    previewLayer.y = -100 + progress;
                } else if (direction == "down") {
                    previewLayer.y = 100 - progress;
                }
                
                if (progress < 100) {
                    if(onProgress) onProgress(progress);
                    requestAnimationFrame(animate);
                } else {         
                    finish();
                }
            }
            requestAnimationFrame(animate);
        }
        function finish(){
            const tmp = window.pgm;
            const tmp_preview = window.preview;
            window.pgm = tmp_preview;

            setTimeout(() => {
                pgmLayer.x = 0;
                pgmLayer.y = 0;
                previewLayer.x = 0;
                previewLayer.y = 0;
                previewLayer.opacity = 0;
                window.preview = tmp;
                resolve();
            }, 100);
        }
    });
}

function crossFade(opt, onProgress) {
    return new Promise((resolve, reject) => {
        const aux1Layers = window.master;

        const previewLayer = aux1Layers.find(layer => layer.device === "preview");
        const pgmLayer = aux1Layers.find(layer => layer.device === "pgm");
    
        let startTime = null;
        if(opt.progress !== undefined) {
            previewLayer.opacity = opt.progress / 100;
            pgmLayer.opacity = (100 - opt.progress) / 100;
            
            if (opt.progress < 100) {
                if(onProgress) onProgress(opt.progress);
            }
            else {
                finish();
            }
        }
        else{
            previewLayer.opacity = 0;
            pgmLayer.opacity = 1;
        
            function animate(timestamp) {
                if (!startTime) {
                    startTime = timestamp;
                }
    
                const elapsed = timestamp - startTime;
                const progress = Math.min(elapsed / opt.duration, 1);    
            
                previewLayer.opacity = progress;
                pgmLayer.opacity = 1 - progress;

                if (progress < 1) {
                    if(onProgress) onProgress(progress * 100);
                    requestAnimationFrame(animate);
                } else {         
                    finish();
                }
            }

            requestAnimationFrame(animate);
        }
        function finish(){
            const tmp = window.pgm;
            const tmp_preview = window.preview;
            window.pgm = tmp_preview;

            setTimeout(() => {
                pgmLayer.opacity = 1;
                window.preview = tmp;
                previewLayer.opacity = 0;
                resolve();
            }, 100);
        }
    });
}

module.exports = {globalCropTransition, pushTransition, slideOverlayTransition, crossFade}