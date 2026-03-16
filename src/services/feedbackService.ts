import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export type FeedbackType = 'bug' | 'idea' | 'other';
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FeedbackData {
  type: FeedbackType;
  severity?: FeedbackSeverity;
  title: string;
  description: string;
  category?: string;
  metadata?: Record<string, any>;
}

const BASE_URL = window.location.origin.includes('localhost') 
  ? 'https://ais-dev-4xlkqj6wtjalfvtml4xabo-214876071276.europe-west2.run.app' 
  : '';

export const submitFeedback = async (data: FeedbackData) => {
  const user = auth.currentUser;
  
  const feedbackDoc = {
    ...data,
    createdAt: serverTimestamp(),
    userId: user?.uid || null,
    userEmail: user?.email || null,
    userAgent: navigator.userAgent,
    platform: (window as any).Capacitor?.getPlatform() || 'web',
    appVersion: '1.0.0'
  };

  try {
    // 1. Save to Firestore (Primary storage)
    const docRef = await addDoc(collection(db, 'feedbacks'), feedbackDoc);
    console.log('Feedback saved to Firestore with ID:', docRef.id);

    // 2. Notify via Discord (Secondary notification)
    const apiPath = `${BASE_URL}/api/feedback`;
    fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        feedbackId: docRef.id,
        userEmail: user?.email || 'Anonyme',
        timestamp: new Date().toISOString()
      })
    }).catch(err => {
      console.error('Failed to send Discord notification, but feedback was saved to Firestore:', err);
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
};
