export default class Timer extends HTMLElement {
    constructor() {
      super();
      this.timerInterval = null;
      this.startTime = null;
      this._onStartRecording = this.startTimer.bind(this);
    }
  
    connectedCallback() {
      this.render();
      window.addEventListener("start-timer", this._onStartRecording);
    }
  
    disconnectedCallback() {
      window.removeEventListener("start-timer", this._onStartRecording);
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
    }
  
    startTimer() {
      if (this.timerInterval) {
        return;
      }
      this.startTime = Date.now();
      this.timerInterval = setInterval(() => {
        if (!window.mediaRecorder || Object.keys(window.mediaRecorder).length === 0) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
          return;
        }
        const elapsed = Date.now() - this.startTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const centiseconds = Math.floor((elapsed % 1000) / 10);
        this.innerHTML = `
          <div class='TimerRecording'>
            ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}
          </div>`;
          window.dispatchEvent(new CustomEvent("timer-update", {
            detail: {
              hours: String(hours).padStart(2, '0'),
              minutes : String(minutes).padStart(2, '0'),
              seconds: String(seconds).padStart(2, '0'),
              centiseconds: String(centiseconds).padStart(2, '0')
            }
          }));
      }, 10);
    }
  
    render() {
      this.innerHTML = `<div class='TimerRecording'>00:00:00:00</div>`;
      window.dispatchEvent(new CustomEvent("timer-update", {
        detail: {
          hours: "00",
          minutes : "00",
          seconds: "00",
          centiseconds: "00"
        }
      }));
    }
  }
  