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

  importMethod(methodName, file, pluginState) {
    if (!pluginState.selectedMethods[methodName]) {
      const libraryDirectory = this.libraryDirectory;
      const style = this.style;
      const transformedMethodName = this.camel2UnderlineComponentName  // eslint-disable-line
        ? transCamel(methodName, '_')
        : this.camel2DashComponentName
          ? transCamel(methodName, '-')
          : methodName;
      const path = winPath(
        this.customName ? this.customName(transformedMethodName) : join(this.libraryName, libraryDirectory, transformedMethodName, this.fileName) // eslint-disable-line
      );
      pluginState.selectedMethods[methodName] = this.transformToDefaultImport  // eslint-disable-line
        ? addDefault(file.path, path, { nameHint: methodName })
        : addNamed(file.path, methodName, path);
      if (this.customStyleName) {
        const stylePath = winPath(this.customStyleName(transformedMethodName));
        addSideEffect(file.path, `${stylePath}`);
      } else if (this.styleLibraryDirectory) {
        const stylePath = winPath(
          join(this.libraryName, this.styleLibraryDirectory, transformedMethodName, this.fileName)
        );
        addSideEffect(file.path, `${stylePath}`);
      } else if (style === true) {
        addSideEffect(file.path, `${path}/style`);
      } else if (style === 'css') {
        addSideEffect(file.path, `${path}/style/css`);
      } else if (typeof style === 'function') {
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

  buildDeclaratorHandler(node, prop, path, state) {
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const types = this.types;
    const pluginState = this.getPluginState(state);
    if (!types.isIdentifier(node[prop])) return;
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

  // 对于import的语句来说：
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
          pluginState.libraryObjs[spec.local.name] = true;
        }
      });
      // 记录下这个需要删除的路径，path具备remove方法，用于删除这个节点从而删除这个import语句
      pluginState.pathsToRemove.push(path);
    }
  }

  CallExpression(path, state) {
    const { node } = path;
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const { name } = node.callee;
    const types = this.types;
    const pluginState = this.getPluginState(state);

    if (types.isIdentifier(node.callee)) {
      if (pluginState.specified[name]) {
        node.callee = this.importMethod(pluginState.specified[name], file, pluginState);
      }
    }

    node.arguments = node.arguments.map(arg => {
      const { name: argName } = arg;
      if (pluginState.specified[argName] &&
        path.scope.hasBinding(argName) &&
        path.scope.getBinding(argName).path.type === 'ImportSpecifier') {
        return this.importMethod(pluginState.specified[argName], file, pluginState);
      }
      return arg;
    });
  }

  MemberExpression(path, state) {
    const { node } = path;
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const pluginState = this.getPluginState(state);

    // multiple instance check.
    if (!node.object || !node.object.name) return;

    if (pluginState.libraryObjs[node.object.name]) {
      // antd.Button -> _Button
      path.replaceWith(this.importMethod(node.property.name, file, pluginState));
    } else if (pluginState.specified[node.object.name] && path.scope.hasBinding(node.object.name)) {
      const scope = path.scope.getBinding(node.object.name).scope;
      // global variable in file scope
      if (scope.path.parent.type === 'File') {
        node.object = this.importMethod(
          pluginState.specified[node.object.name],
          file,
          pluginState
        );
      }
    }
  }

  Property(path, state) {
    const { node } = path;
    this.buildDeclaratorHandler(node, 'value', path, state);
  }

  VariableDeclarator(path, state) {
    const { node } = path;
    this.buildDeclaratorHandler(node, 'init', path, state);
  }

  ArrayExpression(path, state) {
    const { node } = path;
    const props = node.elements.map((_, index) => index);
    this.buildExpressionHandler(node.elements, props, path, state);
  }

  LogicalExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['left', 'right'], path, state);
  }

  ConditionalExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['test', 'consequent', 'alternate'], path, state);
  }

  IfStatement(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['test'], path, state);
    this.buildExpressionHandler(node.test, ['left', 'right'], path, state);
  }

  ExpressionStatement(path, state) {
    const { node } = path;
    const { types } = this;
    if (types.isAssignmentExpression(node.expression)) {
      this.buildExpressionHandler(node.expression, ['right'], path, state);
    }
  }

  ReturnStatement(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['argument'], path, state);
  }

  ExportDefaultDeclaration(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['declaration'], path, state);
  }

  BinaryExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['left', 'right'], path, state);
  }

  NewExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['callee', 'arguments'], path, state);
  }

  ClassDeclaration(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['superClass'], path, state);
  }
}
