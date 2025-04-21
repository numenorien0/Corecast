export default class mediaplayer extends HTMLElement {
    constructor() {
        super();

        this.sources = [];
        this.currentSourceIndex = 0;
        this.currentSourceUuid = "";
        this.isPlaying = false;
        this.mediaplayer = parseInt(this.getAttribute("mediaplayer"));

        if (!window.mediaplayer[this.mediaplayer]) {
            window.mediaplayer[this.mediaplayer] = new MediaStream();  
        }
        
        this.audioContext = window.sharedAudioContext;
        this.audioDestination = this.audioContext.createMediaStreamDestination();
        const audioTracks = this.audioDestination.stream.getAudioTracks();

        if (audioTracks.length > 0 && !window.mediaplayer[this.mediaplayer].getAudioTracks().length) {
            window.mediaplayer[this.mediaplayer].addTrack(audioTracks[0]);
        }
      
    }
  
    getConfig() {
      var storedData = JSON.parse(localStorage.getItem("playlist-"+this.mediaplayer)) || {playlist: [], config: {}};
      return storedData || {};
    }

    connectedCallback() {
      this.render();

      this.addEventListener("setVideo", (e) => {
          this.currentSourceUuid = e.detail.uuid
          this.codec = e.detail.codec;
          this.querySelector(".mediaplayer").setAttribute("src", e.detail.file);               
          if(this.isPlaying){
              this.play("play");
          }
          else{
              const videoElement = this.querySelector(".mediaplayer");
              videoElement.currentTime = 0;
              this.play("pause");
          }
      })
      
      window.addEventListener("camera-exposed", (e) => {
        if (e.detail.device === "mediaplayer-"+this.mediaplayer) {
          const videoElement = this.querySelector(".mediaplayer");
          videoElement.currentTime = 0;
          this.play("play");
        }
      });
      window.addEventListener("camera-unexposed", (e) => {
        if (e.detail.device === "mediaplayer-"+this.mediaplayer) {
            const videoElement = this.querySelector(".mediaplayer");
            
            videoElement.currentTime = 0;
            this.play("pause");
        }
      });
    }

    play(state){
        const videoElement = this.querySelector(".mediaplayer");
        if(state == "play"){
            videoElement.play();
            window.dispatchEvent(new CustomEvent("played", { detail: {mediaplayer: this.mediaplayer, state: "playing"}}));
        }
        else if(state == "pause"){
            videoElement.pause();
            window.dispatchEvent(new CustomEvent("played", { detail: {mediaplayer: this.mediaplayer, state: "paused"}}));
        }
        if(!state){
            if(videoElement.paused){
                videoElement.play();
                window.dispatchEvent(new CustomEvent("played", { detail: {mediaplayer: this.mediaplayer, state: "playing"}}));
            }
            else{
                videoElement.pause();
                window.dispatchEvent(new CustomEvent("played", { detail: {mediaplayer: this.mediaplayer, state: "paused"}}));
            }
        }
    }
    
    next(){
        document.querySelector("playlist-service[mediaplayer='"+this.mediaplayer+"'][main=true]").dispatchEvent(new CustomEvent("askNextVideo", { detail: {}}));
    }

    prev(){
        const videoElement = this.querySelector(".mediaplayer");
        if(videoElement.currentTime > 4){
            videoElement.currentTime = 0;
        }
        else{
            document.querySelector("playlist-service[mediaplayer='"+this.mediaplayer+"'][main=true]").dispatchEvent(new CustomEvent("askPrevVideo", { detail: {}}));
        }
    }

    getRemainingTime(element){
        const elapsed = element.duration - element.currentTime; // ou videoElement.duration - videoElement.currentTime pour le temps restant
        let hours = Math.floor(elapsed / 3600);
        let minutes = Math.floor((elapsed % 3600) / 60);
        let seconds = Math.floor(elapsed % 60);
        if (isNaN(hours)) hours = 0;
        if (isNaN(minutes)) minutes = 0;
        if (isNaN(seconds)) seconds = 0;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  
    render() {
      this.innerHTML = `
        <div>
          <!-- L'élément vidéo lit la source actuelle -->
          <video class="mediaplayer" preload id='player-${this.mediaplayer}' src="${this.sources[this.currentSourceIndex]}"></video>
          <div id='video_control'>
            <div class='timecode'>05:06:12</div>
            <button id="playBtn" class='video_control_btn'><i class='bx bx-play' ></i></button>
<!--            <input id="video_progress" type="range" min="0" max="100" value="0"/>-->
                <progress-bar id="video_progress" min="0" max="100"></progress-bar>
            <button id="prevBtn" class='video_control_btn'><i class='bx bx-skip-previous' ></i></button>
            <button id="nextBtn" class='video_control_btn'><i class='bx bx-skip-next' ></i></button>
          </div>
        </div>
      `;
      
      const videoElement = this.querySelector(".mediaplayer");
      const prevBtn = this.querySelector("#prevBtn");
      const nextBtn = this.querySelector("#nextBtn");
      const playBtn = this.querySelector("#playBtn");
      const video_progress = this.querySelector("#video_progress");

      if (typeof videoElement.setSinkId === "function") {
        videoElement.setSinkId("none")
          .then(() => console.log("Audio sink configuré sur 'none'"))
          .catch(err => {});
      } 
  
      playBtn.addEventListener("click", () => {
        this.play();
      })

      videoElement.oncanplaythrough = () => {
        this.querySelector(".timecode").innerHTML = this.getRemainingTime(videoElement);
        this.dispatchEvent(new CustomEvent("update", {detail: {currentTime: videoElement.currentTime, duration: videoElement.duration, paused: videoElement.paused, remainingTime: this.getRemainingTime(videoElement)}}))
        const ratio = (videoElement.currentTime / videoElement.duration) * 100;

        video_progress.currentValue = ratio;
      }

      videoElement.ontimeupdate = () => {
        video_progress.currentValue = videoElement.currentTime / videoElement.duration * 100;
        this.dispatchEvent(new CustomEvent("update", {detail: {currentTime: videoElement.currentTime, duration: videoElement.duration, paused: videoElement.paused, remainingTime: this.getRemainingTime(videoElement)}}))
        if(videoElement.paused){
            playBtn.innerHTML = `<i class='bx bx-play' ></i>`
        }
        else{
            playBtn.innerHTML = `<i class='bx bx-pause' ></i>`
        }
        this.querySelector(".timecode").innerHTML = this.getRemainingTime(videoElement);
      }

      video_progress.addEventListener("change", (e) => {
        videoElement.currentTime = Math.floor(videoElement.duration / 100 * e.detail.value);
    })

      prevBtn.addEventListener("click", () => {
        this.prev();
      });

      nextBtn.addEventListener("click", () => {
          this.next();
      });

      videoElement.addEventListener("loadeddata", () => {
        videoElement.currentTime = 0;
      });

      
      videoElement.onended = () => {
        const config = this.getConfig().config;
        const configItem = this.getConfig().playlist.find(el => el.uuid === this.currentSourceUuid);
        if(configItem.loop == true){
            videoElement.currentTime = 0;
            this.play("play");
        }
        else{
            if(config.autoNext == true || configItem.autoNext == true){
                this.isPlaying = true;
                this.next();
            }
            else{
                this.isPlaying = false;          
            }
        }
      }
  
      videoElement.onpause = () => {
        this.isPlaying = false;
      }

      videoElement.onplaying = () => {
        this.isPlaying = true;
        const oldTracks = window.mediaplayer[this.mediaplayer].getVideoTracks();
        oldTracks.forEach((track) => {
            track.stop();
            window.mediaplayer[this.mediaplayer].removeTrack(track);
        });
        const stream = videoElement.captureStream();
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
            window.mediaplayer[this.mediaplayer].addTrack(videoTrack);
        }

        if (!this.audioSource) {
          this.audioSource = this.audioContext.createMediaElementSource(videoElement);
          this.audioSource.connect(this.audioDestination);
        } 
      };
    }
  }
    
  