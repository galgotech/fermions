import { LoadingState } from '@grafana/data';

import { SceneDataNode } from './SceneDataNode';
import { SceneTimeRange as SceneTimeRangeImpl } from './SceneTimeRange';
import { SceneDataState, SceneEditor, SceneLayoutState, SceneObject, SceneTimeRangeLike } from './types';

/**
 * Will walk up the scene object graph to the closest $data scene object
 */
export function getData(sceneObject: SceneObject): SceneObject<SceneDataState> {
  const { $data } = sceneObject.state;
  if ($data) {
    return $data;
  }

  if (sceneObject.parent) {
    return getData(sceneObject.parent);
  }

  return EmptyDataNode;
}

/**
 * Will walk up the scene object graph to the closest $timeRange scene object
 */
export function getTimeRange(sceneObject: SceneObject): SceneTimeRangeLike {
  const { $timeRange } = sceneObject.state;
  if ($timeRange) {
    return $timeRange;
  }

  if (sceneObject.parent) {
    return getTimeRange(sceneObject.parent);
  }

  return DefaultTimeRange;
}

/**
 * Will walk up the scene object graph to the closest $editor scene object
 */
export function getSceneEditor(sceneObject: SceneObject): SceneEditor {
  const { $editor } = sceneObject.state;
  if ($editor) {
    return $editor;
  }

  if (sceneObject.parent) {
    return getSceneEditor(sceneObject.parent);
  }

  throw new Error('No editor found in scene tree');
}

/**
 * Will walk up the scene object graph to the closest $layout scene object
 */
export function getLayout(scene: SceneObject): SceneObject<SceneLayoutState> {
  if (scene.constructor.name === 'SceneFlexLayout' || scene.constructor.name === 'SceneGridLayout') {
    return scene as SceneObject<SceneLayoutState>;
  }

  if (scene.parent) {
    return getLayout(scene.parent);
  }

  throw new Error('No layout found in scene tree');
}

export const EmptyDataNode = new SceneDataNode({
  data: {
    state: LoadingState.Done,
    series: [],
  },
});

export const DefaultTimeRange = new SceneTimeRangeImpl();

export const sceneGraph = {
  getData,
  getTimeRange,
  getSceneEditor,
  getLayout,
};
