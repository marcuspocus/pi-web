import type { TemplateResult } from "lit";
import type { AppAction } from "../actions";
import type { FileContentResponse, FileTreeEntry, GitDiffResponse, GitStatusResponse, Workspace } from "../api";
import type { AppState } from "../appState";

export type PluginId = string;
export type LocalContributionId = string;
export type QualifiedContributionId = `${PluginId}:${LocalContributionId}`;

export interface PiWebPlugin {
  id: PluginId;
  name: string;
  activate: (context: PluginActivationContext) => PluginContributions;
}

export interface PluginActivationContext {
  apiVersion: 1;
}

export interface PluginContributions {
  actions?: PluginAction[];
  workspacePanels?: WorkspacePanelContribution[];
}

export interface PluginRuntimeContext {
  state: AppState;
  openActionPalette: () => void;
  focusPrompt: () => void;
  addProject: () => void | Promise<void>;
  selectMainView: (view: AppState["mainView"]) => void;
  selectWorkspaceTool: (tool: QualifiedContributionId) => void;
  refreshFiles: () => void | Promise<void>;
  refreshGit: () => void | Promise<void>;
  startSession: () => void | Promise<void>;
  archiveSession: () => void | Promise<void>;
  stopActiveWork: () => void | Promise<void>;
}

export interface PluginAction {
  id: LocalContributionId;
  title: string;
  description?: string;
  shortcut?: string;
  group?: string;
  enabled?: boolean | ((context: PluginRuntimeContext) => boolean);
  run: (context: PluginRuntimeContext) => void | Promise<void>;
}

export interface QualifiedPluginAction extends AppAction {
  pluginId: PluginId;
  localId: LocalContributionId;
}

export interface WorkspacePanelContext {
  workspace: Workspace;
  fileTree: FileTreeEntry[];
  expandedDirs: Record<string, FileTreeEntry[]>;
  selectedFilePath: string | undefined;
  selectedFileContent: FileContentResponse | undefined;
  fileTreeStale: boolean;
  gitStatus: GitStatusResponse | undefined;
  selectedDiffPath: string | undefined;
  selectedDiff: GitDiffResponse | undefined;
  selectedStagedDiff: GitDiffResponse | undefined;
  gitStale: boolean;
  onRefreshFiles: () => void;
  onExpandDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  onRefreshGit: () => void;
  onSelectDiff: (path: string) => void;
}

export interface WorkspacePanelContribution {
  id: LocalContributionId;
  title: string;
  order?: number;
  visible?: (workspace: Workspace) => boolean;
  render: (context: WorkspacePanelContext) => TemplateResult;
}

export interface QualifiedWorkspacePanelContribution extends WorkspacePanelContribution {
  id: QualifiedContributionId;
  pluginId: PluginId;
  localId: LocalContributionId;
}
