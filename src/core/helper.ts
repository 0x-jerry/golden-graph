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
      return id;
    },
  };
}

export type Factory<T> = { new (): T };

const strictEqual = <T>(a: T, b: T) => a === b;

export function isIntersected<T>(
  arr1: T[],
  arr2: T[],
  isEqual: (a: T, b: T) => boolean = strictEqual
) {
  return arr1.some((a) => arr2.some((b) => isEqual(a, b)));
}
