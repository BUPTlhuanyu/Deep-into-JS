import { join } from 'path';
// https://babeljs.io/docs/en/next/babel-helper-module-imports.html
// addSideEffect(path, 'source');  会在代码中插入import "source"
// 其他的类似，都是添加对应的import语句
import { addSideEffect, addDefault, addNamed } from '@babel/helper-module-imports';

function transCamel(_str, symbol) {
  const str = _str[0].toLowerCase() + _str.substr(1);
  return str.replace(/([A-Z])/g, ($1) => `${symbol}${$1.toLowerCase()}`);
}

function winPath(path) {
  return path.replace(/\\/g, '/');
}

// 如果传入的是一个字符串，说明customName属性值对应的函数需要从模块中加载
function normalizeCustomName(originCustomName) {
  // If set to a string, treat it as a JavaScript source file path.
  if (typeof originCustomName === 'string') {
    const customNameExports = require(originCustomName);
    return typeof customNameExports === 'function'
      ? customNameExports : customNameExports.default;
  }

  return originCustomName;
}

export default class Plugin {
  constructor(
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
    index = 0
  ) {
    this.libraryName = libraryName;
    this.libraryDirectory = typeof libraryDirectory === 'undefined'
      ? 'lib'
      : libraryDirectory;
    this.camel2DashComponentName = typeof camel2DashComponentName === 'undefined'
      ? true
      : camel2DashComponentName;
    this.camel2UnderlineComponentName = camel2UnderlineComponentName;
    this.style = style || false;
    this.styleLibraryDirectory = styleLibraryDirectory;
    this.customStyleName = normalizeCustomName(customStyleName);
    this.fileName = fileName || '';
    this.customName = normalizeCustomName(customName);
    this.transformToDefaultImport = typeof transformToDefaultImport === 'undefined'
      ? true
      : transformToDefaultImport;
    this.types = types;
    this.pluginStateKey = `importPluginState${index}`;
  }

  getPluginState(state) {
    // state是visitor的各个方法中传入的第三个参数，每个方法都能访问以及修改这个state，state还包含了诸如path等其他信息
    // 如果state中如果有this.pluginStateKey属性值，则返回。
    // 如果没有则添加this.pluginStateKey属性值为{}。然后返回this.pluginStateKey属性值，注意返回的是一个引用，直接修改该函数的返回值，相当于直接修改这个state中某个属性的值
    if (!state[this.pluginStateKey]) {
      state[this.pluginStateKey] = {};  // eslint-disable-line
    }
    return state[this.pluginStateKey];
  }
  /**
   * 如果methodName代表的组件已经import了，那么只需要返回这个节点pluginState.selectedMethods[methodName]的副本
   * 为path添加import组件的节点以及import组件样式的节点。类型是Identifier
   * import的组件的ast节点会被缓存到pluginState.selectedMethods[methodName]中
   * @param {*} methodName 
   * @param {*} file 
   * @param {*} pluginState
   * @returns {*} 返回一个新的import组件的ast节点
   */
  importMethod(methodName, file, pluginState) {
    if (!pluginState.selectedMethods[methodName]) {
      const libraryDirectory = this.libraryDirectory;  // 放置组件的文件夹路径
      const style = this.style; // 指定是否导入样式文件：boolean，string，function
      // 根据导入的模块的名称重新生成特定格式名称：camel2UnderlineComponentName为true表示在驼峰处用下划线链接，camel2DashComponentName为true表示在驼峰处用‘-’链接，否则不改变
      const transformedMethodName = this.camel2UnderlineComponentName  // eslint-disable-line
        ? transCamel(methodName, '_')
        : this.camel2DashComponentName
          ? transCamel(methodName, '-')
          : methodName;
      // 构建需要import的路径：比如import {Button} from 'antd' --> import Button from 'antd/lib/button'
      const path = winPath(
        this.customName ? this.customName(transformedMethodName) : join(this.libraryName, libraryDirectory, transformedMethodName, this.fileName) // eslint-disable-line
      );
      // transformToDefaultImport默认值为true，表示按默认导入的方式处理， 比如import Button from 'antd/lib/button'。 
      // 这里调用的就是addDefault为path添加默认导入的节点，导入后组件的名称为methodName
      pluginState.selectedMethods[methodName] = this.transformToDefaultImport  // eslint-disable-line
        ? addDefault(file.path, path, { nameHint: methodName })  // addDefault返回的是一个Identifier类型的节点，在后续如果有用到button那么，那么就会用这个Identifier节点来替换原来的Identifier
        : addNamed(file.path, methodName, path);
      // customStyleName与customName类似，生成样式文件的路径，以及节点
      if (this.customStyleName) {
        const stylePath = winPath(this.customStyleName(transformedMethodName));
        addSideEffect(file.path, `${stylePath}`);
      } else if (this.styleLibraryDirectory) {
        // 如果没有customStyleName，则加上styleLibraryDirectory指定的样式文件夹路径
        const stylePath = winPath(
          join(this.libraryName, this.styleLibraryDirectory, transformedMethodName, this.fileName)
        );
        addSideEffect(file.path, `${stylePath}`);
      } else if (style === true) {
        // 从style中找样式文件
        addSideEffect(file.path, `${path}/style`);
      } else if (style === 'css') {
        // 从style/css中找样式文件
        addSideEffect(file.path, `${path}/style/css`);
      } else if (typeof style === 'function') {
        // 如果是一个函数，则将传入组件的路径得到一个样式文件的路径
        const stylePath = style(path, file);
        if (stylePath) {
          addSideEffect(file.path, stylePath);
        }
      }
    }
    return Object.assign({}, pluginState.selectedMethods[methodName]);
  }

