const { loadUserConfig, saveUserConfig, defaultConfig } = require('./js/preferences.js');

var userConfig = loadUserConfig();
var storedShortcuts = userConfig.shortcuts || {};

window.addEventListener("settings-updated", (e) => {
    userConfig = loadUserConfig();
    storedShortcuts = userConfig.shortcuts || {};
})
const camActions = Object.fromEntries(
  Array.from({ length: 8 }, (_, i) => [
    `cam${i + 1}`,
    () =>
      window.dispatchEvent(
        new CustomEvent("switchCam", {
          detail: { camera: `camera${i + 1}`, to: "preview" }
        })
      )
  ])
);

const ptzMoveActions = {
  up: () =>
    window.dispatchEvent(
      new CustomEvent("movePTZ", { detail: { direction: "up" } })
    ),
  down: () =>
    window.dispatchEvent(
      new CustomEvent("movePTZ", { detail: { direction: "down" } })
    ),
  left: () =>
    window.dispatchEvent(
      new CustomEvent("movePTZ", { detail: { direction: "left" } })
    ),
  right: () =>
    window.dispatchEvent(
      new CustomEvent("movePTZ", { detail: { direction: "right" } })
    ),
  zoomIn: () =>
    window.dispatchEvent(
      new CustomEvent("movePTZ", { detail: { direction: "zoomIn" } })
    ),
  zoomOut: () =>
    window.dispatchEvent(
      new CustomEvent("movePTZ", { detail: { direction: "zoomOut" } })
    )
};

const selectPtzActions = Object.fromEntries(
  Array.from({ length: 8 }, (_, i) => [
    `select_ptz${i + 1}`,
    () =>

      window.dispatchEvent(
        new CustomEvent("selectPTZ", {
          detail: `camera${i + 1}`
        })
      )
  ])
);

const selectPresetPtzActions = Object.fromEntries(
  Array.from({ length: 8 }, (_, i) => [
    `select_preset_ptz${i + 1}`,
    () =>
      window.dispatchEvent(
        new CustomEvent("presetPTZ", {
          detail: { camera: document.querySelector(".ptz-ctrl.active").getAttribute("data-camera-id"), preset: i + 1 }
        })
      )
  ])
);


const directCamActions = Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [
      `directcam${i + 1}`,
      () =>
        window.dispatchEvent(
          new CustomEvent("switchCam", {
            detail: { camera: `camera${i + 1}`, to: "pgm" }
          })
        )
    ])
  );

const layerActions = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [
    `toggle_layer${i + 1}`,
    () =>
      window.dispatchEvent(
        new CustomEvent("toggleLayer", { detail: { index: i } })
      )
  ])
);

const sceneActions = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [
    `apply_scene${i + 1}`,
    () =>
      window.dispatchEvent(
        new CustomEvent("applyScene", { detail: { scene: i } })
      )
  ])
);

const playerActions = {
  play_player1: () =>
    window.dispatchEvent(new CustomEvent("play", { detail: { player: 1 } })),
  next_player1: () =>
    window.dispatchEvent(new CustomEvent("next", { detail: { player: 1 } })),
  prev_player1: () =>
    window.dispatchEvent(new CustomEvent("prev", { detail: { player: 1 } })),
  play_player2: () =>
    window.dispatchEvent(new CustomEvent("play", { detail: { player: 2 } })),
  next_player2: () =>
    window.dispatchEvent(new CustomEvent("next", { detail: { player: 2 } })),
  prev_player2: () =>
    window.dispatchEvent(new CustomEvent("prev", { detail: { player: 2 } }))
};

const shortcutActions = {
  ...camActions,
  ...directCamActions,
  ...selectPtzActions,
  ...selectPresetPtzActions,
  ...ptzMoveActions,
  autoswitch: () =>
    window.dispatchEvent(new CustomEvent("toggleAutoswitch")),
  switch: () =>
    window.dispatchEvent(new CustomEvent("previewToPGM")),
  startstream: () =>
    window.dispatchEvent(new CustomEvent("launch-stream")),
  startrec: () =>
    window.dispatchEvent(new CustomEvent("launch-recording")),
  startreciso: () =>
    window.dispatchEvent(new CustomEvent("launch-recording-iso")),

  ...layerActions,
  ...sceneActions,
  ...playerActions
};

window.addEventListener("keydown", (e) => {
	const activeEl = document.activeElement;
	if (["INPUT", "TEXTAREA"].includes(activeEl.tagName) || activeEl.isContentEditable) return;

	const keys = [];
	if (e.ctrlKey) keys.push("Ctrl");
	if (e.metaKey) keys.push("Cmd");
	if (e.altKey) keys.push("Alt");
	if (e.shiftKey) keys.push("Shift");
	if (!["Control", "Shift", "Alt", "Meta"].includes(e.key))
		keys.push(e.key.charAt(0).toUpperCase() + e.key.slice(1));

	const pressedCombination = keys.join(" + ");

	for (const [shortcutId, combination] of Object.entries(storedShortcuts)) {
		if (combination === pressedCombination) {
			e.preventDefault();
			const action = shortcutActions[shortcutId];
			if (action) action();
			break;
		}
	}
});
