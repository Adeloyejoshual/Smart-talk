import { getFirestore } from "firebase-admin/firestore";

export const cleanupExpiredPins = async () => {
  const db = getFirestore();
  const now = Date.now();
  const pins = await db.collectionGroup("pins").where("expiresAt", "<", now).get();

  const batch = db.batch();
  pins.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
};