import { v4 as uuidv4 } from 'uuid';

import {
  IntervalValues,
  rangeUtil,
  RawTimeRange,
  TimeRange,
  TimeZone,
} from '@grafana/data';

export const safeStringifyValue = (value: any, space?: number) => {
  if (!value) {
    return '';
  }

  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    console.error(error);
  }

  return '';
};

export function generateKey(index = 0): string {
  return `Q-${uuidv4()}-${index}`;
}

export const getTimeRange = (timeZone: TimeZone, rawRange: RawTimeRange, fiscalYearStartMonth: number): TimeRange => {
  let range = rangeUtil.convertRawToRange(rawRange, timeZone, fiscalYearStartMonth);

  if (range.to.isBefore(range.from)) {
    range = rangeUtil.convertRawToRange({ from: range.raw.to, to: range.raw.from }, timeZone, fiscalYearStartMonth);
  }

  return range;
};

export function getIntervals(range: TimeRange, lowLimit?: string, resolution?: number): IntervalValues {
  if (!resolution) {
    return { interval: '1s', intervalMs: 1000 };
  }

  return rangeUtil.calculateInterval(range, resolution, lowLimit);
}

export const copyStringToClipboard = (string: string) => {
  const el = document.createElement('textarea');
  el.value = string;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};
