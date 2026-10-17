/** Serializes work that shares a provider session or a player. */
export class KeyLock {
  private tails = new Map<string, Promise<void>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const run = previous.then(task, task);
    this.tails.set(
      key,
      run.then(
        () => undefined,
        () => undefined
      )
    );
    return run;
  }
}
