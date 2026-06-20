<template>
  <div class="kanban-container">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>任务看板</h2>
      </div>
      <div class="sidebar-menu">
        <el-button class="menu-btn" plain @click="addColumnDialog = true">+ 添加卡片</el-button>
        <el-button type="primary" class="menu-btn" @click="dialogVisible = true">+ 新增任务</el-button>
      </div>
      <div class="sidebar-stats">
        <div class="stat-item">
          <span class="stat-label">卡片</span>
          <span class="stat-value">{{ columns.length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">任务总数</span>
          <span class="stat-value">{{ totalTasks }}</span>
        </div>
        <div class="progress-section">
          <div class="progress-header">
            <span class="stat-label">整体进度</span>
            <span class="progress-percent">{{ completionRate }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: completionRate + '%' }"></div>
          </div>
        </div>
      </div>
      <div class="sidebar-footer">
        <el-button type="danger" plain class="menu-btn" @click="resetDialogVisible = true">一键清空</el-button>
      </div>
    </aside>

    <main class="main-area">
      <div class="toolbar">
        <div class="zoom-controls">
          <el-button text @click="zoomOut">-</el-button>
          <span>{{ Math.round(scale * 100) }}%</span>
          <el-button text @click="zoomIn">+</el-button>
        </div>
        <div class="view-controls">
          <el-button text @click="resetView">重置视图</el-button>
          <el-button text @click="toggleFullscreen">
            {{ isFullscreen ? "退出全屏" : "全屏" }}
          </el-button>
          <el-button text @click="helpDialogVisible = true">帮助</el-button>
        </div>
      </div>

      <div class="board-area" ref="boardAreaRef" @contextmenu.prevent>
        <div v-if="isFullscreen" class="fullscreen-toolbar">
          <el-button text @click="zoomOut">-</el-button>
          <span>{{ Math.round(scale * 100) }}%</span>
          <el-button text @click="zoomIn">+</el-button>
          <el-button text @click="resetView">重置视图</el-button>
          <el-button text @click="toggleFullscreen">退出全屏</el-button>
        </div>

        <div v-for="col in columns" :key="col.id" class="floating-column kanban-column" :class="{ expanded: isExpanded(col.id) }"
          :ref="el => { if (el) columnRefs[col.id] = el }" :data-col-id="col.id" :style="{
            left: col.x * scale + 'px',
            top: col.y * scale + 'px',
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }">
          <div class="col-title-bar" @mousedown="startDragColumn(col, $event)"
            @touchstart.passive="startDragColumnTouch(col, $event)">
            <template v-if="editingColumnId === col.id">
              <el-input
                v-model="editingColumnTitle"
                size="small"
                class="col-title-input"
                @mousedown.stop
                @blur="confirmEditColumn(col.id)"
                @keyup.enter="confirmEditColumn(col.id)"
                :ref="el => { if (el) columnTitleInput = el }"
                maxlength="10"
                show-word-limit
              />
            </template>
            <span v-else class="col-title-text" @dblclick.stop="startEditColumn(col)">{{ col.title }}</span>
            <div class="col-actions">
              <el-button type="primary" text size="small" @click.stop="toggleExpand(col.id)">
                {{ isExpanded(col.id) ? '收起' : '详情' }}
              </el-button>
              <el-button type="danger" text size="small" @click.stop="removeColumn(col.id)">x</el-button>
            </div>
          </div>
          <div class="col-tasks" :class="{ 'drag-over': isDragOverColumnId === col.id }"
            @dragover.prevent="onTaskDragOver(col.id)" @dragleave="onTaskDragLeave" @drop="onTaskDrop(col.id)">
            <div v-for="task in getSortedTasks(col.tasks)" :key="task.id" class="task-card" draggable="true"
              @dragstart="onDragStart(task)" @click="viewTask(task)"
              @touchstart.passive="onTaskTouchStart(task, $event)"
              @touchmove.passive="onTaskTouchMove($event)"
              @touchend="onTaskTouchEnd">
              <div class="task-title">{{ task.title }}</div>
              <div class="task-meta">
                <el-tag :type="priorityType(task.priority)" size="small">{{ priorityLabel(task.priority) }}</el-tag>
                <el-button type="danger" text size="small" @click.stop="deleteTask(task.id)">删除</el-button>
              </div>
            </div>
            <div v-if="col.tasks.length === 0" class="empty-hint">拖任务到这里</div>
          </div>
        </div>

        <svg class="connections" :width="boardWidth" :height="boardHeight">
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
              <polygon points="0 0, 8 4, 0 8" fill="#3182ce" />
            </marker>
          </defs>

          <g v-for="col in columns" :key="'points-' + col.id">
            <circle v-for="(point, pIdx) in getCardEdgePoints(col.id)" :key="pIdx" :cx="(point.x || 0) * (scale || 1)"
              :cy="(point.y || 0) * (scale || 1)" :r="(6 || 0) * (scale || 1)" fill="#3182ce" stroke="#fff" :stroke-width="(1 || 0) * (scale || 1)"
              class="connection-point" @mousedown.stop="handlePointClick(col.id, point.edge, $event)" />
          </g>

          <g v-for="(conn, idx) in connections" :key="'conn-' + idx">
            <line :x1="(getEdgePoint(conn.from, conn.to).x || 0) * (scale || 1)" :y1="(getEdgePoint(conn.from, conn.to).y || 0) * (scale || 1)"
              :x2="(getEdgePoint(conn.to, conn.from).x || 0) * (scale || 1)" :y2="(getEdgePoint(conn.to, conn.from).y || 0) * (scale || 1)"
              :stroke="selectedConnection === idx ? '#e53e3e' : '#3182ce'"
              :stroke-width="((selectedConnection === idx ? 3 : 2) || 0) * (scale || 1)" marker-end="url(#arrowhead)"
              class="connection-line" @click="selectConnection(idx)" @dblclick="reverseConnection(idx)" />
          </g>

          <line v-if="tempConnection" :x1="(tempConnection.startX || 0) * (scale || 1)" :y1="(tempConnection.startY || 0) * (scale || 1)"
            :x2="(tempConnection.endX || 0) * (scale || 1)" :y2="(tempConnection.endY || 0) * (scale || 1)" stroke="#3182ce"
            :stroke-width="(2 || 0) * (scale || 1)" stroke-dasharray="5,5" marker-end="url(#arrowhead)" />
        </svg>
      </div>
    </main>

    <el-dialog v-model="dialogVisible" title="新增任务" width="600px" :close-on-click-modal="false" :show-close="false"
      @close="dialogVisible = false">
      <el-form :model="form" label-width="100px" @submit.prevent="submitTask" id="task-form">
        <el-form-item label="任务名称">
          <el-input v-model="form.title" placeholder="输入任务名称" />
        </el-form-item>
        <el-form-item label="任务内容">
          <el-input v-model="form.content" type="textarea" :rows="3" placeholder="输入任务内容" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="form.priority" placeholder="选择优先级">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属卡片">
          <el-select v-model="form.columnId" placeholder="选择卡片">
            <el-option v-for="col in columns" :key="col.id" :label="col.title" :value="col.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" native-type="submit" form="task-form">确定(Enter)</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="addColumnDialog" title="添加卡片" width="500px" :close-on-click-modal="false" :show-close="false"
      @close="addColumnDialog = false">
      <el-form :model="newCol" label-width="100px" @submit.prevent="addColumn" id="column-form">
        <el-form-item label="卡片名称">
          <el-input v-model="newCol.title" placeholder="如：待办、进行中、已完成" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addColumnDialog = false">取消</el-button>
        <el-button type="primary" native-type="submit" form="column-form">确定(Enter)</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resetDialogVisible" title="确认清空" width="400px" :show-close="false">
      <div class="reset-warning">
        <div class="warning-icon">!</div>
        <p>确定要清空所有卡片和任务吗？</p>
        <p class="warning-tip">此操作不可恢复，所有数据将被重置为初始状态。</p>
      </div>
      <template #footer>
        <el-button @click="resetDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReset">确认清空</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="viewDialogVisible" title="任务详情" width="450px" :show-close="false">
      <div v-if="currentTask" class="task-detail">
        <div class="detail-row">
          <span class="label">名称：</span>
          <el-tag v-if="!editing.title" type="primary" size="large" @click="startEdit('title')">{{ currentTask.title
            }}</el-tag>
          <el-input v-else v-model="editValue.title" size="large" maxlength="10" show-word-limit
            @blur="cancelEdit('title')" @keyup.enter="confirmEdit('title')" ref="titleInput" autofocus />
        </div>
        <div class="detail-row">
          <span class="label">内容：</span>
          <div v-if="!editing.content" class="content-display" @click="startEdit('content')">
            {{ currentTask.content || '无' }}
          </div>
          <el-input v-else v-model="editValue.content" type="textarea" :rows="3" maxlength="30" show-word-limit
            @blur="cancelEdit('content')" @keydown.enter.prevent="confirmEdit('content')" ref="contentInput" />
        </div>
        <div class="detail-row">
          <span class="label">优先级：</span>
          <el-tag v-if="!editing.priority" :type="priorityType(currentTask.priority)" size="large"
            @click="startEdit('priority')">{{ priorityLabel(currentTask.priority) }}</el-tag>
          <el-select v-else v-model="editValue.priority" size="large" @blur="cancelEdit('priority')"
            @change="confirmEdit('priority')" ref="priorityInput">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </div>
        <div class="detail-row">
          <span class="label">所属卡片：</span>
          <el-tag v-if="!editing.columnId" type="info" size="large">{{ getColumnTitle(currentTask.status) }}</el-tag>
          <el-select v-else v-model="editValue.columnId" size="large" @blur="cancelEdit('columnId')"
            @change="confirmEdit('columnId')" ref="columnInput">
            <el-option v-for="col in columns" :key="col.id" :label="col.title" :value="col.id" />
          </el-select>
        </div>
      </div>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="helpDialogVisible" title="使用帮助" width="700px" :show-close="false"
      @close="helpDialogVisible = false">
      <div class="help-content">
        <div class="help-section">
          <h4>卡片操作</h4>
          <ul>
            <li v-for="item in cardHelps" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="help-section">
          <h4>任务操作</h4>
          <ul>
            <li v-for="item in taskHelps" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="help-section">
          <h4>关系线操作</h4>
          <ul>
            <li v-for="item in connectionHelps" :key="item">{{ item }}</li>
          </ul>
        </div>

        <div class="help-section">
          <h4>视图操作</h4>
          <ul>
            <li v-for="item in viewHelps" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="helpDialogVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useKanbanStore } from "../stores/kanban.js";

const cardHelps = [
  '拖动标题栏移动卡片位置',
  '双击卡片标题修改名称',
  '点击"详情"展开卡片显示全部任务',
  '点击"×"删除卡片及所有任务'
]

const taskHelps = [
  '点击任务卡片查看详情',
  '拖动任务卡片移动到其他卡片',
  '点击任务上的"删除"移除任务',
  '任务按优先级从高到低自动排序'
]

const connectionHelps = [
  '拖动蓝色连接点创建新连接',
  '点击连接线选中，按 Delete 键删除',
  '双击连接线调换箭头方向',
  '一个卡片可连接多个不同卡片'
]

const viewHelps = [
  '使用 +/- 按钮缩放视图',
  '点击"重置视图"恢复默认缩放',
  '点击"全屏"进入全屏模式'
]


const store = useKanbanStore();
const { columns, connections } = storeToRefs(store);

// 弹窗状态
const dialogVisible = ref(false);
const viewDialogVisible = ref(false);
const addColumnDialog = ref(false);
const helpDialogVisible = ref(false);
const resetDialogVisible = ref(false);

const currentTask = ref(null);
const form = reactive({ title: "", content: "", priority: "medium", columnId: "" });
const newCol = reactive({ title: "" });

const editing = reactive({ title: false, content: false, priority: false, columnId: false });
const editValue = reactive({ title: '', content: '', priority: 'medium', columnId: '' });
const titleInput = ref(null);
const contentInput = ref(null);
const priorityInput = ref(null);
const columnInput = ref(null);
const columnTitleInput = ref(null);

const editingColumnId = ref(null);
const editingColumnTitle = ref('');

const scale = ref(1);
const isFullscreen = ref(false);
const boardAreaRef = ref(null);
const columnRefs = reactive({});
const boardWidth = ref(1000);
const boardHeight = ref(800);
const isDragOverColumnId = ref(null);
const tempConnection = ref(null);
const selectedConnection = ref(null);

let draggedTask = null;
let dragColumn = null;
let dragOffset = { x: 0, y: 0 };
let isDraggingColumn = false;

const totalTasks = computed(() => {
  return columns.value.reduce((sum, col) => sum + col.tasks.length, 0);
});

// 计算完成进度，找标题里有"完成"字样的列
const completionRate = computed(() => {
  if (totalTasks.value === 0) return 0;
  const doneTasks = columns.value
    .filter(col => col.title.includes('完成') || col.title.includes('已完成') || col.title.includes('Done'))
    .reduce((sum, col) => sum + col.tasks.length, 0);
  return Math.round((doneTasks / totalTasks.value) * 100);
});

// 优先级排序：high > medium > low
const priorityOrder = (priority) => {
  const orders = { high: 0, medium: 1, low: 2 };
  return orders[priority] ?? 3;
};

// 按优先级排序任务
const getSortedTasks = (tasks) => {
  return [...tasks].sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
};

const expandedColumns = ref(new Set());

const toggleExpand = (colId) => {
  if (expandedColumns.value.has(colId)) {
    expandedColumns.value.delete(colId);
  } else {
    expandedColumns.value.add(colId);
  }
  expandedColumns.value = new Set(expandedColumns.value);
};

const isExpanded = (colId) => expandedColumns.value.has(colId);

// 任务拖拽开始
const onDragStart = (task) => {
  draggedTask = task;
};

// 任务拖放
const onTaskDrop = (columnId) => {
  isDragOverColumnId.value = null;
  if (!draggedTask || draggedTask.status === columnId) {
    draggedTask = null;
    return;
  }

  store.moveTask(draggedTask.id, columnId);
  draggedTask = null;
};

const onTaskDragOver = (columnId) => {
  isDragOverColumnId.value = columnId;
};

const onTaskDragLeave = () => {
  isDragOverColumnId.value = null;
};

// 移动端触摸事件
let touchDraggedTask = null;
let touchStartX = 0;
let touchStartY = 0;
let hasTouchMoved = false;

const onTaskTouchStart = (task, e) => {
  if (e.target.closest('.el-button')) return;
  touchDraggedTask = task;
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  hasTouchMoved = false;
};

const onTaskTouchMove = (e) => {
  if (!touchDraggedTask) return;
  const touch = e.touches[0];
  const deltaX = Math.abs(touch.clientX - touchStartX);
  const deltaY = Math.abs(touch.clientY - touchStartY);
  
  // 防止误触点击
  if (deltaX > 5 || deltaY > 5) {
    hasTouchMoved = true;
  }
  
  // 检测当前拖到哪个卡片上了
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  const colTaskEl = el?.closest('.col-tasks');
  if (colTaskEl) {
    const colEl = colTaskEl.closest('.kanban-column');
    if (colEl) {
      const colId = colEl.getAttribute('data-col-id');
      if (colId) {
        isDragOverColumnId.value = colId;
      }
    }
  } else {
    isDragOverColumnId.value = null;
  }
};

const onTaskTouchEnd = () => {
  // 如果有拖拽任务且真的发生了移动且拖到了有效区域，执行移动
  if (touchDraggedTask && hasTouchMoved && isDragOverColumnId.value) {
    if (touchDraggedTask.status !== isDragOverColumnId.value) {
      store.moveTask(touchDraggedTask.id, isDragOverColumnId.value);
    }
  } 
  // 如果有拖拽任务但完全没移动，说明是想点击查看详情
  else if (touchDraggedTask && !hasTouchMoved) {
    viewTask(touchDraggedTask);
  }
  
  touchDraggedTask = null;
  isDragOverColumnId.value = null;
  hasTouchMoved = false;
};

const viewTask = (task) => {
  currentTask.value = task;
  viewDialogVisible.value = true;
};

const submitTask = () => {
  if (!form.title.trim() || !form.columnId) return;
  store.addTask(form.title, form.priority, form.content, form.columnId);
  // 清空表单
  form.title = "";
  form.content = "";
  form.priority = "medium";
  form.columnId = "";
  dialogVisible.value = false;
};

const deleteTask = (id) => {
  store.deleteTask(id);
};

const addColumn = () => {
  if (!newCol.title.trim()) return;
  // 先记住最后一个列的id，新增后自动创建连接
  const lastColId = columns.value.length > 0 ? columns.value[columns.value.length - 1].id : null;
  const newId = store.addColumn(newCol.title);
  if (lastColId) {
    store.addConnection(lastColId, newId);
  }
  newCol.title = "";
  addColumnDialog.value = false;
};

const removeColumn = (id) => {
  store.removeColumn(id);
};

const startEditColumn = (col) => {
  editingColumnId.value = col.id;
  editingColumnTitle.value = col.title;
  nextTick(() => {
    if (columnTitleInput.value) {
      const input = columnTitleInput.value.$el.querySelector('input');
      if (input) {
        input.focus();
        input.select();
      }
    }
  });
};

const confirmEditColumn = (id) => {
  if (!editingColumnTitle.value.trim()) {
    cancelEditColumn();
    return;
  }
  store.updateColumnTitle(id, editingColumnTitle.value.trim());
  editingColumnId.value = null;
  editingColumnTitle.value = '';
};

const cancelEditColumn = () => {
  editingColumnId.value = null;
  editingColumnTitle.value = '';
};

const handleReset = () => {
  store.reset();
  resetDialogVisible.value = false;
  scale.value = 1;
  selectedConnection.value = null;
  expandedColumns.value = new Set();
};

const getColumnTitle = (status) => {
  const col = columns.value.find(c => c.id === status);
  return col ? col.title : "未知";
};

const getColumnById = (id) => {
  return columns.value.find(c => c.id === id) || columns.value[0];
};

const EDGE_OFFSET = 10;

// 计算两个卡片之间的连线坐标
const getEdgePoint = (fromId, toId) => {
  const fromCol = columns.value.find(c => c.id === fromId);
  const toCol = columns.value.find(c => c.id === toId);
  if (!fromCol || !toCol) return { x: 0, y: 0 };

  const fromEl = columnRefs[fromId];
  const toEl = columnRefs[toId];
  if (!fromEl || !toEl) return { x: 0, y: 0 };

  const fromWidth = fromEl.offsetWidth || 280;
  const fromHeight = fromEl.offsetHeight || 100;
  const toWidth = toEl.offsetWidth || 280;
  const toHeight = toEl.offsetHeight || 100;

  const fromX = fromCol.x;
  const fromY = fromCol.y;
  const toX = toCol.x;
  const toY = toCol.y;

  const fromCenterX = fromX + fromWidth / 2;
  const fromCenterY = fromY + fromHeight / 2;
  const toCenterX = toX + toWidth / 2;
  const toCenterY = toY + toHeight / 2;

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  let edgePoint = { x: fromCenterX, y: fromCenterY };

  // 根据两个卡片的相对位置决定从哪边连
  if (Math.abs(dx) > Math.abs(dy)) {
    edgePoint.x = dx > 0 ? fromX + fromWidth : fromX;
  } else {
    edgePoint.y = dy > 0 ? fromY + fromHeight : fromY;
  }

  const offset = EDGE_OFFSET / (scale.value || 1);
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    edgePoint.x += (dx / len) * offset;
    edgePoint.y += (dy / len) * offset;
  }

  // 确保返回的是有效数字，不然会报错
  return {
    x: isFinite(edgePoint.x) ? edgePoint.x : 0,
    y: isFinite(edgePoint.y) ? edgePoint.y : 0
  };
};

