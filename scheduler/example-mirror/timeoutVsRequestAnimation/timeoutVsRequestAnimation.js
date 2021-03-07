function validProgress(progress) {
    if (!progress || progress < 0) {
        return 0;
    }
    if (progress > 100) {
        return 100;
    }
    return progress;
};

function setAttribute(dom, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'style' && dom.style.cssText !== value) {
            dom.style.cssText = value;
        }
        else if (dom.getAttribute(key) !== value) {
            dom.setAttribute(key, value);
        }
    });
}

// 默认options,需要设置
var defaultOptions = {
    percent : 1,
    strokeWidth : 4,
    strokeColor : '#236EFF',
    gapDegree : 0,
    gapPosition : 'bottom',
    strokeLinecap: 'round',
    trailColor: '#f3f3f3'
}

// 修改组件state
var state = {
    options: Object.assign({}, defaultOptions),
    progress : {
        circleProps: {

        },
        circletrailProps: {

        },
        circlePathProps: {

        }
    },
    infoTextProps: {
        text: '正在准备项目，请稍等片刻…',
        style: ''
    },
    infoStep: {
        text: '正在启动预览服务…',
        style: ''
    }
};

// 存储组件中的dom
var elements = {
    circle : document.querySelector(".progress-circle"),
    circletrail: document.querySelector(".progress-circle-trail"),
    circlepath: document.querySelector(".progress-circle-path"),
    infoText: document.querySelector(".progress-information-text"),
    infoStep: document.querySelector(".progress-information-step")
};

// 修改环形宽度，环形末端的形状
function updateStroke() {
    state.progress.circletrailProps.stroke = state.options.trailColor; // 未完成的颜色
    state.progress.circletrailProps['stroke-width'] = state.options.strokeWidth;
    state.progress.circlePathProps['stroke-linecap'] = state.options.strokeLinecap;
    state.progress.circlePathProps['stroke-width'] = state.options.percent === 0 ? 0 : state.options.strokeWidth; // 已完成的线条宽度
}

// 修改环形的path
function updatePathStringState(){
    var {
        percent,
        strokeWidth,
        gapPosition
    } = state.options;

    percent = validProgress(percent);
    var radius = 50 - (strokeWidth / 2);
    var beginPositionX = 0;
    var beginPositionY = -radius;
    var endPositionX = 0;
    var endPositionY = -2 * radius;

    switch (gapPosition) {
        case 'left':
            beginPositionX = -radius;
            beginPositionY = 0;
            endPositionX = 2 * radius;
            endPositionY = 0;
            break;
        case 'right':
            beginPositionX = radius;
            beginPositionY = 0;
            endPositionX = -2 * radius;
            endPositionY = 0;
            break;
        case 'bottom':
            beginPositionY = radius;
            endPositionY = 2 * radius;
            break;
        default:
    }

    var pathString = "M 50,50 m ".concat(beginPositionX, ",").concat(beginPositionY, " a ").concat(radius, ",").concat(radius, " 0 1 1 ").concat(endPositionX, ",").concat(-endPositionY, " a ").concat(radius, ",").concat(radius, " 0 1 1 ").concat(-endPositionX, ",").concat(endPositionY, "");
    state.progress.circletrailProps.d = pathString;
    state.progress.circlePathProps.d = pathString;
}

// 修改表示未完成部分的样式状态
function updateTrailPathState() {
    var {
        percent,
        strokeWidth,
        gapDegree,
    } = state.options;

    percent = validProgress(percent);
    var radius = 50 - (strokeWidth / 2);
    var len = Math.PI * 2 * radius;

    var trailPathStyle = "stroke-dasharray: ".concat(len - gapDegree, "px ").concat(len, "px;stroke-dashoffset: -").concat(gapDegree / 2, "px;transition: stroke-dashoffset .3s ease 0s, stroke-dasharray .3s ease 0s, stroke .3s;");
    state.progress.circletrailProps.style = trailPathStyle;
}

// 修改progress的进度
function updateProgressState() {
    var {
        percent,
        strokeWidth,
        strokeColor,
        gapDegree
    } = state.options;

    percent = validProgress(percent);
    var radius = 50 - (strokeWidth / 2);
    var len = Math.PI * 2 * radius;

    var strokePathStyle = "stroke: ".concat(strokeColor, ";stroke-dasharray: ").concat(percent / 100 * (len - gapDegree), "px ").concat(len, "px;stroke-dashoffset: -").concat(gapDegree / 2, "px;transition: stroke-dashoffset .3s ease 0s,    stroke-dasharray .3s ease 0s, stroke .3s,    stroke-width .06s ease .3s;");
    state.progress.circlePathProps.style = strokePathStyle;
}

// 初始化state
function initState() {
    updateStroke();
    updatePathStringState();
    updateTrailPathState();
    updateProgressState();
}

// 更新视图属性
function updateProgressView() {
    setAttribute(elements.circle, state.progress.circleProps);
    setAttribute(elements.circletrail, state.progress.circletrailProps);
    setAttribute(elements.circlepath, state.progress.circlePathProps);
}

// 更新info信息
function updateInfoView() {
    elements.infoText.innerHTML = state.infoTextProps.text;
    elements.infoStep.innerHTML = state.infoStep.text;
}

function synchronizeUi(){
    // let i = 0;
    // while (i < 500) {
    //     console.log(i++);
    // }
    console.log('synchronizeUi');
    // 需要分开
    updateProgressView();
    updateInfoView();
}

// 初始化progress
function createProgressBar(){
    // 初始化state，更新视图
    initState();
    updateProgressView();
    updateInfoView();
}
createProgressBar();

function firstRender() {
    // 第一次event loop
    elements.infoText.innerHTML = '第一次..';

    // 第三次event loop
    function timeVsRequestAnimation() {
        console.log('timeVsRequestAnimation');
        elements.infoText.innerHTML = '第三次......';
    };

    setTimeout(timeVsRequestAnimation, 0);
    setTimeout(timeVsRequestAnimation, 0);
    setTimeout(timeVsRequestAnimation, 0);

    // 第三次event loop
    function secondRender() {
        console.log('secondRender');
        elements.infoText.innerHTML = '第二次....';
    }
    window.addEventListener('message', secondRender);

    window.postMessage('123', '*');
    window.postMessage('123', '*');
    window.postMessage('123', '*');
}
setTimeout(firstRender, 2000);

