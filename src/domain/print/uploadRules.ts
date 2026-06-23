import { getProfileUploadLimitBytes } from "./measurements";
import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";
import type { PreflightIssue, ProductionProfile } from "./types";

export interface UploadCandidate {
  name: string;
  type: string;
  size: number;
}

export function getFileExtension(fileName: string): string {
  const extension = fileName.split(".").pop();
  return extension ? extension.toLowerCase() : "";
}

export function isAcceptedUploadType(
  file: Pick<UploadCandidate, "name" | "type">,
  profile: ProductionProfile = STICKER_SHEET_MVP_PROFILE
): boolean {
  const extension = getFileExtension(file.name);

  return (
    profile.uploadRules.acceptedMimeTypes.includes(file.type) ||
    profile.uploadRules.acceptedExtensions.includes(extension)
  );
}

export function validateUploadCandidate(
  file: UploadCandidate,
  profile: ProductionProfile = STICKER_SHEET_MVP_PROFILE
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];

  if (!isAcceptedUploadType(file, profile)) {
    issues.push({
      id: `${file.name}:unsupported-upload`,
      severity: "error",
      code: "unsupported-upload",
      message: `${file.name} is not a supported upload type.`,
    });
  }

  if (file.size > getProfileUploadLimitBytes(profile)) {
    issues.push({
      id: `${file.name}:upload-too-large`,
      severity: "error",
      code: "upload-too-large",
      message: `${file.name} exceeds the ${profile.uploadRules.maxUploadSizeMb} MB upload limit.`,
    });
  }

  return issues;
}
