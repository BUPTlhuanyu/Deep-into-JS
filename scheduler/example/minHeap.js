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
