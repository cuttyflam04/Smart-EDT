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

export const submitFeedback = async (data: FeedbackData) => {
  console.log('Feedback submitted (local):', data);
  // In a real app without Firebase, we'd use a simple API endpoint.
  // For now, we'll just return a mock success.
  return { success: true, id: 'local-' + Date.now() };
};
