import zhTW from './messages/zh-TW.js';
import en from './messages/en.js';

const messages = {
  'zh-TW': zhTW,
  'en-US': en
};

export const getMessage = (key, lang = 'zh-TW', params = {}) => {
  try {
    const langMessages = messages[lang] || messages['zh-TW'];
    const value = key.split('.').reduce((obj, k) => obj?.[k], langMessages);
    
    if (!value) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }

    return Object.entries(params).reduce(
      (msg, [key, value]) => msg.replace(`{${key}}`, value),
      value
    );
  } catch (error) {
    console.error('Translation error:', error);
    return key;
  }
}; 