"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AuditFilter({ defaultQuery }: { defaultQuery: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(defaultQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(Array.from(sp.entries()));
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    router.replace(`/admin/audit?${params.toString()}`);
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by actor name, email, entity type, or entity ID…"
      />
      <Button type="submit">Filter</Button>
    </form>
  );
}
