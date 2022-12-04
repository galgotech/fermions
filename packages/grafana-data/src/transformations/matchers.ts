// Load the Builtin matchers
import {
  FieldMatcherInfo,
  MatcherConfig,
  FieldMatcher,
} from '../types/transformations';
import { Registry } from '../utils/Registry';

import { getFieldTypeMatchers } from './matchers/fieldTypeMatcher';
import { getFieldNameMatchers } from './matchers/nameMatcher';
import { getFieldPredicateMatchers } from './matchers/predicates';
import { getSimpleFieldMatchers } from './matchers/simpleFieldMatcher';

/**
 * Registry that contains all of the built in field matchers.
 * @public
 */
export const fieldMatchers = new Registry<FieldMatcherInfo>(() => {
  return [
    ...getFieldPredicateMatchers(), // Predicates
    ...getFieldTypeMatchers(), // by type
    ...getFieldNameMatchers(), // by name
    ...getSimpleFieldMatchers(), // first
  ];
});

/**
 * Resolves a field matcher from the registry for given config.
 * Will throw an error if matcher can not be resolved.
 * @public
 */
export function getFieldMatcher(config: MatcherConfig): FieldMatcher {
  const info = fieldMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown field matcher: ' + config.id);
  }
  return info.get(config.options);
}
