import CryptoJS from 'crypto-js';

export function calculateFileHash(fileContent: string): string {
  return CryptoJS.SHA256(fileContent).toString();
}