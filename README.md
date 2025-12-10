# AsyncQueue

一个强大的 TypeScript 异步任务队列管理库，支持任务顺序执行、失败重试、事件监听等功能。

## 功能特性

- ✨ **顺序执行**：按添加顺序依次执行异步任务
- 🎯 **去重机制**：同一 ID 的任务不会被重复添加到队列
- 🛑 **灵活控制**：支持暂停、继续、重置队列操作
- 📢 **事件系统**：完整的任务和队列事件监听
- ⚙️ **配置灵活**：支持多种队列执行策略
- 🔄 **错误处理**：可配置失败时是否继续执行后续任务

## 安装

```bash
npm install @hucy_hucy/async-queue
```

或使用 pnpm：

```bash
pnpm add @hucy_hucy/async-queue
```

## 快速开始

### 基础用法

```javascript
import AsyncQueue from '@hucy_hucy/async-queue'

// 创建队列实例
const queue = new AsyncQueue()

// 添加任务
queue.push('task-1', () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Task 1 completed')
      resolve()
    }, 1000)
  })
})

queue.push('task-2', () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Task 2 completed')
      resolve()
    }, 1000)
  })
})

// 开始执行
queue.exec()
```

## 配置选项

在创建队列时可以传递配置对象：

```javascript
const queue = new AsyncQueue({
  // 是否在任务添加后立即开始执行队列
  immediate: false,
  
  // 是否在任务完成后移除任务
  // false: 同名任务不会被重复添加到队列（默认行为）
  // true: 完成后移除任务，允许同名任务重新添加
  removeAfterFinish: false,
  
  // 任务失败时是否继续执行队列
  // false: 任务失败后停止执行（默认行为）
  // true: 任务失败后继续执行下一个任务
  continueWhenError: false
})
```

## API 文档

### 方法

#### `push(id, executeFn, pushFailureFn?)`

添加任务到队列。

**参数：**
- `id` (string): 任务唯一标识
- `executeFn` (Function): 任务执行函数，必须返回 Promise
- `pushFailureFn` (Function, 可选): 添加失败时的回调（如任务已存在）

**返回值：** Promise

**示例：**

```javascript
queue.push('fetch-user', async (payload) => {
  const response = await fetch('/api/user')
  return response.json()
}, (error, existTask) => {
  console.log('Task already exists:', error)
})
```

#### `exec()`

开始执行队列中的任务。

```javascript
queue.exec()
```

#### `pause()`

暂停队列执行。当前执行中的任务会完成，但不会继续执行下一个任务。

```javascript
queue.pause()
```

#### `resume()`

恢复队列执行。

```javascript
queue.resume()
```

#### `reset(resetFailureFn?)`

重置队列，清空所有任务。

**参数：**
- `resetFailureFn` (Function, 可选): 重置失败时的回调

```javascript
queue.reset(() => {
  console.log('Queue reset failed')
})
```

#### `isRunning()`

检查队列是否正在运行。

```javascript
if (queue.isRunning()) {
  console.log('Queue is running')
}
```

#### `isPause()`

检查队列是否暂停。

#### `isFinished()`

检查队列是否执行完成。

### 静态常量

#### 任务状态

```javascript
AsyncQueue.STATUS_WAITING    // 等待中
AsyncQueue.STATUS_PEDDING    // 执行中
AsyncQueue.STATUS_SUCCESS    // 成功
AsyncQueue.STATUS_FAILURE    // 失败
```

#### 队列状态

```javascript
AsyncQueue.STATUS_QUEUE_WAITING      // 等待中
AsyncQueue.STATUS_QUEUE_RUNNING      // 运行中
AsyncQueue.STATUS_QUEUE_BEFORE_PAUSE // 准备暂停
AsyncQueue.STATUS_QUEUE_PAUSE        // 已暂停
AsyncQueue.STATUS_QUEUE_FINISH       // 已完成
```

#### 事件常量

