![](https://user-gold-cdn.xitu.io/2019/6/20/16b72e8c47b361fe?w=1200&h=797&f=jpeg&s=296122)

- [react相关库源码浅析](https://github.com/BUPTlhuanyu/ReactNote)
- [源码PromiseManager](https://github.com/BUPTlhuanyu/Deep-into-JS/blob/master/%E5%BC%82%E6%AD%A5%E6%B5%81%E7%A8%8B%E7%AE%A1%E7%90%86/%E5%B8%B8%E8%A7%81%E9%97%AE%E9%A2%98/PromiseManager.js)

## promise异步缓冲器需求分析
- [x] 外部使用promise的方式不变，内部实现异步缓冲队列，一个promise异步任务返回的promise状态变化之后立即执行下一个等待中的异步任务。 
- [x] 每个任务都有一个超时限制以及全局的超时限制，前者优先级大，没有设置超时限制的任务默认为全局的超时限制。
- [x] 异步任务超时之后该task的then回调将接收不到addTask对应的promise返回的结果，而只会收到超时的提示。
- [x] 收集每个异步任务的结果到this.result
- [x] 通过实例stopWaitingPromiseFromNow来取消后续等待中的task的执行，比如前面的异步任务返回的结果达到了某个条件，那么就停止后面的所有任务的执行

## 关键点
1. event loop机制
2. new Promise中的resolve.bind(this)的this指向
3. 将new Promise中的resolve.bind(this)作为订阅者，在任意时刻发布消息，resolve.bind(this)执行，从而改变对应promise实例的状态。resolve与promise状态也是一种发布订阅模式。

## 目标
```
let runner = new PromiseManager(3)

let taskFactory = function(time, msg){
  return new Promise((r) => {
    setTimeout(() => {
      r(msg)
    }, time)
  })
}
runner.addTask({task: taskFactory.bind(null, 1000, 1)}).then(data => {
  console.log(data, performance.now())
})
runner.addTask({task: taskFactory.bind(null, 2000, 2)}).then(data => {
  console.log(data, performance.now())
})
runner.addTask({task: taskFactory.bind(null, 3000, 3)}).then(data => {
  console.log(data, performance.now())
  runner.stopWaitingPromiseFromNow()
})
runner.addTask({task: taskFactory.bind(null, 3000, 4)}).then(data => {
  console.log(data, performance.now())
})
runner.addTask({task: taskFactory.bind(null, 5000, 5)}).then(data => {
  console.log(data, performance.now())
})
runner.addTask({task: taskFactory.bind(null, 2000, 6)}).then(data => {
  console.log(data, performance.now())
})
runner.addTask({task: taskFactory.bind(null, 1000, 7)}).then(data => {
  console.log(data, performance.now())
})

setTimeout(()=> {
  runner.wakeUp()
}, 15000)
```
一次性发布7个异步任务，异步缓冲队列为3，某个异步执行任务完成则从等待的异步任务中挑选一个执行,并且支持暂停与恢复。

> 执行结果
```
start 30886539.240000002
1 30888421.780000005
2 30889422.125000004
3 30890421.220000003
4 30891422.245
6 30892421.745000005
5 30894423.495
7 30903421.960000005
```

## 关键API
#### PromiseManager.prototype.addTask({task, timeout})
```
  addTask({task, timeout}){
    if(this.rest > 0){
      return new Promise((resolve, reject) =>{
        this.rest--
        resolve(this._promiseWithTimeout(task, timeout))
      }).then(this._afterTaskCompletedChanged, this._afterTaskCompletedChanged)
    }else{
      return new Promise((resolve, reject) =>{
        // 这里resolve.bind(this)是为了与当前promise实例绑定，执行的时候resolve改变的promise实例就是这个this指向的promise，也就是new出来的
        // 原理可以看promise中_resolve的实现
        this.readyToRun.push({task, resolve: resolve.bind(this), timeout})
      })
    }
  }
```
从最简单的功能来实现：不管缓冲队列是否满了，都应该返回一个promise
> 直接执行的异步任务比较简单
异步任务返回的promise状态变化之后，执行_afterTaskCompletedChanged，该内部函数会收集这个promise返回的值到this.result中，接着设置一个定时器，其回调函数是this._runNextTask.bind(this)，该函数目的是从等待队列中取出一个等待执行的异步task，然后执行该task(异步处理：在task返回的promise状态改变之后，利用resolve.bind(this)改变之前addTask返回的promise的状态)。最后task返回的promise返回的值返回给addTask的then或者catch回调中。

这里要用定时器是为了确保addTask返回的promise的then回调先执行，然后再执行下一个等待中的task。
> 如果不能直接执行
对于不能直接执行的异步任务，push到待执行的异步任务队列this.readyToRun中，关键的关键是这里的resolve.bind(this)，这里的this指向new Promise的实例，实现过promise的应该都知道，原理如下：
```
  constructor(fn){
    this.PromiseStatus = PENDING
    this.PromiseValue = undefined
    this.resolvedFn = []
    this.rejectedFn = []
    if(isFunction(fn)){
      fn(this._resolve.bind(this), this._reject.bind(this))
    }
  }
```
resolve.bind(this)在后续的_runNextTask中会被调用，从而改变addTask返回的promise的状态。

#### 内部函数_afterTaskCompletedChanged
用于收集异步任务返回的promise的结果以及从等待队列中取出等待的异步任务执行，然后将异步任务返回的promise的结果返回给addTask返回的promise的then回调。
```
  _afterTaskCompletedChanged(value){
    this.result.push(value)
    // 用了定时器来保证了，addTask返回的promise的then的回调先执行，然后再执行下一个等待中的task
    setTimeout(this._runNextTask.bind(this), 0)
    // 这里是为addTask的then回调返回value
    return value
  }
```

#### 内部函数_runNextTask
```
  _runNextTask(){ 
    // task状态变化了，那么增加一个直接执行task的名额
    this.rest++
    if(this._stopFromNow)return 
    // 如果等待执行的task列表不为空
    if(this.readyToRun.length > 0){
        //console.log(this.readyToRun.length)
        //取出队列中的一个task执行
        let item = this.readyToRun.shift()
        if(item){
          this.rest--
          // 在task返回的promise的状态变化之后，执行下一个task
          return new Promise((resolve) =>{
            let {task, resolve: itemResolve, timeout} = item
            resolve(
              this._promiseWithTimeout(
                () => {
                  // 执行task
                  let result = task()
                  // 改变之前addTask将task添加到this.readyToRun的那个promise的状态
                  itemResolve(result)
                  // 必须返回result，这个由task返回的promise
                  return result
                },
                timeout
              )
            )
          }).then(this._afterTaskCompletedChanged, this._afterTaskCompletedChanged)          
        }        
    }
  }
```
_runNextTask会在task状态改变之后递归调用自己，直到所有等待的任务都执行掉

#### 内部函数_promiseWithTimeout
```
  _promiseWithTimeout(task, timeout = this.timeout){
    let taskPromise, timerId = null
    if(typeof task === 'function'){
      taskPromise = task() 
    }else{
      taskPromise = Promise.resolve(task)
    }
    let timeoutPromise = new Promise((resolve) => {
      timerId = setTimeout(() => {
        resolve('超时了')
      }, timeout)
    })
    return Promise.race([taskPromise, timeoutPromise]).finally(() => {
      clearTimeout(timerId)
      timerId = null
    })
  }
```
利用定时器对异步任务task做伪中断操作。

#### stopWaitingPromiseFromNow
用于停止从等待的异步任务队列中取出任务执行的操作，并返回已经完成的异步任务的结果。
```
  stopWaitingPromiseFromNow(){
    this._stopFromNow = true
    return this.result
  }
```

#### wakeUp
恢复从等待的异步任务队列中取出任务执行的操作。
```
  wakeUp(){
    if(this.rest === this.threshold && this._stopFromNow){
      this._stopFromNow = false
      this.rest--
      // 如果没有等待中的任务，那么下面的函数什么都不会做。
      this._runNextTask()
    }
    return this.result
  }
```