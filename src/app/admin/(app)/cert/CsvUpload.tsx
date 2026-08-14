"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function CsvUpload({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      // Very basic CSV parsing (assuming Name, Email format without complicated quotes)
      const rows = text.split("\n").map(row => row.trim()).filter(row => row.length > 0);
      
      const attendees = [];
      // Skip header row if it contains 'name' or 'email'
      const startIdx = rows[0].toLowerCase().includes("email") ? 1 : 0;
      
      for (let i = startIdx; i < rows.length; i++) {
        const columns = rows[i].split(",");
        if (columns.length >= 2) {
          attendees.push({
            full_name: columns[0].trim(),
            email: columns[1].trim()
          });
        }
      }

      if (attendees.length === 0) {
        throw new Error("No valid rows found in CSV. Make sure it has 'Name, Email' columns.");
      }

      const res = await fetch("/api/admin/certificates/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, attendees }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload CSV");
      }

      router.refresh();
      // Reset file input
      e.target.value = '';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border bg-card p-4">
      <h3 className="mb-2 font-medium">Upload Participants (CSV)</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Upload a CSV file with two columns: <strong>Name, Email</strong>. This will automatically approve them and mark them as having attended, making them eligible for certificates.
      </p>
      
      <div className="flex items-center gap-4">
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload} 
          disabled={loading}
          className="text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
        />
        {loading && <span className="text-sm text-muted-foreground">Uploading...</span>}
      </div>
      
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
