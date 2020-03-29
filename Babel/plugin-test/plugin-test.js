export default function(babel) {

    // console.log(Object.keys(babel.types))
    const {types: t} = babel
    // plugin contents
    return {
        visitor:{
            Program(path){
              // console.log(path)
            },
            FunctionDeclaration(path) { 
                // console.log('FunctionDeclaration, plugin-test', path)
                path.scope.rename("n")
                path.insertBefore(t.expressionStatement(t.stringLiteral("Because I'm easy come, easy go."))); 
                path.insertAfter(t.expressionStatement(t.stringLiteral("A little high, little low."))); 
            },
            BinaryExpression(path, state) {
                // console.log('path', path.hub)
                if (path.get('left').isIdentifier({ name: "a" })) {
                    // ...
                    // console.log('1111')
                  }
                // if (path.node.operator !== "+") {
                //     console.log(1212)
                //   return;
                // }
                // path.node.left = t.identifier('test')
                // console.log('path.node.operator', path.get('left'))
                // ...
              },
              ClassMethod(path) { 
                  path.get('body').unshiftContainer('body', t.expressionStatement(t.stringLiteral('before'))); 
                  path.get('body').pushContainer('body', t.expressionStatement(t.stringLiteral('after'))); 
                }
        }
    }
  }