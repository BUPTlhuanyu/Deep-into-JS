'use strict';

const Utils = require('./utils.js');
const Constants = require('./constants.js');

// Randomly selected unique id to use as keys for the background ports object.
const BACKGROUND_PORT_UID_KEY = 1;

const BackgroundHub = function(options) {
    Utils.constructorTweakMethods('BackgroundHub', this);

    options = options || {};
    this._connectedHandler = options.connectedHandler;
    this._disconnectedHandler = options.disconnectedHandler;

    // Hold all ports created with unique ids as keys (usually tabId, except background).
    this._backgroundPorts = {};
    this._contentScriptPorts = {};
    this._popupPorts = {};
    this._devtoolPorts = {};

    // Listen to port connections.
    chrome.runtime.onConnect.addListener(this._onPortConnected);
    window.mockPortOnConnect = this._onPortConnected;
};

BackgroundHub.prototype.constructor = BackgroundHub;

// ------------------------------------------------------------
// Private methods - start.
// ------------------------------------------------------------

// 为链接进来的 port 设定事件监听函数，监听该通道的消息以及断开链接事件
BackgroundHub.prototype._onPortConnected = function(port) {
    Utils.log('log', '[BackgroundHub:runtime.onConnect]', arguments);

    // Handle this port only if came from our API.
    if (port.name.indexOf(Constants.MESSENGER_PORT_NAME_PREFIX) === 0) {
        // Handle ALL incoming port messages.
        port.onMessage.addListener(this._onPortMessageHandler);

        // Cleanup on port disconnections, this takes care of all disconnections
        // (other extension parts create the connection with this port).
        port.onDisconnect.addListener(this._onPortDisconnectionHandler);
    }
};

// 在其他 part 调用 Messenger.prototype.initConnection 的时候会初始化 connection，初始化的过程会通过 doInitConnection 轮询 background，主要做以下两个事情
// 1. 调用 chrome.runtime.connect，创建一个 port，并注册一个消息监听函数接收包括初始化成功在内的所有消息
// 2. port.postMessage 触发这里的 _onPortMessageHandler 来初始化链接
// 上述第 2 步，如果 background 以及通知 part 整个过程中出错，导致 part 没有接收到初始化成功的消息，那么 part 会销毁这个 port，并重新执行 doInitConnection，
// 
// 触发 _onPortConnected，然后监听 port 的消息。
BackgroundHub.prototype._onPortMessageHandler = function(message, fromPort) {
    switch (message.type) {
        case Constants.INIT: {
            this._initConnection(message, fromPort);

            break;
        }

        // This cases our similar except the actual handling.
        case Constants.MESSAGE:
        case Constants.RESPONSE: {
            // Validate input.
            if (!message.to) { Utils.log('error', '[BackgroundHub:_onPortMessageHandler]', 'Missing "to" in message:', message); }
            if (!message.toNames) { Utils.log('error', '[BackgroundHub:_onPortMessageHandler]', 'Missing "toNames" in message:', message); }

            // Background hub always acts as a relay of messages to appropriate connection.
            this._relayMessage(message, fromPort);

            break;
        }

        default: {
            Utils.log('error', '[BackgroundHub:_onPortMessageHandler]', 'Unknown message type: ' + message.type);
        }
    }
};

BackgroundHub.prototype._getPortsObj = function(extensionPart) {
    switch (extensionPart) {
        case Constants.BACKGROUND:
            return this._backgroundPorts;
        case Constants.CONTENT_SCRIPT:
            return this._contentScriptPorts;
        case Constants.POPUP:
            return this._popupPorts;
        case Constants.DEVTOOL:
            return this._devtoolPorts;
        default:
            Utils.log('error', '[BackgroundHub:_onPortDisconnectionHandler]', 'Unknown extension part: ' + extensionPart);
    }
};

BackgroundHub.prototype._initConnection = function(message, fromPort) {
    let doInit = function(extensionPart, id) {
        // 将新链接添加到 BackgroundHub 实例对应属性上
        let portsObj = this._getPortsObj(extensionPart);

        portsObj[id] = portsObj[id] ? portsObj[id] : [];
        portsObj[id].push(fromPort);

        // Invoke the user connected handler if given.
        // 执行用户注册的链接处理函数
        if (this._connectedHandler) {
            let tabId = extensionPart !== Constants.BACKGROUND ? id : null;
            let userPortName = Utils.removeMessengerPortNamePrefix(fromPort.name);
            // 扩展部分, 通道名称， tabId
            this._connectedHandler(extensionPart, userPortName, tabId);
        }

        // Send the init success message back to the sender port.
        // 通知通道对面初始化成功
        fromPort.postMessage({ from: Constants.BACKGROUND, type: Constants.INIT_SUCCESS });
    }.bind(this);

    if (message.from === Constants.BACKGROUND) {
        doInit(Constants.BACKGROUND, BACKGROUND_PORT_UID_KEY);
    } else if (message.from === Constants.DEVTOOL) {
        doInit(Constants.DEVTOOL, message.tabId);
    } else if (message.from === Constants.CONTENT_SCRIPT) {
        doInit(Constants.CONTENT_SCRIPT, fromPort.sender.tab.id);
    } else if (message.from === Constants.POPUP) {
        doInit(Constants.POPUP , message.tabId);
    } else {
        throw new Error('Unknown "from" in message: ' + message.from);
    }
};

