export default class Debug {
    static clear() {
        if (typeof document === "undefined") {
            return;
        }

        document.getElementById("debug").innerHTML = "";
    }
    
    static log(message) {
        if (typeof document === "undefined") {
            return;
        }

        let element = document.getElementById("debug");
        if (element) {
            let div = document.createElement("div");
            let text = document.createTextNode(message);
            div.appendChild(text);
            
            element.appendChild(div);
            while (element.scrollHeight > element.clientHeight) {
                element.removeChild(element.firstChild);
            }
        }
    }
}
