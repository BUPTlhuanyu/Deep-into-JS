export default function (babel) {
    const t = babel.types;
    // 这些变量需要在每个programe里重置
    const invokedApis = new Map();
    let taroName;
    let needDefault;
    let referrencedTaros;
    return {
        name: 'babel-plugin-transform-taro-api',
        visitor: {
            // 处理import的ast，这里传入的ast就是path路径，表示着ast节点之间的关系
            ImportDeclaration(ast, state) {
                // plugins: [
                //     '@babel/plugin-proposal-class-properties',
                //     [
                //       '@babel/plugin-transform-react-jsx',
                //       {
                //         pragma: 'Nerv.createElement'
                //       }
                //     ],
                //     ['@babel/plugin-proposal-object-rest-spread'],
                //     ['babel-plugin-transform-taroapi', {
                //       apis,
                //       packageName: '@tarojs/taro-h5'
                //     }]
                //   ]
                const packageName = state.opts.packageName;  // 获取babel配置plugin的时候参数，这里是'@tarojs/taro-h5'
                const apis = state.opts.apis;                // 这里是apis: new Set(["addCard","addInterceptor","addPhoneContact","advancedGeneralIdentify",...])
                if (ast.node.source.value !== packageName)
                    // source表示导出模块的来源节点
                    return;
                // 多个声明：比如import {a, b, c, d} from 'foo'，将其用https://astexplorer.net/转成ast看到specifiers是4个元素的数组
                ast.node.specifiers.forEach(node => {
                    if (t.isImportDefaultSpecifier(node)) {
                        // 如果是export default
                        needDefault = true;
                        // imported表示从导出模块导出的变量，local表示导入后当前模块的变量，如果import的时候使用as，那么as前面是被import也就是imported，as后面是被local的变量名称
                        taroName = node.local.name;
                    }
                    else if (t.isImportSpecifier(node)) {
                        // 处理 export
                        const propertyName = node.imported.name;
                        if (apis.has(propertyName)) { // 记录api名字
                            ast.scope.rename(node.local.name);
                            invokedApis.set(propertyName, node.local.name);
                        }
                        else { // 如果是未实现的api 改成Taro.xxx
                            needDefault = true;
                            const localName = node.local.name;
                            const binding = ast.scope.getBinding(localName);
                            const iden = t.identifier(taroName);
                            referrencedTaros.push(iden);
                            binding && binding.referencePaths.forEach(reference => {
                                reference.replaceWith(t.memberExpression(iden, t.identifier(propertyName)));
                            });
                        }
                    }
                });
            },
            MemberExpression(ast, state) {
                /* 处理Taro.xxx */
                const apis = state.opts.apis;
                const isTaro = t.isIdentifier(ast.node.object, { name: taroName });
                const property = ast.node.property;
                let propertyName = null;
                let propName = 'name';
                if (!isTaro)
                    return;
                // 兼容一下 Taro['xxx']
                if (t.isStringLiteral(property)) {
                    propName = 'value';
                }
                propertyName = property[propName];
                if (!propertyName)
                    return;
                // 同一api使用多次, 读取变量名
                if (apis.has(propertyName)) {
                    const parentNode = ast.parent;
                    const isAssignment = t.isAssignmentExpression(parentNode) && parentNode.left === ast.node;
                    if (!isAssignment) {
                        let identifier;
                        if (invokedApis.has(propertyName)) {
                            identifier = t.identifier(invokedApis.get(propertyName));
                        }
                        else {
                            const newPropertyName = ast.scope.generateUid(propertyName);
                            invokedApis.set(propertyName, newPropertyName);
                            /* 未绑定作用域 */
                            identifier = t.identifier(newPropertyName);
                        }
                        ast.replaceWith(identifier);
                    }
                }
                else {
                    needDefault = true;
                }
            },
            Program: {
                enter(ast) {
                    needDefault = false;
                    referrencedTaros = [];
                    invokedApis.clear();
                    taroName = ast.scope.getBinding('Taro')
                        ? ast.scope.generateUid('Taro')
                        : 'Taro';
                },
                exit(ast, state) {
                    // 防止重复引入
                    let isTaroApiImported = false;
                    referrencedTaros.forEach(node => {
                        node.name = taroName;
                    });
                    ast.traverse({
                        ImportDeclaration(ast) {
                            const packageName = state.opts.packageName;
                            const isImportingTaroApi = ast.node.source.value === packageName;
                            if (!isImportingTaroApi)
                                return;
                            if (isTaroApiImported)
                                return ast.remove();
                            isTaroApiImported = true;
                            const namedImports = Array.from(invokedApis.entries()).map(([imported, local]) => t.importSpecifier(t.identifier(local), t.identifier(imported)));
                            if (needDefault) {
                                const defaultImport = t.importDefaultSpecifier(t.identifier(taroName));
                                ast.node.specifiers = [
                                    defaultImport,
                                    ...namedImports
                                ];
                                needDefault = false;
                            }
                            else {
                                ast.node.specifiers = namedImports;
                            }
                        }
                    });
                }
            }
        }
    }
}