// 转发：比如 popup 通过 background 通知 content_script， connectot.sendmessage({background:123,from:...,to:...})
// background 会根据 to 查找之前链接成功的 port，然后调用该 port.postmessage 转发消息
BackgroundHub.prototype._relayMessage = function(message, fromPort) {
    let from = message.from;
    let to = message.to;
    let toNames = message.toNames;

    // Will have value only for messages from background to other parts.
    let toTabId = message.toTabId;

    // Get the tab id of sender (not relevant in case sender is background to background).
    let tabId;
    if (from === Constants.BACKGROUND) {
        // With background to background messages, tabId is not relevant/necessary.
        if (to !== Constants.BACKGROUND) {
            tabId = toTabId;
        }
    } else if (from === Constants.DEVTOOL) {
        tabId = message.tabId;
    } else if (from === Constants.POPUP) {
        tabId = message.tabId;
    } else if (from === Constants.CONTENT_SCRIPT) {
        tabId = fromPort.sender.tab.id;
    } else {
        Utils.log('error', '[BackgroundHub:_relayMessage]', 'Unknown "from" in message: ' + from);
    }

    // Note: Important to store this on the message for responses from background which require the original tab id.
    message.fromTabId = tabId;

    // Get all connections ports according extension part.
    // NOTE: Port might not exist, it can happen when:
    // NOTE: - devtool window is not open.
    // NOTE: - content_script is not running because the page is of chrome:// type.
    let toPorts;
    if (to === Constants.BACKGROUND) {
        toPorts = this._backgroundPorts[BACKGROUND_PORT_UID_KEY] ? this._backgroundPorts[BACKGROUND_PORT_UID_KEY] : [];
    } else if (to === Constants.DEVTOOL) {
        toPorts = this._devtoolPorts[tabId] ? this._devtoolPorts[tabId] : [];
    } else if (to === Constants.POPUP) {
        toPorts = this._popupPorts[tabId] ? this._popupPorts[tabId] : [];
    } else if (to === Constants.CONTENT_SCRIPT) {
        toPorts = this._contentScriptPorts[tabId] ? this._contentScriptPorts[tabId] : [];
    } else {
        Utils.log('error', '[BackgroundHub:_relayMessage]', 'Unknown "to" in message: ' + to);
    }

    // Logging...
    if (toPorts.length === 0) { Utils.log('info', '[BackgroundHub:_relayMessage]', 'Not sending relay because "to" port does not exist'); }

    // Go over names and find all matching ports.
    let matchingToPorts = [];
    toNames.forEach(function(toName) {
        let matchedPorts = toPorts.filter(function(toPort) {
            return toPort.name === toName || toName === Constants.TO_NAME_WILDCARD;
        });

        if (matchedPorts.length > 0) {
            matchedPorts.forEach(function(matchedPort) {
                // Make sure to keep matching to ports unique in case someone gave both names and wildcard.
                if (matchingToPorts.indexOf(matchedPort) === -1) {
                    matchingToPorts.push(matchedPort);
                }
            });
        } else {
            Utils.log('warn', '[BackgroundHub:_relayMessage]', 'Could not find any connections with this name (probably no such name):', Utils.removeMessengerPortNamePrefix(toName));
        }
    }.bind(this));

    // NOTE: We store this on the message so it won't get lost when relying.
    message.fromPortSender = fromPort.sender;

    // Send the message/s.
    matchingToPorts.forEach(function(matchingToPort) {
        matchingToPort.postMessage(message);
    }.bind(this));
};

// 1. 取消消息监听
// 2. 从 hub 移除该 port
// 3. 执行用户注册的移除事件处理函数
BackgroundHub.prototype._onPortDisconnectionHandler = function(disconnectedPort) {
    // Remove our message listener.
    disconnectedPort.onMessage.removeListener(this._onPortMessageHandler);

    let removePort = function(extensionPart, disconnectedPort) {
        let portsObj = this._getPortsObj(extensionPart);

        // NOTE: portKeys is usually the tab ids (except for background).
        let portKeys = Object.keys(portsObj);
        for (let i = 0; i < portKeys.length; i++) {
            let currPortKey = portKeys[i];

            // Remove according matching port, traverse backward to be able to remove them on th go.
            let portsArr = portsObj[currPortKey];
            let portsArrLength = portsArr.length;
            for (var j = portsArrLength; j >= 0; j--) {
                let port = portsArr[j];
                if (port === disconnectedPort) {
                    Utils.log('log', '[BackgroundHub:_onPortDisconnectionHandler]', 'Remove connection of port with unique id: ', currPortKey);
                    portsArr.splice(j, 1);

                    // Invoke the user disconnected handler if given.
                    if (this._disconnectedHandler) {
                        // Lets pass the tab id for which this port was working for
                        // (and not the devtool sender tab id which is "-1").
                        // NOTE: Background ports are not identified by tab ids.
                        // NOTE: parseInt required since the object keys are strings.
                        let tabId = extensionPart !== Constants.BACKGROUND ? parseInt(currPortKey) : null;
                        let userPortName = Utils.removeMessengerPortNamePrefix(disconnectedPort.name);
                        this._disconnectedHandler(extensionPart, userPortName, tabId);
                    }
                }
            }

            // If all ports removed, remove it from our stored ports object and invoke disconnect handler if given.
            if (portsObj[currPortKey].length === 0) {
                Utils.log('log', '[BackgroundHub:_onPortDisconnectionHandler]', 'Removing empty ports object for unique id: ', currPortKey);
                delete portsObj[currPortKey];
            }
        }
    }.bind(this);

    // Attempt to remove from all our stored ports.
    removePort(Constants.BACKGROUND, disconnectedPort);
    removePort(Constants.CONTENT_SCRIPT, disconnectedPort);
    removePort(Constants.POPUP, disconnectedPort);
    removePort(Constants.DEVTOOL, disconnectedPort);
};

// ------------------------------------------------------------
// Private methods - end.
// ------------------------------------------------------------

export default BackgroundHub;