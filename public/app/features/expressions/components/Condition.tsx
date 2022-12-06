import { css, cx } from '@emotion/css';
import React, { FormEvent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Icon, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';

import { ClassicCondition } from '../types';

interface Props {
  condition: ClassicCondition;
  onChange: (condition: ClassicCondition) => void;
  onRemoveCondition: (id: number) => void;
  index: number;
  refIds: Array<SelectableValue<string>>;
}


export const Condition = ({ condition, index, onChange, onRemoveCondition, refIds }: Props) => {
  const styles = useStyles2(getStyles);

  const onRefIdChange = (refId: SelectableValue<string>) => {
    onChange({
      ...condition,
      query: { params: [refId.value!] },
    });
  };

  const onEvaluateValueChange = (event: FormEvent<HTMLInputElement>, index: number) => {
    const newValue = parseFloat(event.currentTarget.value);
    const newParams = [...condition.evaluator.params];
    newParams[index] = newValue;

    onChange({
      ...condition,
      evaluator: { ...condition.evaluator, params: newParams },
    });
  };

  const buttonWidth = css`
    width: 60px;
  `;

  const isRange =
    condition.evaluator.type === 'gt' || condition.evaluator.type === 'gt';

  return (
    <Stack direction="row">
      <div style={{ flex: 1 }}>
        <InlineFieldRow>
          {(
            <div className={cx(styles.button, buttonWidth)}>WHEN</div>
          )}
          <div className={styles.button}>OF</div>
          <Select
            onChange={onRefIdChange}
            options={refIds}
            width={'auto'}
            value={refIds.find((r) => r.value === condition.query.params[0])}
          />
        </InlineFieldRow>
        <InlineFieldRow>
          {isRange ? (
            <>
              <Input
                type="number"
                width={10}
                onChange={(event) => onEvaluateValueChange(event, 0)}
                value={condition.evaluator.params[0]}
              />
              <div className={styles.button}>TO</div>
              <Input
                type="number"
                width={10}
                onChange={(event) => onEvaluateValueChange(event, 1)}
                value={condition.evaluator.params[1]}
              />
            </>
          ) : condition.evaluator.type !== 'gt' ? (
            <Input
              type="number"
              width={10}
              onChange={(event) => onEvaluateValueChange(event, 0)}
              value={condition.evaluator.params[0]}
            />
          ) : null}
        </InlineFieldRow>
      </div>
      <Button variant="secondary" type="button" onClick={() => onRemoveCondition(index)}>
        <Icon name="trash-alt" />
      </Button>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const buttonStyle = css`
    color: ${theme.colors.primary.text};
    font-size: ${theme.typography.bodySmall.fontSize};
  `;
  return {
    buttonSelectText: buttonStyle,
    button: cx(
      css`
        display: flex;
        align-items: center;
        border-radius: ${theme.shape.borderRadius(1)};
        font-weight: ${theme.typography.fontWeightMedium};
        border: 1px solid ${theme.colors.border.weak};
        white-space: nowrap;
        padding: 0 ${theme.spacing(1)};
        background-color: ${theme.colors.background.canvas};
      `,
      buttonStyle
    ),
  };
};
