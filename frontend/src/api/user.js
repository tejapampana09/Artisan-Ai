import { 
  marketplaceRequest, 
  studioRequest, 
  adminRequest, 
  getBuyerToken, 
  getStudioToken, 
  getAdminToken 
} from './client.js';

export async function getCurrentUser(domain = null) {
  let activeDomain = domain;
  if (!activeDomain) {
    if (getStudioToken()) activeDomain = 'STUDIO';
    else if (getAdminToken()) activeDomain = 'ADMIN';
    else if (getBuyerToken()) activeDomain = 'MARKETPLACE';
    else return null;
  }

  try {
    if (activeDomain === 'STUDIO' || activeDomain === 'ARTISAN') {
      return await studioRequest('/studio/auth/me');
    }
    if (activeDomain === 'ADMIN') {
      return await adminRequest('/admin/auth/me');
    }
    return await marketplaceRequest('/marketplace/auth/me');
  } catch (err) {
    console.error('Error fetching user for domain:', activeDomain, err);
    return null;
  }
}

export async function updateUserProfile(profileData, domain = null) {
  let activeDomain = domain;
  if (!activeDomain) {
    if (getStudioToken()) activeDomain = 'STUDIO';
    else if (getAdminToken()) activeDomain = 'ADMIN';
    else activeDomain = 'MARKETPLACE';
  }

  if (activeDomain === 'STUDIO' || activeDomain === 'ARTISAN') {
    return await studioRequest('/studio/auth/me', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }
  if (activeDomain === 'ADMIN') {
    return await adminRequest('/admin/auth/me', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }
  return await marketplaceRequest('/marketplace/auth/me', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });
}
