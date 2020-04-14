/*
 * @Descripttion: 异步缓冲队列，异步队列只允许一定数量的异步处于执行中，一旦某个异步完成就执行处于等待中的异步任务。
 * 关键点：
 * 1. 在finally与定时器结合使用，先将任务结果返回给用户的then回调，然后执行等待中的异步任务
 * 2. promise的resolve可以提供给用户改变该promise的状态，resolve.bind(this)
 * 3. 可以为某个promise添加多个订阅者promise，等这个promise状态变化之后，利用finally并行执行多个额外任务
 * 4. runNextTask的递归执行，刷新等待队列
 * @Author: lhuanyu
 * @Date: 2020-04-14 13:39:24
 * @LastEditors: lhuanyu
 * @LastEditTime: 2020-04-14 18:00:57
 */
class PromiseManager {
  constructor(threshold){
    this.threshold = threshold
    this.rest = threshold  // 还能直接执行多少个task
    this.readyToRun = []   // 存储等待执行的task，是一个队列，先进先出
  }
  addTask(task){
    if(this.rest > 0){
      return new Promise((resolve) =>{
        // 直接执行task，rest减少一个，this.rest表示还能直接执行几个task
        this.rest--
        resolve(task())
      }).finally(
        // task执行的时候会返回一个promise，这个被作为resolve的参数执行
        // finally会等这个promise状态变化之后执行传入的回调函数，来从promise队列中取出一个task来执行
        // finally会先执行，然后执行addTash返回的promise的then的回调，并且接收到的值是task()返回的promise的值。
        // finally方法总是会返回原来的值：https://es6.ruanyifeng.com/#docs/promise#Promise-prototype-finally
        // 这里有两个点需要注意：
        //  1. 传入的是箭头函数，解决this问题
        //  2. 用了定时器来保证了，addTash返回的promise的then的回调先执行，然后再执行下一个等待中的task
          () => {setTimeout(this.runNextTask.bind(this), 0)}
        )
    }else{
      console.log('this.rest <= 0')
      return new Promise((resolve, reject) =>{
        // 这里resolve.bind(this)是为了与当前promise实例绑定，执行的时候resolve改变的promise实例就是这个this指向的promise，也就是new出来的
        // 原理可以看promise中_resolve的实现
        this.readyToRun.push([task, resolve.bind(this)])
      })
    }
  }
  runNextTask(){
    // task状态变化了，那么增加一个直接执行task的名额
    this.rest++
    console.log('runNextTask')
    // 如果等待执行的task列表不为空
    if(this.readyToRun.length > 0){
        //console.log(this.readyToRun.length)
        //取出队列中的一个task执行
        let item = this.readyToRun.shift()
        if(item){
          console.log('readyToRun run')
          this.rest--
          // 执行task
          let result = item[0]()
          // 改变之前addTask将task添加到this.readyToRun的那个promise的状态
          item[1](result)
          // 在task返回的promise的状态变化之后，执行下一个task
          return new Promise((resolve) =>{
            resolve(result)
          }).finally(this.runNextTask.bind(this))          
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

runner.addTask(taskFactory.bind(null, 3000, 1)).then(data => {
  console.log(data)
})
runner.addTask(taskFactory.bind(null, 3000, 2)).then(data => {
  console.log(data)
})
runner.addTask(taskFactory.bind(null, 3000, 3)).then(data => {
  console.log(data)
})
runner.addTask(taskFactory.bind(null, 3000, 4)).then(data => {
  console.log(data)
})
runner.addTask(taskFactory.bind(null, 3000, 5)).then(data => {
  console.log(data)
})
runner.addTask(taskFactory.bind(null, 3000, 6)).then(data => {
  console.log(data)
})
runner.addTask(taskFactory.bind(null, 1000, 7)).then(data => {
  console.log(data)
})

