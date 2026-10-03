export async function forEachConcurrently<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items]
  const worker = async (): Promise<void> => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item)
  }
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker))
}