```javascript
// 任务事件
AsyncQueue.EVENT_TASK_START      // 任务开始
AsyncQueue.EVENT_TASK_SUCCESS    // 任务成功
AsyncQueue.EVENT_TASK_FAILURE    // 任务失败

// 队列事件
AsyncQueue.EVENT_QUEUE_START     // 队列开始
AsyncQueue.EVENT_QUEUE_PAUSE     // 队列暂停
AsyncQueue.EVENT_QUEUE_FINISH    // 队列完成
```

## 事件监听

AsyncQueue 直接继承自 Emitter，可以直接使用事件方法：

### 任务事件

```javascript
// 任务开始
queue.on(AsyncQueue.EVENT_TASK_START, ({ payload, waitQueue, finishQueue }) => {
  console.log('Task started:', payload.id)
})

// 任务成功
queue.on(AsyncQueue.EVENT_TASK_SUCCESS, ({ payload, waitQueue, finishQueue, response }) => {
  console.log('Task completed:', payload.id)
  console.log('Response:', response)
})

// 任务失败
queue.on(AsyncQueue.EVENT_TASK_FAILURE, ({ payload, waitQueue, finishQueue, error }) => {
  console.log('Task failed:', payload.id)
  console.error('Error:', error)
})
```

### 队列事件

```javascript
// 队列开始
queue.on(AsyncQueue.EVENT_QUEUE_START, ({ waitQueue, finishQueue }) => {
  console.log('Queue started')
})

// 队列暂停
queue.on(AsyncQueue.EVENT_QUEUE_PAUSE, ({ waitQueue, finishQueue }) => {
  console.log('Queue paused')
})

// 队列完成
queue.on(AsyncQueue.EVENT_QUEUE_FINISH, ({ waitQueue, finishQueue }) => {
  console.log('Queue finished')
})
```

### Emitter 的其他方法

```javascript
// 只监听一次
queue.once(AsyncQueue.EVENT_TASK_SUCCESS, handler)

// 取消监听
const unsubscribe = queue.on(AsyncQueue.EVENT_TASK_START, handler)
unsubscribe() // 或者

queue.off(AsyncQueue.EVENT_TASK_START, handler)

// 获取监听器数量
const count = queue.listenerCount(AsyncQueue.EVENT_TASK_START)

// 获取所有事件名称
const events = queue.eventNames()

// 清空所有监听器
queue.clear()

// 清空指定事件的监听器
queue.clearEvent(AsyncQueue.EVENT_TASK_START)

// 获取指定事件的所有监听器
const listeners = queue.getListeners(AsyncQueue.EVENT_TASK_START)

// 设置最大监听器数量警告值
queue.setMaxListeners(20)
```

## 使用示例

### 示例 1：基础顺序执行

```javascript
import AsyncQueue from '@hucy_hucy/async-queue'

const queue = new AsyncQueue()

// 模拟任务
const tasks = [
  { name: 'Task 1', duration: 1000 },
  { name: 'Task 2', duration: 2000 },
  { name: 'Task 3', duration: 1500 }
]

tasks.forEach((task, index) => {
  queue.push(`task-${index}`, () => {
    return new Promise((resolve) => {
      console.log(`${task.name} started`)
      setTimeout(() => {
        console.log(`${task.name} completed`)
        resolve()
      }, task.duration)
    })
  })
})

queue.exec()
```

### 示例 2：错误处理

```javascript
const queue = new AsyncQueue({
  continueWhenError: true  // 失败后继续执行
})

queue.push('task-1', () => Promise.resolve())
queue.push('task-2', () => Promise.reject(new Error('Task 2 failed')))
queue.push('task-3', () => Promise.resolve())

queue.on(AsyncQueue.EVENT_TASK_FAILURE, ({ payload, error }) => {
  console.log(`${payload.id} failed:`, error.message)
})

queue.on(AsyncQueue.EVENT_QUEUE_FINISH, () => {
  console.log('All tasks completed (or failed)')
})

queue.exec()
```

