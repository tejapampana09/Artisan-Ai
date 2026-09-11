import { useState, useCallback } from 'react';
import { 
  startInterviewSession, 
  submitInterviewAnswer, 
  runMarketResearch, 
  submitExpectedPrice, 
  generateListingProse, 
  calculateFinalPrice, 
  publishInterviewProduct 
} from '../services/interviewApi';

export const INTERVIEW_STEPS = {
  PHOTO_LANG: 'PHOTO_LANG',
  INTERVIEW: 'INTERVIEW',
  MARKET_RESEARCH: 'MARKET_RESEARCH',
  EXPECTED_PRICE: 'EXPECTED_PRICE',
  FINAL_PRICING: 'FINAL_PRICING',
  REVIEW: 'REVIEW'
};

export function useInterview() {
  const [step, setStep] = useState(INTERVIEW_STEPS.PHOTO_LANG);
  const [sessionId, setSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startSession = useCallback(async ({ language = 'te', photo_url = null, category_hint = null }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await startInterviewSession({ language, photo_url, category_hint });
      setSessionId(data.id);
      setSessionData(data);
      setStep(INTERVIEW_STEPS.INTERVIEW);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to start interview session');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendAnswer = useCallback(async (answerText) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await submitInterviewAnswer(sessionId, answerText);
      setSessionData(data);

      if (data.status === 'FACTS_COMPLETE') {
        // Auto trigger market research when interview questions complete
        const researchData = await runMarketResearch(sessionId);
        setSessionData(researchData);
        setStep(INTERVIEW_STEPS.MARKET_RESEARCH);
      }
      return data;
    } catch (err) {
      setError(err.message || 'Failed to process answer');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const sendExpectedPrice = useCallback(async (priceVal) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await submitExpectedPrice(sessionId, priceVal);
      setSessionData(data);

      // Generate AI listing prose
      const listingData = await generateListingProse(sessionId);
      setSessionData(listingData);

      // Calculate V2 pricing recommendation
      const priceData = await calculateFinalPrice(sessionId, {});
      setSessionData(priceData);

      setStep(INTERVIEW_STEPS.REVIEW);
      return priceData;
    } catch (err) {
      setError(err.message || 'Failed to submit expected price');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const recalculatePrice = useCallback(async (costs) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await calculateFinalPrice(sessionId, costs);
      setSessionData(data);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to calculate price');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const publishProduct = useCallback(async (publishPayload) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const product = await publishInterviewProduct(sessionId, publishPayload);
      return product;
    } catch (err) {
      setError(err.message || 'Failed to publish product');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return {
    step,
    setStep,
    sessionId,
    sessionData,
    loading,
    error,
    startSession,
    sendAnswer,
    sendExpectedPrice,
    recalculatePrice,
    publishProduct
  };
}
