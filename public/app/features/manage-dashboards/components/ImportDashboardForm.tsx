import React, { FC, useEffect, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import {
  Button,
  Field,
  FormAPI,
  FormFieldErrors,
  FormsOnSubmit,
  HorizontalGroup,
  Input,
  InputControl,
  Legend,
} from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import {
  DashboardInput,
  DashboardInputs,
  ImportDashboardDTO,
  LibraryPanelInputState,
} from '../state/reducers';
import { validateTitle, validateUid } from '../utils/validation';

import { ImportDashboardLibraryPanelsList } from './ImportDashboardLibraryPanelsList';

interface Props extends Pick<FormAPI<ImportDashboardDTO>, 'register' | 'errors' | 'control' | 'getValues' | 'watch'> {
  uidReset: boolean;
  inputs: DashboardInputs;
  initialFolderUid: string;

  onCancel: () => void;
  onUidReset: () => void;
  onSubmit: FormsOnSubmit<ImportDashboardDTO>;
}

export const ImportDashboardForm: FC<Props> = ({
  register,
  errors,
  control,
  getValues,
  uidReset,
  inputs,
  initialFolderUid,
  onUidReset,
  onCancel,
  onSubmit,
  watch,
}) => {
  const [isSubmitted, setSubmitted] = useState(false);
  const watchFolder = watch('folder');

  /*
    This useEffect is needed for overwriting a dashboard. It
    submits the form even if there's validation errors on title or uid.
  */
  useEffect(() => {
    if (isSubmitted && (errors.title || errors.uid)) {
      onSubmit(getValues(), {} as any);
    }
  }, [errors, getValues, isSubmitted, onSubmit]);
  const newLibraryPanels = inputs?.libraryPanels?.filter((i) => i.state === LibraryPanelInputState.New) ?? [];
  const existingLibraryPanels = inputs?.libraryPanels?.filter((i) => i.state === LibraryPanelInputState.Exists) ?? [];

  return (
    <>
      <Legend>Options</Legend>
      <Field label="Name" invalid={!!errors.title} error={errors.title && errors.title.message}>
        <Input
          {...register('title', {
            required: 'Name is required',
            validate: async (v: string) => await validateTitle(v, getValues().folder.uid),
          })}
          type="text"
          data-testid={selectors.components.ImportDashboardForm.name}
        />
      </Field>
      <Field label="Folder">
        <InputControl
          render={({ field: { ref, ...field } }) => (
            <FolderPicker {...field} enableCreateNew initialFolderUid={initialFolderUid} />
          )}
          name="folder"
          control={control}
        />
      </Field>
      <Field
        label="Unique identifier (UID)"
        description="The unique identifier (UID) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.
                The UID allows having consistent URLs for accessing dashboards so changing the title of a dashboard will not break any
                bookmarked links to that dashboard."
        invalid={!!errors.uid}
        error={errors.uid && errors.uid.message}
      >
        <>
          {!uidReset ? (
            <Input
              disabled
              {...register('uid', { validate: async (v: string) => await validateUid(v) })}
              addonAfter={!uidReset && <Button onClick={onUidReset}>Change uid</Button>}
            />
          ) : (
            <Input {...register('uid', { required: true, validate: async (v: string) => await validateUid(v) })} />
          )}
        </>
      </Field>
      {inputs.constants &&
        inputs.constants.map((input: DashboardInput, index) => {
          const constantIndex = `constants[${index}]`;
          return (
            <Field
              label={input.label}
              error={errors.constants && errors.constants[index] && `${input.label} needs a value`}
              invalid={errors.constants && !!errors.constants[index]}
              key={constantIndex}
            >
              <Input {...register(constantIndex as any, { required: true })} defaultValue={input.value} />
            </Field>
          );
        })}
      <ImportDashboardLibraryPanelsList
        inputs={newLibraryPanels}
        label="New library panels"
        description="List of new library panels that will get imported."
        folderName={watchFolder.title}
      />
      <ImportDashboardLibraryPanelsList
        inputs={existingLibraryPanels}
        label="Existing library panels"
        description="List of existing library panels. These panels are not affected by the import."
        folderName={watchFolder.title}
      />
      <HorizontalGroup>
        <Button
          type="submit"
          data-testid={selectors.components.ImportDashboardForm.submit}
          variant={getButtonVariant(errors)}
          onClick={() => {
            setSubmitted(true);
          }}
        >
          {getButtonText(errors)}
        </Button>
        <Button type="reset" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </HorizontalGroup>
    </>
  );
};

function getButtonVariant(errors: FormFieldErrors<ImportDashboardDTO>) {
  return errors && (errors.title || errors.uid) ? 'destructive' : 'primary';
}

function getButtonText(errors: FormFieldErrors<ImportDashboardDTO>) {
  return errors && (errors.title || errors.uid) ? 'Import (Overwrite)' : 'Import';
}
