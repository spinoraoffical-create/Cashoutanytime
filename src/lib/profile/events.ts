export const PROFILE_UPDATED_EVENT = "hub-profile-updated";

export type ProfileUpdatedDetail = {
  name: string;
  avatarUrl: string | null;
};
