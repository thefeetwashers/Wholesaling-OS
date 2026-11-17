import { supabase, supabaseConfigured } from './supabase';

// Slice 133 item 2 — proof-of-funds verification.
//
// A cash buyer uploads a proof-of-funds document (bank letter or
// statement) into the PRIVATE 'buyer-pof-documents' bucket; the
// operator reviews it in OperatorStats and marks it verified or
// rejected. A verified buy box then shows "POF verified" + the
// verification date in the public Cash Buyers directory. There is
// NO verified badge without an actual operator check: the public
// display reads ONLY the public.verified_buyer_pof view, which
// the migration fills only from rows the operator set to
// 'verified'.
//
// Privacy: the table and the bucket hold NO bank account numbers
// and NO amounts — only the storage path, the status, and the
// verification timestamps. No account number is ever displayed
// anywhere. The document itself is opened only through a 1-hour
// signed URL minted with the viewer's own session (the storage
// policies gate it: owner or operator only).
//
// Status states only: none submitted / pending review / verified
// (+ date) / rejected. A re-upload returns the row to 'pending'
// with the old verification cleared — a new document never keeps
// an old verified badge.
//
// Every write selects its row back, so a refused save throws
// instead of looking saved.

export type PofStatus = 'pending' | 'verified' | 'rejected';
export type PofDisplayStatus = 'none' | PofStatus;

export const POF_STATUS_LABELS: Record<PofStatus, string> = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Rejected',
};

export const POF_BUCKET = 'buyer-pof-documents';

export interface PofDocument {
  id?: string;
  user_id?: string;
  storage_path: string;
  status: PofStatus;
  uploaded_at?: string;
  verified_at?: string | null;
  verified_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VerifiedPof {
  user_id: string;
  verified_at: string | null;
}

const POF_SELECT =
  'id, user_id, storage_path, status, uploaded_at, verified_at, verified_by, created_at, updated_at';

function requireSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured on this deployment, so the proof of funds was not saved. Nothing was faked.',
    );
  }
  return supabase;
}

// The signed-in buyer's own current document, or null when none
// has been submitted. RLS decides what this account may see —
// a buyer reads only their own row.
export async function loadMyPof(userId: string): Promise<PofDocument | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('buyer_pof_documents')
    .select(POF_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as PofDocument | null;
}

// Operator only: every document, oldest upload first so the
// review queue is first-in, first-out. RLS decides what this
// account may see — a non-operator gets an empty result (or an
// error), never another buyer's document.
export async function loadAllPofDocuments(): Promise<PofDocument[]> {
  if (!supabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('buyer_pof_documents')
    .select(POF_SELECT)
    .order('uploaded_at', { ascending: true });
  if (error) throw error;
  return (data || []) as PofDocument[];
}

// Public read: verified rows only, from the public view. The
// view exposes exactly user_id + verified_at — no storage path,
// no pending/rejected rows. Safe to call for any list of buyer
// ids (the /buyers directory loads all verified rows at once).
export async function loadVerifiedPofByUserIds(
  userIds: string[],
): Promise<Record<string, string | null>> {
  if (!supabaseConfigured || !supabase) return {};
  if (userIds.length === 0) return {};
  const { data, error } = await supabase
    .from('verified_buyer_pof')
    .select('user_id, verified_at')
    .in('user_id', userIds);
  if (error) throw error;
  const out: Record<string, string | null> = {};
  ((data || []) as VerifiedPof[]).forEach((r) => {
    out[r.user_id] = r.verified_at;
  });
  return out;
}

// Buyer: submit (or re-submit) their document. Upsert on
// user_id — one current document per buyer. A re-upload always
// returns the row to 'pending' with any old verification
// cleared, so a new document never inherits an old badge.
// Verified write: the row is selected back.
export async function submitPofDocument(
  userId: string,
  storagePath: string,
): Promise<PofDocument> {
  const client = requireSupabase();
  if (!storagePath.trim()) throw new Error('No document was uploaded — nothing was saved.');
  const { data, error } = await client
    .from('buyer_pof_documents')
    .upsert(
      {
        user_id: userId,
        storage_path: storagePath.trim(),
        status: 'pending',
        uploaded_at: new Date().toISOString(),
        verified_at: null,
        verified_by: null,
      },
      { onConflict: 'user_id' },
    )
    .select(POF_SELECT)
    .single();
  if (error) throw error;
  if (!data) throw new Error('The proof of funds was not saved — nothing was written.');
  return data as PofDocument;
}

// Buyer: remove their own document record. The caller deletes
// the storage file separately; a failed file delete must not
// leave a record pointing at a file that is gone, so delete the
// file FIRST and only then remove the row.
export async function deleteMyPof(userId: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client
    .from('buyer_pof_documents')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

// Operator only: verify or reject a document. Verified write —
// the update selects its row back, so a refused save throws.
// Verify stamps verified_at; reject clears it. verified_by is
// the operator who decided either way.
export async function setPofStatus(
  documentId: string,
  status: 'verified' | 'rejected',
  operatorUserId: string,
): Promise<PofDocument> {
  const client = requireSupabase();
  if (!operatorUserId) throw new Error('The operator could not be identified — nothing was saved.');
  const { data, error } = await client
    .from('buyer_pof_documents')
    .update({
      status,
      verified_at: status === 'verified' ? new Date().toISOString() : null,
      verified_by: operatorUserId,
    })
    .eq('id', documentId)
    .select(POF_SELECT)
    .single();
  if (error) throw error;
  if (!data) {
    throw new Error(
      'The decision did not save — the document may not exist, or the Slice 133 migration has not been applied yet.',
    );
  }
  return data as PofDocument;
}

// 1-hour signed URL for one document, minted with the caller's
// own session. The storage policies gate it: only the document's
// owner or the operator gets a URL. Returns null (not a fake
// URL) when the document cannot be opened.
export async function mintPofSignedUrl(storagePath: string): Promise<string | null> {
  if (!supabaseConfigured || !supabase) return null;
  if (!storagePath.trim()) return null;
  const { data, error } = await supabase.storage
    .from(POF_BUCKET)
    .createSignedUrl(storagePath.trim(), 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
