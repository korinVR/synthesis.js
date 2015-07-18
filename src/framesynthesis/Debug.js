export default class Debug {
	static clear() {
		document.getElementById("debug").innerHTML = "";
	}
	
	static log(message) {
		let element = document.getElementById("debug");
		if (element) {
			element.innerHTML += "<div>" + message + "</div>"; 
			while (element.scrollHeight > element.clientHeight) {
				element.removeChild(element.firstChild);
			}
		}
	}
}

