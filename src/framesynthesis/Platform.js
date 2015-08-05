export default class Platform {
	static isiOS() {
		return this.isiPhone() || this.isiPad();
	}
	
	static isiPhone() {
		return window.navigator.userAgent.includes("iPhone");
	}
	
	static isiPad() {
		return window.navigator.userAgent.includes("iPad");
	}
}