  buildExpressionHandler(node, props, path, state) {
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const types = this.types;
    const pluginState = this.getPluginState(state);
    props.forEach(prop => {
      if (!types.isIdentifier(node[prop])) return;
      if (
        pluginState.specified[node[prop].name] &&
        types.isImportSpecifier(path.scope.getBinding(node[prop].name).path)
      ) {
        node[prop] = this.importMethod(pluginState.specified[node[prop].name], file, pluginState);  // eslint-disable-line
      }
    });
  }

  // 处理类似情况，将赋值语句的init或者对象属性赋值语句的value设置为节点addDefault或者addNamed返回的ast节点
  // let a = Button
  // {
  //   a: Button
  // }
  buildDeclaratorHandler(node, prop, path, state) {
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const types = this.types;
    const pluginState = this.getPluginState(state);
    if (!types.isIdentifier(node[prop])) return; // 值不是一个标志符号直接返回
    if (pluginState.specified[node[prop].name] &&
      path.scope.hasBinding(node[prop].name) &&
      path.scope.getBinding(node[prop].name).path.type === 'ImportSpecifier') {
      node[prop] = this.importMethod(pluginState.specified[node[prop].name], file, pluginState);  // eslint-disable-line
    }
  }

  ProgramEnter(path, state) {
    // state就是visitor的Program方法的第二个参数，包含了state
    const pluginState = this.getPluginState(state);
    pluginState.specified = Object.create(null);
    pluginState.libraryObjs = Object.create(null);
    pluginState.selectedMethods = Object.create(null);
    pluginState.pathsToRemove = [];
  }

  ProgramExit(path, state) {
    this.getPluginState(state).pathsToRemove.forEach(p => !p.removed && p.remove());
  }

  /**
   * 处理import
   * 1. 将从当前处理的库名libraryName里导入的变量或者函数保存到state[this.pluginStateKey].specified属性指向的对象中
   * 键名是本地的变量名local.name,值是被导入的变量名imported.name
   * 2. 将当前import节点的path保存到state[this.pluginStateKey].pathsToRemove，在退出program的时候会执行path.remove删除这些import节点
   * @param {*} path 
   * @param {*} state 
   */
  ImportDeclaration(path, state) {
    const { node } = path;

    // path maybe removed by prev instances.
    if (!node) return;

    const { value } = node.source; // source.value代表import的模块
    const libraryName = this.libraryName; // 获取当前处理的库的名称
    const types = this.types;  // types中是babel/types暴露出来的方法集合
    const pluginState = this.getPluginState(state); // 获取当前处理的库的state
    if (value === libraryName) {
      // 如果import的是当前处理的库，那么遍历node.specifiers
      // node.specifiers存储的是import后面的操作：
      // 比如：
      // import {a} from 'b' 那么node.specifiers数组只有一个元素，这个元素表示的操作type是ImportSpecifier, 被导入的变量名imported.name以及导入之后本地的变量local.name都是a
      // import {a as c} from 'b' 与上面唯一的区别是：被导入的变量名imported.name是a以及导入之后本地的变量local.name是c
      // import a from 'b' 与第一种的唯一区别是数组中唯一的那个元素的type是ImportDefaultSpecifier

      node.specifiers.forEach(spec => {
        if (types.isImportSpecifier(spec)) {
          pluginState.specified[spec.local.name] = spec.imported.name;
        } else {
          // 有可能是默认导入或者全部导入：
          // import d from 'b'： ImportDefaultSpecifier
          // import * as d from 'b'： ImportNamespaceSpecifier
          pluginState.libraryObjs[spec.local.name] = true;
        }
      });
      // 记录下这个需要删除的路径，path具备remove方法，用于删除这个节点从而删除这个import语句
      pluginState.pathsToRemove.push(path);
    }
  }

