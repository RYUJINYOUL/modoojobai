export const getSafeLocalStorage = (key) => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const storedValue = localStorage.getItem(key);
  if (storedValue === null || storedValue === 'undefined') {
    return null;
  }

  try {
    return JSON.parse(storedValue);
  } catch (error) {
    console.error(`Error parsing JSON from localStorage for key: ${key}`, error);
    return storedValue; // 유효한 JSON이 아니면 원본 문자열 반환
  }
}; 