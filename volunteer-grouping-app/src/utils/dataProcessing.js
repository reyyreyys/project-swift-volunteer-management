// src/utils/dataProcessing.js

export const processVolunteerCSV = (rawData) => {
  return rawData.map((row) => {
    // Parse timestamp
    let timestamp = null;
    if (row['Timestamp']) {
      timestamp = new Date(row['Timestamp']);
    }

    // Parse languages
    const languages = (row['Please list the languages that you are fluent in'] || '')
      .split(',')
      .map(lang => lang.trim())
      .filter(lang => lang);

    // Parse regions
    const regions = (row['Which region of Singapore do you live/frequent?'] || '')
      .split(',')
      .map(region => region.trim())
      .filter(region => region);

    // Parse available days
    const availableDays = (row['Days of the Week'] || '')
      .split(',')
      .map(day => day.trim())
      .filter(day => day);

    // Parse available times
    const availableTime = (row['Time of the Day'] || '')
      .split(',')
      .map(time => time.trim())
      .filter(time => time);

    // Parse group members
    const groupMembers = [];
    if (row["Group Member's Name (max 1 person only)"]) {
      groupMembers.push(row["Group Member's Name (max 1 person only)"].trim());
    }

    // Parse shirt information
    const shirtResponse = row['If you don\'t have, please indicate your size.'] || '';
    let hasShirt = null;
    let shirtSize = null;
    
    if (row['Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?']) {
      const shirtAnswer = row['Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?'];
      hasShirt = shirtAnswer.toLowerCase().includes('yes');
      
      if (!hasShirt && shirtResponse && !shirtResponse.toLowerCase().includes('no')) {
        shirtSize = shirtResponse.trim();
      }
    }

    return {
      firstName: row['First Name'] || '',
      lastName: row['Last Name'] || '',
      email: row['Email'] || null,
      contactNumber: row['Contact Number'] || null,
      age: row['Age'] ? parseInt(row['Age']) : null,
      
      // Commitment & Availability
      canCommit: (row['Are you able to commit time for house visits at elderly HoME+ clients between 14–29 June 2025?'] || '').toLowerCase() === 'yes',
      trainingAttendance: row['Please indicate your availability for an in-person training & briefing on 1 Jun (Sun) 12pm - 4pm.'] || null,
      languages: languages,
      regions: regions,
      canTravel: (row['Are you comfortable to travel outside of your preferred region for house visits?'] || '').toLowerCase() === 'yes',
      availableDays: availableDays,
      availableTime: availableTime,
      
      // Experience
      hasExperience: (row['Do you have experience in house visits, door-to-door survey, DRR, befriending?'] || '').toLowerCase() === 'yes',
      experienceSummary: row['Short summary of your experience (if "Yes" on above question)'] || null,
      
      // Personal Requirements
      dietary: row['Do you have dietary requirements/food allergies (Please indicate in \'Other\')?'] || null,
      hasShirt: hasShirt,
      shirtSize: shirtSize,
      
      // Group Information
      isJoiningAsGroup: (row['Are you joining as a group?'] || '').toLowerCase() === 'yes',
      groupName: row["What is your group's name?"] || null,
      groupMembers: groupMembers,
      
      // Additional
      comments: row['Any other comments/questions?'] || null,
      timestamp: timestamp,
      
      // System fields
      isPublic: true
    };
  });
};