// 获取卡片四个边的连接点
const getCardEdgePoints = (colId) => {
  const col = columns.value.find(c => c.id === colId);
  if (!col) return [];

  const el = columnRefs[colId];
  if (!el) return [];

  const width = el.offsetWidth || 280;
  const height = el.offsetHeight || 100;
  const x = col.x;
  const y = col.y;

  return [
    { x: x + width / 2, y: y, edge: 'top' },
    { x: x + width, y: y + height / 2, edge: 'right' },
    { x: x + width / 2, y: y + height, edge: 'bottom' },
    { x: x, y: y + height / 2, edge: 'left' }
  ].map(point => ({
    ...point,
    x: isFinite(point.x) ? point.x : 0,
    y: isFinite(point.y) ? point.y : 0
  }));
};

const getPointConnectionStatus = (colId, edge) => {
  const connIndex = connections.value.findIndex(conn => conn.from === colId || conn.to === colId);
  if (connIndex !== -1) {
    return { hasConnection: true, connIndex };
  }
  return { hasConnection: false, connIndex: -1 };
};

const handlePointClick = (colId, edge, e) => {
  if (e.button === 0) {
    startNewConnection(colId, edge, e);
  }
};

const startNewConnection = (colId, edge, e) => {
  const points = getCardEdgePoints(colId);
  const point = points.find(p => p.edge === edge);
  if (!point) return;

  tempConnection.value = {
    fromColId: colId,
    fromEdge: edge,
    startX: point.x || 0,
    startY: point.y || 0,
    endX: point.x || 0,
    endY: point.y || 0
  };

  document.addEventListener('mousemove', onTempConnectionMove);
  document.addEventListener('mouseup', onTempConnectionEnd);
};

