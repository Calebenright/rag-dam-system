import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import fs from 'fs/promises';

/**
 * Extract text content from various file types
 */
export async function extractTextFromFile(filePath, fileType) {
  try {
    const mimeType = fileType.toLowerCase();

    if (mimeType.includes('pdf')) {
      return await extractFromPDF(filePath);
    } else if (mimeType.includes('word') || mimeType.includes('docx')) {
      return await extractFromDOCX(filePath);
    } else if (mimeType.includes('text') || mimeType.includes('txt')) {
      return await extractFromTXT(filePath);
    } else if (mimeType.includes('sheet') || mimeType.includes('xlsx') || mimeType.includes('csv')) {
      return await extractFromSpreadsheet(filePath);
    } else if (mimeType.includes('image') || mimeType.includes('png') || mimeType.includes('jpg') || mimeType.includes('jpeg')) {
      // For images, return a placeholder. In production, use OCR (Tesseract.js, Google Vision API)
      return `[Image file: ${filePath}. Text extraction requires OCR configuration.]`;
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from PDF
 */
async function extractFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from DOCX
 */
async function extractFromDOCX(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    return result.value;
  } catch (error) {
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from TXT
 */
async function extractFromTXT(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`TXT extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from spreadsheets (XLSX, CSV)
 */
async function extractFromSpreadsheet(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    let allText = '';

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const csvData = xlsx.utils.sheet_to_csv(sheet);
      allText += `\n\n--- Sheet: ${sheetName} ---\n${csvData}`;
    });

    return allText;
  } catch (error) {
    throw new Error(`Spreadsheet extraction failed: ${error.message}`);
  }
}

/**
 * Validate file type
 */
export function isValidFileType(mimetype) {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ];

  return allowedTypes.some(type => mimetype.includes(type));
}

/**
 * Validate file size
 */
export function isValidFileSize(size, maxSize = 10485760) { // 10MB default
  return size <= maxSize;
}
