const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');
const Tesseract = require('tesseract.js');
const fileType = require('file-type');

/**
 * Parse text from various file formats
 * @param {string} filePath - Path to the uploaded file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} Extracted text content
 */
async function parseText(filePath, mimeType) {
  try {
    console.log(`Parsing file: ${filePath}, MIME type: ${mimeType}`);
    
    // Detect file type if not provided
    let detectedType = mimeType;
    if (!detectedType) {
      const fileBuffer = fs.readFileSync(filePath);
      const type = await fileType.fromBuffer(fileBuffer);
      detectedType = type ? type.mime : 'application/octet-stream';
    }

    let extractedText = '';

    switch (detectedType) {
      case 'application/pdf':
        extractedText = await parsePDF(filePath);
        break;
        
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        extractedText = await parseDOCX(filePath);
        break;
        
      case 'application/msword':
        extractedText = await parseDOC(filePath);
        break;
        
      case 'text/plain':
        extractedText = await parseTXT(filePath);
        break;
        
      case 'text/rtf':
        extractedText = await parseRTF(filePath);
        break;
        
      case 'image/jpeg':
      case 'image/png':
      case 'image/tiff':
        extractedText = await parseImage(filePath);
        break;
        
      default:
        // Try to parse as text file
        try {
          extractedText = await parseTXT(filePath);
        } catch (error) {
          throw new Error(`Unsupported file type: ${detectedType}`);
        }
    }

    // Clean and normalize the extracted text
    return cleanText(extractedText);

  } catch (error) {
    console.error('Error parsing file:', error);
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

/**
 * Parse PDF files
 */
async function parsePDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file');
  }
}

/**
 * Parse DOCX files
 */
async function parseDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('DOCX parsing error:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

/**
 * Parse DOC files using textract
 */
async function parseDOC(filePath) {
  return new Promise((resolve, reject) => {
    textract.fromFileWithPath(filePath, (error, text) => {
      if (error) {
        console.error('DOC parsing error:', error);
        reject(new Error('Failed to parse DOC file'));
      } else {
        resolve(text);
      }
    });
  });
}

/**
 * Parse plain text files
 */
async function parseTXT(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('TXT parsing error:', error);
    throw new Error('Failed to parse text file');
  }
}

/**
 * Parse RTF files using textract
 */
async function parseRTF(filePath) {
  return new Promise((resolve, reject) => {
    textract.fromFileWithPath(filePath, (error, text) => {
      if (error) {
        console.error('RTF parsing error:', error);
        reject(new Error('Failed to parse RTF file'));
      } else {
        resolve(text);
      }
    });
  });
}

/**
 * Parse image files using OCR
 */
async function parseImage(filePath) {
  try {
    console.log('Starting OCR for image:', filePath);
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
      logger: m => console.log('OCR Progress:', m)
    });
    return text;
  } catch (error) {
    console.error('OCR parsing error:', error);
    throw new Error('Failed to parse image file with OCR');
  }
}

/**
 * Clean and normalize extracted text
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters that might interfere with parsing
    .replace(/[^\w\s.,;:!?@#$%&*()\-+=\[\]{}|\\:";'<>.,?\/]/g, ' ')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove multiple consecutive line breaks
    .replace(/\n\s*\n/g, '\n')
    // Trim whitespace
    .trim();
}

module.exports = parseText;
