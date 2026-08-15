/**
 * Types for the schema in supabase/migrations/.
 *
 * Hand-written for Phase 0. Once the Supabase CLI is linked to the project you
 * can regenerate this instead of editing it by hand:
 *
 *   npm run db:types
 *
 * If you change the SQL, change this file in the same commit — a mismatch here
 * type-checks fine and fails at runtime.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type EventStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
export type RegStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "WAITLISTED"
  | "CANCELLED";
export type AdminRole = "OWNER" | "ADMIN" | "SCANNER";
export type JobStatus = "QUEUED" | "SENDING" | "SENT" | "FAILED";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  venue: string | null;
  banner_url: string | null;
  form_key: string;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  status: EventStatus;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  requires_payment: boolean;
  fee_amount: number | null;
  payment_qr_url: string | null;
  auto_approve: boolean;
  certificate_enabled: boolean;
  certificate_template_url: string | null;
  certificate_config: Json | null;
  created_at: string;
  updated_at: string;
};

type EventDayRow = {
  id: string;
  event_id: string;
  day_number: number;
  label: string | null;
  date: string;
};

type RegistrationRow = {
  id: string;
  event_id: string;
  code: string;
  qr_token: string;
  full_name: string;
  email: string;
  phone: string | null;
  answers: Json;
  status: RegStatus;
  payment_proof_url: string | null;
  created_at: string;
};

type AttendanceRow = {
  id: string;
  registration_id: string;
  event_day_id: string;
  scanned_at: string;
  scanned_by: string | null;
};

type CertificateRow = {
  id: string;
  registration_id: string;
  serial: string;
  pdf_url: string;
  issued_at: string;
  emailed_at: string | null;
};

type AdminUserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
};

type EmailJobRow = {
  id: string;
  to: string;
  template: string;
  payload: Json;
  registration_id: string | null;
  status: JobStatus;
  attempts: number;
  locked_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
};

type CertificateJobRow = {
  id: string;
  registration_id: string | null;
  event_id: string | null;
  status: JobStatus;
  error_msg: string | null;
  created_at: string;
};

/** Columns that accept null — omitting them on insert is the same as null. */
type NullableKeys<Row> = {
  [K in keyof Row]-?: null extends Row[K] ? K : never;
}[keyof Row];

/**
 * On insert, everything the database can fill in for itself is optional:
 * generated columns (id, timestamps), columns with defaults, and any nullable
 * column.
 */
type Insert<Row, Generated extends keyof Row> = Omit<
  Row,
  Generated | NullableKeys<Row>
> &
  Partial<Pick<Row, Generated | NullableKeys<Row>>>;

export type Database = {
  public: {
    Tables: {
      events: {
        Row: EventRow;
        Insert: Insert<EventRow, "id" | "created_at" | "updated_at" | "status" |
          "form_key" | "requires_payment" | "auto_approve" | "certificate_enabled">;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      event_days: {
        Row: EventDayRow;
        Insert: Insert<EventDayRow, "id">;
        Update: Partial<EventDayRow>;
        Relationships: [];
      };
      registrations: {
        Row: RegistrationRow;
        Insert: Insert<RegistrationRow, "id" | "created_at" | "status" | "answers">;
        Update: Partial<RegistrationRow>;
        Relationships: [];
      };
      attendance: {
        Row: AttendanceRow;
        Insert: Insert<AttendanceRow, "id" | "scanned_at">;
        Update: Partial<AttendanceRow>;
        Relationships: [];
      };
      certificates: {
        Row: CertificateRow;
        Insert: Insert<CertificateRow, "id" | "issued_at">;
        Update: Partial<CertificateRow>;
        Relationships: [];
      };
      admin_users: {
        Row: AdminUserRow;
        Insert: Insert<AdminUserRow, "id" | "created_at" | "role" | "is_active">;
        Update: Partial<AdminUserRow>;
        Relationships: [];
      };
      email_jobs: {
        Row: EmailJobRow;
        Insert: Insert<EmailJobRow, "id" | "created_at" | "status" | "attempts" | "payload">;
        Update: Partial<EmailJobRow>;
        Relationships: [];
      };
      certificate_jobs: {
        Row: CertificateJobRow;
        Insert: Insert<CertificateJobRow, "id" | "created_at" | "status">;
        Update: Partial<CertificateJobRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      /**
       * Atomic capacity check + insert. See supabase/migrations/0002_functions.sql.
       * Throws CAPACITY_FULL / REGISTRATION_CLOSED / DUPLICATE_EMAIL / EVENT_NOT_FOUND.
       */
      register_for_event: {
        Args: {
          p_event_id: string;
          p_code: string;
          p_qr_token: string;
          p_full_name: string;
          p_email: string;
          p_phone?: string | null;
          p_answers?: Json;
          p_payment_proof_url?: string | null;
        };
        Returns: RegistrationRow;
      };
      /** Atomic claim of queued email jobs, safe against overlapping workers. */
      claim_email_jobs: {
        Args: { p_limit?: number };
        Returns: EmailJobRow[];
      };
    };
    Enums: {
      event_status: EventStatus;
      reg_status: RegStatus;
      admin_role: AdminRole;
      job_status: JobStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};

// Convenience aliases — import these instead of reaching into Database.
export type Event = EventRow;
export type EventDay = EventDayRow;
export type Registration = RegistrationRow;
export type Attendance = AttendanceRow;
export type Certificate = CertificateRow;
export type AdminUser = AdminUserRow;
export type EmailJob = EmailJobRow;
export type CertificateJob = CertificateJobRow;
