import {
  AsyncQueueOptions,
  AsyncTaskExcute,
  TaskStatus,
  QueueStatus,
  AsyncTaskEventPayloads,
  AsyncTaskItem,
  AsyncTaskList,
  PushFailureFn,
  ResetFailureFn,
} from "../type";
import Emitter from "../events";

export default class AsyncQueue extends Emitter<AsyncTaskEventPayloads> {
  // 任务事件名称
  static EVENT_TASK_START = "EVENT_TASK_START" as const;
  static EVENT_TASK_SUCCESS = "EVENT_TASK_SUCCESS" as const;
  static EVENT_TASK_FAILURE = "EVENT_TASK_FAILURE" as const;

  // 队列事件名称
  static EVENT_QUEUE_START = "EVENT_QUEUE_START" as const;
  static EVENT_QUEUE_PAUSE = "EVENT_QUEUE_PAUSE" as const;
  static EVENT_QUEUE_FINISH = "EVENT_QUEUE_FINISH" as const;

  // 任务状态
  static STATUS_WAITING = "STATUS_WAITING" as const;
  static STATUS_PEDDING = "STATUS_PEDDING" as const;
  static STATUS_SUCCESS = "STATUS_SUCCESS" as const;
  static STATUS_FAILURE = "STATUS_FAILURE" as const;

  // 队列状态
  static STATUS_QUEUE_WAITING = "STATUS_QUEUE_WAITING" as const;
  static STATUS_QUEUE_RUNNING = "STATUS_QUEUE_RUNNING" as const;
  static STATUS_QUEUE_BEFORE_PAUSE = "STATUS_QUEUE_BEFORE_PAUSE" as const;
  static STATUS_QUEUE_PAUSE = "STATUS_QUEUE_PAUSE" as const;
  static STATUS_QUEUE_FINISH = "STATUS_QUEUE_FINISH" as const;

  // 初始化任务队列
  private waitList: AsyncTaskList = [];
  // 任务执行中队列
  private excuteList: AsyncTaskList = [];
  // 任务执行完成的队列
  private finishList: AsyncTaskList = [];

  // 初始化状态
  private status: QueueStatus = AsyncQueue.STATUS_QUEUE_WAITING;

  // 初始化 options 默认值
  private options: AsyncQueueOptions = {
    immediate: false,
    removeAfterFinish: false,
    continueWhenError: false,
  };

  constructor(userOptions: Partial<AsyncQueueOptions> = {}) {
    super();
    this.options = Object.assign(this.options, userOptions);
  }

  isRunning() {
    return this.status === AsyncQueue.STATUS_QUEUE_RUNNING;
  }

  isPause() {
    return this.status === AsyncQueue.STATUS_QUEUE_PAUSE;
  }

  // 已经进入暂停流程, 等待执行中的任务执行完成就立即进入暂停状态
  isBeforePause() {
    return this.status === AsyncQueue.STATUS_QUEUE_BEFORE_PAUSE;
  }

  isWaiting() {
    return this.status === AsyncQueue.STATUS_QUEUE_WAITING;
  }

  isFinished() {
    return this.status === AsyncQueue.STATUS_QUEUE_FINISH;
  }

  isWaitingTask(task: AsyncTaskItem) {
    return task.status === AsyncQueue.STATUS_WAITING;
  }

  isRunningTask(task: AsyncTaskItem) {
    return task.status === AsyncQueue.STATUS_PEDDING;
  }

  isSuccessTask(task: AsyncTaskItem) {
    return task.status === AsyncQueue.STATUS_SUCCESS;
  }

  isFailureTask(task: AsyncTaskItem) {
    return task.status === AsyncQueue.STATUS_FAILURE;
  }

  isExist(id: string) {
    return (
      !!this.waitList.find((task) => task.id === id) ||
      !!this.excuteList.find((task) => task.id === id) ||
      !!this.finishList.find((task) => task.id === id)
    );
  }

  findTaskById(id: string) {
    return (
      this.waitList.find((task) => task.id === id) ||
      this.excuteList.find((task) => task.id === id) ||
      this.finishList.find((task) => task.id === id)
    );
  }

  push(id: string, excuteFn: AsyncTaskExcute, pushFailureFn?: PushFailureFn) {
    // 避免重复任务
    const existTask = this.findTaskById(id);
    if (existTask) {
      // console.warn(
      //   `[${id}] is in queue, cannot be push again. you can try set option \`removeAfterFinish\` to true`
      // );
      const error = new Error("TaskIsExist");
      pushFailureFn && pushFailureFn(error, existTask);
      return Promise.reject(error);
    }

    this.waitList.push({
      id,
      status: AsyncQueue.STATUS_WAITING,
      excute: excuteFn,
    });

    if (this.options.immediate) {
      this.exec();
    }
    return Promise.resolve();
  }

