/*
 * @Descripttion: 异步缓冲队列，异步队列只允许一定数量的异步处于执行中，一旦某个异步完成就执行处于等待中的异步任务。
 * 关键点：
 * 1. 在finally与定时器结合使用，先将任务结果返回给用户的then回调，然后执行等待中的异步任务
 * 2. promise的resolve可以提供给用户改变该promise的状态，resolve.bind(this)
 * 3. 可以为某个promise添加多个订阅者promise，等这个promise状态变化之后，利用finally并行执行多个额外任务
 * 4. _runNextTask的递归执行，刷新等待队列
 * @Author: lhuanyu
 * @Date: 2020-04-14 13:39:24
 * @LastEditors: lhuanyu
 * @LastEditTime: 2020-04-15 17:53:04
 */
class PromiseManager {
  constructor(threshold, timeout = 20000){
    this.threshold = threshold
    this.rest = threshold  // 还能直接执行多少个task
    this.readyToRun = []   // 存储等待执行的task，是一个队列，先进先出
    this.result = []       // 存储已经执行返回的结果
    this.timeout = timeout
    this._afterTaskCompletedChanged = this._afterTaskCompletedChanged.bind(this)
    this.stopWaitingPromiseFromNow = this.stopWaitingPromiseFromNow.bind(this)
    this.wakeUp = this.wakeUp.bind(this)
    this._stopFromNow = false
  }
  /**
   * 用于用户暂停或者恢复等待中的task的执行
   * @param {*} value
   */
  stopWaitingPromiseFromNow(){
    this._stopFromNow = true
    return this.result
  }

  /**
   * 用于用户暂停或者恢复等待中的task的执行
   * @param {*} value
   */  
  wakeUp(){
    if(this.rest === this.threshold && this._stopFromNow){
      this._stopFromNow = false
      this.rest--
      // 如果没有等待中的任务，那么下面的函数什么都不会做。
      this._runNextTask()
    }
    return this.result
  }

  /**
   * 任务执行完成之后： 收集task执行后的结果保存到this.result中
   * @param {*} value 
   */
  _afterTaskCompletedChanged(value){
    this.result.push(value)
    // 用了定时器来保证了，addTask返回的promise的then的回调先执行，然后再执行下一个等待中的task
    setTimeout(this._runNextTask.bind(this), 0)
    // 这里是为addTask的then回调返回value
    return value
  }
  /**
   * 用setTimeout伪中断task
   * @param {*} task 
   * @param {*} timeout 
   */
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
  /**
   * 添加任务，不能立即执行的添加到等待队列，能立即执行的直接执行，执行完成之后自动执行下一个等待任务
   * @param {*} {task, timeout} task需要执行的任务，timeout为此任务的超时时间
   */
  addTask({task, timeout}){
    if(this.rest > 0){
      return new Promise((resolve, reject) =>{
        // 直接执行task，rest减少一个，this.rest表示还能直接执行几个task
        this.rest--
        resolve(this._promiseWithTimeout(task, timeout))
      }).then(this._afterTaskCompletedChanged, this._afterTaskCompletedChanged)
      // .finally(
      //   // task执行的时候会返回一个promise，这个被作为resolve的参数执行
      //   // finally会等这个promise状态变化之后执行传入的回调函数，来从promise队列中取出一个task来执行
      //   // finally会先执行，然后执行addTash返回的promise的then的回调，并且接收到的值是task()返回的promise的值。
      //   // finally方法总是会返回原来的值：https://es6.ruanyifeng.com/#docs/promise#Promise-prototype-finally
      //   // 这里有两个点需要注意：
      //   //  1. 传入的是箭头函数，解决this问题
      //   //  2. 用了定时器来保证了，addTask返回的promise的then的回调先执行，然后再执行下一个等待中的task
      //     () => {
            
      //     }
      //   )
    }else{
      return new Promise((resolve, reject) =>{
        // 这里resolve.bind(this)是为了与当前promise实例绑定，执行的时候resolve改变的promise实例就是这个this指向的promise，也就是new出来的
        // 原理可以看promise中_resolve的实现
        this.readyToRun.push({task, resolve: resolve.bind(this), timeout})
      })
    }
  }
  /**
   * 内部执行器，取一个等待队列执行
   */
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
}

let runner = new PromiseManager(3)

let taskFactory = function(time, msg){
  return new Promise((r) => {
    setTimeout(() => {
      r(msg)
    }, time)
  })
}
console.log('start', performance.now())
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