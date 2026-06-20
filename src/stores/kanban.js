import { defineStore } from 'pinia'

// 默认的初始状态，三个基础列
const getInitialState = () => ({
  columns: [
    { id: '1', title: '待办', x: 50, y: 100, tasks: [] },
    { id: '2', title: '进行中', x: 380, y: 100, tasks: [] },
    { id: '3', title: '已完成', x: 710, y: 100, tasks: [] }
  ],
  connections: [
    { from: '1', to: '2' },
    { from: '2', to: '3' }
  ]
})

export const useKanbanStore = defineStore('kanban', {
  state: () => getInitialState(),

  actions: {
    // 添加任务到指定列
    addTask(title, priority, content = '', columnId) {
      const col = this.columns.find(c => c.id === columnId)
      if (col) {
        // 生成唯一ID，防止快速添加时重复
        const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        col.tasks.push({
          id,
          title,
          priority,
          content,
          status: columnId,
          x: col.x,
          y: col.y + col.tasks.length * 40
        })
        this.save()
      }
    },

    // 移动任务到新列
    moveTask(taskId, newStatus) {
      // 先找到任务所在的原列
      for (const col of this.columns) {
        const idx = col.tasks.findIndex(t => t.id === taskId)
        if (idx !== -1) {
          const [task] = col.tasks.splice(idx, 1)
          task.status = newStatus
          const target = this.columns.find(c => c.id === newStatus)
          if (target) {
            target.tasks.push(task)
            // 更新任务的坐标，暂时先简单处理，后面可以优化
            task.x = target.x
            task.y = target.y + target.tasks.length * 40
          }
          break
        }
      }
      this.save()
    },

    // 更新任务信息
    updateTask(id, title, priority, content) {
      for (const col of this.columns) {
        const idx = col.tasks.findIndex(t => t.id === id);
        if (idx !== -1) {
          if (title !== undefined) col.tasks[idx].title = title;
          if (priority !== undefined) col.tasks[idx].priority = priority;
          if (content !== undefined) col.tasks[idx].content = content;
          this.save();
          break;
        }
      }
    },

    // 删除任务
    deleteTask(id) {
      for (const col of this.columns) {
        const idx = col.tasks.findIndex(t => t.id === id)
        if (idx !== -1) {
          col.tasks.splice(idx, 1)
          break
        }
      }
      this.save()
    },

    // 添加新列
    addColumn(title) {
      const lastCol = this.columns[this.columns.length - 1]
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      this.columns.push({
        id,
        title,
        x: lastCol ? lastCol.x + 330 : 50,
        y: 100,
        tasks: []
      })
      this.save()
      return id;
    },

    // 删除列，同时删除相关的连接
    removeColumn(id) {
      this.columns = this.columns.filter(c => c.id !== id)
      this.connections = this.connections.filter(c => c.from !== id && c.to !== id)
      this.save()
    },

    // 更新列标题
    updateColumnTitle(id, title) {
      const col = this.columns.find(c => c.id === id)
      if (col) {
        col.title = title
        this.save()
      }
    },

    // 添加连接（防止重复添加）
    addConnection(from, to) {
      const exists = this.connections.some(conn =>
        (conn.from === from && conn.to === to) ||
        (conn.from === to && conn.to === from)
      )
      if (!exists && from !== to) {
        this.connections.push({ from, to })
        this.save()
      }
    },

    // 删除连接
    removeConnection(index) {
      this.connections.splice(index, 1)
      this.save()
    },

    // 反转连接方向
    reverseConnection(index) {
      const conn = this.connections[index]
      if (conn) {
        const temp = conn.from
        conn.from = conn.to
        conn.to = temp
        this.save()
      }
    },

    // 保存到 localStorage
    save() {
      const data = {
        columns: this.columns,
        connections: this.connections
      }
      localStorage.setItem('kanban-data', JSON.stringify(data))
    },

    // 从 localStorage 加载
    load() {
      const data = localStorage.getItem('kanban-data')
      if (data) {
        try {
          const parsed = JSON.parse(data)
          // 兼容旧版本数据格式
          if (Array.isArray(parsed)) {
            this.columns = parsed
          } else {
            this.columns = parsed.columns || []
            this.connections = parsed.connections || []
          }
        } catch (e) {
          // 解析失败就用默认数据
          console.log('加载数据失败，使用默认值')
        }
      }
    },

    // 重置到初始状态
    reset() {
      const initial = getInitialState()
      this.columns = initial.columns
      this.connections = initial.connections
      this.save()
    }
  }
})
