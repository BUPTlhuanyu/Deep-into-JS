(function (global, schedulerFactory) {
    global.scheduler = schedulerFactory();
})(this, function () {
    /* 工具函数 */
    const hasNativePerformanceNow =
        typeof performance === 'object' && typeof performance.now === 'function';
    const localDate = Date;
    let getCurrentTime;
    if (hasNativePerformanceNow) {
        const Performance = performance;
        getCurrentTime = function() {
            return Performance.now();
        };
    } else {
        getCurrentTime = function() {
            return localDate.now();
        };
    }

    /* 优先级 */
    const ImmediatePriority = 1;
    const UserBlockingPriority = 2;
    const NormalPriority = 3;
    const LowPriority = 4;
    const IdlePriority = 5;

    const IMMEDIATE_PRIORITY_TIMEOUT = -1;
    const USER_BLOCKING_PRIORITY_TIMEOUT = 250;
    const NORMAL_PRIORITY_TIMEOUT = 5000;
    const LOW_PRIORITY_TIMEOUT = 10000;
    const IDLE_PRIORITY_TIMEOUT = 1073741823;

    /* 最小堆 */
    // 数组中已知当前节点下标为 index，那么左子节点为2*index+1，右子节点为2*index+2，父节点为Math.floor((index - 1)/2)
    function push(heap, node) {
        if (!Array.isArray(heap)) {
            return false;
        }
        let index = heap.length;
        heap.push(node);
        siftUp(heap, node, index);
    }

    function pop(heap) {
        if (!Array.isArray(heap)) {
            return null;
        }
        const first = heap[0];
        if (typeof first !== 'undefined') {
            // 将最后一个节点替换到第一个节点的位置，然后将第一个节点下沉(满足节点是其子树的最小值即可)
            const last = heap.pop();
            if (last !== first) {
                heap[0] = last;
                siftDown(heap, node, 0);
            }
            return first;
        } else {
            return null;
        }
    }

    function peek(heap) {
        if (!Array.isArray(heap)) {
            return false;
        }
        const first = heap[0];
        return first === undefined ? null : first;
    }

    function siftUp(heap, node, i) {
        let index = i;
        while (true) {
            const parentIndex = (ihndex - 1) >>> 1; // Math.floor((index -1)/2)
            const parent = heap[parentIndex];
            if (typeof parent !== 'undefined' && canSwap(node, parent)) {
                heap[parentIndex] = node;
                heap[index] = parent;
                index = parentIndex;
            } else {
                return;
            }
        }
    }

    function siftDown(heap, node, i) {
        const length = heap.length;
        let index = i;
        while (index < length) {
            const leftIndex = 2 * index + 1;
            const leftNode = heap[leftIndex];
            const rightIndex = 2 * index + 2;
            const rightNode = heap[rightIndex];

            if (typeof leftNode !== 'undefined' && canSwap(leftNode, node)) {
                if (typeof rightNode !== 'undefined' && canSwap(rightNode, leftNode)) {
                    heap[index] = rightNode;
                    heap[rightIndex] = node;
                    index = rightIndex;
                } else {
                    heap[index] = leftNode;
                    heap[leftIndex] = node;
                    index = leftIndex;
                }
            } else if (typeof rightNode !== 'undefined' && canSwap(rightNode, node)) {
                heap[index] = rightNode;
                heap[rightIndex] = node;
                index = rightIndex;
            } else {
                return;
            }
        }
    }

    /**
     * 返回是否交换节点
     * @param {*} a 子节点/左节点
     * @param {*} b 父节点/右节点
     * @param {*} min 最小堆
     * @returns
     */
    function canSwap(a, b, min = true) {
        const diffSortIndex = a.sortIndex - b.sortIndex;
        const diff = diffSortIndex !== 0 ? diffSortIndex : a.sortIndex - b.sortIndex;
        return min ? diff < 0 : diff > 0;
    }

    /* scheduleCallback */
    function scheduleCallback(priorityLevel, callback, options) {
        const currentTime = getCurrentTime();

        let startTime;
        if (typeof options === "object" && options !== null) {
          var delay = options.delay;
          if (typeof delay === "number" && delay > 0) {
            startTime = currentTime + delay;
          } else {
            startTime = currentTime;
          }
        } else {
          startTime = currentTime;
        }
      
        var timeout;
        switch (priorityLevel) {
          case ImmediatePriority:
            timeout = IMMEDIATE_PRIORITY_TIMEOUT;
            break;
          case UserBlockingPriority:
            timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
            break;
          case IdlePriority:
            timeout = IDLE_PRIORITY_TIMEOUT;
            break;
          case LowPriority:
            timeout = LOW_PRIORITY_TIMEOUT;
            break;
          case NormalPriority:
          default:
            timeout = NORMAL_PRIORITY_TIMEOUT;
            break;
        }
      
        var expirationTime = startTime + timeout;
      
        var newTask = {
          id: taskIdCounter++,
          callback,
          priorityLevel,
          startTime,
          expirationTime,
          sortIndex: -1,
        };
      
        if (startTime > currentTime) {
          newTask.sortIndex = startTime;
          push(timerQueue, newTask);
          if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
            if (isHostTimeoutScheduled) {
              cancelHostTimeout();
            } else {
              isHostTimeoutScheduled = true;
            }
            requestHostTimeout(handleTimeout, startTime - currentTime);
          }
        } else {
          newTask.sortIndex = expirationTime;
          push(taskQueue, newTask);
      
          if (!isHostCallbackScheduled && !isPerformingWork) {
            isHostCallbackScheduled = true;
            requestHostCallback(flushWork);
          }
        }
      
        return newTask;
    }

    return {
        scheduleCallback
    };
});
