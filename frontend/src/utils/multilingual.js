/**
 * Helper to retrieve localized product field based on user's active language.
 * Checks structured translations object if present, otherwise returns primary or English field.
 * Full-page translation into the target language is handled dynamically by Google Translate.
 */

export function getLocalizedProductField(product, field, activeLanguage = 'en') {
  if (!product) return '';

  // 1. Check structured translations dictionary on the product if present
  if (product.translations) {
    try {
      const transMap = typeof product.translations === 'string'
        ? JSON.parse(product.translations)
        : product.translations;
      if (transMap && transMap[activeLanguage] && transMap[activeLanguage][field]) {
        return transMap[activeLanguage][field];
      }
    } catch (e) {
      // Ignore parse error
    }
  }

  // 2. Return primary value or English fallback
  const primaryValue = product[field] || '';
  const englishValue = product[`${field}_en`] || '';

  if (activeLanguage === 'en' && englishValue) {
    return englishValue;
  }

  return primaryValue || englishValue || '';
}

