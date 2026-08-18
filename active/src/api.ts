import { invoke } from "@tauri-apps/api/core";

export interface GenerateInput {
  customer_name: string;
  hwid: string;
  duration: string;
  features: string;
}

export const api = {
  generateLicense: (input: GenerateInput) =>
    invoke<string>("generate_license", { input }),
  listLicenses: () => invoke<any[]>("list_licenses"),
  deleteLicense: (index: number) =>
    invoke<void>("delete_license", { index }),
  verifyLicense: (key: string) =>
    invoke<{ valid: boolean; customer_name?: string; hwid?: string; expiry_date?: string; features?: string; created_at?: string; error?: string }>(
      "verify_license",
      { key },
    ),
};