const onTempConnectionMove = (e) => {
  if (!tempConnection.value) return;

  const boardArea = boardAreaRef.value;
  if (!boardArea) return;

  const rect = boardArea.getBoundingClientRect();
  tempConnection.value.endX = (e.clientX - rect.left) / (scale.value || 1);
  tempConnection.value.endY = (e.clientY - rect.top) / (scale.value || 1);
  
  tempConnection.value.endX = isFinite(tempConnection.value.endX) ? tempConnection.value.endX : 0;
  tempConnection.value.endY = isFinite(tempConnection.value.endY) ? tempConnection.value.endY : 0;
};

const onTempConnectionEnd = (e) => {
  if (!tempConnection.value) return;

  const boardArea = boardAreaRef.value;
  if (boardArea) {
    const rect = boardArea.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / (scale.value || 1);
    const mouseY = (e.clientY - rect.top) / (scale.value || 1);

    for (const col of columns.value) {
      if (col.id === tempConnection.value.fromColId) continue;

      const el = columnRefs[col.id];
      if (!el) continue;

      const x = col.x;
      const y = col.y;
      const w = el.offsetWidth || 280;
      const h = el.offsetHeight || 100;

      if (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h) {
        store.addConnection(tempConnection.value.fromColId, col.id);
        break;
      }
    }
  }

  tempConnection.value = null;
  document.removeEventListener('mousemove', onTempConnectionMove);
  document.removeEventListener('mouseup', onTempConnectionEnd);
};

