// 利用promise实现尝试三次发请求: any是并发的所以并不满足要求，如果要控制他的步骤还是async或者generator函数
function retryPro(fn, nums){
    Promise.any(Array.of(nums).fill(fn())).then(res => console.log(res)).catch(errors => console.log(errors))
}

// 利用async实现尝试三次发请求
async function retry(fn, nums){
    let errors = []
    let res = null
    for(let i = 0; i < nums; i++){
        // try...catch会拦截异步的错误
        try{ 
            // 只有在fn的状态为resolved的时候，res被赋值的操作才会执行，并且res的值等于这个异步resolve返回的值
            res = await fn()
            console.log('res', res)
            break;
        }catch(err){
            errors.push(err)
        }
    }
    if(res)return res //返回第一次成功resolve的值
    if(errors.length === nums){
        // 返回错误原因
        return errors
    }
    
}
// async函数返回一个promise
retry(()=>{
     return new Promise((resolve, reject) => {
        setTimeout(() => {
            let rand = Math.random()
            console.log('rand', rand)
            rand > 0.3? resolve(1000) : reject(1000)
        }, 4000)
    })
}, 3).then(e => console.log(e))
