export default class MyMath {
    static random(min, max) {
        return min + Math.random() * (max - min);
    }

    static clamp(value, min, max)
    {
        if (min > max) {
            var temp = min;
            min = max;
            max = temp;
        }

        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }
        return value;
    }

    static linearMap(value, s0, s1, d0, d1)
    {
        return d0 + (value - s0) * (d1 - d0) / (s1 - s0);
    }

    static clampedLinearMap(value, s0, s1, d0, d1)
    {
        return this.clamp(this.linearMap(value, s0, s1, d0, d1), d0, d1);
    }

    static ease(value, target, factor, deltaTime) {
        return value + (target - value) * (1 - Math.exp(-factor * deltaTime));
    }

    static radian(degree) {
        return degree * 0.01745329251994330; // Math.PI / 180
    }

    static degree(radian) {
        return radian * 57.2957795130823208; // 180 / Math.PI
    }

    static wrap(value, min, max) {
        let n = (value - min) % (max - min);
        return (n >= 0) ? n + min : n + max;
    }
}
