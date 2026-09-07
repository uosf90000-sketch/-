export type RecentProject = {
  id: string;
  name: string;
  extension?: string;
  uploadedAt?: string;
  seenAt: string;
};
const KEY = "bayti:recent-projects:v1";
export function recentProjects(): RecentProject[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list)
      ? list.filter(
          (p) => typeof p.id === "string" && typeof p.name === "string",
        )
      : [];
  } catch {
    return [];
  }
}
export function rememberProject(project: Omit<RecentProject, "seenAt">) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(
        [
          { ...project, seenAt: new Date().toISOString() },
          ...recentProjects().filter((p) => p.id !== project.id),
        ].slice(0, 50),
      ),
    );
  } catch {
    /* The server project remains accessible if device storage is unavailable. */
  }
}
