import { NewLeadForm } from "./NewLeadForm";

export default function NewLeadPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gtn-navy mb-2">New Lead</h1>
      <p className="text-sm text-gtn-grey-2 mb-6">Capture the basics — you can fill in everything else later.</p>
      <NewLeadForm />
    </div>
  );
}
