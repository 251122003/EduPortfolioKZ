// Plain API types for the award endpoints, shared by the server and the web client.
// No imports on purpose: the browser code imports this file with `import type`,
// so it must not pull in zod, Prisma or node-only modules.

/** One award in GET /me/awards. Never contains IIN, phone, full name or encrypted fields. */
export interface StudentAward {
  id: string;
  type: 'diploma' | 'certificate';
  place: number | null;
  documentNumber: string;
  status: 'active' | 'corrected' | 'revoked';
  /** Reason of the approved revoke request; null when the award is not revoked or has no reason. */
  revokeReason: string | null;
  event: {
    title: string;
    subject: string;
    /** Event date as YYYY-MM-DD. */
    date: string;
    level: 'school' | 'district' | 'regional' | 'national' | 'international';
  };
  organization: {
    name: string;
    status: 'pending' | 'verified' | 'rejected' | 'suspended';
  };
}

/** 200 from GET /me/awards. Newest event first. */
export interface StudentAwardsResponse {
  awards: StudentAward[];
}
