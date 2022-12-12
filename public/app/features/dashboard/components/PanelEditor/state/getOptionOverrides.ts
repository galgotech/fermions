import { FieldConfigPropertyItem, FieldConfigSource } from '@grafana/data';

import { OptionPaneItemOverrideInfo } from '../types';

export const dataOverrideTooltipDescription =
  'Some data fields have this option pre-configured. Add a field override rule to override the pre-configured value.';
export const overrideRuleTooltipDescription = 'An override rule exists for this property';

export function getOptionOverrides(
  fieldOption: FieldConfigPropertyItem,
  fieldConfig: FieldConfigSource,
): OptionPaneItemOverrideInfo[] {
  const infoDots: OptionPaneItemOverrideInfo[] = [];

  const overrideRuleFound = fieldConfig.overrides.some((rule) =>
    rule.properties.some((prop) => prop.id === fieldOption.id)
  );

  if (overrideRuleFound) {
    infoDots.push({
      type: 'rule',
      description: overrideRuleTooltipDescription,
      tooltip: overrideRuleTooltipDescription,
    });
  }

  return infoDots;
}