### 示例 3：去重机制

```javascript
const queue = new AsyncQueue({
  removeAfterFinish: false  // 完成后不移除，用于去重
})

// 添加第一个 task-1
queue.push('task-1', () => Promise.resolve('Task 1'))

// 尝试添加重复的 task-1（会被拒绝）
queue.push('task-1', 
  () => Promise.resolve('Task 1 Again'),
  (error, existTask) => {
    console.log('Cannot add duplicate task:', error.message)
  }
)

queue.exec()
```

### 示例 4：暂停/继续

```javascript
const queue = new AsyncQueue()

for (let i = 1; i <= 5; i++) {
  queue.push(`task-${i}`, () => {
    return new Promise((resolve) => {
      console.log(`Task ${i} started`)
      setTimeout(() => {
        console.log(`Task ${i} completed`)
        resolve()
      }, 1000)
    })
  })
}

queue.exec()

// 2秒后暂停
setTimeout(() => {
  console.log('Pausing queue...')
  queue.pause()
}, 2000)

// 5秒后继续
setTimeout(() => {
  console.log('Resuming queue...')
  queue.resume()
}, 5000)
```

### 示例 5：立即执行

```javascript
const queue = new AsyncQueue({
  immediate: true  // 任务添加后立即开始执行
})

queue.push('task-1', () => {
  return new Promise((resolve) => {
    console.log('Task 1 started immediately')
    setTimeout(() => {
      console.log('Task 1 completed')
      resolve()
    }, 1000)
  })
})

queue.push('task-2', () => {
  return new Promise((resolve) => {
    console.log('Task 2 will start after task-1')
    setTimeout(() => {
      console.log('Task 2 completed')
      resolve()
    }, 1000)
  })
})
// 无需调用 queue.exec()，任务会自动执行
```

### 示例 6：与 API 请求结合

```javascript
const apiQueue = new AsyncQueue({
  continueWhenError: true
})

const userIds = [1, 2, 3, 4, 5]

userIds.forEach(userId => {
  apiQueue.push(`fetch-user-${userId}`, async () => {
    const response = await fetch(`/api/users/${userId}`)
    if (!response.ok) throw new Error(`Failed to fetch user ${userId}`)
    return response.json()
  })
})

apiQueue.on(AsyncQueue.EVENT_TASK_SUCCESS, ({ payload, response }) => {
  console.log(`User ${payload.id} fetched:`, response)
})

apiQueue.on(AsyncQueue.EVENT_QUEUE_FINISH, () => {
  console.log('All user data fetched')
})

apiQueue.exec()
```

## 架构设计

AsyncQueue 提供完整的事件驱动能力。这样设计的优势：

- **类型安全**：完整的 TypeScript 泛型支持，事件类型自动推断
- **功能完整**：Emitter 提供了丰富的事件管理方法
- **易于扩展**：可轻松继承 AsyncQueue 并添加自定义事件

## 事件API

- `on(eventName, handler)` - 监听事件
- `once(eventName, handler)` - 监听一次
- `off(eventName, handler?)` - 取消监听
- `emit(eventName, payload)` - 发射事件
- `listenerCount(eventName)` - 获取监听器数量
- `eventNames()` - 获取所有事件名称
- `getListeners(eventName)` - 获取事件的所有监听器
- `clear()` - 清空所有监听器
- `clearEvent(eventName)` - 清空特定事件的监听器
- `setMaxListeners(n)` - 设置最大监听器警告值

## 类型定义

项目完全用 TypeScript 编写，提供完整的类型定义：

```typescript
import AsyncQueue from '@hucy_hucy/async-queue'
import type { 
  AsyncQueueOptions, 
  AsyncTaskExcute, 
  TaskStatus, 
  QueueStatus 
} from '@hucy_hucy/async-queue'

const queue = new AsyncQueue<any>({
  immediate: false,
  removeAfterFinish: false,
  continueWhenError: false
})
```

## 许可证

MIT
