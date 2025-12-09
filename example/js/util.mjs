let uid = 0

export function createTaskSchema (startDuration = 300, endDuration = 1300) {
  const id = 'uid-' + (uid++)
  return {
    id,
    name: 'name-' + id,
    duration: ~~(Math.random() * (endDuration - startDuration)) + startDuration,
  }
}
