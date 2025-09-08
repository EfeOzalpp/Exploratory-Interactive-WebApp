// utils/saveUserResponse.ts
import { liveClient } from './sanityClient';

export async function saveUserResponse(section: string, answers: {
  question1: string; question2: string; question3: string; question4: string; question5: string;
}) {
  const doc = {
    _type: 'userResponseV2',
    section,
    ...answers,
    submittedAt: new Date().toISOString(),
  };

  // liveClient so the write is immediately visible
  const created = await liveClient.create(doc);

  // Persist ONLY for this tab/session (this is exactly your desired scope)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('gp.myEntryId', created._id);
    sessionStorage.setItem('gp.mySection', section);
  }

  return created; // { _id, ... }
}
