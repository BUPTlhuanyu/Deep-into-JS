#### promise异步管理器需求分析
- [x]外部使用promise的方式不变，内部实现异步缓冲队列，一个promise异步任务返回的promise状态变化之后立即执行下一个等待中的异步任务。 
- [x]每个任务都有一个超时限制以及全局的超时限制，前者优先级大，没有设置超时限制的任务默认为全局的超时限制。
- [x]异步任务超时之后该task的then回调将接收不到addTask对应的promise返回的结果，而只会收到超时的提示。
- [x]收集每个异步任务的结果到this.result
- [x]通过实例stopWaitingPromiseFromNow来取消后续等待中的task的执行，比如前面的异步任务返回的结果达到了某个条件，那么就停止后面的所有任务的执行

#### API设计
1. PromiseManager.prototype.addTask(task: function, shouldTaskExecute: function)
2. PromiseManager.prototype._runNextTask()
