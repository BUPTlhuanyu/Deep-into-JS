/**
 * 改变this的方式： 
 * 1. new操作构造函数改变this 
 * 2. 显示绑定apply，call， bind
 * 3. 隐式绑定 obj.fn()  fn为普通函数的this指向obj，fn为箭头函数另算
 * 4. 默认绑定 fn()  fn为普通函数this指向全局对象，fn为箭头函数，箭头函数没有this，但是函数体内的this是静态作用域决定的，也就是指向定义的时候的作用域，对象不构成作用域
 */

 /**
  * new
  */
(function(){
    function newFn(fn, ...args){
        var obj = Object.create(null)
        Object.setPrototypeOf(obj, fn.prototype)
        let result = fn.apply(obj, args)
        return result instanceof Object? result : obj
    }


})()



/**
 * this的显示绑定方法call
 */
(function(){
    let call = Function.prototype.call;
    Function.prototype.call = function(){
        // var args = [].slice.call(arguments),  // 这里用[].slice.call会出现栈溢出，[].slice也是一个函数
        // var args = Array.from(arguments),   // 类数组数组化
        // for循环数组化
        var args = [...arguments], 
            context = args[0],
            fnArgs = args.slice(1)
        context.fn  = this
        result = context.fn(...fnArgs)
        delete context.fn
        return result
    }
    function fn(a, b){
        console.log(a, b)
        console.log(this.a)
    }
    let obj = {a: 1}
    fn.call(obj, 1, 2)
})()

/**
 * this的显示绑定方法apply
 */
(function(){
    let apply = Function.prototype.apply;
    Function.prototype.apply = function(){
        var context = arguments[0],
            fnArgs = arguments[1]
        context.fn  = this
        if(fnArgs){
            result = context.fn(...fnArgs)
        }else{
            result = context.fn()
        }
        delete context.fn
        return result
    }
    function fn(a, b, c){
        console.log(a, b, c)
        console.log(this.a)
    }
    let obj = {a: 1}
    fn.apply(obj, [1,2,3])
})()


/**
 * this的显示绑定方法bind
 */
(function(){
    let bind = Function.prototype.apply;
    Function.prototype.bind = function(){
        var args = [...arguments], 
            context = args[0],
            fnArgs = args.slice(1)
        function fn(){
            var newArgs = fnArgs.cancat([...arguments])
            if(this instanceof fn){
                let result = context.call(this, ...newArgs)
                return result
            }else{
                context.call(context, ...newArgs)
            }
            
        }
        return fn
    }
    function fn(a, b, c){
        console.log(a, b, c)
        console.log(this.a)
    }
    let obj = {a: 1}
    let newfn = fn.apply(obj, 1, 2)
    newfn(10)
})()