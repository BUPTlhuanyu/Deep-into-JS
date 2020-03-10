/*
 * @Descripttion: 
 * @Author: lhuanyu
 * @Date: 2020-03-04 13:28:33
 * @LastEditors: lhuanyu
 * @LastEditTime: 2020-03-10 15:22:11
 */
// 关键点： 
// 1. 发布订阅者模式

const isFunction = (fn) => {
  return typeof fn === 'function'
}

const RESOLVED = 'resolved'
const PENDING = 'pending'
const REJECTED = 'rejected'

class DeepIntoPromise {
  constructor(fn){
    this.PromiseStatus = PENDING
    this.PromiseValue = undefined
    this.resolvedFn = []
    this.rejectedFn = []
    if(isFunction(fn)){
      fn(this._resolve.bind(this), this._reject.bind(this))
    }
  }

  _resolve(arg){
    if (this.PromiseStatus !== PENDING) return
    let runResolveFn = () => {
        let resolvedFn
        while (resolvedFn = this.resolvedFn.shift()) {
          resolvedFn(arg)
        }  
    }
    let runRejectFn = () => {
        let rejectedFn
        while (rejectedFn = this.rejectedFn.shift()) {
          rejectedFn(arg)
        }  
    }
    if(arg instanceof DeepIntoPromise){
        arg.then( argValue => {
            this.PromiseStatus = RESOLVED
            this.PromiseValue = argValue
            runResolveFn(argValue)
        }, argError => {
            this.PromiseStatus = REJECTED
            this.PromiseValue = argError
            runRejectFn(argError)
        })            
    }else{
        this.PromiseStatus = RESOLVED
        this.PromiseValue = arg
        runResolveFn(arg)
    }
  }

  _reject(arg){
    if (this.PromiseStatus !== PENDING) return
    this.PromiseStatus = REJECTED
    this.PromiseValue = arg
    let rejectedFn
    while (rejectedFn = this.rejectedFn.shift()) {
      rejectedFn(arg)
    }
  }

    // 添加静态 resolve方法
    static resolve (value) {
      // 如果参数是MyPromise实例，直接返回这个实例
      if (value instanceof DeepIntoPromise) return value
      return new DeepIntoPromise(resolve => resolve(value))
    }

        // 添加静态 reject方法
    static reject (value) {
      return new DeepIntoPromise((resolve, reject) => reject(value))
    }

  
  /**
   * 只要有一个reject，那么返回的DeepIntoPromises实例的状态就变成rejected，该实例的catch回调接收的参数是第一个reject返回的数据
   * 所有的都resolve之后，返回的DeepIntoPromises实例的状态才会变成resolved，该实例的then回调接收的参数是resolve返回的数据数组
   * @param {*} list 
   * @returns {DeepIntoPromise} DeepIntoPromises实例
   */
  static all(list){
        return new DeepIntoPromise((resolve, reject) => {
          let values = []
          let count = 0
          for(let [i, p] of list.entries()){
             DeepIntoPromise.resolve(p).then((res) => {
                values[i] = res
                count++
                // 所有状态都变成fulfilled时返回的MyPromise状态就变成fulfilled
                if (count === list.length) resolve(values)
             }, (err) => {
                reject(err)
             })
          }
        })
  }

  /**
   * 只要有一个resolve，那么返回的DeepIntoPromises实例的状态就变成resolved，该实例的then回调接收的参数是第一个resolve返回的数据
   * 所有的都reject之后，返回的DeepIntoPromises实例的状态才会变成rejected，该实例的then回调接收的参数是reject返回的错误数组
   * @param {*} list 
   * @returns {DeepIntoPromise} DeepIntoPromises实例
   */
  static any(list){
    return new DeepIntoPromise((resolve, reject) => {
      let values = []
      let count = 0
      for(let [i, p] of list.entries()){
         DeepIntoPromise.resolve(p).then((res) => {
            resolve(res)
         }, (err) => {
            values[i] = err
            count++
            // 所有状态都变成fulfilled时返回的MyPromise状态就变成fulfilled
            if (count === list.length) reject(values)
         })
      }
    })
  }

  /**
   * 只要有一个状态变化了，那么返回的DeepIntoPromises实例状态就会变化
   * @param {*} list
   * @returns {DeepIntoPromise} DeepIntoPromises实例 
   */
  static race(list){
      return new DeepIntoPromise((resolve, reject) => {
          for(let p of list){
             DeepIntoPromise.resolve(p).then((res) => {
                resolve(res)
             }, (err) => {
                reject(err)
             })
          }
      })
  }

