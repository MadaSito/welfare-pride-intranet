export type BirthdaySource = {
  id: number;
  displayName: string;
  photoUrl: string | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayVisible?: boolean;
  [key: string]: unknown;
};

export function projectBirthdayDisplays(profiles: BirthdaySource[]) {
  return profiles
    .filter(profile => profile.birthdayVisible && profile.birthdayMonth && profile.birthdayDay)
    .map(profile => ({
      profileId: profile.id,
      displayName: profile.displayName,
      photoUrl: profile.photoUrl,
      month: profile.birthdayMonth!,
      day: profile.birthdayDay!,
    }))
    .sort((a, b) => a.month - b.month || a.day - b.day || a.displayName.localeCompare(b.displayName));
}
