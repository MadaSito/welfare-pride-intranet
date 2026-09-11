export type BirthdayTemplateValues = {
  displayName: string;
  firstName: string;
};

export function getBirthdayTemplateValues(displayName: string): BirthdayTemplateValues {
  const normalizedDisplayName = displayName.trim() || "Welfare Pride Employee";
  return {
    displayName: normalizedDisplayName,
    firstName: normalizedDisplayName.split(/\s+/)[0] || normalizedDisplayName,
  };
}

export function renderBirthdayTemplate(value: string, values: BirthdayTemplateValues): string {
  return value
    .replace(/\{\{displayName\}\}/g, values.displayName)
    .replace(/\{\{firstName\}\}/g, values.firstName);
}

export function previewBirthdayTemplate(input: { subjectTemplate: string; bodyTemplate: string; displayName?: string }) {
  const values = getBirthdayTemplateValues(input.displayName || "Welfare Pride Employee");
  return {
    ...values,
    subject: renderBirthdayTemplate(input.subjectTemplate, values),
    bodyText: renderBirthdayTemplate(input.bodyTemplate, values),
  };
}
