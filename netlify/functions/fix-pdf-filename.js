// PDF Filename Sanitization Fix
// Add this function to your email delivery functions

function sanitizeFilename(filename, maxLength = 50) {
  return filename
    // Remove/replace invalid characters
    .replace(/[^\w\s\-\.]/g, '')
    // Replace spaces with underscores  
    .replace(/\s+/g, '_')
    // Remove multiple underscores
    .replace(/_+/g, '_')
    // Trim to max length
    .substring(0, maxLength)
    // Remove trailing underscore or dot
    .replace(/[_\.]+$/, '')
    // Add timestamp for uniqueness
    + `_${Date.now().toString().slice(-6)}`;
}

// EXAMPLES:
console.log('BEFORE:', 'Gmail - Uw Recruitment APK Rapport - Recruitin ondersteunt technische...');
console.log('AFTER:', sanitizeFilename('Gmail - Uw Recruitment APK Rapport - Recruitin ondersteunt technische...'));
// OUTPUT: "Gmail_Uw_Recruitment_APK_Rapport_Recruitin_onder_123456"

// Use in your PDF generation:
const safeFilename = sanitizeFilename(`APK_Rapport_${companyName}`) + '.pdf';
// Instead of using email subject as filename

module.exports = { sanitizeFilename };