import React, { useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Input, Field, Button, ValuePicker, HorizontalGroup } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { Rule } from './types';

interface Props {
  onRuleAdded: (rule: Rule) => void;
}

type PatternType = 'any';

const patternTypes: Array<SelectableValue<PatternType>> = [
  {
    label: 'Any',
    description: 'Enter an arbitray channel pattern',
    value: 'any',
  },
];

export function AddNewRule({ onRuleAdded }: Props) {
  const [patternType, setPatternType] = useState<PatternType>();
  const [pattern, setPattern] = useState<string>();
  const [patternPrefix] = useState<string>('');
  const notifyApp = useAppNotification();

  const onSubmit = () => {
    if (!pattern) {
      notifyApp.error('Enter path');
      return;
    }

    getBackendSrv()
      .post(`api/live/channel-rules`, {
        pattern: patternPrefix + pattern,
        settings: {
          converter: {
            type: 'jsonAuto',
          },
          frameOutputs: [
            {
              type: 'managedStream',
            },
          ],
        },
      })
      .then((v: any) => {
        console.log('ADDED', v);
        setPattern(undefined);
        setPatternType(undefined);
        onRuleAdded(v.rule);
      })
      .catch((e) => {
        notifyApp.error('Error adding rule', e);
        e.isHandled = true;
      });
  };

  if (patternType) {
    return (
      <div>
        <HorizontalGroup>
          {patternType === 'any' && (
            <Field label="Pattern">
              <Input
                value={pattern ?? ''}
                onChange={(e) => setPattern(e.currentTarget.value)}
                placeholder="scope/namespace/path"
              />
            </Field>
          )}
          <Field label="">
            <Button onClick={onSubmit} variant={pattern?.length ? 'primary' : 'secondary'}>
              Add
            </Button>
          </Field>

          <Field label="">
            <Button variant="secondary" onClick={() => setPatternType(undefined)}>
              Cancel
            </Button>
          </Field>
        </HorizontalGroup>
      </div>
    );
  }

  return (
    <div>
      <ValuePicker
        label="Add channel rule"
        variant="secondary"
        size="md"
        icon="plus"
        menuPlacement="auto"
        isFullWidth={false}
        options={patternTypes}
        onChange={(v) => setPatternType(v.value)}
      />
    </div>
  );
}
