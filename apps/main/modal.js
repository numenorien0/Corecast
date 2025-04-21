export default class modal extends HTMLElement{
    constructor(){
        super();
        this.show = this.getAttribute("show");
        this.content = this.getAttribute("content");
        this.title = this.getAttribute("title");
    }

    static get observedAttributes() {
        return ["show", "content"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "show" && oldValue !== newValue) {
            this.show = newValue;
            this.render();
        }
        if (name === "content" && oldValue !== newValue) {
            this.content = newValue;
            this.render();
        }
    }

    render(){
        this.innerHTML = `
            <div class='background_modal ${this.show == "true" ? "show" : "hide"}'>
                <div class='modal'>
                    <div class='modal_header'><h1>${this.title}</h1><button id='closeModal'><i class="fa-duotone fa-solid fa-check"></i></button></div>
                    <div class='modal_body'>${this.content}</div>
                    <div class='modal_footer'></div>
                </div>
            </div>
        `;
    
        const background = this.querySelector(".background_modal");
        const modal = this.querySelector(".modal");

        modal.addEventListener("click", (e) => e.stopPropagation());

        background.addEventListener("click", () => {
            this.setAttribute("show", "false");
            this.render();
        });

        this.querySelector("#closeModal").addEventListener("click", () => {
            this.setAttribute("show", "false");
            this.render();
        })
    }
    

    connectedCallback(){
        this.render();
    }

    disconnectedCallback(){

    }
}