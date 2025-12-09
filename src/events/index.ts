/**
 * 事件发射器（Event Emitter）
 * 支持事件的订阅、发射和取消订阅
 * 提供类型安全的事件监听
 */

// 事件处理函数类型
export type EventHandler<T = any> = (payload: T) => void

// 事件映射类型
export type Events = Record<string, any>

/**
 * 通用的事件发射器类
 * 可用于任何需要事件驱动的场景
 * 
 * @example
 * // 定义事件类型
 * type MyEvents = {
 *   'user:login': { userId: number; name: string };
 *   'user:logout': { userId: number };
 * };
 * 
 * // 创建发射器实例
 * const emitter = new Emitter<MyEvents>();
 * 
 * // 监听事件
 * emitter.on('user:login', (payload) => {
 *   console.log(`User ${payload.name} logged in`);
 * });
 * 
 * // 发射事件
 * emitter.emit('user:login', { userId: 1, name: 'John' });
 * 
 * // 取消监听
 * emitter.off('user:login', handler);
 */
export class Emitter<T extends Events = Events> {
  /**
   * 存储事件监听器的 Map
   * 键为事件名称，值为处理函数数组
   */
  private eventMap: Map<keyof T, Set<EventHandler>> = new Map()

  /**
   * 监听事件
   * 可以为同一事件添加多个处理函数
   * 
   * @param eventName - 事件名称
   * @param handler - 事件处理函数
   * @returns 返回取消订阅函数
   * 
   * @example
   * const unsubscribe = emitter.on('user:login', handler);
   * // 稍后取消订阅
   * unsubscribe();
   */
  on<K extends keyof T>(eventName: K, handler: EventHandler<T[K]>): () => void {
    if (!this.eventMap.has(eventName)) {
      this.eventMap.set(eventName, new Set())
    }

    const handlers = this.eventMap.get(eventName)!
    handlers.add(handler)

    // 返回取消订阅函数
    return () => {
      handlers.delete(handler)
      // 如果没有处理函数了，删除该事件
      if (handlers.size === 0) {
        this.eventMap.delete(eventName)
      }
    }
  }

  /**
   * 监听事件，但只触发一次
   * 
   * @param eventName - 事件名称
   * @param handler - 事件处理函数
   * 
   * @example
   * emitter.once('user:firstLogin', (payload) => {
   *   console.log('First time login:', payload);
   * });
   */
  once<K extends keyof T>(eventName: K, handler: EventHandler<T[K]>): void {
    const onceWrapper = (payload: T[K]) => {
      handler(payload)
      this.off(eventName, onceWrapper)
    }
    this.on(eventName, onceWrapper)
  }

  /**
   * 取消监听事件
   * 如果没有指定处理函数，则移除该事件的所有监听器
   * 
   * @param eventName - 事件名称
   * @param handler - 事件处理函数（可选）
   * 
   * @example
   * // 移除特定处理函数
   * emitter.off('user:login', handler);
   * 
   * // 移除所有监听器
   * emitter.off('user:login');
   */
  off<K extends keyof T>(eventName: K, handler?: EventHandler<T[K]>): void {
    if (!this.eventMap.has(eventName)) {
      return
    }

    const handlers = this.eventMap.get(eventName)!

    if (handler) {
      handlers.delete(handler)
      // 如果没有处理函数了，删除该事件
      if (handlers.size === 0) {
        this.eventMap.delete(eventName)
      }
    } else {
      // 移除所有监听器
      this.eventMap.delete(eventName)
    }
  }

  /**
   * 发射事件
   * 触发所有监听该事件的处理函数
   * 
   * @param eventName - 事件名称
   * @param payload - 事件数据
   * 
   * @example
   * emitter.emit('user:login', { userId: 1, name: 'John' });
   */
  emit<K extends keyof T>(eventName: K, payload: T[K]): void {
    if (!this.eventMap.has(eventName)) {
      return
    }

    const handlers = this.eventMap.get(eventName)!
    handlers.forEach((handler) => {
      try {
        handler(payload)
      } catch (error) {
        // 捕获错误以防止一个处理函数的错误影响其他处理函数
        console.error(`Error in event handler for "${String(eventName)}":`, error)
      }
    })
  }

  /**
   * 获取指定事件的监听器数量
   * 
   * @param eventName - 事件名称
   * @returns 监听器数量
   * 
   * @example
   * const count = emitter.listenerCount('user:login');
   * console.log(`${count} handlers listening to user:login`);
   */
  listenerCount<K extends keyof T>(eventName: K): number {
    return this.eventMap.has(eventName) ? this.eventMap.get(eventName)!.size : 0
  }

  /**
   * 获取所有事件名称
   * 
   * @returns 事件名称数组
   * 
   * @example
   * const events = emitter.eventNames();
   * console.log('All events:', events);
   */
  eventNames(): (keyof T)[] {
    return Array.from(this.eventMap.keys())
  }

  /**
   * 获取指定事件的所有监听器
   * 
   * @param eventName - 事件名称
   * @returns 监听器数组
   */
  getListeners<K extends keyof T>(eventName: K): EventHandler<T[K]>[] {
    if (!this.eventMap.has(eventName)) {
      return []
    }
    return Array.from(this.eventMap.get(eventName)!)
  }

  /**
   * 清空所有事件监听器
   * 
   * @example
   * emitter.clear();
   */
  clear(): void {
    this.eventMap.clear()
  }

  /**
   * 清空指定事件的所有监听器
   * 
   * @param eventName - 事件名称
   * 
   * @example
   * emitter.clearEvent('user:login');
   */
  clearEvent<K extends keyof T>(eventName: K): void {
    this.eventMap.delete(eventName)
  }

  /**
   * 获取最大监听器数量警告值
   * 默认为 10
   */
  private maxListeners = 10

  /**
   * 设置最大监听器数量
   * 如果为某个事件添加超过此数量的监听器，会输出警告
   * 
   * @param n - 最大数量
   * 
   * @example
   * emitter.setMaxListeners(20);
   */
  setMaxListeners(n: number): void {
    this.maxListeners = n
  }

  /**
   * 监听事件时的内部检查
   */
  private checkMaxListeners<K extends keyof T>(eventName: K): void {
    const count = this.listenerCount(eventName)
    if (count > this.maxListeners) {
      console.warn(
        `[Emitter] MaxListenersExceeded: ${String(eventName)} has ${count} listeners which exceeds the limit of ${this.maxListeners}`
      )
    }
  }

  /**
   * 增强的 on 方法，包含最大监听器检查
   */
  onWithCheck<K extends keyof T>(eventName: K, handler: EventHandler<T[K]>): () => void {
    const unsubscribe = this.on(eventName, handler)
    this.checkMaxListeners(eventName)
    return unsubscribe
  }
}

/**
 * 创建一个新的事件发射器实例
 * 
 * @example
 * const emitter = createEmitter();
 * emitter.on('event', handler);
 */
export function createEmitter<T extends Events = Events>(): Emitter<T> {
  return new Emitter<T>()
}

// 导出默认的 mitt 兼容接口（与之前的 mitt 库兼容）
export default Emitter
