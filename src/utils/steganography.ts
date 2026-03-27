/**
 * Simple LSB (Least Significant Bit) Steganography implementation with password protection
 */

/**
 * Advanced Steganography implementation with Compression, Dynamic Bit Depth, and Encryption.
 * This version supports much larger messages ("unlimited" feel) by using compression
 * and automatically increasing bit depth if needed.
 */

const MAGIC = 0x5347; // 'SG' in hex

// Helper to compress data
async function compressData(data: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (e) {
    console.warn('CompressionStream not supported, falling back to raw data');
    return data;
  }
}

// Helper to decompress data
async function decompressData(data: Uint8Array): Promise<Uint8Array> {
  try {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (e) {
    throw new Error('Failed to decompress data. The image might be corrupted or not encoded with compression.');
  }
}

// XOR bytes with password
function xorBytes(data: Uint8Array, password: string): Uint8Array {
  if (!password) return data;
  const passBytes = new TextEncoder().encode(password);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ passBytes[i % passBytes.length];
  }
  return result;
}

/**
 * Encodes a message into a canvas.
 * Uses a header to store encoding parameters (magic, bit depth, compression, length).
 */
export const encodeMessage = async (
  canvas: HTMLCanvasElement,
  message: string,
  password?: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 1. Prepare data: Prefix + Message
  const encoder = new TextEncoder();
  let rawData = encoder.encode('###VERIFY###' + message);

  // 2. Compress
  if (onProgress) onProgress(5);
  const compressedData = await compressData(rawData);
  const isCompressed = compressedData.length < rawData.length;
  const finalData = isCompressed ? compressedData : rawData;

  // 3. Encrypt
  if (onProgress) onProgress(10);
  const encryptedData = password ? xorBytes(finalData, password) : finalData;

  // 4. Determine required bit depth (1, 2, or 4 bits per channel)
  // We use RGB channels (3 per pixel). Total bits needed = Header (64) + Data (length * 8)
  const totalDataBits = encryptedData.length * 8;
  const availablePixels = canvas.width * canvas.height;
  
  let bitDepth = 1;
  if (64 + totalDataBits > availablePixels * 3 * 1) bitDepth = 2;
  if (64 + totalDataBits > availablePixels * 3 * 2) bitDepth = 4;
  
  if (64 + totalDataBits > availablePixels * 3 * bitDepth) {
    throw new Error('Message is truly too large even for high-capacity mode. Try a larger image.');
  }

  // 5. Create Header (64 bits)
  // 0-15: Magic (16)
  // 16-19: Bit Depth (4)
  // 20-23: Compressed Flag (4)
  // 24-55: Data Length in bytes (32)
  // 56-63: Reserved (8)
  const header = new DataView(new ArrayBuffer(8));
  header.setUint16(0, MAGIC);
  header.setUint8(2, (bitDepth & 0x0F) << 4 | (isCompressed ? 1 : 0));
  header.setUint32(3, encryptedData.length);

  const headerBits: number[] = [];
  const headerBytes = new Uint8Array(header.buffer);
  for (let i = 0; i < 8; i++) {
    for (let j = 7; j >= 0; j--) {
      headerBits.push((headerBytes[i] >> j) & 1);
    }
  }

  // 6. Embed Header (always 1-bit LSB for first 64 channel slots)
  for (let i = 0; i < 64; i++) {
    const pixelIdx = Math.floor(i / 3);
    const channelIdx = i % 3;
    const dataIdx = pixelIdx * 4 + channelIdx;
    data[dataIdx] = (data[dataIdx] & ~1) | headerBits[i];
  }

  // 7. Embed Data (using selected bit depth)
  const mask = (1 << bitDepth) - 1;
  const invMask = ~mask;
  
  let currentBit = 0;
  const totalBits = encryptedData.length * 8;
  
  // Start embedding after the header (64 bits / 3 channels = 21.33 pixels)
  // To keep it simple, we start data at pixel 22
  const startPixel = 22;
  
  for (let i = 0; i < encryptedData.length; i++) {
    const byte = encryptedData[i];
    for (let j = 8 - bitDepth; j >= 0; j -= bitDepth) {
      const val = (byte >> j) & mask;
      const bitIdx = i * 8 + (8 - bitDepth - j);
      const channelOffset = bitIdx / bitDepth;
      
      const absoluteChannelIdx = (startPixel * 3) + channelOffset;
      const pixelIdx = Math.floor(absoluteChannelIdx / 3);
      const channelIdx = Math.floor(absoluteChannelIdx % 3);
      const dataIdx = pixelIdx * 4 + channelIdx;
      
      if (dataIdx < data.length) {
        data[dataIdx] = (data[dataIdx] & invMask) | val;
      }
    }

    if (i % 10000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (onProgress) onProgress(10 + (i / encryptedData.length) * 90);
    }
  }

  if (onProgress) onProgress(100);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * Decodes a message from a canvas.
 */
export const decodeMessage = async (
  canvas: HTMLCanvasElement, 
  password?: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 1. Extract Header (first 64 bits, 1-bit LSB)
  const headerBits: number[] = [];
  for (let i = 0; i < 64; i++) {
    const pixelIdx = Math.floor(i / 3);
    const channelIdx = i % 3;
    const dataIdx = pixelIdx * 4 + channelIdx;
    headerBits.push(data[dataIdx] & 1);
  }

  const headerBytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | headerBits[i * 8 + j];
    }
    headerBytes[i] = byte;
  }

  const header = new DataView(headerBytes.buffer);
  const magic = header.getUint16(0);
  
  // Backward compatibility check
  if (magic !== MAGIC) {
    // Fallback to old delimiter-based decoding if magic not found
    return decodeLegacy(data, password);
  }

  const flags = header.getUint8(2);
  const bitDepth = (flags >> 4) & 0x0F;
  const isCompressed = (flags & 0x01) === 1;
  const dataLength = header.getUint32(3);

  if (bitDepth < 1 || bitDepth > 4 || dataLength > data.length) {
    throw new Error('Invalid header data. This image might not contain a SteganoGuard message.');
  }

  // 2. Extract Data
  if (onProgress) onProgress(10);
  const encryptedData = new Uint8Array(dataLength);
  const mask = (1 << bitDepth) - 1;
  const startPixel = 22;

  for (let i = 0; i < dataLength; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j += bitDepth) {
      const bitIdx = i * 8 + j;
      const channelOffset = bitIdx / bitDepth;
      const absoluteChannelIdx = (startPixel * 3) + channelOffset;
      const pixelIdx = Math.floor(absoluteChannelIdx / 3);
      const channelIdx = Math.floor(absoluteChannelIdx % 3);
      const dataIdx = pixelIdx * 4 + channelIdx;
      
      const val = data[dataIdx] & mask;
      byte = (byte << bitDepth) | val;
    }
    encryptedData[i] = byte;

    if (i % 20000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (onProgress) onProgress(10 + (i / dataLength) * 40);
    }
  }

  // 3. Decrypt
  if (onProgress) onProgress(60);
  const decryptedData = password ? xorBytes(encryptedData, password) : encryptedData;

  // 4. Decompress
  if (onProgress) onProgress(70);
  let finalData = decryptedData;
  if (isCompressed) {
    finalData = await decompressData(decryptedData);
  }

  // 5. Verify and Return
  if (onProgress) onProgress(90);
  const decoder = new TextDecoder();
  const result = decoder.decode(finalData);

  if (!result.startsWith('###VERIFY###')) {
    throw new Error('Incorrect password or corrupted data. Could not decrypt the message.');
  }

  if (onProgress) onProgress(100);
  return result.replace('###VERIFY###', '');
};

