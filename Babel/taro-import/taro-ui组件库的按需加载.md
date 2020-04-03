## 组件按需加载的目的
减少包体积，加速首屏渲染有两种方式：tree-shaking与按需加载。一般而言css作为组件库的副作用，会逃离tree-shaking的作用，因此按需加载也不可或缺。
> 按需加载前
```
import { AtButton } from 'taro-ui'
```

> 按需加载后
```
import AtButton from 'taro-ui/dist/h5/components/button/index'
import 'taro-ui/dist/style/components/button.scss'
```

## 第三方组件库按需加载的配置原理
1. libraryName：这个是用于匹配import的源文件名称，ast节点的node.source.value
2. camel2DashComponentName这个需要强制设置为false，因为采取的方式是customName获取新的import源的方式。
3. transformToDefaultImport设置为true是因为taro-ui每个组件都是以export default的方式导出。
4. customStyleName以及customName返回的都是importdeclaration节点的node.source.value，也就是组件以及样式在包的具体位置，由于具体位置文件名与导出组件的名称会不一致，因此还需要提供每个组件名称与位置的对应关系。也就是下方的map。

更多的请自行查阅[babel-plugin-import](https://github.com/ant-design/babel-plugin-import)

> 缺点：

将
```
import { AtButton } from 'taro-ui'
```
替换成
```
import { AtButton } from 'taro-ui'
import 'taro-ui/dist/style/components/button.scss'
```
然后借助tree-shaking也可以达到目的，如果要以这种方式导入，会出事，因为项目本来就是这样导入的，并且这个plugin是在pragram退出的时候才会删除import节点，导致在importdeclaration的时候作用域中已经存在了AtButton，所以为了避免重复，会重新生成一个uid来作为identifier的name，这个name一般都是加上'_'，例如path.scope.generateUidIdentifier("uid")。

由于babel-plugin-import无法保持节点不变化，必定会将一种组件的import节点替换成另一种import，可以是addDefault也可以是addNamed，所以无法只增加import样式的节点。

## taro-ui按需加载的babel插件配置
> 需要注意的是对于第三方的taro组件，请在每个组件中加上addGlobalClass,确保外部可以通过样式覆盖的方式修改自定义组件中的样式，自定义组件中的样式不会影响外部页面的样式。

目前给出的一种方式是利用已有的按需加载工作babel-plugin-import。可能还会存在利用babel-plugin-import实现的其他方案。
```
const map = {
  'AtActionSheet' : 'components/action-sheet',
  'AtActionSheetItem' : 'components/action-sheet/body/item',
  'AtActivityIndicator' : 'components/activity-indicator',
  'AtAvatar' : 'components/avatar',
  'AtBadge' : 'components/badge',
  'AtButton' : 'components/button',
  'AtCard' : 'components/card',
  'AtCheckbox' : 'components/checkbox',
  'AtDrawer' : 'components/drawer',
  'AtFloatLayout' : 'components/float-layout',
  'AtForm' : 'components/form',
  'AtGrid' : 'components/grid',
  'AtIcon' : 'components/icon',
  'AtInput' : 'components/input',
  'AtInputNumber' : 'components/input-number',
  'AtList' : 'components/list',
  'AtListItem' : 'components/list/item',
  'AtModal' : 'components/modal',
  'AtModalHeader' : 'components/modal/header',
  'AtModalContent' : 'components/modal/content',
  'AtModalAction' : 'components/modal/action',
  'AtNavBar' : 'components/nav-bar',
  'AtNoticebar' : 'components/noticebar',
  'AtPagination' : 'components/pagination',
  'AtProgress' : 'components/progress',
  'AtRadio' : 'components/radio',
  'AtRate' : 'components/rate',
  'AtSegmentedControl' : 'components/segmented-control',
  'AtSwitch' : 'components/switch',
  'AtTabBar' : 'components/tab-bar',
  'AtTabs' : 'components/tabs',
  'AtTabsPane' : 'components/tabs-pane',
  'AtTag' : 'components/tag',
  'AtTextarea' : 'components/textarea',
  'AtTimeline' : 'components/timeline',
  'AtToast' : 'components/toast',
  'AtAccordion' : 'components/accordion',
  'AtSlider' : 'components/slider',
  'AtSwipeAction' : 'components/swipe-action',
  'AtSearchBar' : 'components/search-bar',
  'AtLoadMore' : 'components/load-more',
  'AtDivider' : 'components/divider',
  'AtCountdown' : 'components/countdown',
  'AtSteps' : 'components/steps',
  'AtCurtain' : 'components/curtain',
  'AtMessage' : 'components/message',
  'AtImagePicker' : 'components/image-picker',
  'AtRange' : 'components/range',
  'AtIndexes' : 'components/indexes',
  'AtCalendar' : 'components/calendar',
  'AtFab' : 'components/fab',
 /* 私有的组件  */
  'AtLoading' : 'components/loading',
  'AtComponent' : 'common/component'
 }
 const exludesMap = {
  'AtActionSheetItem' : 'components/action-sheet',
  'AtListItem' : 'components/list',
  'AtModalHeader' : 'components/modal',
  'AtModalContent' : 'components/modal',
  'AtModalAction' : 'components/modal',
  'AtTabsPane' : 'components/tabs'
}
const isWeb = process.argv.includes('h5')
const config = {
    ...
  babel: {
    ...
    plugins: [
        ...
      ['import',{
        'libraryName': 'taro-ui',
        'camel2DashComponentName': false,
        'transformToDefaultImport': true,
        'customStyleName': (name) => {
          if(name in exludesMap){
            return `taro-ui/dist/style/${exludesMap[name]}.scss`
          }
          return `taro-ui/dist/style/${map[name]}.scss`
        },
        'customName': (name) => `taro-ui/dist/${isWeb?'h5':'weapp'}/${map[name]}/index`,
      }]
    ]
  },
    ...
  mini: {
    ...
  },
  h5: {
    ...
  }
}

```

注意上述配置有一个缺点，AtActionSheetItem得样式在action-sheet.scss中，每次遇到导入AtActionSheetItem的时候，都会要添加一个import节点，如果customStyleName中返回空字符或者undefined会报错，目前只能遇到AtActionSheetItem的时候也引入action-sheet.scss，导致了重复导入多个相同的style。为了解决这个问题继续需要fork以分babel-plugin-import或者是等待babel-plugin-import修改其非空判断逻辑的补充。

## fork babel-plugin-import 代码并进行修改
主要修改plugin.js的importMethod方法如下：
```
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
        if(stylePath) addSideEffect(file.path, `${stylePath}`);
      } else if (this.styleLibraryDirectory) {
        // 如果没有customStyleName，则加上styleLibraryDirectory指定的样式文件夹路径
        const stylePath = winPath(
          join(this.libraryName, this.styleLibraryDirectory, transformedMethodName, this.fileName)
        );
        if(stylePath) addSideEffect(file.path, `${stylePath}`);
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
```

## 此外对于icon图标的引入
iconfont图标样式的引入需要在入口单独添加，比如
```
import 'taro-ui/dist/style/components/icon.scss'
```