export default class miniPlayer extends HTMLElement{
    constructor(){
        super();
    }

    connectedCallback(){
        this.render();
        this.mainElement = document.querySelector("media-player[mediaplayer='"+this.getAttribute("player")+"']");

        this.mainElement.addEventListener("update", (e) => {
            this.querySelector(".mini_remaining_time").innerHTML = e.detail.remainingTime;
            if(e.detail.paused){
                this.querySelector(".playpause").innerHTML = `<i class='bx bx-play' ></i>`
            }
            else{
                this.querySelector(".playpause").innerHTML = `<i class='bx bx-pause' ></i>`
            }
        });

        

    }

    render(){
        this.innerHTML = `
            <div class='mini_control'>
                <button class='prev'><i class='bx bx-skip-previous' ></i></button>
                <button class='playpause'><i class='bx bx-play' ></i></button>
                <button class='next'><i class='bx bx-skip-next' ></i></button>
            </div>   
            <div class='mini_remaining_time'>00:00:00</div> 
        `;

        this.querySelector(".playpause").addEventListener("click", (e) => {
            this.mainElement.play();
        })
        this.querySelector(".next").addEventListener("click", (e) => {
            this.mainElement.next();
        })
        this.querySelector(".prev").addEventListener("click", (e) => {
            this.mainElement.prev();
        })
    }

    disconnectedCallback(){

    }
}