  /**
   * 所有的状态变化之后，返回的DeepIntoPromises实例状态才会变化，并且始终是resolved，也就是返回的所有值都会传入then回调
   * [
   *    {status: 'resolved' | 'rejected', value: any},
   *    {status: 'resolved' | 'rejected', reason: any}
   * ]
   * @param {*} list
   * @returns {DeepIntoPromise} DeepIntoPromises实例 
   */
  static allSettled(list){
    let count = 0
    let result = []
    let len = list.length
    return new DeepIntoPromise((resolve, reject) => {
        for(let [i, p] of list.entries()){
           DeepIntoPromise.resolve(p).then((res) => {
              count++
              result[i] = {status: 'resolved', value: res}
              if(count === len) resolve(result)
           }, (err) => {
              count++
              result[i] = {status: 'rejected', reason: err}
              if(count === len) resolve(result)
           })
        }
    })
  }

  then(resolvedFn, rejectedFn){
    // console.log(this)
    const { PromiseValue, PromiseStatus } = this    
    // 返回新的promise实例， 这里的resolvedFn返回的值应该传递给这个新的实例的then回调
    // 关键是如何传递呢？需要抓住一个关键点： promise构造函数传入的函数是立即执行的，并且这个新的实例的then也是根据该实例是否调用resolve来实现的。        
    return new DeepIntoPromise((resolve, reject) => {
        let oldPromiseResolvedFn = value => {
            try{
                if(isFunction(resolvedFn)){
                    let res =  resolvedFn(value);
                    if(res instanceof DeepIntoPromise){
                        res.then(resolve, reject)
                    }else{
                        resolve(res)
                    }                    
                }else{
                    resolve(PromiseValue)
                }                
            }catch(err){
                reject(err)
            }
        }
        let oldPromiseRejectedFn = value => {  
            try{
                if(isFunction(rejectedFn)){
                    let res =  rejectedFn(value);
                    if(res instanceof DeepIntoPromise){
                        res.then(resolve, reject)
                    }else{
                        resolve(res)
                    }                   
                }else{
                    reject(PromiseValue)
                }                
            }catch(err){
                reject(err)
            }                  
        }
                 
        switch(PromiseStatus){
            // 如果当前实例已经 resolve了，那么直接执行 resolvedFn         
            case RESOLVED: {
                oldPromiseResolvedFn(PromiseValue)   
                break;
            }
            // 如果当前实例已经 reject了，那么直接执行 rejectedFn
            case REJECTED: {
                oldPromiseRejectedFn(PromiseValue)
                break;
            }
            case PENDING: {
                this.resolvedFn.push(oldPromiseResolvedFn)
                this.rejectedFn.push(oldPromiseRejectedFn)
                break;
            }
        }        
    })
  }

  catch (onRejected) {
    return this.then(undefined, onRejected)
  }
}

function thenHan(res){
  console.log('then', res)
}
function catchHan(res){
  console.log('catch', res)
}

const p1 = DeepIntoPromise.resolve('p1')
const p2 = DeepIntoPromise.resolve('p2')
DeepIntoPromise.all([p1, p2]).then(thenHan).catch(catchHan)

const p3 = DeepIntoPromise.resolve('p3')
const p4 = DeepIntoPromise.reject('p4')
DeepIntoPromise.all([p3, p4]).then(thenHan).catch(catchHan)

const p5 = DeepIntoPromise.resolve('p5')
const p6 = DeepIntoPromise.reject('p6')
DeepIntoPromise.any([p5, p6]).then(thenHan).catch(catchHan)

const p7 = DeepIntoPromise.reject('p7')
const p8 = DeepIntoPromise.reject('p8')
DeepIntoPromise.any([p7, p8]).then(thenHan).catch(catchHan)

const p9 = DeepIntoPromise.resolve('p9')
const p10 = DeepIntoPromise.reject('p10')
DeepIntoPromise.race([p9, p10]).then(thenHan).catch(catchHan)

const p11 = DeepIntoPromise.resolve('p11')
const p12 = DeepIntoPromise.reject('p12')
DeepIntoPromise.allSettled([p11, p12]).then(thenHan).catch(catchHan)

// const d1 = new DeepIntoPromise((resolve, reject) => {
//   setTimeout(() => {resolve(100)}, 2000)
// }).then((value) => {console.log('1', value); return new DeepIntoPromise((resolve, reject) => {
//   setTimeout(() => {resolve(200)}, 3000)
// })}).then((value) => {console.log('2', value)})

// const d2 = new DeepIntoPromise((resolve, reject) => {
//   reject(100)
// }).catch( (value) => {console.log('2', value)})