const selectConnection = (idx) => {
  selectedConnection.value = selectedConnection.value === idx ? null : idx;
};

const reverseConnection = (idx) => {
  store.reverseConnection(idx);
};

const deleteConnection = (idx) => {
  store.removeConnection(idx);
  selectedConnection.value = null;
};

// 卡片拖拽开始
const startDragColumn = (col, e) => {
  if (e.target.closest(".el-button") || e.target.closest(".col-title-input")) return;
  dragColumn = col;
  const boardArea = boardAreaRef.value;
  if (boardArea) {
    const rect = boardArea.getBoundingClientRect();
    const scaledX = col.x * scale.value;
    const scaledY = col.y * scale.value;
    dragOffset.x = e.clientX - rect.left - scaledX;
    dragOffset.y = e.clientY - rect.top - scaledY;
  }
  isDraggingColumn = true;
};

// 卡片触摸拖拽开始
const startDragColumnTouch = (col, e) => {
  if (e.target.closest(".el-button") || e.target.closest(".col-title-input")) return;
  const touch = e.touches[0];
  dragColumn = col;
  const boardArea = boardAreaRef.value;
  if (boardArea) {
    const rect = boardArea.getBoundingClientRect();
    const scaledX = col.x * scale.value;
    const scaledY = col.y * scale.value;
    dragOffset.x = touch.clientX - rect.left - scaledX;
    dragOffset.y = touch.clientY - rect.top - scaledY;
  }
  isDraggingColumn = true;
};

