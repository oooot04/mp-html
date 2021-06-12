/**
 * @fileoverview editable 插件
 */
const config = require('./config')
const Parser = require('../parser')

function Editable (vm) {
  this.vm = vm
  this.editHistory = [] // 历史记录
  this.editI = -1 // 历史记录指针
  vm._mask = [] // 蒙版被点击时进行的操作

  /**
   * @description 移动历史记录指针
   * @param {Number} num 移动距离
   */
  const move = num => {
    const item = this.editHistory[this.editI + num]
    if (item) {
      this.editI += num
      vm.setData({
        [item.key]: item.value
      })
    }
  }
  vm.undo = () => move(-1) // 撤销
  vm.redo = () => move(1) // 重做

  /**
   * @description 更新记录
   * @param {String} path 路径
   * @param {*} oldVal 旧值
   * @param {*} newVal 新值
   * @param {Boolean} set 是否更新到视图
   * @private
   */
  vm._editVal = (path, oldVal, newVal, set) => {
    // 当前指针后的内容去除
    while (this.editI < this.editHistory.length - 1) {
      this.editHistory.pop()
    }

    // 最多存储 30 条操作记录
    while (this.editHistory.length > 30) {
      this.editHistory.pop()
      this.editI--
    }

    const last = this.editHistory[this.editHistory.length - 1]
    if (!last || last.key !== path) {
      if (last) {
        // 去掉上一次的新值
        this.editHistory.pop()
        this.editI--
      }
      // 存入这一次的旧值
      this.editHistory.push({
        key: path,
        value: oldVal
      })
      this.editI++
    }

    // 存入本次的新值
    this.editHistory.push({
      key: path,
      value: newVal
    })
    this.editI++

    // 更新到视图
    if (set) {
      vm.setData({
        [path]: newVal
      })
    }
  }

  /**
   * @description 获取菜单项
   * @private
   */
  vm._getItem = function (node) {
    let items
    let i
    if (node.name === 'img') {
      items = config.img.slice(0)
      if (!vm.getSrc) {
        i = items.indexOf('换图')
        if (i !== -1) {
          items.splice(i, 1)
        }
        i = items.indexOf('超链接')
        if (i !== -1) {
          items.splice(i, 1)
        }
        i = items.indexOf('预览图')
        if (i !== -1) {
          items.splice(i, 1)
        }
      }
      i = items.indexOf('禁用预览')
      if (i !== -1 && node.attrs.ignore) {
        items[i] = '启用预览'
      }
    } else if (node.name === 'a') {
      items = config.link.slice(0)
      if (!vm.getSrc) {
        i = items.indexOf('更换链接')
        if (i !== -1) {
          items.splice(i, 1)
        }
      }
    } else if (node.name === 'video' || node.name === 'audio') {
      items = config.media.slice(0)
      i = items.indexOf('封面')
      if (!vm.getSrc && i !== -1) {
        items.splice(i, 1)
      }
      i = items.indexOf('循环')
      if (node.attrs.loop && i !== -1) {
        items[i] = '不循环'
      }
    } else {
      items = config.node.slice(0)
    }
    return items
  }

  /**
   * @description 显示 tooltip
   * @param {object} obj
   * @private
   */
  vm._tooltip = function (obj) {
    vm.setData({
      tooltip: {
        top: obj.top,
        items: obj.items
      }
    })
    vm._tooltipcb = obj.success
  }

  /**
   * @description 显示滚动条
   * @param {object} obj
   * @private
   */
  vm._slider = function (obj) {
    vm.setData({
      slider: {
        min: obj.min,
        max: obj.max,
        value: obj.value,
        top: obj.top
      }
    })
    vm._slideringcb = obj.changing
    vm._slidercb = obj.change
  }

  /**
   * @description 点击蒙版
   * @private
   */
  vm._maskTap = function () {
    // 隐藏所有悬浮窗
    while (this._mask.length) {
      (this._mask.pop())()
    }
    const data = {}
    if (this.data.tooltip) {
      data.tooltip = null
    }
    if (this.data.slider) {
      data.slider = null
    }
    if (this.data.tooltip || this.data.slider) {
      this.setData(data)
    }
  }

  /**
   * @description 插入节点
   * @param {Object} node
   */
  function insert (node) {
    if (vm._edit) {
      vm._edit.insert(node)
    } else {
      const nodes = vm.data.nodes.slice(0)
      nodes.push(node)
      vm._editVal('nodes', vm.data.nodes, nodes, true)
    }
  }

  /**
   * @description 在光标处插入指定 html 内容
   * @param {String} html 内容
   */
  vm.insertHtml = html => {
    this.inserting = true
    const arr = new Parser(vm).parse(html)
    this.inserting = undefined
    for (let i = 0; i < arr.length; i++) {
      insert(arr[i])
    }
  }

  /**
   * @description 在光标处插入一张图片
   */
  vm.insertImg = function () {
    vm.getSrc && vm.getSrc('img').then(src => {
      insert({
        name: 'img',
        attrs: {
          src
        }
      })
    }).catch(() => { })
  }

  /**
   * @description 在光标处插入一个链接
   */
  vm.insertLink = function () {
    vm.getSrc && vm.getSrc('link').then(url => {
      insert({
        name: 'a',
        attrs: {
          href: url
        },
        children: [{
          type: 'text',
          text: url
        }]
      })
    }).catch(() => { })
  }

  /**
   * @description 在光标处插入一个表格
   * @param {Number} rows 行数
   * @param {Number} cols 列数
   */
  vm.insertTable = function (rows, cols) {
    const table = {
      name: 'table',
      attrs: {
        style: 'display:table;width:100%;margin:10px 0;text-align:center;border-spacing:0;border-collapse:collapse;border:1px solid gray'
      },
      children: []
    }
    for (let i = 0; i < rows; i++) {
      const tr = {
        name: 'tr',
        attrs: {},
        children: []
      }
      for (let j = 0; j < cols; j++) {
        tr.children.push({
          name: 'td',
          attrs: {
            style: 'padding:2px;border:1px solid gray'
          },
          children: [{
            type: 'text',
            text: ''
          }]
        })
      }
      table.children.push(tr)
    }
    insert(table)
  }

  /**
   * @description 在光标处插入一个视频
   */
  vm.insertVideo = function () {
    vm.getSrc && vm.getSrc('video').then(src => {
      if (typeof src === 'string') {
        src = [src]
      }
      insert({
        name: 'div',
        attrs: {
          style: 'text-align:center'
        },
        children: [{
          name: 'video',
          attrs: {
            controls: 'T'
          },
          src
        }]
      })
    }).catch(() => { })
  }

  /**
   * @description 在光标处插入一个音频
   */
  vm.insertAudio = function () {
    vm.getSrc && vm.getSrc('audio').then(attrs => {
      let src
      if (attrs.src) {
        src = attrs.src
        attrs.src = undefined
      } else {
        src = attrs
        attrs = {}
      }
      attrs.controls = 'T'
      if (typeof src === 'string') {
        src = [src]
      }
      insert({
        name: 'div',
        attrs: {
          style: 'text-align:center'
        },
        children: [{
          name: 'audio',
          attrs,
          src
        }]
      })
    }).catch(() => { })
  }

  /**
   * @description 在光标处插入一段文本
   */
  vm.insertText = function () {
    insert({
      name: 'p',
      attrs: {},
      children: [{
        type: 'text',
        text: ''
      }]
    })
  }

  /**
   * @description 清空内容
   */
  vm.clear = function () {
    vm._maskTap()
    vm._edit = undefined
    vm.setData({
      nodes: [{
        name: 'p',
        attrs: {},
        children: [{
          type: 'text',
          text: ''
        }]
      }]
    })
  }

  /**
   * @description 获取编辑后的 html
   */
  vm.getContent = function () {
    let html = '';
    // 递归遍历获取
    (function traversal (nodes, table) {
      for (let i = 0; i < nodes.length; i++) {
        let item = nodes[i]
        if (item.type === 'text') {
          // 编码实体
          html += item.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/\xa0/g, '&nbsp;')
        } else {
          // 还原被转换的 svg
          if (item.name === 'img' && (item.attrs.src || '').includes('data:image/svg+xml;utf8,')) {
            html += item.attrs.src.substr(24).replace(/%23/g, '#').replace('<svg', '<svg style="' + (item.attrs.style || '') + '"')
            continue
          } else if (item.name === 'video' || item.name === 'audio') {
            // 还原 video 和 audio 的 source
            if (item.src.length > 1) {
              item.children = []
              for (let j = 0; j < item.src.length; j++) {
                item.children.push({
                  name: 'source',
                  attrs: {
                    src: item.src[j]
                  }
                })
              }
            } else {
              item.attrs.src = item.src[0]
            }
          } else if (item.name === 'div' && (item.attrs.style || '').includes('overflow:auto') && (item.children[0] || {}).name === 'table') {
            // 还原滚动层
            item = item.children[0]
          }
          // 还原 table
          if (item.name === 'table') {
            table = item.attrs
            if ((item.attrs.style || '').includes('display:grid')) {
              item.attrs.style = item.attrs.style.split('display:grid')[0]
              const children = [{
                name: 'tr',
                attrs: {},
                children: []
              }]
              for (let j = 0; j < item.children.length; j++) {
                item.children[j].attrs.style = item.children[j].attrs.style.replace(/grid-[^;]+;*/g, '')
                if (item.children[j].r !== children.length) {
                  children.push({
                    name: 'tr',
                    attrs: {},
                    children: [item.children[j]]
                  })
                } else {
                  children[children.length - 1].children.push(item.children[j])
                }
              }
              item.children = children
            }
          }
          html += '<' + item.name
          for (const attr in item.attrs) {
            let val = item.attrs[attr]
            if (!val) continue
            // bool 型省略值
            if (val === 'T' || val === true) {
              html += ' ' + attr
              continue
            } else if (item.name[0] === 't' && attr === 'style' && table) {
              // 取消为了显示 table 添加的 style
              val = val.replace(/;*display:table[^;]*/, '')
              if (table.border) {
                val = val.replace(/border[^;]+;*/g, $ => $.includes('collapse') ? $ : '')
              }
              if (table.cellpadding) {
                val = val.replace(/padding[^;]+;*/g, '')
              }
              if (!val) continue
            }
            html += ' ' + attr + '="' + val.replace(/"/g, '&quot;') + '"'
          }
          html += '>'
          if (item.children) {
            traversal(item.children, table)
            html += '</' + item.name + '>'
          }
        }
      }
    })(vm.data.nodes)

    // 其他插件处理
    for (let i = vm.plugins.length; i--;) {
      if (vm.plugins[i].onGetContent) {
        html = vm.plugins[i].onGetContent(html) || html
      }
    }

    return html
  }
}

Editable.prototype.onUpdate = function (content, config) {
  if (this.vm.properties.editable) {
    this.vm._maskTap()
    config.entities.amp = '&'
    if (!this.inserting) {
      this.vm._edit = undefined
      if (!content) {
        setTimeout(() => {
          this.vm.setData({
            nodes: [{
              name: 'p',
              attrs: {},
              children: [{
                type: 'text',
                text: ''
              }]
            }]
          })
        }, 0)
      }
    }
  }
}

Editable.prototype.onParse = function (node) {
  // 空白单元格可编辑
  if (this.vm.properties.editable && (node.name === 'td' || node.name === 'th') && !this.vm.getText(node.children)) {
    node.children.push({
      type: 'text',
      text: ''
    })
  }
}

module.exports = Editable
