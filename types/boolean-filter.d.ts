declare global {
  interface Array<T> {
    filter(predicate: BooleanConstructor, thisArg?: unknown): NonNullable<T>[];
  }

  interface ReadonlyArray<T> {
    filter(predicate: BooleanConstructor, thisArg?: unknown): NonNullable<T>[];
  }
}

export {};
