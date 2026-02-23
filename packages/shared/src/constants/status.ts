export const DOCUMENT_STATE = {
  PENDING_UPLOAD: "pending_upload",
  DRAFT: "draft",
  SUBMITTED: "submitted",
  PROCESSING: "processing",
  PROCESSING_FAILED: "processing_failed",
  USER_REVIEW: "user_review",
  MODERATOR_REVIEW: "moderator_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type DocumentState = (typeof DOCUMENT_STATE)[keyof typeof DOCUMENT_STATE];

export const VALID_STATE_TRANSITIONS: Record<DocumentState, DocumentState[]> = {
  pending_upload: ["submitted"],
  draft: ["moderator_review"],
  submitted: ["processing"],
  processing: ["user_review", "moderator_review", "processing_failed"],
  processing_failed: ["submitted"],
  user_review: ["draft", "moderator_review"],
  moderator_review: ["approved", "rejected"],
  approved: [],
  rejected: ["submitted", "user_review"],
};

export function isValidStateTransition(from: DocumentState, to: DocumentState): boolean {
  return VALID_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export const PROCESSING_STATES: DocumentState[] = ["submitted", "processing"];
export const REVIEW_STATES: DocumentState[] = ["user_review", "draft"];
// EDITABLE_STATES removed — editing now happens inside the review view
export const DELETABLE_STATES: DocumentState[] = [
  "draft",
  "processing_failed",
  "rejected",
  "pending_upload",
];
export const TERMINAL_STATES: DocumentState[] = ["approved"];
