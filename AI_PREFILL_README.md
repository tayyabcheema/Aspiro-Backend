# AI-Powered Question Pre-filling System

This document describes the enhanced user onboarding system that automatically pre-fills questionnaire answers using AI and document parsing.

## Overview

The system now supports two modes for admin questions:

1. **Auto-fill Mode** → Pulls structured data directly from uploaded CVs/documents
2. **AI Suggestion Mode** → Generates 4-8 multiple-choice options using OpenAI API when no direct match is found

## Features

### Document Parsing Pipeline
- **Supported Formats**: PDF, Word (.doc/.docx), Images (JPG, PNG, TIFF), Text files
- **OCR Support**: Image-based documents processed with Tesseract.js
- **Text Extraction**: Uses pdf-parse for PDFs and mammoth for Word documents
- **Image Preprocessing**: Sharp library for better OCR results

### Structured Data Extraction
The system extracts the following information from documents:

- **Personal Info**: Name, email, phone, location
- **Education**: Degree, field, institution, year
- **Experience**: Job titles, companies, duration, descriptions
- **Skills**: Technical skills, programming languages, tools
- **Certifications**: Certificates, issuers, years
- **Languages**: Spoken languages
- **Projects**: Project names and descriptions
- **Achievements**: Awards and recognitions
- **Contact Info**: LinkedIn, GitHub, portfolio websites

### AI-Powered Suggestions
- **OpenAI Integration**: Uses GPT-3.5-turbo for generating contextual suggestions
- **Smart Mapping**: Automatically maps extracted data to relevant questions
- **Confidence Scoring**: Provides confidence levels for auto-filled answers
- **Fallback Options**: Graceful degradation when AI services are unavailable

## API Endpoints

### Pre-fill Questions
```
POST /api/user-response/prefill
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
- files: Array of uploaded documents
```

**Response:**
```json
{
  "success": true,
  "message": "Questions pre-filled successfully",
  "data": {
    "preFilledAnswers": {
      "questionId": {
        "type": "auto-fill" | "ai-suggestions",
        "answer": "extracted answer",
        "suggestions": ["option1", "option2", ...],
        "confidence": 0.85,
        "source": "document-parsing" | "ai-generation"
      }
    },
    "questionMappings": {
      "autoFill": [...],
      "aiSuggestions": [...],
      "noMatch": [...]
    },
    "documentSummary": {...},
    "summary": {...}
  }
}
```

### Admin Analytics
```
GET /api/ai-processing/statistics?days=30
GET /api/ai-processing/performance?days=7
GET /api/ai-processing/log/:logId
GET /api/ai-processing/user/:userId
```

## Frontend Components

### DocumentUploadWithPreFill
- Drag-and-drop file upload interface
- File validation and size limits (5MB per file)
- Real-time processing feedback
- Pre-fill results display

### PreFillDisplay
- Shows auto-filled answers with confidence indicators
- Displays AI-generated suggestions
- Accept/edit functionality for users
- Visual indicators for different suggestion types

## Database Schema

### AIProcessingLog Collection
```javascript
{
  user: ObjectId,
  documents: [{
    filename: String,
    mimetype: String,
    size: Number,
    documentType: String,
    parsingSuccess: Boolean,
    textLength: Number,
    structuredData: Mixed
  }],
  questionMappings: {
    autoFill: [...],
    aiSuggestions: [...],
    noMatch: [...]
  },
  statistics: {
    totalQuestions: Number,
    autoFillQuestions: Number,
    aiSuggestionQuestions: Number,
    autoFillSuccessRate: Number,
    aiSuggestionSuccessRate: Number
  },
  aiMetadata: {
    model: String,
    processingTime: Number,
    tokenUsage: {...}
  },
  status: String,
  userInteraction: {...}
}
```

## Configuration

### Environment Variables
```bash
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# File Upload Limits
MAX_FILE_SIZE=5242880  # 5MB in bytes

# Supported File Types
SUPPORTED_MIME_TYPES=application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/jpeg,image/png,image/tiff,text/plain
```

## Usage Flow

1. **User Uploads Documents**: User uploads CV and supporting documents
2. **Document Processing**: System parses documents and extracts structured data
3. **Question Mapping**: System analyzes questions and maps to extracted data
4. **Auto-fill Generation**: Direct matches are auto-filled with high confidence
5. **AI Suggestions**: Missing data generates AI-powered multiple-choice options
6. **User Review**: User reviews and accepts/modifies suggestions
7. **Admin Logging**: All processing is logged for admin analytics

## Admin Dashboard

The admin dashboard provides:

- **Processing Statistics**: Success rates, processing times, document counts
- **Performance Metrics**: Daily trends, error rates, user interactions
- **Individual Logs**: Detailed view of each user's processing session
- **Error Monitoring**: Failed processing attempts and error patterns

## Error Handling

- **Graceful Degradation**: System continues to work even if AI services fail
- **Fallback Suggestions**: Pre-defined options when AI generation fails
- **File Cleanup**: Automatic cleanup of uploaded files after processing
- **Error Logging**: Comprehensive error tracking for debugging

## Testing

### Manual Testing
1. Upload various document formats (PDF, Word, images)
2. Verify text extraction accuracy
3. Test AI suggestion generation
4. Check admin logging functionality

### Automated Testing
```bash
# Test document parser
node backend/test-document-parser.js

# Test API endpoints
npm run test:api

# Test frontend components
npm run test:components
```

## Performance Considerations

- **File Size Limits**: 5MB per file to prevent memory issues
- **Processing Timeouts**: 30-second timeout for AI processing
- **Concurrent Limits**: Maximum 3 concurrent AI requests per user
- **Caching**: Structured data cached for 24 hours

## Security

- **File Validation**: Strict MIME type and size validation
- **User Isolation**: Users can only access their own processing logs
- **Admin Access**: AI processing logs only accessible to admin users
- **API Key Protection**: OpenAI API key stored securely in environment variables

## Future Enhancements

- **Multi-language Support**: OCR and parsing for non-English documents
- **Advanced AI Models**: Integration with GPT-4 for better suggestions
- **Real-time Processing**: WebSocket support for live processing updates
- **Batch Processing**: Support for processing multiple users simultaneously
- **Custom Question Types**: Support for more complex question formats

## Troubleshooting

### Common Issues

1. **OCR Not Working**: Check if Tesseract.js is properly installed
2. **AI Suggestions Failing**: Verify OpenAI API key and quota
3. **File Upload Errors**: Check file size and format restrictions
4. **Processing Timeouts**: Increase timeout limits for large documents

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=ai-processing:*
```

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.
