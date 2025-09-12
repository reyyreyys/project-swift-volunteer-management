import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, Download, X } from 'lucide-react';

const VolunteerCSVImporter = ({ projectId, onImportComplete, onClose }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  // Helper functions (keep these as they are)
  const getFirst = (row, names) => {
    for (const n of names) {
      const k = Object.keys(row).find(h => h.toLowerCase() === n.toLowerCase());
      if (k && row[k] != null && String(row[k]).trim() !== '') return row[k];
    }
    return '';
  };

  const toBool = (v) => {
    if (v == null) return false;
    const s = String(v).replace(/\u00A0/g, ' ').trim().toLowerCase();
    return ['yes','y','true','1'].includes(s);
  };

  const splitList = (v) => String(v || '')
    .split(',')
    .map(x => x.replace(/\u00A0/g, ' ').trim())
    .filter(Boolean);

const processVolunteerCSV = (rawData) => {
  // *** SEPARATE FUNCTIONS - NO INTERFERENCE ***
  
  // Simple exact matching for group names and most fields
  const getFirstSimple = (row, names) => {
    for (const n of names) {
      const k = Object.keys(row).find(h => h.toLowerCase() === n.toLowerCase());
      if (k && row[k] != null && String(row[k]).trim() !== '') return row[k];
    }
    return '';
  };

  // Complex normalization ONLY for shirt sizes
  const normalizeKey = (key) => {
    return String(key || '')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"')
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const getFirstShirtSize = (row, names) => {
    const normalizedNames = names.map(n => normalizeKey(n));
    
    // Try normalized matching first
    for (const key of Object.keys(row)) {
      const normalizedKey = normalizeKey(key);
      const matchIndex = normalizedNames.indexOf(normalizedKey);
      
      if (matchIndex >= 0) {
        const val = row[key];
        if (val != null && String(val).trim() !== '') {
          console.log(`SHIRT SIZE MATCH! Key: "${key}", Value: "${val}"`);
          return String(val).trim();
        }
      }
    }
    
    // Try partial matching for shirt size
    for (const key of Object.keys(row)) {
      const normalizedKey = normalizeKey(key);
      if (normalizedKey.includes('shirt') || (normalizedKey.includes('size') && normalizedKey.includes('indicate'))) {
        const val = row[key];
        if (val != null && String(val).trim() !== '') {
          console.log(`SHIRT SIZE PARTIAL MATCH! Key: "${key}", Value: "${val}"`);
          return String(val).trim();
        }
      }
    }
    
    return '';
  };

  const toBool = (v) => {
    if (v == null) return false;
    const s = String(v).replace(/\u00A0/g, ' ').trim().toLowerCase();
    return ['yes','y','true','1'].includes(s);
  };

  return rawData.map((row, index) => {
    console.log(`\n=== PROCESSING ROW ${index + 1} ===`);

    // Timestamp processing
    let timestamp = new Date();
    const tsStr = getFirstSimple(row, ['Timestamp']);
    if (tsStr) {
      const m = String(tsStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
      if (m) {
        const [, d, mo, y, h, mi, s] = m;
        timestamp = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(mi), parseInt(s));
      } else {
        const d = new Date(tsStr);
        if (!isNaN(d.getTime())) timestamp = d;
      }
    }

    // Strings -> arrays
    const splitList = (v) => String(v || '')
      .split(',')
      .map(x => x.replace(/\u00A0/g, ' ').trim())
      .filter(Boolean);

    // Core fields - using SIMPLE matching
    const firstName = getFirstSimple(row, ['First Name']);
    const lastName  = getFirstSimple(row, ['Last Name']);
    const email     = getFirstSimple(row, ['Email']);
    const contact   = getFirstSimple(row, ['Contact Number']);
    const ageStr    = getFirstSimple(row, ['Age']);
    const age       = ageStr ? parseInt(ageStr, 10) : null;

    // Availability / prefs - using SIMPLE matching
    const canCommit = toBool(getFirstSimple(row, ['Are you able to commit time for house visits at elderly HoME+ clients between 14–29 June 2025?']));
    const training  = getFirstSimple(row, ['Please indicate your availability for an in-person training & briefing on 1 Jun (Sun) 12pm - 4pm.']);
    const languages = splitList(getFirstSimple(row, ['Please list the languages that you are fluent in']));
    const regions   = splitList(getFirstSimple(row, ['Which region of Singapore do you live/frequent?']));
    const canTravel = toBool(getFirstSimple(row, ['Are you comfortable to travel outside of your preferred region for house visits?']));
    const availableDays = splitList(getFirstSimple(row, ['Days of the Week']));
    const availableTime = splitList(getFirstSimple(row, ['Time of the Day']));

    // Replace your group tracking section with this fixed version:

// *** GROUP TRACKING - FIXED VERSION ***
console.log('\n--- GROUP DEBUGGING ---');

const joiningAns = getFirst(row, [
  'Are you joining as a group?',
  'Are you joining as a group',
  'Joining as a group?',
  'Are you joining a group?'
]);
console.log(`Group joining answer: "${joiningAns}"`);

const isJoiningAsGroup = toBool(joiningAns);
console.log(`Is joining as group: ${isJoiningAsGroup}`);

// Enhanced group name matching - try multiple approaches
let groupNameRaw = '';

// First try exact matching with various apostrophe types
const groupNameVariations = [
  "What is your group's name?",     // straight apostrophe
  "What is your group's name?",     // curly apostrophe
  "What is your group's name?",     // another curly apostrophe variant
  'Group Name',
  'Group name'
];

// Try the standard getFirst approach first
groupNameRaw = getFirst(row, groupNameVariations);

// If that didn't work, try a more flexible search
if (!groupNameRaw) {
  console.log('Standard matching failed, trying flexible search...');
  
  for (const key of Object.keys(row)) {
    const lowerKey = key.toLowerCase();
    
    // Look for columns that contain both "group" and "name" but not "member"
    if (lowerKey.includes('group') && lowerKey.includes('name') && !lowerKey.includes('member')) {
      const value = row[key];
      console.log(`Testing flexible match: "${key}" = "${value}"`);
      
      if (value && String(value).trim() && String(value).trim() !== '') {
        groupNameRaw = String(value).trim();
        console.log(`Found group name via flexible matching: "${groupNameRaw}"`);
        break;
      }
    }
  }
}

console.log(`Group name raw: "${groupNameRaw}"`);

const groupName = isJoiningAsGroup && groupNameRaw && groupNameRaw.trim() 
  ? groupNameRaw.trim() 
  : null;
console.log(`Final group name: "${groupName}"`);

const groupMembers = [];
const memberName = getFirst(row, [
  "Group Member's Name (max 1 person only)",
  "Group Member's Name (max 1 person only)",
  'Group Member Name',
  'Group member name'
]);
if (memberName) groupMembers.push(memberName.trim());

    // *** SHIRT SIZE - COMPLEX MATCHING ONLY ***
    console.log('\n--- SHIRT SIZE DEBUGGING ---');
    const shirtSizeVariations = [
      `Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?\nIf you don't have, please indicate your size.`,
      `Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt? If you don't have, please indicate your size.`,
      `Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?\nIf you donâ€™t have, please indicate your size.`,
      `Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt? If you donâ€™t have, please indicate your size.`,
      `If you don't have, please indicate your size.`,
      `If you donâ€™t have, please indicate your size.`,
      `Please indicate your size.`,
      'Shirt Size',
      'T-Shirt Size',
      'Size'
    ];

    let shirtSizeRaw = '';
    for (const variation of shirtSizeVariations) {
      const testValue = getFirstShirtSize(row, [variation]);
      if (testValue) {
        shirtSizeRaw = testValue;
        console.log(`Found shirt size: "${shirtSizeRaw}"`);
        break;
      }
    }

    // Manual check if still no match
    if (!shirtSizeRaw) {
      console.log('Manual shirt size check...');
      Object.entries(row).forEach(([key, value]) => {
        if (key.toLowerCase().includes('shirt') || 
            key.toLowerCase().includes('size') ||
            (key.toLowerCase().includes('src') && key.toLowerCase().includes('rcy'))) {
          console.log(`Potential shirt field: "${key}" = "${value}"`);
          if (!shirtSizeRaw && value && String(value).trim()) {
            shirtSizeRaw = String(value).trim();
          }
        }
      });
    }

    let finalShirtSize = null;
    if (shirtSizeRaw) {
      const cleaned = String(shirtSizeRaw)
        .replace(/\u00A0/g, ' ')
        .replace(/â€™/g, "'")
        .trim();
      if (cleaned && cleaned.toLowerCase() !== 'null') {
        finalShirtSize = cleaned;
      }
    }

    // Experience - using SIMPLE matching
    const expAns = getFirstSimple(row, ['Do you have experience in house visits, door-to-door survey, DRR, befriending?']);
    const hasExperience = toBool(expAns);
    const experienceSummary = getFirstSimple(row, [
      'Short summary of your experience (if "Yes" on above question)', 
      'Short summary of your experience (if "Yes" on above question)'
    ]) || null;

    // Dietary and comments - using SIMPLE matching
    const dietary = getFirstSimple(row, [
      `Do you have dietary requirements/food allergies (Please indicate in 'Other')?`, 
      `Do you have dietary requirements/food allergies (Please indicate in 'Other')?`
    ]) || null;
    const comments = getFirstSimple(row, ['Any other comments/questions?']) || null;

    // Final result
    const result = {
      firstName,
      lastName,
      email: email || null,
      contactNumber: contact || null,
      age,

      canCommit,
      trainingAttendance: training || null,
      languages,
      regions,
      canTravel,
      availableDays,
      availableTime,

      hasExperience,
      experienceSummary,

      dietary,
      shirtSize: finalShirtSize,

      isJoiningAsGroup,
      groupName,
      groupMembers,

      comments,

      timestamp,
      submissionDate: timestamp,
      isPublic: true
    };

    console.log(`🎯 FINAL RESULTS for ${firstName}:`);
    console.log(`   - Group Name: "${result.groupName}"`);
    console.log(`   - Is Group: ${result.isJoiningAsGroup}`);
    console.log(`   - Shirt Size: "${result.shirtSize}"`);

    return result;
  });
};

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsImporting(true);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      transformHeader: (h) => h.replace(/\u00A0/g, ' ').trim(),
      transform: (v) => (typeof v === 'string' ? v.replace(/\u00A0/g, ' ').trim() : v),
      complete: async ({ data, errors, meta }) => {
        try {
          console.log('Papa meta:', meta);
          console.log('Papa errors:', errors);
          console.log('First 2 rows after parse:', data.slice(0, 2));
          
          const processedVolunteers = processVolunteerCSV(data);
          console.log('First processed:', processedVolunteers[0]);
          
          // Make the API call
          const response = await axios.post('/volunteers/import-csv', { 
            volunteers: processedVolunteers, 
            projectId 
          });
          
          // Set success result
          setImportResult({
            success: true,
            message: response.data.message || 'Volunteers imported successfully',
            created: response.data.created || 0,
            updated: response.data.updated || 0,
            linkedToProject: response.data.linkedToProject || 0,
            errors: response.data.errors || 0,
            errorDetails: response.data.errorDetails || []
          });
          
          // Call the completion callback to refresh other tabs
          if (onImportComplete) {
            onImportComplete();
          }
          
        } catch (error) {
          console.error('Import error:', error);
          
          // Set error result
          setImportResult({
            success: false,
            message: error.response?.data?.message || error.message || 'Failed to import volunteers',
            errorDetails: error.response?.data?.errorDetails || []
          });
        } finally {
          // Always stop loading animation
          setIsImporting(false);
        }
      },
      error: (error) => {
        console.error('Papa parse error:', error);
        setImportResult({
          success: false,
          message: 'Failed to parse CSV file: ' + error.message
        });
        setIsImporting(false);
      }
    });

    // Reset file input to allow same file to be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const downloadTemplate = () => {
    const template = `Timestamp,First Name,Last Name,Contact Number,Email,Age,Are you able to commit time for house visits at elderly HoME+ clients between 14–29 June 2025?,Please indicate your availability for an in-person training & briefing on 1 Jun (Sun) 12pm - 4pm.,Please list the languages that you are fluent in,Which region of Singapore do you live/frequent?,Are you comfortable to travel outside of your preferred region for house visits?,Do you have experience in house visits, door-to-door survey, DRR, befriending?,Short summary of your experience (if "Yes" on above question),Do you have dietary requirements/food allergies (Please indicate in 'Other')?,Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?,If you don't have, please indicate your size.,Are you joining as a group?,Days of the Week,Time of the Day,What is your group's name?,Group Member's Name (max 1 person only),Any other comments/questions?
10/05/2025 10:28:34,John,Doe,91234567,john@example.com,25,Yes,I will attend,English, Mandarin,Central,Yes,Yes,Volunteered with elderly before,None,No,S,No,Saturday, Sunday,Morning, Evening,,,`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'volunteer-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Rest of your component remains the same...
  return (
    <div className="modal-overlay">
      <div className="modal csv-import-modal">
        <div className="modal-header">
          <h2>Import Volunteer Responses</h2>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="import-info">
            <p>Import volunteer interest form responses from CSV. The system will:</p>
            <ul>
              <li>✅ Check for existing volunteers by email/phone</li>
              <li>✅ Link existing volunteers to this project</li>
              <li>✅ Calculate experience based on participation in other projects</li>
              <li>✅ Use original form submission timestamp</li>
              <li>✅ Provide detailed import summary</li>
            </ul>
          </div>

          <div className="importer-actions">
            <button onClick={downloadTemplate} className="template-btn">
              <Download size={16} />
              Download Template
            </button>
          </div>

          <div className="file-upload-section">
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload}
              disabled={isImporting}
              style={{ display: 'none' }}
            />
            
            <button 
              onClick={triggerFileInput}
              disabled={isImporting}
              className="file-upload-btn"
            >
              <Upload size={20} />
              Choose CSV File
            </button>
          </div>

          {fileName && (
            <div className="file-info">
              <FileText size={16} />
              <span>{fileName}</span>
            </div>
          )}

          {isImporting && (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <span>Processing volunteers and preserving submission timestamps...</span>
            </div>
          )}

          {importResult && (
            <div className={`import-status ${importResult.success ? 'success' : 'error'}`}>
              {importResult.success ? (
                <CheckCircle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <div className="import-details">
                <strong>{importResult.success ? 'Import Successful!' : 'Import Failed'}</strong>
                <p>{importResult.message}</p>
                
                {importResult.success && (
                  <div className="import-summary">
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">New Volunteers:</span>
                        <span className="summary-value">{importResult.created || 0}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Updated Existing:</span>
                        <span className="summary-value">{importResult.updated || 0}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Linked to Project:</span>
                        <span className="summary-value">{importResult.linkedToProject || 0}</span>
                      </div>
                      {importResult.errors > 0 && (
                        <div className="summary-item error">
                          <span className="summary-label">Errors:</span>
                          <span className="summary-value">{importResult.errors}</span>
                        </div>
                      )}
                    </div>
                    <div className="experience-note">
                      📊 Experience status calculated based on previous project participation
                    </div>
                    <div className="timestamp-note">
                      ⏰ Original form submission timestamps preserved
                    </div>
                    {importResult.updated > 0 && (
                      <div className="existing-note">
                        ✅ Existing volunteers were successfully linked to this project
                      </div>
                    )}
                  </div>
                )}
                
                {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                  <details className="error-details">
                    <summary>View Error Details ({importResult.errorDetails.length})</summary>
                    <div className="error-list">
                      {importResult.errorDetails.map((error, idx) => (
                        <div key={idx} className="error-detail">
                          <strong>{error.volunteer}</strong>: {error.error}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VolunteerCSVImporter;