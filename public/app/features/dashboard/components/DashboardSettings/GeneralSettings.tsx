import React, { useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { config } from '@grafana/runtime';
import { Field, Input, TagsInput } from '@grafana/ui';
import { Page } from 'app/core/components/PageNew/Page';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { DeleteDashboardButton } from '../DeleteDashboard/DeleteDashboardButton';

import { PreviewSettings } from './PreviewSettings';
import { SettingsPageProps } from './types';

export type Props = SettingsPageProps & ConnectedProps<typeof connector>;

export function GeneralSettingsUnconnected({
  dashboard,
  sectionNav,
}: Props): JSX.Element {
  const [renderCounter, setRenderCounter] = useState(0);

  const onFolderChange = (folder: { uid: string; title: string }) => {
    dashboard.meta.folderUid = folder.uid;
    dashboard.meta.folderTitle = folder.title;
    dashboard.meta.hasUnsavedFolderChange = true;
  };

  const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (event.currentTarget.name === 'title' || event.currentTarget.name === 'description') {
      dashboard[event.currentTarget.name] = event.currentTarget.value;
    }
  };

  const onTagsChange = (tags: string[]) => {
    dashboard.tags = tags;
    setRenderCounter(renderCounter + 1);
  };

  return (
    <Page navModel={sectionNav}>
      <div style={{ maxWidth: '600px' }}>
        <div className="gf-form-group">
          <Field label="Name">
            <Input id="title-input" name="title" onBlur={onBlur} defaultValue={dashboard.title} />
          </Field>
          <Field label="Description">
            <Input id="description-input" name="description" onBlur={onBlur} defaultValue={dashboard.description} />
          </Field>
          <Field label="Tags">
            <TagsInput id="tags-input" tags={dashboard.tags} onChange={onTagsChange} width={40} />
          </Field>
          <Field label="Folder">
            <FolderPicker
              inputId="dashboard-folder-input"
              initialTitle={dashboard.meta.folderTitle}
              initialFolderUid={dashboard.meta.folderUid}
              onChange={onFolderChange}
              enableCreateNew={true}
              dashboardId={dashboard.id}
              skipInitialLoad={true}
            />
          </Field>
        </div>

        {config.featureToggles.dashboardPreviews && config.featureToggles.dashboardPreviewsAdmin && (
          <PreviewSettings uid={dashboard.uid} />
        )}

        <div className="gf-form-button-row">
          {dashboard.meta.canDelete && <DeleteDashboardButton dashboard={dashboard} />}
        </div>
      </div>
    </Page>
  );
}

const mapDispatchToProps = {
};

const connector = connect(null, mapDispatchToProps);

export const GeneralSettings = connector(GeneralSettingsUnconnected);