const onTouchMove = (e) => {
  if (isDraggingColumn && dragColumn) {
    const touch = e.touches[0];
    const boardArea = boardAreaRef.value;
    if (boardArea) {
      const rect = boardArea.getBoundingClientRect();
      const newX = touch.clientX - rect.left - dragOffset.x;
      const newY = touch.clientY - rect.top - dragOffset.y;
      
      const colEl = columnRefs[dragColumn.id];
      const colWidth = colEl ? colEl.offsetWidth : 280;
      const colHeight = colEl ? colEl.offsetHeight : 300;
      
      // 边界检测，不能拖出可视区域
      const maxX = rect.width - colWidth * scale.value;
      const maxY = rect.height - colHeight * scale.value;
      dragColumn.x = Math.max(0, Math.min(maxX / scale.value, newX / scale.value));
      dragColumn.y = Math.max(0, Math.min(maxY / scale.value, newY / scale.value));
    }
  }
};

const onTouchEnd = () => {
  isDraggingColumn = false;
  dragColumn = null;
};

const onMouseMove = (e) => {
  if (isDraggingColumn && dragColumn) {
    const boardArea = boardAreaRef.value;
    if (boardArea) {
      const rect = boardArea.getBoundingClientRect();
      const newX = e.clientX - rect.left - dragOffset.x;
      const newY = e.clientY - rect.top - dragOffset.y;
      
      const colEl = columnRefs[dragColumn.id];
      const colWidth = colEl ? colEl.offsetWidth : 280;
      const colHeight = colEl ? colEl.offsetHeight : 300;
      
      const maxX = rect.width - colWidth * scale.value;
      const maxY = rect.height - colHeight * scale.value;
      dragColumn.x = Math.max(0, Math.min(maxX / scale.value, newX / scale.value));
      dragColumn.y = Math.max(0, Math.min(maxY / scale.value, newY / scale.value));
    }
  }
};

