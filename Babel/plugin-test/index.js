require = require('esm')(module /*, options*/);

// https://juejin.im/post/5d94bfbf5188256db95589be#heading-1
// babel-core中内置的@babel/parser用于解析代码成为一个ast
// @babel/traverse来遍历这个ast并第二个参数可以直接修改这个ast，在修改的过程中，可以借助@babel/types中的辅助方法，简化修改过程
// 修改后的ast可以用@babel/generator来生成对应的代码

const str1 = "a + b"
const str2 = `function square(n) {
    return n * n;
  }`;

const apis = new Set(["addCard","addInterceptor","addPhoneContact","advancedGeneralIdentify"])

const core = require("@babel/core")
// parse字符串：babel7使用transformSync
// const result = core.transformSync(str2, {
//     plugins: [
//       // ["./plugin-test.js"],
//       ["./babel-plugin-transform-taro-api.js",{
//           apis,
//           packageName: '@tarojs/taro-h5'
//       }]]
// });
// console.log(result)

// parse文件
const result1 = core.transformFileSync('./file2parse.js', {
  plugins: [
    // ["./plugin-test.js"],
    ["./babel-plugin-transform-taro-api.js",{
        apis,
        packageName: '@tarojs/taro-h5'
    }]]
});
console.log(result1)