  // 开始执行下一个任务
  private next() {
    if (this.isBeforePause()) {
      return;
    }
    const task = this.waitList.shift();
    if (task) {
      this.excuteList.push(task);
      this.emit(AsyncQueue.EVENT_TASK_START, {
        payload: task,
        waitQueue: this.waitList,
        finishQueue: this.finishList,
      });
      task.status = AsyncQueue.STATUS_PEDDING;
      task.excutePromise = task
        .excute(task)
        .then((response: any) => {
          task.status = AsyncQueue.STATUS_SUCCESS;
          this.emit(AsyncQueue.EVENT_TASK_SUCCESS, {
            payload: task,
            waitQueue: this.waitList,
            finishQueue: this.finishList,
            response,
          });
          if (!this.options.continueWhenError) {
            // 如果报错就中断执行, 在 then 中调用 next
            this.next();
          }
        })
        .catch((error: any) => {
          task.status = AsyncQueue.STATUS_FAILURE;
          this.emit(AsyncQueue.EVENT_TASK_FAILURE, {
            payload: task,
            waitQueue: this.waitList,
            finishQueue: this.finishList,
            error,
          });
        })
        .finally(() => {
          // 如果任务结束后不删除任务, 则将任务存放到完成列表, 以便用于去重
          if (!this.options.removeAfterFinish) {
            this.finishList.push(task);
          }

          // 如果忽略报错继续执行, 在 finally 中调用 next
          if (this.options.continueWhenError) {
            this.next();
          }

          // 从执行列表退出
          this.excuteList.shift();
        });
    } else {
      // 队列执行完成
      this.status = AsyncQueue.STATUS_QUEUE_FINISH;
      this.emit(AsyncQueue.EVENT_QUEUE_FINISH, {
        waitQueue: this.waitList,
        finishQueue: this.finishList,
      });
    }
  }

  removeFromFinishList(task: Pick<AsyncTaskItem, "id">) {
    const index = this.finishList.findIndex((x) => x.id === task.id);
    if (index > -1) {
      this.finishList.splice(index, 1);
    }
  }

  removeFromExcuteList(task: Pick<AsyncTaskItem, "id">) {
    const index = this.excuteList.findIndex((x) => x.id === task.id);
    if (index > -1) {
      this.excuteList.splice(index, 1);
    }
  }

  removeFromWaitList(task: Pick<AsyncTaskItem, "id">) {
    const index = this.waitList.findIndex((x) => x.id === task.id);
    if (index > -1) {
      this.waitList.splice(index, 1);
    }
  }

  retry(task: AsyncTaskItem) {
    this.removeFromFinishList(task);
    this.waitList.push(task);
    this.exec();
  }

  retryAll() {
    const failureTasks = this.finishList.filter(
      (task) => task.status === AsyncQueue.STATUS_FAILURE
    );
    const successTasks = this.finishList.filter(
      (task) => task.status === AsyncQueue.STATUS_SUCCESS
    );

    failureTasks.forEach((task) => this.retry(task));
    this.finishList = successTasks;
  }

  // 暂停队列执行
  pause() {
    if (!this.isRunning()) {
      // 队列不在执行时, 不需要执行暂停操作
      return;
    }

    // 设置暂停执行标志位
    this.status = AsyncQueue.STATUS_QUEUE_BEFORE_PAUSE;

    // 等待当前执行任务完成再修改队列状态到暂停
    Promise.all(this.excuteList.map((task) => task.excutePromise!)).finally(
      () => {
        if (this.waitList.length === 0) {
          this.status = AsyncQueue.STATUS_QUEUE_FINISH;
          this.emit(AsyncQueue.EVENT_QUEUE_FINISH, {
            waitQueue: this.waitList,
            finishQueue: this.finishList,
          });
        } else {
          this.status = AsyncQueue.STATUS_QUEUE_PAUSE;
          this.emit(AsyncQueue.EVENT_QUEUE_PAUSE, {
            waitQueue: this.waitList,
            finishQueue: this.finishList,
          });
        }
      }
    );
  }

  // 继续执行暂停的队列
  resume() {
    if (!this.isPause()) {
      // 只有处于暂停状态时才能调用继续执行方法
      return;
    }

    // 继续执行
    this.exec();
  }

  // 对外暴露的执行开始方法
  exec() {
    if (this.isRunning()) {
      console.warn("async queue is running");
      return;
    }

    this.status = AsyncQueue.STATUS_QUEUE_RUNNING;
    this.emit(AsyncQueue.EVENT_QUEUE_START, {
      waitQueue: this.waitList,
      finishQueue: this.finishList,
    });
    this.next();
  }

  reset(resetFailFn?: ResetFailureFn) {
    if (this.isRunning()) {
      // 报错队列在运行中不能重置队列
      // 需要先停止队列运行再重置
      const error = new Error("AsyncQueueIsRunning");

      resetFailFn && resetFailFn(error);

      return Promise.reject(error);
    }

    // 将剩余的任务和完成的任务合并
    // 必须确保执行列表内没有任务
    this.waitList = this.waitList.concat(this.finishList);
    this.finishList = [];

    this.waitList.forEach((task) => {
      task.status = AsyncQueue.STATUS_WAITING;
    });
  }
}
