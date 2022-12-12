import React from 'react';

import {
  StandardEditorContext,
} from '@grafana/data';
import { PanelOptionsSupplier } from '@grafana/data/src/panel/PanelPlugin';
import {
  isNestedPanelOptions,
  NestedValueAccess,
  PanelOptionsEditorBuilder,
} from '@grafana/data/src/utils/OptionsUIBuilders';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';

type categoryGetter = (categoryNames?: string[]) => OptionsPaneCategoryDescriptor;


/**
 * This will iterate all options panes and add register them with the configured categories
 *
 * @internal
 */
export function fillOptionsPaneItems(
  supplier: PanelOptionsSupplier<any>,
  access: NestedValueAccess,
  getOptionsPaneCategory: categoryGetter,
  context: StandardEditorContext<any, any>,
  parentCategory?: OptionsPaneCategoryDescriptor
) {
  const builder = new PanelOptionsEditorBuilder<any>();
  supplier(builder, context);

  for (const pluginOption of builder.getItems()) {
    if (pluginOption.showIf && !pluginOption.showIf(context.options, context.data)) {
      continue;
    }

    let category = parentCategory;
    if (!category) {
      category = getOptionsPaneCategory(pluginOption.category);
    } else if (pluginOption.category?.[0]?.length) {
      category = category.getCategory(pluginOption.category[0]);
    }

    // Nested options get passed up one level
    if (isNestedPanelOptions(pluginOption)) {
      const subAccess = pluginOption.getNestedValueAccess(access);
      const subContext = subAccess.getContext
        ? subAccess.getContext(context)
        : { ...context, options: access.getValue(pluginOption.path) };

      fillOptionsPaneItems(
        pluginOption.getBuilder(),
        subAccess,
        getOptionsPaneCategory,
        subContext,
        category // parent category
      );
      continue;
    }

    const Editor = pluginOption.editor;
    category.addItem(
      new OptionsPaneItemDescriptor({
        title: pluginOption.name,
        description: pluginOption.description,
        render: function renderEditor() {
          return (
            <Editor
              value={access.getValue(pluginOption.path)}
              onChange={(value) => {
                access.onChange(pluginOption.path, value);
              }}
              item={pluginOption}
              context={context}
              id={pluginOption.id}
            />
          );
        },
      })
    );
  }
}
