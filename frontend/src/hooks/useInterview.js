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
  COST_INPUT: 'COST_INPUT',
  FINAL_PRICING: 'FINAL_PRICING',
  REVIEW: 'REVIEW',
  SUCCESS: 'SUCCESS'
};

export function useInterview() {
  const [step, setStep] = useState(INTERVIEW_STEPS.PHOTO_LANG);
  const [sessionId, setSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startSession = useCallback(async ({ language = 'te', photo_url = null, secondary_images = null, category_hint = null }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await startInterviewSession({ language, photo_url, secondary_images, category_hint });
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

  const submitArtisanExpectedPrice = useCallback(async (priceVal) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await submitExpectedPrice(sessionId, priceVal);
      setSessionData(data);
      // Advance to explicit Cost Input screen
      setStep(INTERVIEW_STEPS.COST_INPUT);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to submit expected price');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const submitCostBreakdown = useCallback(async (costs) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Generate AI listing prose
      const listingData = await generateListingProse(sessionId);

      // 2. Calculate final price with real cost inputs and Option B safety caps
      const priceData = await calculateFinalPrice(sessionId, costs);

      const fullData = {
        ...sessionData,
        ...listingData,
        ...priceData,
        material_cost: costs?.material_cost ? parseFloat(costs.material_cost) : 0,
        labour_cost: costs?.labour_cost ? parseFloat(costs.labour_cost) : 0,
        packaging_cost: costs?.packaging_cost ? parseFloat(costs.packaging_cost) : 0,
        other_cost: costs?.other_cost ? parseFloat(costs.other_cost) : 0,
        pricing_recommendation: priceData.pricing_recommendation || {
          recommended_price: priceData.recommended_price,
          cost_floor: priceData.cost_floor,
          artisan_expected_price: priceData.artisan_expected_price,
          reasoning: priceData.pricing_explanation || []
        }
      };
      setSessionData(fullData);
      setStep(INTERVIEW_STEPS.FINAL_PRICING);
      return fullData;
    } catch (err) {
      setError(err.message || 'Failed to calculate pricing and generate listing');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId, sessionData]);

  const recalculatePrice = useCallback(async (costs) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await calculateFinalPrice(sessionId, costs);
      const fullData = {
        ...sessionData,
        ...data,
        material_cost: costs?.material_cost !== undefined ? parseFloat(costs.material_cost) : (sessionData?.material_cost || 0),
        labour_cost: costs?.labour_cost !== undefined ? parseFloat(costs.labour_cost) : (sessionData?.labour_cost || 0),
        packaging_cost: costs?.packaging_cost !== undefined ? parseFloat(costs.packaging_cost) : (sessionData?.packaging_cost || 0),
        other_cost: costs?.other_cost !== undefined ? parseFloat(costs.other_cost) : (sessionData?.other_cost || 0),
        pricing_recommendation: data.pricing_recommendation || {
          recommended_price: data.recommended_price,
          cost_floor: data.cost_floor,
          artisan_expected_price: data.artisan_expected_price,
          reasoning: data.pricing_explanation || []
        }
      };
      setSessionData(fullData);
      return fullData;
    } catch (err) {
      setError(err.message || 'Failed to recalculate price');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sessionId, sessionData]);

  const publishProduct = useCallback(async (publishPayload) => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const product = await publishInterviewProduct(sessionId, publishPayload);
      setStep(INTERVIEW_STEPS.SUCCESS);
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
    setSessionData,
    loading,
    error,
    startSession,
    sendAnswer,
    submitArtisanExpectedPrice,
    submitCostBreakdown,
    recalculatePrice,
    publishProduct
  };
}
