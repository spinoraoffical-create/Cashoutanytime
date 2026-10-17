import { createLiveStoreAdapter } from "./adapters";

/** Fire Kirin store adapter. execute() does not open the portal or solve a CAPTCHA. */
export function createFireKirinStoreAdapter() {
  return createLiveStoreAdapter("fire-kirin");
}
