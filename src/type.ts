
export type AsyncQueueOptions = {
  // 是否在任务添加后立即开始执行队列
  immediate: boolean;
  // 是否在任务完成后移除任务
  // 如果不移除的话那么同名任务将不会被添加到队列
  removeAfterFinish: boolean;
  // 任务失败时是否中断执行
  continueWhenError: boolean;
};

export interface AsyncTaskExcute {
  (payload?: any, queue?: any): Promise<any>;
}

export type TaskStatus =
  | "STATUS_WAITING"
  | "STATUS_PEDDING"
  | "STATUS_SUCCESS"
  | "STATUS_FAILURE";

export type QueueStatus =
  | "STATUS_QUEUE_WAITING"
  | "STATUS_QUEUE_RUNNING"
  | "STATUS_QUEUE_BEFORE_PAUSE"
  | "STATUS_QUEUE_PAUSE"
  | "STATUS_QUEUE_FINISH";

export type AsyncTaskEventPayloads = {
  // 任务事件
  EVENT_TASK_START: {
    payload: AsyncTaskItem;
    waitQueue: AsyncTaskList;
    finishQueue: AsyncTaskList;
  };
  EVENT_TASK_SUCCESS: {
    payload: AsyncTaskItem;
    waitQueue: AsyncTaskList;
    finishQueue: AsyncTaskList;
    response: any;
  };
  EVENT_TASK_FAILURE: {
    payload: AsyncTaskItem;
    waitQueue: AsyncTaskList;
    finishQueue: AsyncTaskList;
    error: any;
  };
  // 队列事件
  EVENT_QUEUE_START: { waitQueue: AsyncTaskList; finishQueue: AsyncTaskList };
  EVENT_QUEUE_PAUSE: { waitQueue: AsyncTaskList; finishQueue: AsyncTaskList };
  EVENT_QUEUE_FINISH: { waitQueue: AsyncTaskList; finishQueue: AsyncTaskList };
};

export interface AsyncTaskItem {
  id: string;
  status: TaskStatus;
  excute: AsyncTaskExcute;
  excutePromise?: Promise<any>;
}

export type AsyncTaskList = AsyncTaskItem[];

export interface PushFailureFn {
  (error: Error, task: AsyncTaskItem): void;
}

export interface ResetFailureFn {
  (error: Error): void;
}