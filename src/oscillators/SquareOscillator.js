import MyMath from "../framesynthesis/MyMath";

export default class SquareOscillator {
	getSample(phase) {
		let p = phase % 1;

		return p < 0.5 ? 1 : -1;
	}
}
