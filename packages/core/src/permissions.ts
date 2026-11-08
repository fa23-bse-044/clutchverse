export const roles = [
  "user",
  "player",
  "team_captain",
  "organizer",
  "moderator",
  "admin",
] as const;

export type Role = (typeof roles)[number];
export type Permission =
  | "tournament:create"
  | "tournament:manage"
  | "chat:moderate"
  | "report:review"
  | "admin:access";

const permissions: Record<Role, readonly Permission[]> = {
  user: [],
  player: [],
  team_captain: [],
  organizer: ["tournament:create", "tournament:manage"],
  moderator: ["chat:moderate", "report:review"],
  admin: [
    "tournament:create",
    "tournament:manage",
    "chat:moderate",
    "report:review",
    "admin:access",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return permissions[role].includes(permission);
}
