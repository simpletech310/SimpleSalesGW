import { FormPage } from "@/components/templates";
import { NewLeadForm } from "./NewLeadForm";

export default function NewLeadPage() {
  return (
    <FormPage
      title="New lead"
      subtitle="Capture the basics — you can fill in everything else later."
      crumbs={[{ href: "/leads", label: "Leads" }, { label: "New" }]}
      width="lg"
    >
      <NewLeadForm />
    </FormPage>
  );
}
