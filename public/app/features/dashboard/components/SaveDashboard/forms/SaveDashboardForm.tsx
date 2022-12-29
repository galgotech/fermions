import React, { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { Button, Form, TextArea } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state';

import { SaveDashboardData, SaveDashboardOptions } from '../types';

interface FormDTO {
  message: string;
}

export type SaveProps = {
  dashboard: DashboardModel; // original
  saveModel: SaveDashboardData; // already cloned
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit?: (clone: DashboardModel, options: SaveDashboardOptions, dashboard: DashboardModel) => Promise<any>;
  options: SaveDashboardOptions;
  onOptionsChange: (opts: SaveDashboardOptions) => void;
  isPublish?: boolean;
};

export const SaveDashboardForm = ({
  dashboard,
  saveModel,
  options,
  onSubmit,
  onCancel,
  onSuccess,
  onOptionsChange,
  isPublish,
}: SaveProps) => {
  const [saving, setSaving] = useState(false);
  const hasChanges = !isPublish && !saveModel.hasChanges;

  return (
    <Form
      onSubmit={async (data: FormDTO) => {
        if (!onSubmit) {
          return;
        }
        setSaving(true);
        options = { ...options, message: data.message, publish: isPublish, };
        const result = await onSubmit(saveModel.clone, options, dashboard);
        if (result.status === 'success') {
          onSuccess();
        } else {
          setSaving(false);
        }
      }}
    >
      {({ register, errors }) => {
        const messageProps = register('message');
        return (
          <Stack direction="column" gap={2}>
            <TextArea
              {...messageProps}
              aria-label="message"
              value={options.message}
              onChange={(e) => {
                onOptionsChange({
                  ...options,
                  message: e.currentTarget.value,
                });
                messageProps.onChange(e);
              }}
              placeholder="Add a note to describe your changes."
              autoFocus
              rows={5}
            />

            <Stack alignItems="center">
              <Button variant="secondary" onClick={onCancel} fill="outline">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={hasChanges}
                icon={saving ? 'fa fa-spinner' : undefined}
                aria-label={selectors.pages.SaveDashboardModal.save}
              >
                {isPublish ? 'Publish' : 'Save'}
              </Button>
              {hasChanges && <div>No changes to save</div>}
            </Stack>
          </Stack>
        );
      }}
    </Form>
  );
};
