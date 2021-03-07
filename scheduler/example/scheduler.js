(function (global, schedulerFactory) {
    global.scheduler = schedulerFactory();
})(this, function () {
    /* 当前时间 */
    var hasNativePerformanceNow = typeof performance === 'object' && typeof performance.now === 'function';
    var localDate = Date;
    var getCurrentTime;
    if (hasNativePerformanceNow) {
        var Performance = performance;
        getCurrentTime = function() {
        return Performance.now();
        };
    } else {
        getCurrentTime = function() {
        return localDate.now();
        };
    }
    /* 利用setTimeout弥补requestAnimation的缺陷 */
    var rAFTimeoutID, rAFID, ANIMATION_FRAME_TIMEOUT = 100;
    var localSetTimeout = typeof setTimeout === 'function' ? setTimeout : undefined;
    var localClearTimeout = typeof clearTimeout === 'function' ? clearTimeout : undefined;
    var localRequestAnimationFrame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : undefined;
    var localCancelAnimationFrame = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : undefined;
    var requestAnimationFrameWithTimeout = function(callback) {
        rAFID = localRequestAnimationFrame(function(timestamp) {
            localClearTimeout(rAFTimeoutID);
            callback(timestamp);
        });
        rAFTimeoutID = localSetTimeout(function() {
            localCancelAnimationFrame(rAFID);
            callback(getCurrentTime());
        }, ANIMATION_FRAME_TIMEOUT);
    };
    /* message channel */
    const messageKey =
        '__reactIdleCallback$' +
        Math.random()
        .toString(36)
        .slice(2);
    
    /* 添加callback */
    // 队列用于存储callback
    let callbackQueue = [];
    function setCallback(cb) {
        callbackQueue.push(cb);
    }
    function getCallback() {
        return callbackQueue.shift();
    }
    function flushWork() {
        let cb = getCallback();
        typeof cb === 'function' && cb();
        // requestCallback();
    }
    // 调度cb
    function idleTick() {
        flushWork();
    }
    window.addEventListener('message', idleTick);
    function animationTick() {
        window.postMessage(messageKey, '*');
    }
    function requestCallback(callback) {
        requestAnimationFrameWithTimeout(animationTick); // 这里的cb需要在下一帧执行
    }
    function scheduleCallback(cb) {
        setCallback(cb); // 入队列
        requestCallback(flushWork);
    }

    return {
        scheduleCallback
    };
});
