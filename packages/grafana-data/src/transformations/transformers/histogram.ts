/**
 * @internal
 */
export function incrRound(num: number, incr: number) {
  return Math.round(num / incr) * incr;
}

/**
 * @internal
 */
export function incrRoundUp(num: number, incr: number) {
  return Math.ceil(num / incr) * incr;
}

/**
 * @internal
 */
export function incrRoundDn(num: number, incr: number) {
  return Math.floor(num / incr) * incr;
}
