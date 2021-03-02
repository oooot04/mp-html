/*!
 * mp-html v2.0.4
 * https://github.com/jin-yufeng/mp-html
 * 
 * Released under the MIT license
 * Author: Jin Yufeng
 */
const parser = require('./parser')
const plugins = []

Component({
  data: {
    nodes: []
  },
  properties: {
    /**
     * @description 用于渲染的 html 字符串
     * @type {String}
     */
    content: {
      type: String,
      value: '',
      observer(content) {
        this.setContent(content)
      }
    },

    /**
     * @description 是否允许外部链接被点击时自动复制
     * @type {Boolean}
     * @default true
     */
    copyLink: {
      type: Boolean,
      value: true
    },

    /**
     * @description 主域名，用于拼接链接
     * @type {String}
     */
    domain: String,

    /**
     * @description 图片出错时的占位图链接
     * @type {String}
     */
    errorImg: String,

    /**
     * @description 是否开启图片懒加载
     * @type {Boolean}
     * @default false
     */
    lazyLoad: Boolean,

    /**
     * @description 图片加载过程中的占位图链接
     * @type {String}
     */
    loadingImg: String,

    /**
     * @description 是否在播放一个视频时自动暂停其他视频
     * @type {Boolean}
     * @default true
     */
    pauseVideo: {
      type: Boolean,
      value: true
    },

    /**
     * @description 是否允许图片被点击时自动预览
     * @type {Boolean}
     * @default true
     */
    previewImg: {
      type: Boolean,
      value: true
    },

    /**
     * @description 是否给每个表格添加一个滚动层使其能单独横向滚动
     * @type {Boolean}
     * @default false
     */
    scrollTable: Boolean,

    /**
     * @description 是否开启长按复制
     * @type {Boolean | String}
     * @default false
     */
    selectable: null,

    /**
     * @description 是否将 title 标签的内容设置到页面标题
     * @type {Boolean}
     * @default true
     */
    setTitle: {
      type: Boolean,
      value: true
    },

    /**
     * @description 是否允许图片被长按时显示菜单
     * @type {Boolean}
     * @default true
     */
    showImgMenu: {
      type: Boolean,
      value: true
    },

    /**
     * @description 标签的默认样式
     * @type {Object}
     */
    tagStyle: Object,

    /**
     * @description 是否使用锚点链接
     * @type {Boolean | Number}
     * @default false
     */
    useAnchor: null
  },

  created() {
    this.plugins = []
    for (var i = plugins.length; i--;)
      this.plugins.push(new plugins[i](this))

    // #ifdef MP-ALIPAY
    if (this.properties.content)
      this.setContent(this.properties.content)
    // #endif
  },

  // #ifdef MP-ALIPAY
  didUpdate(e) {
    if (e.content != this.properties.content)
      this.setContent(this.properties.content)
  },
  // #endif

  detached() {
    // 清除定时器
    clearInterval(this._timer)
    // 注销插件
    this._hook('onDetached')
  },

  methods: {
    /**
     * @description 将锚点跳转的范围限定在一个 scroll-view 内
     * @param {Object} page scroll-view 所在页面的示例
     * @param {String} selector scroll-view 的选择器
     * @param {String} scrollTop scroll-view scroll-top 属性绑定的变量名
     */
    in(page, selector, scrollTop) {
      if (page && selector && scrollTop)
        this._in = {
          page,
          selector,
          scrollTop
        }
    },

    /**
     * @description 锚点跳转
     * @param {String} id 要跳转的锚点 id
     * @param {Number} offset 跳转位置的偏移量
     * @returns {Promise}
     */
    navigateTo(id, offset) {
      return new Promise((resolve, reject) => {
        if (!this.properties.useAnchor)
          return reject('Anchor is disabled')
        // 跨组件选择器
        var deep =
          // #ifdef MP-WEIXIN || MP-QQ || MP-TOUTIAO
          '>>>'
        // #endif
        // #ifdef MP-BAIDU || MP-ALIPAY
        ' '
        // #endif
        var selector = wx.createSelectorQuery()
          // #ifndef MP-ALIPAY
          .in(this._in ? this._in.page : this)
          // #endif
          .select((this._in ? this._in.selector : '._root') + (id ? `${deep}#${id}` : '')).boundingClientRect()
        if (this._in)
          selector.select(this._in.selector).scrollOffset()
            .select(this._in.selector).boundingClientRect() // 获取 scroll-view 的位置和滚动距离
        else
          selector.selectViewport().scrollOffset() // 获取窗口的滚动距离
        selector.exec(res => {
          if (!res[0])
            return reject('Label not found')
          var scrollTop = res[1].scrollTop + res[0].top - (res[2] ? res[2].top : 0) + (offset || parseInt(this.properties.useAnchor) || 0)
          if (this._in)
            // scroll-view 跳转
            this._in.page.setData({
              [this._in.scrollTop]: scrollTop
            })
          else
            // 页面跳转
            wx.pageScrollTo({
              scrollTop,
              duration: 300
            })
          resolve()
        })
      })
    },

    /**
     * @description 获取文本内容
     * @returns {String}
     */
    getText(nodes) {
      var text = '';
      (function traversal(nodes) {
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i]
          if (node.type == 'text')
            text += node.text.replace(/&amp;/g, '&')
          else if (node.name == 'br')
            text += '\n'
          else {
            // 块级标签前后加换行
            var isBlock = node.name == 'p' || node.name == 'div' || node.name == 'tr' || node.name == 'li' || (node.name[0] == 'h' && node.name[1] > '0' && node.name[1] < '7')
            if (isBlock && text && text[text.length - 1] != '\n')
              text += '\n'
            // 递归获取子节点的文本
            if (node.children)
              traversal(node.children)
            if (isBlock && text[text.length - 1] != '\n')
              text += '\n'
            else if (node.name == 'td' || node.name == 'th')
              text += '\t'
          }
        }
      })(nodes || this.data.nodes)
      return text
    },

    /**
     * @description 获取内容大小
     * @returns {Promise}
     */
    getRect() {
      return new Promise((resolve, reject) => {
        wx.createSelectorQuery()
          // #ifndef MP-ALIPAY
          .in(this)
          // #endif
          .select('._root').boundingClientRect().exec(res => res[0] ? resolve(res[0]) : reject('Root label not found'))
      })
    },

    /**
     * @description 设置富文本内容
     * @param {string} content 要渲染的 html 字符串
     * @param {boolean} append 是否在尾部追加
     */
    setContent(content, append) {
      if (!this.imgList || !append)
        this.imgList = []
      this._videos = []

      var data = {},
        nodes = new parser(this).parse(content)
      // 尾部追加内容
      if (append)
        for (var i = this.data.nodes.length, j = nodes.length; j--;)
          data[`nodes[${i + j}]`] = nodes[j]
      else
        data.nodes = nodes

      this.setData(data,
        // #ifndef MP-TOUTIAO
        () => {
          this._hook('onLoad')
          this.triggerEvent('load')
        }
        // #endif
      )

      // #ifdef MP-TOUTIAO
      this.selectComponent('#_root', child => {
        child.root = this
        this._hook('onLoad')
        this.triggerEvent('load')
      })
      // #endif

      // 等待图片加载完毕
      var height
      clearInterval(this._timer)
      this._timer = setInterval(() => {
        this.getRect().then(rect => {
          // 350ms 总高度无变化就触发 ready 事件
          if (rect.height == height) {
            this.triggerEvent('ready', rect)
            clearInterval(this._timer)
          }
          height = rect.height
        }).catch(() => { })
      }, 350)
    },

    /**
     * @description 调用插件的钩子函数
     * @private
     */
    _hook(name) {
      for (var i = plugins.length; i--;)
        if (this.plugins[i][name])
          this.plugins[i][name]()
    },

    // #ifndef MP-TOUTIAO
    /**
     * @description 添加子组件
     * @private
     */
    _add(e) {
      e
        // #ifndef MP-ALIPAY
        .detail
        // #endif
        .root = this
    }
    // #endif
  }
})
