export const FIRESTORE_COLLECTION_PATH = {
  UPLOADED_COMMUNITY_ROUTES: "uploadedCommunityRoutes",
} as const;

export type FirestoreCollectionPath =
  (typeof FIRESTORE_COLLECTION_PATH)[keyof typeof FIRESTORE_COLLECTION_PATH];
