/*
 * @Descripttion: 
 * @Author: lhuanyu
 * @Date: 2020-03-04 13:28:33
 * @LastEditors: lhuanyu
 * @LastEditTime: 2020-03-04 16:49:06
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
        runResolveFn(argValue)
    }
  }

  _reject(arg){
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
      return new DeepIntoPromise(resolve => reject(value))
    }

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

  then(resolvedFn, rejectedFn){
    console.log(this)
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
                if(isFunction(resolvedFn)){
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
}

const d1 = new DeepIntoPromise((resolve, reject) => {
  setTimeout(() => {resolve(100)}, 2000)
}).then((value) => {console.log('1', value); return new DeepIntoPromise((resolve, reject) => {
  setTimeout(() => {resolve(200)}, 3000)
})}).then((value) => {console.log('2', value)})