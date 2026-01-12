export function createIncrementIdGenerator() {
  let id = 0;

  return {
    reset(start: number) {
      id = start;
    },
    next() {
      return ++id;
    },
    current() {
      return id
    }
  };
}