  /**
   * 函数调用
   * 
   * @param {*} path 
   * @param {*} state 
   */
  CallExpression(path, state) {
    const { node } = path;
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const { name } = node.callee;
    const types = this.types;
    const pluginState = this.getPluginState(state);

    if (types.isIdentifier(node.callee)) {
      // 如果是调用的this.libraryName的某个方法，那么...
      // import {A} from 'libraryName'
      // A()
      if (pluginState.specified[name]) {
        node.callee = this.importMethod(pluginState.specified[name], file, pluginState);
      }
    }
    // 构建arguments,如果函数传入的是变量则arg是Identifier类型存在name属性，否则arg是Literal不存在name，存在value与raw
    node.arguments = node.arguments.map(arg => {
      const { name: argName } = arg;
      if (pluginState.specified[argName] &&
        path.scope.hasBinding(argName) &&  // 检查本地变量argName是否被该函数绑定
        path.scope.getBinding(argName).path.type === 'ImportSpecifier'/*被绑定的本地变量argName所在的path的类型如果是import的*/) {
        // 这里React.createElement(Button, null)的时候，会走到这里处理作用域 
        return this.importMethod(pluginState.specified[argName], file, pluginState);
      }
      return arg;
    });
  }

  // 属性获取，点运算以及中括号。比如antd.Button，比如Button.defaultProps
  MemberExpression(path, state) {
    const { node } = path;
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const pluginState = this.getPluginState(state);

    // multiple instance check.
    if (!node.object || !node.object.name) return;

    if (pluginState.libraryObjs[node.object.name]) {
      // antd.Button -> _Button
      // 如果是全部导入了组件库，将全部导入的节点替换成组件单个导入
      path.replaceWith(this.importMethod(node.property.name, file, pluginState));
    } else if (pluginState.specified[node.object.name] && path.scope.hasBinding(node.object.name)) {
      const scope = path.scope.getBinding(node.object.name).scope;
      // global variable in file scope
      if (scope.path.parent.type === 'File') {
        // 如果父作用域是File，则将object指向全局的那个Button
        node.object = this.importMethod(
          pluginState.specified[node.object.name],
          file,
          pluginState
        );
      }
    }
  }


//----------------下面的各个类型的节点操作，都是需要将旧的标志符Identifier节点替换成新导入的Identifier节点-----------------//
//----------------不可避免的缺点是：每次遇到一样的节点都需要去判断是否用到了import出来的组件，如果用到了才会替换--------------//
  // a = {
  //   c: Button
  // }
  // 需要将对象属性赋值的value替换成新导入的Identifier节点
  Property(path, state) {
    const { node } = path;
    this.buildDeclaratorHandler(node, 'value', path, state);
  }

  // 变量申明，let a = Button
  // 需要将变量初始化的init替换成新导入的Identifier节点
  VariableDeclarator(path, state) {
    const { node } = path;
    this.buildDeclaratorHandler(node, 'init', path, state);
  }

  // 数组表达式: [Button,Button,Button]这个语句首先是一个表达式ExpressionStatement，其expression属性类型type是ArrayExpression
  // 需要将数组的elements中每个是Button的节点替换成新导入的Identifier节点
  ArrayExpression(path, state) {
    const { node } = path;
    const props = node.elements.map((_, index) => index);
    this.buildExpressionHandler(node.elements, props, path, state);
  }

  // 逻辑运算符: 与或非
  // Button || null，需要将旧的标志符Identifier节点替换成新导入的Identifier节点
  LogicalExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['left', 'right'], path, state);
  }

  // a?b:c   ConditionalExpression是这个ExpressionStatement的expression
  // a?Button : null, 需要将旧的标志符Identifier节点替换成新导入的Identifier节点
  ConditionalExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['test', 'consequent', 'alternate'], path, state);
  }

  // if
  IfStatement(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['test'], path, state);
    this.buildExpressionHandler(node.test, ['left', 'right'], path, state);
  }

  // 表达式
  ExpressionStatement(path, state) {
    const { node } = path;
    const { types } = this;
    if (types.isAssignmentExpression(node.expression)) {
      // 赋值操作
      this.buildExpressionHandler(node.expression, ['right'], path, state);
    }
  }

  // return 
  ReturnStatement(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['argument'], path, state);
  }

  // export default
  ExportDefaultDeclaration(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['declaration'], path, state);
  }

  // 二元表达式： + - * / ...
  BinaryExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['left', 'right'], path, state);
  }

  // new 操作符
  NewExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['callee', 'arguments'], path, state);
  }

  // 类申明符: class a{}
  ClassDeclaration(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['superClass'], path, state);
  }
}
