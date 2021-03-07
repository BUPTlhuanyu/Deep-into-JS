// 获取当前时间

let localRequestAnimation = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : undefined;

let getCurrentTime;
// 代码优化前
// getCurrentTime = function () {
//     if (performance.now) {
//         return performance.now();
//     }
//     if (Date) {
//         return Date.now();
//     }
// }

// 代码优化后
if (typeof performance === 'object' && typeof performance.now === 'function') {
    getCurrentTime = function () {
        return performance.now();
    }
} else {
    getCurrentTime = function () {
        return Date.now();
    }
}

// 不是所有加了requestAnimation都是时间分片，这里添加的listA与listB在AnimationCb中当代码比较长的时候依旧会导致丢帧
let listA = {
    fn: function() {
        console.log('A');
    }
}
let listB = {
    fn: function() {
        console.log('B');
    }
}
let cbList = [listA, listB];
const AnimationCb = function() {
    if (cbList.length > 0) {
        let cb = cbList.pop();
        cb.fn();
    }
    localRequestAnimation(AnimationCb);
}