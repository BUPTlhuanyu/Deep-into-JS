const parser = require("@babel/parser");
const traverse = require("@babel/traverse")
const babelTypes = require("@babel/types")
const generate = require("@babel/generator").default
const template = require("@babel/template").default

const code = `function square(n) {
  return n * n;
}`;

let ast = parser.parse(code, {
    sourceType: 'module'
});

let node = babelTypes.binaryExpression("*", babelTypes.identifier('a'), babelTypes.identifier('b'))
// console.log('babelTypes', node)

function logOnceGen(){
    let active = true
    return function(path){
        if(active){
            active = false
            console.log(path)
        }
    }
}
let logOnce = logOnceGen()

// traverse会直接修改ast，没有返回值
traverse.default(ast, {
    enter(path){
        if (babelTypes.isIdentifier(path.node, { name: "n" })) {
            path.node.name = "x";
        }
        logOnce(path)
        // path.get('body').pushContainer(node)
    }
})
console.log(generate(ast).code);


/**
 * 利用template来构建一个模版生成器buildRequire，buildRequire传入的对象中，属性名称对应传入template字符串的变量，值为一个ast节点
 * 这个ast节点是由babel/types创建而来的，最后用generate将ast生成对应的代码对象，其中code为代码对应的字符串，map为源码映射
 */
const buildRequire = template(`
  var %%importName%% = require(%%source%%);
`);

const ast2 = buildRequire({
  importName: babelTypes.identifier("myModule"),
  source: babelTypes.stringLiteral("my-module"),
});

console.log(generate(ast2).code);
