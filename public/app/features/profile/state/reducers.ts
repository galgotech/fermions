import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { dateTimeFormatTimeAgo, TimeZone } from '@grafana/data';
import config from 'app/core/config';
import { Team, UserDTO, UserOrg, UserSession } from 'app/types';

export interface UserState {
  orgId: number;
  timeZone: TimeZone;
  weekStart: string;
  user: UserDTO | null;
  teams: Team[];
  orgs: UserOrg[];
  sessions: UserSession[];
  teamsAreLoading: boolean;
  orgsAreLoading: boolean;
  sessionsAreLoading: boolean;
  isUpdating: boolean;
}

export const initialUserState: UserState = {
  orgId: config.bootData.user.orgId,
  timeZone: config.bootData.user.timezone,
  weekStart: config.bootData.user.weekStart,
  orgsAreLoading: false,
  sessionsAreLoading: false,
  teamsAreLoading: false,
  isUpdating: false,
  orgs: [],
  sessions: [],
  teams: [],
  user: null,
};

export const slice = createSlice({
  name: 'user/profile',
  initialState: initialUserState,
  reducers: {
    setUpdating: (state, action: PayloadAction<{ updating: boolean }>) => {
      state.isUpdating = action.payload.updating;
    },
    userLoaded: (state, action: PayloadAction<{ user: UserDTO }>) => {
      state.user = action.payload.user;
    },
    initLoadTeams: (state, action: PayloadAction<undefined>) => {
      state.teamsAreLoading = true;
    },
    teamsLoaded: (state, action: PayloadAction<{ teams: Team[] }>) => {
      state.teams = action.payload.teams;
      state.teamsAreLoading = false;
    },
    initLoadOrgs: (state, action: PayloadAction<undefined>) => {
      state.orgsAreLoading = true;
    },
    orgsLoaded: (state, action: PayloadAction<{ orgs: UserOrg[] }>) => {
      state.orgs = action.payload.orgs;
      state.orgsAreLoading = false;
    },
    initLoadSessions: (state, action: PayloadAction<undefined>) => {
      state.sessionsAreLoading = true;
    },
    sessionsLoaded: (state, action: PayloadAction<{ sessions: UserSession[] }>) => {
      const sorted = action.payload.sessions.sort((a, b) => Number(b.isActive) - Number(a.isActive)); // Show active sessions first
      state.sessions = sorted.map((session) => ({
        id: session.id,
        isActive: session.isActive,
        seenAt: dateTimeFormatTimeAgo(session.seenAt),
        createdAt: session.createdAt,
        clientIp: session.clientIp,
        browser: session.browser,
        browserVersion: session.browserVersion,
        os: session.os,
        osVersion: session.osVersion,
        device: session.device,
      }));
      state.sessionsAreLoading = false;
    },
    userSessionRevoked: (state, action: PayloadAction<{ tokenId: number }>) => {
      state.sessions = state.sessions.filter((session: UserSession) => {
        return session.id !== action.payload.tokenId;
      });
      state.isUpdating = false;
    },
  },
});

export const {
  setUpdating,
  initLoadOrgs,
  orgsLoaded,
  initLoadTeams,
  teamsLoaded,
  userLoaded,
  userSessionRevoked,
  initLoadSessions,
  sessionsLoaded,
} = slice.actions;

export const userReducer = slice.reducer;
export default { user: slice.reducer };
