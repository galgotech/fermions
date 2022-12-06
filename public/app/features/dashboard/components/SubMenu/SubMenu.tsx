import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect, MapStateToProps } from 'react-redux';

import { StoreState } from '../../../../types';
import { getSubMenuVariables, getVariablesState } from '../../../variables/state/selectors';
import { VariableModel } from '../../../variables/types';
import { DashboardModel } from '../../state';
import { DashboardLink } from '../../state/DashboardModel';

import { DashboardLinks } from './DashboardLinks';
import { SubMenuItems } from './SubMenuItems';

interface OwnProps {
  dashboard: DashboardModel;
  links: DashboardLink[];
}

interface ConnectedProps {
  variables: VariableModel[];
}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

class SubMenuUnConnected extends PureComponent<Props> {
  render() {
    const { dashboard, variables, links } = this.props;

    if (!dashboard.isSubMenuVisible()) {
      return null;
    }

    const readOnlyVariables = false;

    return (
      <div className="submenu-controls">
        <form aria-label="Template variables" className={styles}>
          <SubMenuItems variables={variables} readOnly={readOnlyVariables} />
        </form>
        <div className="gf-form gf-form--grow" />
        {dashboard && <DashboardLinks dashboard={dashboard} links={links} />}
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, ownProps) => {
  const { uid } = ownProps.dashboard;
  const templatingState = getVariablesState(uid, state);
  return {
    variables: getSubMenuVariables(uid, templatingState.variables),
  };
};

const styles = css`
  display: flex;
  flex-wrap: wrap;
  display: contents;
`;

export const SubMenu = connect(mapStateToProps)(SubMenuUnConnected);

SubMenu.displayName = 'SubMenu';
