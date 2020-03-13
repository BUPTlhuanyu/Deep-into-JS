// async的yield实现方法： 具有自执行能力的generator函数
function async(args){
    return spawn(
        function*(){
            yield 1
            yield 2
        }
    )
}

function spawn(genF){
    return new Promise((resolve, reject) => {
        let gen = genF()
        function step(nextYieldFn){
            try{
                yieldResult = nextYieldFn()
            }catch(err){
                reject(err)
            }
            if(yieldResult.done){return resolve(yieldResult.value)}
            Promise.resolve(yieldResult.value).then((res) => {
                setp(function() { return gen.next(res) })
            },(err) => {
                step(function() { return gen.throw(err) })
            })

        }
        step(function(){ return gen.next(undefined) })
    })
}
