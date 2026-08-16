import { redirect } from "next/navigation";

// Categories now live on the main settings page.
export default function CategoriesSettingsRedirect() {
  redirect("/settings/household");
}