const onMouseUp = () => {
  isDraggingColumn = false;
  dragColumn = null;
};

const zoomIn = () => {
  scale.value = Math.min(2, scale.value + 0.1);
};

const zoomOut = () => {
  scale.value = Math.max(0.5, scale.value - 0.1);
};

const resetView = () => {
  scale.value = 1;
  updateBoardSize();
};

const toggleFullscreen = () => {
  const boardArea = boardAreaRef.value;
  if (!boardArea) return;

  if (!document.fullscreenElement) {
    boardArea.requestFullscreen();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen();
    isFullscreen.value = false;
  }
};

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;
};

const startEdit = (field) => {
  editing[field] = true;
  editValue[field] = currentTask.value[field] || '';

  nextTick(() => {
    if (field === 'title' && titleInput.value) titleInput.value.focus();
    if (field === 'content' && contentInput.value) contentInput.value.focus();
    if (field === 'priority' && priorityInput.value) priorityInput.value.focus();
    if (field === 'columnId' && columnInput.value) columnInput.value.focus();
  });
};

const confirmEdit = (field) => {
  if (field === 'title') {
    currentTask.value.title = editValue.title;
    store.updateTask(currentTask.value.id, editValue.title);
  } else if (field === 'content') {
    currentTask.value.content = editValue.content;
    store.updateTask(currentTask.value.id, undefined, undefined, editValue.content);
  } else if (field === 'priority') {
    currentTask.value.priority = editValue.priority;
    store.updateTask(currentTask.value.id, undefined, editValue.priority);
  } else if (field === 'columnId') {
    // 只有列改变了才移动
    if (currentTask.value.status !== editValue.columnId) {
      store.moveTask(currentTask.value.id, editValue.columnId);
      currentTask.value.status = editValue.columnId;
    }
  }
  editing[field] = false;
};

const cancelEdit = (field) => {
  editing[field] = false;
  editValue[field] = '';
};

// 组件挂载时初始化
onMounted(() => {
  store.load()
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
  window.addEventListener("keydown", handleKeyDown);
  updateBoardSize();
  window.addEventListener("resize", updateBoardSize);
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("touchend", onTouchEnd);
  document.removeEventListener("fullscreenchange", handleFullscreenChange);
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("resize", updateBoardSize);
});

const handleKeyDown = (e) => {
  // Delete键删除选中的连线
  if (e.key === 'Delete' && selectedConnection.value !== null) {
    deleteConnection(selectedConnection.value);
  }
};

const updateBoardSize = () => {
  if (boardAreaRef.value) {
    const rect = boardAreaRef.value.getBoundingClientRect();
    boardWidth.value = rect.width;
    boardHeight.value = rect.height;
  }
};

const priorityType = (p) => {
  return p === "high" ? "danger" : p === "low" ? "info" : "warning";
};

const priorityLabel = (p) => {
  return p === "high" ? "高" : p === "low" ? "低" : "中";
};
</script>

<style scoped lang="scss">
.kanban-container {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
}

.sidebar {
  width: 220px;
  background: #ffffff;
  border-right: 1px solid #e8ecf1;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.sidebar-header {
  margin-bottom: 30px;

  h2 {
    margin: 0;
    font-size: 20px;
    color: #1a1a2e;
  }
}

.sidebar-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 30px;
}

.menu-btn {
  width: 100%;
  font-size: 15px;
  margin-left: 0 !important;
}

.sidebar-stats {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid #e8ecf1;

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    &:last-child {
      margin-bottom: 0;
    }

    .stat-label {
      font-size: 13px;
      color: #718096;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 700;
      color: #4299e1;
    }
  }

  .progress-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #edf2f7;

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .stat-label {
        font-size: 13px;
        color: #718096;
      }

      .progress-percent {
        font-size: 14px;
        font-weight: 700;
        color: #48bb78;
      }
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #48bb78, #38a169);
        border-radius: 4px;
        transition: width 0.3s ease;
      }
    }
  }
}

