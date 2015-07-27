export default class Platform {
	static isiOS() {
		return this.isiPhone() || this.isiPad();
	}
	
	static isiPhone() {
		return window.navigator.userAgent.indexOf("iPhone") > 0;
	}
	
	static isiPad() {
		return window.navigator.userAgent.indexOf("iPad") > 0;
	}
}
