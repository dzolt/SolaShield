import type { Role } from "./data";

const ROLE_PARAM = "role";
const WILL_PARAM = "will";

export function roleFromUrl(): Role | undefined {
  const value = new URLSearchParams(window.location.search).get(ROLE_PARAM);
  return value === "owner" || value === "guardian" || value === "heir" ? value : undefined;
}

export function willFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get(WILL_PARAM) ?? undefined;
}

function writeParam(name: string, value: string | undefined): void {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState(null, "", url);
}

/** Keeps the role in the address (?role=heir), so a link opens straight into that view. */
export const writeRoleToUrl = (role: Role | undefined): void => writeParam(ROLE_PARAM, role);

/** Keeps the open will in the address (?will=...). */
export const writeWillToUrl = (will: string | undefined): void => writeParam(WILL_PARAM, will);
