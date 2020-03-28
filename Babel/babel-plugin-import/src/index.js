import assert from 'assert';
import Plugin from './Plugin';

/**
 * types相当于babel/types的功能，提供一些便捷的工具方法，提供判断ast的节点类型以及操作ast节点的api
 * @param {*} param0 
 * @returns {visitor: {Program: (path, opts) => void, [key in methods]: (path, opts) => void}}
 * 1. 首先创建Program方法用于遍历ast的根节点
 *    该方法的作用：进入根节点的时候如果plugins还没有初始化则会初始化plugins，该plugins中的每个plugin通过new Plugin来生成。
 *                然后执行plugins中的每个plugin的ProgramEnter方法。
 *                退出根节点的时候，执行plugins中的每个plugin的ProgramExit
 * 2. 将Program作为visitor对象的一个属性
 * 3. 为visitor添加methods列表中的对应属性的方法
 * 4. 返回对象{visitor:{Program,ImportDeclaration: function(){},...}}
 */
export default function ({ types }) {
  let plugins = null;

  // Only for test
  global.__clearBabelAntdPlugin = () => {
    plugins = null;
  };

  function applyInstance(method, args, context) {
    for (const plugin of plugins) {
      if (plugin[method]) {
        plugin[method].apply(plugin, [...args, context]);
      }
    }
  }

  const Program = {
    // 在进入一个代码块的时候，会为babel-plugin-import的options中每个需要按需导入的组件库初始化生成一个plugin。
    // webpack中做了模块化的处理，所以用到了babel-loader，每次遇到一个模块都会用babel-loader处理
    // TODO： babel-loader输入的是ast还是模块字符串
    enter(path, { opts = {} }) {
      // opts是在配置babelrc的时候，babel-plugin-import对应的options
      // {
      //   "plugins": [["import", options]]
      // }
      // Init plugin instances once.
      if (!plugins) {
        if (Array.isArray(opts)) {
          // {
          //   "libraryName": "antd",
          //   "style": true,   // or 'css'
          // }
          // 如果只需要按需处理一个opts，
          plugins = opts.map(({
            libraryName,
            libraryDirectory,
            style,
            styleLibraryDirectory,
            customStyleName,
            camel2DashComponentName,
            camel2UnderlineComponentName,
            fileName,
            customName,
            transformToDefaultImport,
          }, index) => {
            // !!libraryName如果是false，则抛出错误，错误内容是后面的字符串，如果是true ,则继续后面的代码
            assert(libraryName, 'libraryName should be provided');
            return new Plugin(
              libraryName,
              libraryDirectory,
              style,
              styleLibraryDirectory,
              customStyleName,
              camel2DashComponentName,
              camel2UnderlineComponentName,
              fileName,
              customName,
              transformToDefaultImport,
              types,
              index
            );
          });
        } else {
          assert(opts.libraryName, 'libraryName should be provided');
          plugins = [
            new Plugin(
              opts.libraryName,
              opts.libraryDirectory,
              opts.style,
              opts.styleLibraryDirectory,
              opts.customStyleName,
              opts.camel2DashComponentName,
              opts.camel2UnderlineComponentName,
              opts.fileName,
              opts.customName,
              opts.transformToDefaultImport,
              types
            ),
          ];
        }
      }
      applyInstance('ProgramEnter', arguments, this);  // eslint-disable-line
    },
    exit() {
      // 遍历program结束的时候执行plugins插件集合中每个插件对象的ProgramExit方法
      applyInstance('ProgramExit', arguments, this);  // eslint-disable-line
    },
  };

  const methods = [
    'ImportDeclaration',
    'CallExpression',
    'MemberExpression',
    'Property',
    'VariableDeclarator',
    'ArrayExpression',
    'LogicalExpression',
    'ConditionalExpression',
    'IfStatement',
    'ExpressionStatement',
    'ReturnStatement',
    'ExportDefaultDeclaration',
    'BinaryExpression',
    'NewExpression',
    'ClassDeclaration',
  ];

  // 构造一个插件返回的处理ast的方法集合对象
  const ret = {
    visitor: { Program },
  };

  // 为该集合对象添加methods中的属性名称的方法，每个方法会遍历plugins中的每个插件
  // plugins是遍历过程中收集到的插件数组
  for (const method of methods) {
    ret.visitor[method] = function () { // eslint-disable-line
      applyInstance(method, arguments, ret.visitor);  // eslint-disable-line
    };
  }

  return ret;
}
