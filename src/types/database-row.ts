export type SnakeCase<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? `${First extends Lowercase<First>
        ? First
        : `_${Lowercase<First>}`}${SnakeCase<Rest>}`
    : S;

export type DatabaseRow<T> = {
  [K in keyof T as K extends string ? SnakeCase<K> : never]: T[K];
};
