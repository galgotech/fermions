import angular from 'angular';
import { isArray, isNull, isObject, isUndefined } from 'lodash';

import { dateTime } from '@grafana/data';

import coreModule from '../core_module';

coreModule.filter('stringSort', () => {
  return (input: any) => {
    return input.sort();
  };
});

coreModule.filter('slice', () => {
  return (arr: any[], start: any, end: any) => {
    if (!isUndefined(arr)) {
      return arr.slice(start, end);
    }
    return arr;
  };
});

coreModule.filter('stringify', () => {
  return (arr: any[]) => {
    if (isObject(arr) && !isArray(arr)) {
      return angular.toJson(arr);
    } else {
      return isNull(arr) ? null : arr.toString();
    }
  };
});

coreModule.filter('moment', () => {
  return (date: string, mode: string) => {
    switch (mode) {
      case 'ago':
        return dateTime(date).fromNow();
    }
    return dateTime(date).fromNow();
  };
});

export default {};
