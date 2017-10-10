import MyMath from "../framesynthesis/MyMath";

export default class TriangleOscillator {
    getSample(phase) {
        let p = phase % 1;
        
        if (p < 0.25) {
            return MyMath.linearMap(p, 0, 0.25, 0, 1);
            // return p * 4;
        }
        if (p < 0.75) {
            return MyMath.linearMap(p, 0.25, 0.75, 1, -1);
        }
        return MyMath.linearMap(p, 0.75, 1, -1, 0);
    }
}
