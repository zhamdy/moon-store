export interface SuccessResponse<T, M = never> {
  data: T;
  meta?: M;
}

export function success<T>(data: T): SuccessResponse<T>;
export function success<T, M>(data: T, meta: M): SuccessResponse<T, M>;
export function success<T, M>(data: T, meta?: M): SuccessResponse<T, M> {
  return meta === undefined ? { data } : { data, meta };
}
