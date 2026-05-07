import { createHash } from "node:crypto";
import type { Project } from "../types.js";
import type { Workspace } from "../types.js";
import { discoverGitWorktrees, isGitRepository } from "./gitWorktreeDiscovery.js";

const idFor = (value: string) => createHash("sha1").update(value).digest("hex").slice(0, 12);

export class WorkspaceService {
  async list(project: Project): Promise<Workspace[]> {
    if (!(await isGitRepository(project.path))) {
      return [this.single(project)];
    }

    const worktrees = await discoverGitWorktrees(project.path);
    if (worktrees.length === 0) return [this.single(project)];

    return worktrees.map((worktree) => ({
      id: idFor(`${project.id}:${worktree.path}`),
      projectId: project.id,
      path: worktree.path,
      label: worktree.branch || (worktree.detached ? "detached" : worktree.path.split("/").filter(Boolean).at(-1) || worktree.path),
      branch: worktree.branch,
      isMain: worktree.path === project.path,
      isGitWorktree: true,
    }));
  }

  private single(project: Project): Workspace {
    return {
      id: idFor(`${project.id}:${project.path}`),
      projectId: project.id,
      path: project.path,
      label: project.name,
      isMain: true,
      isGitWorktree: false,
    };
  }
}
