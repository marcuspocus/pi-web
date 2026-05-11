import type { AppState } from "../appState";
import type { Workspace } from "../api";
import type { PiWebPlugin, PluginAction, PluginRuntimeContext, QualifiedContributionId, QualifiedPluginAction, QualifiedWorkspaceLabelContribution, QualifiedWorkspacePanelContribution, WorkspaceLabelContribution, WorkspaceLabelItem, WorkspacePanelContribution } from "./types";

const idPattern = /^[a-z][a-z0-9.-]*$/u;
const localIdPattern = /^[a-z][a-z0-9.-]*$/u;

type RegisteredPluginAction = Omit<PluginAction, "id"> & {
  id: QualifiedContributionId;
  pluginId: string;
  localId: string;
};

export class PluginRegistry {
  private readonly actions: RegisteredPluginAction[] = [];
  private readonly workspacePanels: QualifiedWorkspacePanelContribution[] = [];
  private readonly workspaceLabelContributions: QualifiedWorkspaceLabelContribution[] = [];
  private readonly pluginIds = new Set<string>();
  private readonly contributionIds = new Set<QualifiedContributionId>();

  register(plugin: PiWebPlugin): void {
    this.validatePluginId(plugin.id);
    if (this.pluginIds.has(plugin.id)) throw new Error(`Duplicate plugin id: ${plugin.id}`);
    this.pluginIds.add(plugin.id);

    const contributions = plugin.activate({ apiVersion: 1 });
    for (const action of contributions.actions ?? []) this.actions.push(this.qualifyAction(plugin.id, action));
    for (const panel of contributions.workspacePanels ?? []) this.workspacePanels.push(this.qualifyWorkspacePanel(plugin.id, panel));
    for (const contribution of contributions.workspaceLabelContributions ?? []) this.workspaceLabelContributions.push(this.qualifyWorkspaceLabelContribution(plugin.id, contribution));
  }

  getActions(context: PluginRuntimeContext): QualifiedPluginAction[] {
    return this.actions.map((action) => {
      const enabled = typeof action.enabled === "function" ? action.enabled(context) : action.enabled;
      const qualified: QualifiedPluginAction = {
        id: action.id,
        pluginId: action.pluginId,
        localId: action.localId,
        title: action.title,
        run: () => action.run(context),
      };
      if (action.description !== undefined) qualified.description = action.description;
      if (action.shortcut !== undefined) qualified.shortcut = action.shortcut;
      if (action.group !== undefined) qualified.group = action.group;
      if (enabled !== undefined) qualified.enabled = enabled;
      return qualified;
    });
  }

  getWorkspacePanels(): QualifiedWorkspacePanelContribution[] {
    return [...this.workspacePanels].sort((left, right) => (left.order ?? 1000) - (right.order ?? 1000) || left.title.localeCompare(right.title));
  }

  getWorkspaceLabelItems(state: AppState, workspace: Workspace): WorkspaceLabelItem[] {
    const context = { state, workspace };
    return [...this.workspaceLabelContributions]
      .sort((left, right) => (left.order ?? 1000) - (right.order ?? 1000) || left.id.localeCompare(right.id))
      .flatMap((contribution) => {
        if (contribution.visible?.(context) === false) return [];
        const items = contribution.items(context);
        if (items === undefined) return [];
        return Array.isArray(items) ? items : [items];
      });
  }

  private qualifyAction(pluginId: string, action: PluginAction): RegisteredPluginAction {
    const id = this.qualify(pluginId, action.id);
    return { ...action, id, pluginId, localId: action.id };
  }

  private qualifyWorkspacePanel(pluginId: string, panel: WorkspacePanelContribution): QualifiedWorkspacePanelContribution {
    const id = this.qualify(pluginId, panel.id);
    return { ...panel, id, pluginId, localId: panel.id };
  }

  private qualifyWorkspaceLabelContribution(pluginId: string, contribution: WorkspaceLabelContribution): QualifiedWorkspaceLabelContribution {
    const id = this.qualify(pluginId, contribution.id);
    return { ...contribution, id, pluginId, localId: contribution.id };
  }

  private qualify(pluginId: string, localId: string): QualifiedContributionId {
    this.validateLocalId(localId);
    const qualified: QualifiedContributionId = `${pluginId}:${localId}`;
    if (this.contributionIds.has(qualified)) throw new Error(`Duplicate contribution id: ${qualified}`);
    this.contributionIds.add(qualified);
    return qualified;
  }

  private validatePluginId(pluginId: string): void {
    if (!idPattern.test(pluginId)) throw new Error(`Invalid plugin id: ${pluginId}`);
  }

  private validateLocalId(localId: string): void {
    if (!localIdPattern.test(localId)) throw new Error(`Invalid contribution id: ${localId}`);
  }
}