.sidebar-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e8ecf1;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #ffffff;
  border-bottom: 1px solid #e8ecf1;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #4a5568;

  button {
    width: 32px;
    height: 32px;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.view-controls {
  display: flex;
  gap: 10px;
}

.board-area {
  flex: 1;
  position: relative;
  overflow: auto;
  background-color: #fafbfc;
  background-image:
    linear-gradient(rgba(200, 210, 220, 0.3) 1px, transparent 1px),
    linear-gradient(90deg, rgba(200, 210, 220, 0.3) 1px, transparent 1px);
  background-size: 50px 50px;
  user-select: none;
}

.fullscreen-toolbar {
  position: fixed;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  backdrop-filter: blur(8px);
}

.fullscreen-toolbar span {
  font-size: 14px;
  color: #4a5568;
  min-width: 40px;
  text-align: center;
}

.floating-column {
  position: absolute;
  width: 280px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid #e8ecf1;
  cursor: move;
  z-index: 10;

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  &.expanded {
    .col-tasks {
      max-height: none;
    }
  }
}

.col-actions {
  display: flex;
  gap: 4px;
}

.col-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 700;
  font-size: 15px;
  color: #4a5568;
  background: #f7fafc;
  border-radius: 12px 12px 0 0;
  border-bottom: 2px solid #e2e8f0;
  cursor: move;
  user-select: none;

  .col-title-text {
    cursor: text;
    flex: 1;
    margin-right: 8px;
    transition: color 0.2s;

    &:hover {
      color: #3182ce;
    }
  }

  .col-title-input {
    flex: 1;
    margin-right: 8px;

    :deep(.el-input__wrapper) {
      box-shadow: 0 0 0 1px #4299e1 inset;
      background: #fff;

      &:hover {
        box-shadow: 0 0 0 1px #3182ce inset;
      }

      &.is-focus {
        box-shadow: 0 0 0 1px #3182ce inset;
      }
    }

    :deep(.el-input__inner) {
      font-weight: 600;
      font-size: 14px;
    }
  }
}

.col-tasks {
  padding: 12px;
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s;

  &.drag-over {
    background: rgba(66, 153, 225, 0.1);
    border: 2px dashed #4299e1;
    border-radius: 8px;
  }
}

.task-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 12px;
  cursor: move;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border-left: 4px solid #4299e1;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }

  &:active {
    cursor: move;
    transform: scale(1.03);
    border-left-color: #ed8936;
  }
}

.task-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #2d3748;
  font-size: 14px;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-hint {
  text-align: center;
  color: #a0aec0;
  font-size: 13px;
  padding: 20px;
}

.connections {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
  overflow: visible;
}

.connections line,
.connections circle {
  pointer-events: auto;
}

.connection-point {
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    r: 8;
    fill: #2b6cb0;
  }
}

.connection-line {
  cursor: pointer;
  transition: stroke 0.2s;

  &:hover {
    stroke: #2b6cb0;
  }
}

.task-detail {
  .detail-row {
    display: flex;
    align-items: flex-start;
    margin-bottom: 20px;
    font-size: 14px;
    line-height: 1.6;

    &:last-child {
      margin-bottom: 0;
    }

    .label {
      flex-shrink: 0;
      width: 80px;
      font-weight: 600;
      color: #718096;
      margin-right: 12px;
      padding-top: 6px;
    }

    .content-display {
      flex: 1;
      display: inline-block;
      min-height: 32px;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      color: #2d3748;
      background: #f7fafc;
      border: 1px solid transparent;
      transition: all 0.2s;

      &:hover {
        background: #edf2f7;
        border-color: #e2e8f0;
      }
    }

    .el-tag {
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    }

    .el-input,
    .el-select {
      flex: 1;
    }

    :deep(.el-input__wrapper) {
      box-shadow: 0 0 0 1px #4299e1 inset;
      border-radius: 6px;

      &:hover {
        box-shadow: 0 0 0 1px #3182ce inset;
      }

      &.is-focus {
        box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.2) inset;
      }
    }

    :deep(.el-textarea__inner) {
      border: 1px solid #4299e1;
      border-radius: 6px;
      resize: none;

      &:hover {
        border-color: #3182ce;
      }

      &:focus {
        border-color: #3182ce;
        box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
      }
    }

    :deep(.el-select .el-input__wrapper) {
      box-shadow: 0 0 0 1px #4299e1 inset;
      border-radius: 6px;
    }
  }
}

