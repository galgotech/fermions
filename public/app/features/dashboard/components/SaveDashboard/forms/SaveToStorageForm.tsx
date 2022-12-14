import React, { useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { locationService } from '@grafana/runtime';
import {
  Button,
  Field,
  Form,
  HorizontalGroup,
  Input,
  RadioButtonGroup,
  Spinner,
  TextArea,
} from '@grafana/ui';
import { getGrafanaStorage } from 'app/features/storage/storage';
import { ItemOptions, WorkflowID, WriteValueResponse } from 'app/features/storage/types';

import { SaveProps } from './SaveDashboardForm';

interface FormDTO {
  title?: string;
  message: string;
}

interface Props extends SaveProps {
  isNew?: boolean;
  isCopy?: boolean;
}

export function SaveToStorageForm(props: Props) {
  const { dashboard, saveModel, onSubmit, onCancel, onSuccess, isNew, isCopy } = props;
  const [saving, setSaving] = useState(false);
  const [response, setResponse] = useState<WriteValueResponse>();
  const [path, setPath] = useState(dashboard.uid);
  const [workflow, setWorkflow] = useState(WorkflowID.Save);
  const saveText = useMemo(() => {
    switch (workflow) {
      case WorkflowID.PR:
        return 'Create PR';
      case WorkflowID.Push:
        return 'Push';
    }
    console.log('???', workflow);
    return 'Save';
  }, [workflow]);

  const item = useAsync(async () => {
    const opts = await getGrafanaStorage().getOptions(dashboard.uid);
    setWorkflow(opts.workflows[0]?.value ?? WorkflowID.Save);
    return opts;
  }, [dashboard.uid]);

  if (item.error) {
    return <div>Error loading workflows</div>;
  }

  if (item.loading || !item.value) {
    return <Spinner />;
  }

  if (response) {
    return (
      <div>
        {response.url && (
          <div>
            <h2>View pull request</h2>
            <a href={response.url}>{response.url}</a>
          </div>
        )}

        <pre>{JSON.stringify(response)}</pre>

        <HorizontalGroup>
          <Button variant="secondary" onClick={onCancel}>
            Close
          </Button>
        </HorizontalGroup>
      </div>
    );
  }

  const workflows = item.value?.workflows ?? [];
  const canSave = saveModel.hasChanges || isNew || isCopy;

  return (
    <Form
      onSubmit={async (data: FormDTO) => {
        if (!onSubmit) {
          return;
        }
        setSaving(true);

        let uid = saveModel.clone.uid;
        if (isNew || isCopy) {
          uid = path;
          if (!uid.endsWith('-dash.json')) {
            uid += '-dash.json';
          }
        }
        const rsp = await getGrafanaStorage().write(uid, {
          body: saveModel.clone,
          kind: 'dashboard',
          title: data.title,
          message: data.message,
          workflow: workflow,
        });

        console.log('GOT', rsp);
        if (rsp.code === 200) {
          if (!rsp.pending) {
            // should close
            onSuccess();

            // Need to update the URL
            if (isNew || isCopy) {
              locationService.push(`/g/${uid}`);
            }
          }
        } else {
          setSaving(false);
        }
        setResponse(rsp);
      }}
    >
      {({ register, errors }) => (
        <Stack direction="column" gap={1}>
          {(isNew || isCopy) && (
            <Field label="Path">
              <Input
                value={path ?? ''}
                required
                autoFocus
                placeholder="Full path (todo, help validate)"
                onChange={(v) => setPath(v.currentTarget.value)}
              />
            </Field>
          )}

          {!isJustSave(item.value) && (
            <Field label="Workflow">
              <RadioButtonGroup value={workflow} options={workflows} onChange={setWorkflow} />
            </Field>
          )}

          {workflow === WorkflowID.PR && (
            <Field label="PR Title">
              <Input {...register('title')} required placeholder="Enter a PR title" autoFocus />
            </Field>
          )}

          <Field label="Message">
            <TextArea {...register('message')} placeholder="Add a note to describe your changes." rows={5} />
          </Field>

          <HorizontalGroup>
            <Button variant="secondary" onClick={onCancel} fill="outline">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSave}
              icon={saving ? 'fa fa-spinner' : undefined}
              aria-label={selectors.pages.SaveDashboardModal.save}
            >
              {saveText}
            </Button>
            {!canSave && <div>No changes to save</div>}
          </HorizontalGroup>
        </Stack>
      )}
    </Form>
  );
}

function isJustSave(opts: ItemOptions): boolean {
  if (opts.workflows.length === 1) {
    return opts.workflows.find((v) => v.value === WorkflowID.Save) != null;
  }
  return false;
}
