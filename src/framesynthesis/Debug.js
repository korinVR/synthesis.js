export default class Debug {
	static clear() {
		document.getElementById("debug").innerHTML = "";
	}
	
	static log(text) {
		document.getElementById("debug").innerHTML += text + "<br>";
	}
}
