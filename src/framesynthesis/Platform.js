export default class Platform {
	static isiOS() {
		return this.isiPhone() || this.isiPad();
	}
	
	static isiPhone() {
		if (typeof document === "undefined") {
			return false;
		}

		return window.navigator.userAgent.indexOf("iPhone") >= 0;
	}
	
	static isiPad() {
		if (typeof document === "undefined") {
			return false;
		}

		return window.navigator.userAgent.indexOf("iPad") >= 0;
	}
}