/**
 * Legacy decoding for backward compatibility with older versions.
 */
function decodeLegacy(data: Uint8ClampedArray, password?: string): string {
  let binaryMessage = '';
  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) continue;
    binaryMessage += (data[i] & 1).toString();
  }

  let decodedString = '';
  for (let i = 0; i < binaryMessage.length; i += 8) {
    const byte = binaryMessage.slice(i, i + 8);
    if (byte.length < 8) break;
    const charCode = parseInt(byte, 2);
    decodedString += String.fromCharCode(charCode);

    if (decodedString.endsWith('###END###')) {
      let result = decodedString.replace('###END###', '');
      if (result.startsWith('###PWD###')) {
        if (!password) throw new Error('This image is password protected. Please enter the password.');
        result = result.replace('###PWD###', '');
        
        // XOR Cipher for legacy
        let decrypted = '';
        for (let k = 0; k < result.length; k++) {
          decrypted += String.fromCharCode(result.charCodeAt(k) ^ password.charCodeAt(k % password.length));
        }
        
        if (!decrypted.startsWith('###VERIFY###')) {
          throw new Error('Incorrect password. The hidden message could not be decrypted.');
        }
        return decrypted.replace('###VERIFY###', '');
      } else {
        return result;
      }
    }
  }
  throw new Error('No hidden message found. Ensure you uploaded the correct image and that it hasn\'t been compressed.');
}
