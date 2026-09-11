import { apiFetch } from '../api/client.js';

export async function startInterviewSession({ language = 'te', photo_url = null, category_hint = null }) {
  return apiFetch('/interview/start', {
    method: 'POST',
    body: JSON.stringify({ language, photo_url, category_hint }),
  });
}

export async function submitInterviewAnswer(sessionId, answerText) {
  return apiFetch(`/interview/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ answer: answerText }),
  });
}

export async function getInterviewSession(sessionId) {
  return apiFetch(`/interview/${sessionId}`);
}

export async function runMarketResearch(sessionId) {
  return apiFetch(`/interview/${sessionId}/market-research`, {
    method: 'POST',
  });
}

export async function submitExpectedPrice(sessionId, expectedPrice) {
  return apiFetch(`/interview/${sessionId}/expected-price`, {
    method: 'POST',
    body: JSON.stringify({ expected_price: parseFloat(expectedPrice) }),
  });
}

export async function generateListingProse(sessionId) {
  return apiFetch(`/interview/${sessionId}/generate-listing`, {
    method: 'POST',
  });
}

export async function calculateFinalPrice(sessionId, costs = {}) {
  return apiFetch(`/interview/${sessionId}/final-price`, {
    method: 'POST',
    body: JSON.stringify({
      material_cost: costs.material_cost ? parseFloat(costs.material_cost) : 0,
      labour_cost: costs.labour_cost ? parseFloat(costs.labour_cost) : 0,
      packaging_cost: costs.packaging_cost ? parseFloat(costs.packaging_cost) : 0,
      other_cost: costs.other_cost ? parseFloat(costs.other_cost) : 0,
    }),
  });
}

export async function publishInterviewProduct(sessionId, payload) {
  return apiFetch(`/interview/${sessionId}/publish`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
