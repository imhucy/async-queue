import { createTaskSchema } from './util.mjs'
import AsyncQueue from "../../dist/index.modern.mjs";
console.log('is simple')
const app = Vue.createApp({
  data() {
    const options = {
      immediate: false,
      removeAfterFinish: false,
      continueWhenError: false,
    }
    return {
      list: Array.from({ length: 5 }).fill(0).map(() => createTaskSchema(3000, 10000)),
      queue: new AsyncQueue(options),
      options,
      animation: null
    }
  },
  methods: {
    running (task, payload) {
      return new Promise((resolve, reject) => {
        this.animation = gsap.fromTo('.progress-bar-inner', {
          width: 0
        }, {
          width: '100%',
          duration: task.duration / 1000,
          onComplete(){
            resolve()
          },
          onInterrupt() {
            reject()
            this.animation = null
          }
        })
      })
    },
    pushTaskToQueue() {
      this.list.forEach((task, taskIndex) => {
        this.queue.push(task.id, (payload) => {
          return this.running(task, payload)
        })
      })
    },
    finishQueueCallback() {
      gsap.to('.progress-bar-inner', {background: 'red'})
    },
    causeTaskFail() {
      this.animation?.kill()
    }
  },
  watch: {
    options: {
      deep: true,
      handler() {
        this.queue = new AsyncQueue(this.options)
      }
    }
  },
  mounted() {
    this.queue.emitter.on(AsyncQueue.EVENT_QUEUE_FINISH, this.finishQueueCallback)
  },
  beforeUnmount() {
    this.queue.emitter.off(AsyncQueue.EVENT_QUEUE_FINISH, this.finishQueueCallback)
  }
})

app.mount('#app')