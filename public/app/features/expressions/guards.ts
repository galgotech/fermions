import { DataQuery } from '@grafana/data';

import { ExpressionQuery, ExpressionQueryType } from './types';

export const isExpressionQuery = (dataQuery?: DataQuery): dataQuery is ExpressionQuery => {
  if (!dataQuery) {
    return false;
  }

  const expression = dataQuery as ExpressionQuery;

  if (typeof expression.type !== 'string') {
    return false;
  }
  return Object.values(ExpressionQueryType).includes(expression.type);
};