.help-content {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.help-section {
  width: calc(50% - 6px);
  background: #f7fafc;
  border-radius: 8px;
  padding: 12px;
  border-left: 3px solid #3182ce;

  h4 {
    color: #2d3748;
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 18px;
    color: #4a5568;
    font-size: 12px;
    line-height: 1.6;

    li {
      margin-bottom: 4px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}

.reset-warning {
  text-align: center;
  padding: 20px 0;

  .warning-icon {
    width: 48px;
    height: 48px;
    line-height: 46px;
    margin: 0 auto 12px;
    border-radius: 50%;
    background: #fdf6ec;
    color: #e6a23c;
    font-size: 24px;
    font-weight: bold;
    border: 2px solid #e6a23c;
  }

  p {
    margin: 0;
    font-size: 15px;
    color: #303133;
  }

  .warning-tip {
    font-size: 13px !important;
    color: #909399 !important;
    margin-top: 8px !important;
  }
}

:deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;

  .el-dialog__header {
    border-bottom: 1px solid #e2e8f0;
    padding: 16px 20px;
    margin: 0;

    .el-dialog__title {
      font-weight: 700;
      font-size: 16px;
      color: #2d3748;
    }

    .el-dialog__headerbtn {
      display: none;
    }
  }

  .el-dialog__body {
    padding: 20px;
  }

  .el-dialog__footer {
    border-top: 1px solid #e2e8f0;
    padding: 12px 20px;
  }
}

@media (max-width: 1024px) {
  .sidebar {
    width: 180px;
    padding: 16px;
  }

  .sidebar-header h2 {
    font-size: 18px;
  }

  .floating-column {
    width: 240px;
  }

  .toolbar {
    padding: 10px 16px;
  }

  :deep(.el-dialog) {
    width: 80% !important;
    max-width: 500px;

    .el-dialog__header {
      padding: 14px 18px;

      .el-dialog__title {
        font-size: 15px;
      }
    }

    .el-dialog__body {
      padding: 16px 18px;
    }

    .el-dialog__footer {
      padding: 10px 18px;
    }
  }
}

@media (max-width: 768px) {
  .kanban-container {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    flex-direction: row;
    align-items: center;
    padding: 10px 16px;
    border-right: none;
    border-bottom: 1px solid #e8ecf1;
  }

  .sidebar-header {
    margin-bottom: 0;
    margin-right: 20px;

    h2 {
      font-size: 16px;
    }
  }

  .sidebar-menu {
    flex-direction: row;
    margin-bottom: 0;
    margin-right: auto;

    .menu-btn {
      width: auto;
      font-size: 13px;
      padding: 8px 12px;
    }
  }

  .sidebar-stats {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    .stat-item {
      margin-bottom: 0;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;

      .stat-label {
        font-size: 11px;
      }

      .stat-value {
        font-size: 16px;
      }
    }

    .progress-section {
      width: 100%;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #edf2f7;

      .progress-header {
        margin-bottom: 6px;

        .stat-label {
          font-size: 11px;
        }

        .progress-percent {
          font-size: 12px;
        }
      }

      .progress-bar {
        height: 6px;
      }
    }
  }

  .sidebar-footer {
    width: 100%;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #e8ecf1;

    .menu-btn {
      width: 100%;
    }
  }

  .toolbar {
    padding: 8px 12px;
  }

  .zoom-controls {
    font-size: 12px;
    gap: 6px;

    button {
      width: 28px;
      height: 28px;
      font-size: 16px;
    }
  }

  .view-controls {
    gap: 6px;

    button {
      font-size: 12px;
      padding: 6px 10px;
    }
  }

  .floating-column {
    width: 200px;
  }

  .col-title-bar {
    padding: 10px 12px;
    font-size: 14px;
  }

  .col-tasks {
    padding: 10px;
    max-height: 240px;
    gap: 8px;
  }

  .task-card {
    padding: 10px;
  }

  .task-title {
    font-size: 13px;
  }

  .help-section {
    width: 100%;
  }

  .fullscreen-toolbar {
    top: 6px;
    right: 6px;
    padding: 6px 8px;

    span {
      font-size: 12px;
      min-width: 32px;
    }

    button {
      font-size: 12px;
      padding: 4px 8px;
    }
  }

  :deep(.el-dialog) {
    width: 92% !important;
    max-width: none;
    margin: 5vh auto !important;

    .el-dialog__header {
      padding: 12px 16px;

      .el-dialog__title {
        font-size: 14px;
      }
    }

    .el-dialog__body {
      padding: 14px 16px;
    }

    .el-dialog__footer {
      padding: 10px 16px;
    }
  }
}

@media (max-width: 480px) {
  .sidebar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .sidebar-header {
    width: 100%;
    margin-right: 0;
  }

  .sidebar-menu {
    width: 100%;
    justify-content: flex-start;
  }

  .sidebar-stats {
    width: 100%;
    justify-content: flex-start;
  }

  .toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .floating-column {
    width: 180px;
  }

  .col-tasks {
    max-height: 200px;
  }

  :deep(.el-dialog) {
    width: 95% !important;
    margin: 3vh auto !important;

    .el-dialog__header {
      padding: 10px 14px;

      .el-dialog__title {
        font-size: 13px;
      }
    }

    .el-dialog__body {
      padding: 12px 14px;
    }

    .el-dialog__footer {
      padding: 8px 14px;
    }
  }

  .task-detail .detail-row {
    flex-direction: column;

    .label {
      width: 100%;
      margin-right: 0;
      margin-bottom: 4px;
      padding-top: 0;
    }

    .content-display,
    .el-input,
    .el-select {
      width: 100%;
    }
  }

  .el-form-item {
    margin-bottom: 14px;

    :deep(.el-form-item__label) {
      font-size: 13px;
    }
  }

  .help-content {
    flex-direction: column;

    .help-section {
      width: 100%;
    }
  }
}
</style>
