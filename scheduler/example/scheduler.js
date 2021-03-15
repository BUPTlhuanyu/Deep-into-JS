(function (global, schedulerFactory) {
    global.scheduler = schedulerFactory();
})(this, function () {
    
    return {
        scheduleCallback
    };
});
