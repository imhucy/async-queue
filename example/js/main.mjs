import AsyncQueue from "../../dist/index.modern.mjs";
import { createTaskSchema } from './util.mjs'

const queue = new AsyncQueue()

const tasks = Array.from({ length: 10 }).fill(0).map(() => createTaskSchema())

tasks.forEach((task, taskIndex) => {
  queue.push('uid-' + uid++, function (payload) {
    return new Promise((resolve, reject) => {
      console.log(task.name, 'start')
      console.log(task)
      console.log(payload)
      if (taskIndex === 3) {
        reject(new Error('中间有一个报错了'))
        return
      }
      setTimeout(() => {
        console.log(task.name, 'end')
        resolve()
      }, task.duration);
    })
  })
})

queue.emitter.on(AsyncQueue.EVENT_TASK_FAILURE, ({ payload, waitQueue, finishQueue, error }) => {
  console.log(error)
})

queue.exec()
