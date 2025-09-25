const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,              // allow cookies/credentials
  methods: ["GET","POST","PUT","DELETE","OPTIONS","PATCH"]
};


// Apply CORS globally (before routes)
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Permission check middleware
const checkProjectAccess = async (req, res, next) => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user.userId;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: userId },
          {
            collaborators: {
              some: {
                userId: userId
              }
            }
          }
        ]
      },
      include: {
        collaborators: {
          where: { userId: userId }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    req.project = project;
    req.userPermission = project.createdById === userId ? 'ADMIN' : 
                        project.collaborators[0]?.permission || 'VIEW';
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Location normalization function - UPDATED VERSION
function normalizeLocation(location) {
  if (!location) return 'Unknown';
  
  const normalized = location.toLowerCase().trim();
  
  // Standardize directional variations
  const locationMappings = {
    // North variations
    'northeast': 'North',     // Changed to capitalized
    'north-east': 'North',    // Changed to capitalized  
    'north east': 'North',    // Changed to capitalized
    'ne': 'North',           // Changed to capitalized
    'north': 'North',        // Added this line to handle existing "north"
    
    // South variations  
    'southeast': 'South',
    'south-east': 'South',
    'south east': 'South',
    'se': 'South',
    'southwest': 'South',
    'south-west': 'South', 
    'south west': 'South',
    'sw': 'South',
    'south': 'South',        // Added this line
    
    // East variations
    'east': 'East',
    'eastern': 'East',
    
    // West variations
    'west': 'West',
    'western': 'West',
    
    // Central variations
    'central': 'Central',
    'centre': 'Central',
    'center': 'Central',
    'cbd': 'Central',
    'city': 'Central'
  };
  
  // Check for exact matches first
  if (locationMappings[normalized]) {
    return locationMappings[normalized];
  }
  
  // Then check for partial matches
  for (const [variation, standard] of Object.entries(locationMappings)) {
    if (normalized.includes(variation)) {
      return standard;
    }
  }
  
  // Return capitalized version if no mapping found
  return location.charAt(0).toUpperCase() + location.slice(1).toLowerCase();
}



// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});



// ================================
// AUTH ROUTES
// ================================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: existingUser.username === username ? 'Username already exists' : 'Email already exists' 
      });
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword
      }
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ================================
// VOLUNTEER ROUTES
// ================================

// Get volunteers for a specific project, including their involvement in other projects
// Backend: Get volunteers with their selection status

app.get('/api/projects/:id/volunteer-pairs', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const volunteerPairs = await prisma.volunteerPair.findMany({
      where: { 
        projectId: req.params.id,
        isActive: true // Only show active pairs
      },
      include: {
        volunteer1: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        volunteer2: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(volunteerPairs);
  } catch (error) {
    console.error('Get volunteer pairs error:', error);
    res.status(500).json({ error: 'Failed to get volunteer pairs' });
  }
});

app.get('/api/projects/:id/volunteers-detailed', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const projectVolunteers = await prisma.projectVolunteer.findMany({
      where: { projectId: req.params.id },
      include: {
        volunteer: {
          include: {
            createdBy: {
              select: { username: true }
            }
          }
        }
      },
      orderBy: { addedAt: 'desc' }
    });

    res.json(projectVolunteers);
  } catch (error) {
    console.error('Get volunteers error:', error);
    res.status(500).json({ error: 'Failed to get project volunteers' });
  }
});

// Get all projects a specific volunteer is involved in
app.get('/api/volunteers/:id/projects', authenticateToken, async (req, res) => {
  try {
    const volunteerProjects = await prisma.projectVolunteer.findMany({
      where: { volunteerId: req.params.id },
      include: {
        project: {
          include: {
            createdBy: {
              select: { username: true }
            }
          }
        }
      },
      orderBy: { addedAt: 'desc' }
    });

    res.json(volunteerProjects);
  } catch (error) {
    console.error('Get volunteer projects error:', error);
    res.status(500).json({ error: 'Failed to get volunteer projects' });
  }
});

// Check if volunteer exists in other projects
app.get('/api/volunteers/:id/project-status', authenticateToken, async (req, res) => {
  try {
    const { excludeProjectId } = req.query;
    
    const projectCount = await prisma.projectVolunteer.count({
      where: {
        volunteerId: req.params.id,
        ...(excludeProjectId && { projectId: { not: excludeProjectId } })
      }
    });

    const projects = await prisma.projectVolunteer.findMany({
      where: {
        volunteerId: req.params.id,
        ...(excludeProjectId && { projectId: { not: excludeProjectId } })
      },
      include: {
        project: {
          select: { id: true, name: true }
        }
      },
      take: 5 // Limit to 5 most recent
    });

    res.json({
      totalProjects: projectCount,
      isInMultipleProjects: projectCount > 0,
      recentProjects: projects.map(pv => ({
        id: pv.project.id,
        name: pv.project.name,
        status: pv.status,
        joinedAt: pv.addedAt
      }))
    });
  } catch (error) {
    console.error('Get volunteer project status error:', error);
    res.status(500).json({ error: 'Failed to get volunteer project status' });
  }
});

// Clear all volunteers from a specific project (and delete volunteers only in this project)
app.delete('/api/projects/:id/volunteers', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    // Check if user has permission (project owner or admin)
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions to clear volunteers' });
    }

    const projectId = req.params.id;

    // Step 1: Find volunteers that are ONLY in this project
    const volunteersOnlyInThisProject = await prisma.projectVolunteer.findMany({
      where: { projectId: projectId },
      select: { 
        volunteerId: true,
        volunteer: {
          include: {
            projectVolunteers: {
              select: { projectId: true }
            }
          }
        }
      }
    });

    // Filter to get volunteers who are only in this project AND filter out undefined values
    const volunteerIdsToCompletelyDelete = volunteersOnlyInThisProject
      .filter(pv => pv.volunteer.projectVolunteers.length === 1)
      .map(pv => pv.volunteerId)
      .filter(id => id != null);

    // Use a transaction to ensure all deletions succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Step 2: Delete assignments for this project FIRST (they reference volunteer pairs)
      const deletedAssignmentsResult = await tx.assignment.deleteMany({
        where: { projectId: projectId }
      });

      // Step 3: Delete volunteer pairs for this project (now safe after assignments are deleted)
      const deletedPairsResult = await tx.volunteerPair.deleteMany({
        where: { projectId: projectId }
      });

      // Step 4: Delete all project-volunteer relationships for this project
      const projectVolunteerResult = await tx.projectVolunteer.deleteMany({
        where: { projectId: projectId }
      });

      // Step 5: Delete volunteers that were only in this project (only if we have valid IDs)
      let deletedVolunteersResult = { count: 0 };
      if (volunteerIdsToCompletelyDelete.length > 0) {
        console.log('Deleting volunteers with IDs:', volunteerIdsToCompletelyDelete); // Debug log
        
        deletedVolunteersResult = await tx.volunteer.deleteMany({
          where: { 
            id: { 
              in: volunteerIdsToCompletelyDelete 
            } 
          }
        });
      }

      return {
        deletedAssignmentsResult,
        deletedPairsResult,
        projectVolunteerResult,
        deletedVolunteersResult
      };
    });

    // Step 6: Log the action (outside the transaction)
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: projectId,
        action: 'cleared_project_volunteers',
        details: { 
          removedFromProject: result.projectVolunteerResult.count,
          completelyDeleted: result.deletedVolunteersResult.count,
          deletedPairs: result.deletedPairsResult.count,
          deletedAssignments: result.deletedAssignmentsResult.count,
          volunteerIdsDeleted: volunteerIdsToCompletelyDelete
        }
      }
    });

    res.json({ 
      success: true, 
      message: `Cleared ${result.projectVolunteerResult.count} volunteers from project. ${result.deletedVolunteersResult.count} volunteers were completely deleted as they were only in this project. Also removed ${result.deletedPairsResult.count} pairs and ${result.deletedAssignmentsResult.count} assignments.`,
      removedFromProject: result.projectVolunteerResult.count,
      completelyDeleted: result.deletedVolunteersResult.count,
      deletedPairs: result.deletedPairsResult.count,
      deletedAssignments: result.deletedAssignmentsResult.count
    });

  } catch (error) {
    console.error('Error clearing project volunteers:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear project volunteers',
      details: error.message
    });
  }
});




// Get volunteers for a specific project with calculated experience based on other projects
app.get('/api/projects/:id/volunteers-with-experience', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const projectVolunteers = await prisma.projectVolunteer.findMany({
      where: { projectId: req.params.id },
      include: {
        volunteer: {
          include: {
            createdBy: {
              select: { username: true }
            },
            projectVolunteers: {
              include: {
                project: {
                  select: { 
                    id: true, 
                    name: true, 
                    createdAt: true 
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { addedAt: 'desc' }
    });

    // Transform the data to include calculated experience based on other projects
    const volunteersWithCalculatedExperience = projectVolunteers.map(pv => {
      const otherProjects = pv.volunteer.projectVolunteers
        .filter(otherPv => otherPv.projectId !== req.params.id);
      
      return {
        ...pv,
        volunteer: {
          ...pv.volunteer,
          // Override hasExperience based on participation in other projects
          hasExperience: otherProjects.length > 0,
          totalProjects: pv.volunteer.projectVolunteers.length,
          otherProjects: otherProjects.map(otherPv => ({
            id: otherPv.project.id,
            name: otherPv.project.name,
            role: otherPv.status,
            joinedAt: otherPv.addedAt
          }))
        }
      };
    });

    res.json(volunteersWithCalculatedExperience);
  } catch (error) {
    console.error('Get volunteers with calculated experience error:', error);
    res.status(500).json({ error: 'Failed to get project volunteers' });
  }
});

// Enhanced import volunteers from CSV with proper project linking
app.post('/api/volunteers/import-csv', authenticateToken, async (req, res) => {
  try {
    const { volunteers, projectId } = req.body;
    
    if (!volunteers || !Array.isArray(volunteers)) {
      return res.status(400).json({ error: 'Invalid volunteer data' });
    }

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    let createdVolunteers = 0;
    let updatedVolunteers = 0;
    let linkedToProject = 0;
    const errors = [];

    for (const volunteerData of volunteers) {
      try {
        const submissionDate = volunteerData.submissionDate || volunteerData.timestamp || new Date();

        const cleanData = {
          firstName: (volunteerData.firstName || '').trim(),
          lastName: (volunteerData.lastName || '').trim(),
          email: volunteerData.email || null,
          contactNumber: volunteerData.contactNumber || null,
          age: volunteerData.age || null,

          canCommit: volunteerData.canCommit || false,
          trainingAttendance: volunteerData.trainingAttendance || null,
          languages: volunteerData.languages || [],
          regions: volunteerData.regions || [],
          canTravel: volunteerData.canTravel || false,
          availableDays: volunteerData.availableDays || [],
          availableTime: volunteerData.availableTime || [],

          // Preserve existing hasExperience on update; default to false on new
          hasExperience: undefined,  
          totalProjects: 0,
          experienceSummary: volunteerData.experienceSummary || null,

          dietary: volunteerData.dietary || null,
          hasShirt: volunteerData.hasShirt,
          shirtSize: volunteerData.shirtSize || null,

          isJoiningAsGroup: volunteerData.isJoiningAsGroup || false,
          groupName: volunteerData.groupName || null,
          groupMembers: volunteerData.groupMembers || [],

          comments: volunteerData.comments || null,

          timestamp: submissionDate,

          isPublic: volunteerData.isPublic !== false,
          createdById: req.user.userId
        };

        await prisma.$transaction(async (tx) => {
          // Find existing volunteer by first and last name (case-insensitive)
          const existingVolunteer = await tx.volunteer.findFirst({
            where: {
              AND: [
                { firstName: { equals: cleanData.firstName, mode: 'insensitive' } },
                { lastName: { equals: cleanData.lastName, mode: 'insensitive' } }
              ]
            }
          });

          let volunteer;
          if (existingVolunteer) {
            // Preserve existing hasExperience
            if (cleanData.hasExperience === undefined) {
              cleanData.hasExperience = existingVolunteer.hasExperience;
            }

            volunteer = await tx.volunteer.update({
              where: { id: existingVolunteer.id },
              data: {
                ...cleanData,
                createdById: existingVolunteer.createdById // don't overwrite who created originally
              }
            });
            updatedVolunteers++;
          } else {
            // New volunteer, explicitly set hasExperience or default false
            if (cleanData.hasExperience === undefined) {
              cleanData.hasExperience = false;
            }

            volunteer = await tx.volunteer.create({
              data: cleanData
            });
            createdVolunteers++;
          }

          // Link volunteer to project
          await tx.projectVolunteer.upsert({
            where: {
              projectId_volunteerId: {
                projectId,
                volunteerId: volunteer.id,
              }
            },
            update: {
              status: 'PENDING',
              addedAt: new Date()
            },
            create: {
              projectId,
              volunteerId: volunteer.id,
              isSelected: false,
              isWaitlist: false,
              status: 'PENDING',
              addedAt: new Date()
            }
          });

          linkedToProject++;
        });
      } catch (error) {
        errors.push({
          volunteer: `${volunteerData.firstName || 'Unknown'} ${volunteerData.lastName || 'Volunteer'}`,
          error: error.message
        });
      }
    }

    // Optionally run your experience recalculation here if needed again...

    res.status(201).json({
      success: errors.length === 0,
      message: `Processed ${createdVolunteers + updatedVolunteers} volunteers, linked ${linkedToProject} to project.`,
      created: createdVolunteers,
      updated: updatedVolunteers,
      linkedToProject,
      errors: errors.length,
      errorDetails: errors.length ? errors : undefined
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to import volunteers',
      details: error.message
    });
  }
});



// In your backend route
app.post('/api/projects/:id/volunteer-selections', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const { selected, waitlisted } = req.body;
    const projectId = req.params.id;

    // Update selected volunteers
    await prisma.projectVolunteer.updateMany({
      where: { 
        projectId: projectId,
        id: { in: selected }
      },
      data: { 
        status: 'SELECTED',
        isSelected: true,
        isWaitlist: false
      }
    });

    // Update waitlisted volunteers  
    await prisma.projectVolunteer.updateMany({
      where: { 
        projectId: projectId,
        id: { in: waitlisted }
      },
      data: { 
        status: 'WAITLISTED',
        isSelected: false,
        isWaitlist: true
      }
    });

    // Reset other volunteers to PENDING
    await prisma.projectVolunteer.updateMany({
      where: { 
        projectId: projectId,
        id: { notIn: [...selected, ...waitlisted] }
      },
      data: { 
        status: 'PENDING',
        isSelected: false,
        isWaitlist: false
      }
    });

    // Return updated volunteer data
    const updatedVolunteers = await prisma.projectVolunteer.findMany({
      where: { projectId: projectId },
      include: {
        volunteer: {
          include: {
            createdBy: { select: { username: true } }
          }
        }
      }
    });

    res.json({ 
      success: true, 
      message: `Saved ${selected.length} selected and ${waitlisted.length} waitlisted volunteers`,
      volunteers: updatedVolunteers // Include updated data
    });

  } catch (error) {
    console.error('Save selections error:', error);
    res.status(500).json({ error: 'Failed to save volunteer selections' });
  }
});


app.get('/api/volunteers', authenticateToken, async (req, res) => {
  try {
    const { search, region, language, experience, hasGroup } = req.query;
    
    // Debug: Log the user info and query parameters
    console.log('User ID:', req.user.userId);
    console.log('Query params:', { search, region, language, experience, hasGroup });
    
    const where = {
      OR: [
        { createdById: req.user.userId },
        { isPublic: true }
      ]
    };

    // Add filters
    if (search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    if (region) {
      where.regions = { has: region };
    }

    if (language) {
      where.languages = { has: language };
    }

    if (experience !== undefined) {
      where.hasExperience = experience === 'true';
    }

    if (hasGroup !== undefined) {
      where.isJoiningAsGroup = hasGroup === 'true';
    }

    // Debug: Log the final where clause
    console.log('Final where clause:', JSON.stringify(where, null, 2));

    const volunteers = await prisma.volunteer.findMany({
      where,
      include: {
        createdBy: {
          select: { username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Debug: Log the results
    console.log('Found volunteers count:', volunteers.length);
    console.log('First volunteer (if any):', volunteers ? {
      id: volunteers.id,
      firstName: volunteers.firstName,
      createdById: volunteers.createdById,
      isPublic: volunteers.isPublic
    } : 'None');

    res.json(volunteers);
  } catch (error) {
    console.error('Get volunteers error:', error);
    res.status(500).json({ error: 'Failed to get volunteers' });
  }
});

// Get volunteers with detailed filtering for project selection
app.get('/api/projects/:id/available-volunteers', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const { 
      search, 
      region, 
      language, 
      experience, 
      hasGroup, 
      canCommit, 
      canTravel,
      availableDay,
      availableTime,
      minAge,
      maxAge 
    } = req.query;
    
    const where = {
      OR: [
        { createdById: req.user.userId },
        { isPublic: true }
      ]
    };

    // Build complex filters
    if (search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    if (region) {
      where.regions = { has: region };
    }

    if (language) {
      where.languages = { has: language };
    }

    if (experience !== undefined) {
      where.hasExperience = experience === 'true';
    }

    if (hasGroup !== undefined) {
      where.isJoiningAsGroup = hasGroup === 'true';
    }

    if (canCommit !== undefined) {
      where.canCommit = canCommit === 'true';
    }

    if (canTravel !== undefined) {
      where.canTravel = canTravel === 'true';
    }

    if (availableDay) {
      where.availableDays = { has: availableDay };
    }

    if (availableTime) {
      where.availableTime = { has: availableTime };
    }

    if (minAge || maxAge) {
      where.age = {};
      if (minAge) where.age.gte = parseInt(minAge);
      if (maxAge) where.age.lte = parseInt(maxAge);
    }

    const volunteers = await prisma.volunteer.findMany({
      where,
      include: {
        createdBy: {
          select: { username: true }
        },
        projectVolunteers: {
          where: { projectId: req.params.id },
          select: { isSelected: true, isWaitlist: true, status: true }
        }
      },
      orderBy: [
        { isJoiningAsGroup: 'asc' }, // Groups first
        { hasExperience: 'desc' },   // Experience next
        { timestamp: 'asc' }         // Then by submission time
      ]
    });

    res.json(volunteers);
  } catch (error) {
    console.error('Get available volunteers error:', error);
    res.status(500).json({ error: 'Failed to get available volunteers' });
  }
});

app.put('/api/volunteers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if user can update this volunteer
    const volunteer = await prisma.volunteer.findFirst({
      where: {
        id: id,
        createdById: req.user.userId
      }
    });

    if (!volunteer) {
      return res.status(403).json({ error: 'Volunteer not found or access denied' });
    }

    const updatedVolunteer = await prisma.volunteer.update({
      where: { id },
      data: updateData
    });

    res.json(updatedVolunteer);
  } catch (error) {
    console.error('Update volunteer error:', error);
    res.status(500).json({ error: 'Failed to update volunteer' });
  }
});

app.delete('/api/volunteers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await prisma.volunteer.findFirst({
      where: {
        id: id,
        createdById: req.user.userId
      }
    });

    if (!volunteer) {
      return res.status(403).json({ error: 'Volunteer not found or access denied' });
    }

    await prisma.volunteer.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Volunteer deleted successfully' });
  } catch (error) {
    console.error('Delete volunteer error:', error);
    res.status(500).json({ error: 'Failed to delete volunteer' });
  }
});

// ================================
// CLIENT ROUTES
// ================================

app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    const clientData = req.body;
    
    const client = await prisma.client.create({
      data: {
        ...clientData,
        createdById: req.user.userId
      }
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

app.post('/api/clients/bulk', authenticateToken, async (req, res) => {
  try {
    const { clients } = req.body;
    
    const clientsWithUserId = clients.map(c => ({
      ...c,
      createdById: req.user.userId
    }));

    const createdClients = await prisma.client.createMany({
      data: clientsWithUserId,
      skipDuplicates: true
    });

    res.status(201).json({
      success: true,
      count: createdClients.count,
      message: `${createdClients.count} clients created successfully`
    });
  } catch (error) {
    console.error('Bulk create clients error:', error);
    res.status(500).json({ error: 'Failed to create clients' });
  }
});

// Import clients from CSV
// Import clients from CSV
// Import clients from CSV
app.post('/api/clients/import-csv', authenticateToken, async (req, res) => {
  try {
    const { clients, projectId } = req.body;
    
    if (!clients || !Array.isArray(clients)) {
      return res.status(400).json({ error: 'Invalid client data' });
    }

    // Process the CSV data with proper field mapping
    const processedClients = clients.map(c => ({
      srcId: c['SRC #'] || c.srcId,
      name: c['Name'] || c.name,
      gender: c['Gender'] || c.gender || null,
      race: c['Race'] || c.race || null,
      languages: c['Language Spoken'] || c.languages,
      address: c['Full Address'] || c.address,
      location: normalizeLocation(c['Location'] || c.location), // ← ADD THIS LINE
      isPublic: true,
      createdById: req.user.userId
    }));

    // Create clients in database
    const createdClients = [];
    const errors = [];
    
    for (const clientData of processedClients) {
      try {
        // Skip empty rows
        if (!clientData.srcId && !clientData.name) continue;
        
        const client = await prisma.client.create({
          data: clientData
        });
        createdClients.push(client);
      } catch (error) {
        errors.push({
          client: clientData.name || clientData.srcId,
          error: error.message
        });
      }
    }

    // If projectId is provided, also add them to the project
    if (projectId && createdClients.length > 0) {
      const projectClientData = createdClients.map((c, index) => ({
        projectId: projectId,
        clientId: c.id,
        priority: index + 1
      }));
      
      await prisma.projectClient.createMany({
        data: projectClientData,
        skipDuplicates: true
      });
    }

    // Log activity
    if (projectId) {
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          projectId: projectId,
          action: 'importedclients',
          details: {
            count: createdClients.length,
            errors: errors.length
          }
        }
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully imported ${createdClients.length} clients`,
      imported: createdClients.length,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined,
      clients: createdClients.map(c => ({
        id: c.id,
        name: c.name,
        srcId: c.srcId
      }))
    });

  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Failed to import clients' });
  }
});


app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { search, location, language } = req.query;
    
    const where = {
      OR: [
        { createdById: req.user.userId },
        { isPublic: true }
      ]
    };

    if (search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { srcId: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
    }

    if (language) {
      where.languages = { contains: language, mode: 'insensitive' };
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        createdBy: {
          select: { username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to get clients' });
  }
});

// Clear all clients from a specific project (and delete clients only in this project)
app.delete('/api/projects/:id/clients', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    // Check if user has permission (project owner or admin)
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions to clear clients' });
    }

    const projectId = req.params.id;

    // Step 1: Find clients that are ONLY in this project
    const clientsOnlyInThisProject = await prisma.projectClient.findMany({
      where: { projectId: projectId },
      select: {
        clientId: true,
        client: {
          include: {
            projectClients: {
              select: { projectId: true }
            }
          }
        }
      }
    });

    // Filter to get clients who are only in this project
    const clientIdsToCompletelyDelete = clientsOnlyInThisProject
      .filter(pc => pc.client.projectClients.length === 1)
      .map(pc => pc.clientId)
      .filter(id => id != null);

    console.log('Clients to completely delete:', clientIdsToCompletelyDelete);

    // Use a transaction to ensure all deletions succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Step 2: Delete assignments that reference clients in this project
      const deletedAssignmentsResult = await tx.assignment.deleteMany({
        where: { projectId: projectId }
      });

      // Step 3: Delete group clients (client group memberships) for this project
      // This needs to be done before deleting client groups or clients
      const deletedGroupClientsResult = await tx.groupClient.deleteMany({
        where: {
          group: {
            projectId: projectId
          }
        }
      });

      // Step 4: Delete client groups for this project
      const deletedClientGroupsResult = await tx.clientGroup.deleteMany({
        where: { projectId: projectId }
      });

      // Step 5: Delete all project-client relationships for this project
      const projectClientResult = await tx.projectClient.deleteMany({
        where: { projectId: projectId }
      });

      // Step 6: Delete clients that were only in this project (only if we have valid IDs)
      let deletedClientsResult = { count: 0 };
      if (clientIdsToCompletelyDelete.length > 0) {
        console.log('Deleting clients with IDs:', clientIdsToCompletelyDelete);
        
        deletedClientsResult = await tx.client.deleteMany({
          where: {
            id: {
              in: clientIdsToCompletelyDelete
            }
          }
        });
      }

      return {
        deletedAssignmentsResult,
        deletedGroupClientsResult,
        deletedClientGroupsResult,
        projectClientResult,
        deletedClientsResult
      };
    });

    // Step 7: Log the action (outside the transaction)
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: projectId,
        action: 'cleared_project_clients',
        details: {
          removedFromProject: result.projectClientResult.count,
          completelyDeleted: result.deletedClientsResult.count,
          deletedClientGroups: result.deletedClientGroupsResult.count,
          deletedGroupClients: result.deletedGroupClientsResult.count,
          deletedAssignments: result.deletedAssignmentsResult.count,
          clientIdsDeleted: clientIdsToCompletelyDelete
        }
      }
    });

    res.json({
      success: true,
      message: `Cleared ${result.projectClientResult.count} clients from project. ${result.deletedClientsResult.count} clients were completely deleted as they were only in this project. Also removed ${result.deletedClientGroupsResult.count} client groups, ${result.deletedGroupClientsResult.count} group memberships, and ${result.deletedAssignmentsResult.count} assignments.`,
      removedFromProject: result.projectClientResult.count,
      completelyDeleted: result.deletedClientsResult.count,
      deletedClientGroups: result.deletedClientGroupsResult.count,
      deletedGroupClients: result.deletedGroupClientsResult.count,
      deletedAssignments: result.deletedAssignmentsResult.count
    });
  } catch (error) {
    console.error('Error clearing project clients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear project clients',
      details: error.message
    });
  }
});


app.put('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if user can update this client
    const client = await prisma.client.findFirst({
      where: {
        id: id,
        createdById: req.user.userId
      }
    });

    if (!client) {
      return res.status(403).json({ error: 'Client not found or access denied' });
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data: updateData
    });

    res.json(updatedClient);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findFirst({
      where: {
        id: id,
        createdById: req.user.userId
      }
    });

    if (!client) {
      return res.status(403).json({ error: 'Client not found or access denied' });
    }

    await prisma.client.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// ================================
// PROJECT ROUTES
// ================================

app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    const { id, name, description, settings } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    let project;
    
    if (id) {
      // Update existing project
      project = await prisma.project.findFirst({
        where: {
          id: id,
          OR: [
            { createdById: req.user.userId },
            {
              collaborators: {
                some: {
                  userId: req.user.userId,
                  permission: { in: ['EDIT', 'ADMIN'] }
                }
              }
            }
          ]
        }
      });

      if (!project) {
        return res.status(403).json({ error: 'Project not found or insufficient permissions' });
      }

      project = await prisma.project.update({
        where: { id: id },
        data: {
          name,
          description,
          settings: settings || project.settings
        }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          projectId: project.id,
          action: 'updated',
          details: { changes: 'Project details updated' }
        }
      });
    } else {
      // Create new project
      project = await prisma.project.create({
        data: {
          name,
          description,
          settings: settings || {},
          createdById: req.user.userId
        }
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: req.user.userId,
          projectId: project.id,
          action: 'created',
          details: { name }
        }
      });
    }

    res.json({ 
      success: true, 
      message: id ? 'Project updated successfully' : 'Project created successfully',
      project: {
        id: project.id,
        name: project.name,
        description: project.description
      }
    });
  } catch (error) {
    console.error('Save project error:', error);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

app.get('/api/projects/:id', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: {
          select: { id: true, username: true }
        },
        collaborators: {
          include: {
            user: {
              select: { id: true, username: true, email: true }
            }
          }
        }
      }
    });

    res.json({
      ...project,
      userPermission: req.userPermission
    });
  } catch (error) {
    console.error('Load project error:', error);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { createdById: req.user.userId },
          {
            collaborators: {
              some: { userId: req.user.userId }
            }
          }
        ],
        status: 'ACTIVE'
      },
      include: {
        createdBy: {
          select: { username: true }
        },
        collaborators: {
          where: { userId: req.user.userId },
          select: { permission: true }
        },
        _count: {
          select: { collaborators: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const projectsWithPermissions = projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      createdBy: project.createdBy,
      collaboratorCount: project._count.collaborators,
      permission: project.createdById === req.user.userId ? 'ADMIN' : 
                 project.collaborators[0]?.permission || 'VIEW'
    }));

    res.json(projectsWithPermissions);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// ================================
// PROJECT-VOLUNTEER RELATIONSHIPS
// ================================

// Project-specific volunteer selection
app.post('/api/projects/:id/volunteers', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { volunteerIds, isWaitlist = false } = req.body;
    
    const projectVolunteers = volunteerIds.map(volunteerId => ({
      projectId: req.params.id,
      volunteerId,
      isSelected: !isWaitlist,
      isWaitlist,
      status: 'SELECTED'
    }));

    await prisma.projectVolunteer.createMany({
      data: projectVolunteers,
      skipDuplicates: true
    });

    res.json({ 
      success: true, 
      message: `${volunteerIds.length} volunteers added to project` 
    });
  } catch (error) {
    console.error('Add project volunteers error:', error);
    res.status(500).json({ error: 'Failed to add volunteers to project' });
  }
});

app.get('/api/projects/:id/volunteers', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const projectVolunteers = await prisma.projectVolunteer.findMany({
      where: { projectId: req.params.id },
      include: {
        volunteer: {
          include: {
            createdBy: {
              select: { username: true }
            }
          }
        }
      }
    });

    res.json(projectVolunteers);
  } catch (error) {
    console.error('Get project volunteers error:', error);
    res.status(500).json({ error: 'Failed to get project volunteers' });
  }
});

// ================================
// PROJECT-CLIENT RELATIONSHIPS
// ================================

// Project-specific client selection
app.post('/api/projects/:id/clients', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { clientIds } = req.body;
    
    const projectClients = clientIds.map((clientId, index) => ({
      projectId: req.params.id,
      clientId,
      priority: index + 1
    }));

    await prisma.projectClient.createMany({
      data: projectClients,
      skipDuplicates: true
    });

    res.json({ 
      success: true, 
      message: `${clientIds.length} clients added to project` 
    });
  } catch (error) {
    console.error('Add project clients error:', error);
    res.status(500).json({ error: 'Failed to add clients to project' });
  }
});

app.get('/api/projects/:id/clients', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const projectClients = await prisma.projectClient.findMany({
      where: { projectId: req.params.id },
      include: {
        client: {
          include: {
            createdBy: {
              select: { username: true }
            }
          }
        }
      },
      orderBy: { priority: 'asc' }
    });

    res.json(projectClients);
  } catch (error) {
    console.error('Get project clients error:', error);
    res.status(500).json({ error: 'Failed to get project clients' });
  }
});

// ================================
// VOLUNTEER PAIRING
// ================================

// POST /api/projects/:id/pairs - Create a new pair (FIXED)
app.post('/api/projects/:id/pairs', authenticateToken, checkProjectAccess, async (req, res) => {
try {
if (req.userPermission === 'VIEW') {
return res.status(403).json({
success: false,
error: 'Insufficient permissions'
});
}
console.log('Received body:', req.body);

const {
  volunteer1Id,
  volunteer2Id,
  pairName,
  compatibility,
  languageMatch,
  regionMatch,
  isManual = true
} = req.body;

// Basic validation
if (!volunteer1Id || !volunteer2Id) {
  return res.status(400).json({
    success: false,
    error: 'Both volunteer1Id and volunteer2Id are required'
  });
}

if (volunteer1Id === volunteer2Id) {
  return res.status(400).json({
    success: false,
    error: 'Cannot pair a volunteer with themselves'
  });
}

// Relaxed validation: only require that both volunteers are part of this project
// and ignore whether their status is SELECTED.
// Option A (relaxed statuses): accept SELECTED, PENDING, WAITLISTED

// Still prevent double-pairing within the same project
const existingPairs = await prisma.volunteerPair.findMany({
  where: {
    projectId: req.params.id,
    isActive: true,
    OR: [
      { volunteer1Id: volunteer1Id },
      { volunteer2Id: volunteer1Id },
      { volunteer1Id: volunteer2Id },
      { volunteer2Id: volunteer2Id }
    ]
  }
});

if (existingPairs.length > 0) {
  return res.status(400).json({
    success: false,
    error: 'One or both volunteers are already paired in this project'
  });
}

// Create the pair
const newPair = await prisma.volunteerPair.create({
  data: {
    projectId: req.params.id,
    volunteer1Id: volunteer1Id,
    volunteer2Id: volunteer2Id,
    pairName: pairName || null,
    compatibility: compatibility || null,
    isManual: isManual,
    isActive: true
    // ❌ REMOVED: languageMatch and regionMatch (not in schema)
  },
  include: {
    volunteer1: true,
    volunteer2: true
  }
});



// Log activity
await prisma.activityLog.create({
  data: {
    userId: req.user.userId,
    projectId: req.params.id,
    action: 'created_volunteer_pair',
    details: {
      pairId: newPair.id,
      volunteer1: `${newPair.volunteer1.firstName} ${newPair.volunteer1.lastName}`,
      volunteer2: `${newPair.volunteer2.firstName} ${newPair.volunteer2.lastName}`,
      compatibility: newPair.compatibility
    }
  }
});

res.status(201).json({
  success: true,
  message: 'Pair created successfully',
  pair: newPair
});

} catch (error) {
console.error('Error creating pair:', error);
if (error.code === 'P2002') {
return res.status(400).json({
success: false,
error: 'This pair already exists'
});
}
res.status(500).json({
success: false,
error: 'Failed to create pair',
message: error.message
});
}
});


app.get('/api/projects/:id/pairs', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const pairs = await prisma.volunteerPair.findMany({
      where: { 
        projectId: req.params.id,
        isActive: true 
      },
      include: {
        volunteer1: true,
        volunteer2: true
      }
    });

    console.log(pairs)
    res.json(pairs);
  } catch (error) {
    console.error('Get volunteer pairs error:', error);
    res.status(500).json({ error: 'Failed to get volunteer pairs' });
  }
});

// ================================
// ASSIGNMENTS
// ================================

app.post('/api/projects/:id/assignments', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { assignments } = req.body;
    
    const assignmentData = assignments.map(assignment => ({
      projectId: req.params.id,
      clientId: assignment.clientId,
      volunteerPairId: assignment.volunteerPairId,
      languageMatch: assignment.languageMatch || false,
      regionMatch: assignment.regionMatch || false,
      confidenceScore: assignment.confidenceScore || null,
      notes: assignment.notes || null
    }));

    const createdAssignments = await prisma.assignment.createMany({
      data: assignmentData
    });

    res.json({ 
      success: true, 
      count: createdAssignments.count,
      message: `${createdAssignments.count} assignments created` 
    });
  } catch (error) {
    console.error('Create assignments error:', error);
    res.status(500).json({ error: 'Failed to create assignments' });
  }
});

app.get('/api/projects/:id/assignments', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { projectId: req.params.id },
      include: {
        client: true,
        volunteerPair: {
          include: {
            volunteer1: true,
            volunteer2: true
          }
        }
      }
    });

    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Failed to get assignments' });
  }
});

// DELETE /api/projects/:id/assignments/:assignmentId - Delete a specific assignment
app.delete('/api/projects/:id/assignments/:assignmentId', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { assignmentId } = req.params;
    const projectId = req.params.id;

    // Verify assignment belongs to this project
    const existingAssignment = await prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        projectId: projectId
      },
      include: {
        client: true,
        volunteerPair: {
          include: {
            volunteer1: true,
            volunteer2: true
          }
        }
      }
    });

    if (!existingAssignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Delete the assignment
    await prisma.assignment.delete({
      where: { id: assignmentId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: projectId,
        action: 'deleted_assignment',
        details: {
          assignmentId: assignmentId,
          clientName: existingAssignment.client.name,
          volunteerPair: `${existingAssignment.volunteerPair.volunteer1.firstName} ${existingAssignment.volunteerPair.volunteer1.lastName} & ${existingAssignment.volunteerPair.volunteer2.firstName} ${existingAssignment.volunteerPair.volunteer2.lastName}`
        }
      }
    });

    res.json({
      success: true,
      message: 'Assignment removed successfully'
    });

  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// PATCH /api/projects/:id/assignments/:assignmentId - Update assignment (optional)
app.patch('/api/projects/:id/assignments/:assignmentId', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { assignmentId } = req.params;
    const { volunteerPairId, notes, status } = req.body;

    const updatedAssignment = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        ...(volunteerPairId && { volunteerPairId }),
        ...(notes && { notes }),
        ...(status && { status })
      },
      include: {
        client: true,
        volunteerPair: {
          include: {
            volunteer1: true,
            volunteer2: true
          }
        }
      }
    });

    res.json({
      success: true,
      assignment: updatedAssignment
    });

  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// ================================
// PROJECT COLLABORATION
// ================================

// Share project with another user
app.post('/api/projects/:id/share', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission !== 'ADMIN') {
      return res.status(403).json({ error: 'Only project owners can share projects' });
    }

    const { username, permission = 'VIEW' } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Find user to share with
    const userToShare = await prisma.user.findUnique({
      where: { username: username }
    });

    if (!userToShare) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userToShare.id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot share project with yourself' });
    }

    // Add or update collaborator
    const collaborator = await prisma.projectCollaborator.upsert({
      where: {
        projectId_userId: {
          projectId: req.params.id,
          userId: userToShare.id
        }
      },
      update: {
        permission: permission
      },
      create: {
        projectId: req.params.id,
        userId: userToShare.id,
        permission: permission
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: req.params.id,
        action: 'shared',
        details: { 
          sharedWith: username,
          permission: permission
        }
      }
    });

    res.json({ 
      success: true, 
      message: `Project shared with ${username}`,
      collaborator: {
        username: userToShare.username,
        permission: collaborator.permission
      }
    });
  } catch (error) {
    console.error('Share project error:', error);
    res.status(500).json({ error: 'Failed to share project' });
  }
});

// Get project collaborators
app.get('/api/projects/:id/collaborators', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const collaborators = await prisma.projectCollaborator.findMany({
      where: { projectId: req.params.id },
      include: {
        user: {
          select: { id: true, username: true, email: true }
        }
      }
    });

    const formattedCollaborators = collaborators.map(collab => ({
      id: collab.user.id,
      username: collab.user.username,
      email: collab.user.email,
      permission: collab.permission,
      addedAt: collab.addedAt
    }));

    res.json(formattedCollaborators);
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ error: 'Failed to get collaborators' });
  }
});

// Remove collaborator
app.delete('/api/projects/:id/collaborators/:userId', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission !== 'ADMIN') {
      return res.status(403).json({ error: 'Only project owners can remove collaborators' });
    }

    const { userId } = req.params;

    await prisma.projectCollaborator.delete({
      where: {
        projectId_userId: {
          projectId: req.params.id,
          userId: parseInt(userId)
        }
      }
    });

    res.json({ success: true, message: 'Collaborator removed successfully' });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// ================================
// VOLUNTEER PAIRS ROUTES (Updated)
// ================================

// GET /api/projects/:id/pairs - Get all pairs for a project
app.get('/api/projects/:id/pairs', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const pairs = await prisma.volunteerPair.findMany({
      where: {
        projectId: req.params.id,
        isActive: true
      },
      include: {
        volunteer1: true,
        volunteer2: true,
        project: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(pairs);
  } catch (error) {
    console.error('Error fetching pairs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch pairs',
      message: error.message 
    });
  }
});




// DELETE /api/projects/:id/pairs/:pairId - Delete a pair
app.delete('/api/projects/:id/pairs/:pairId', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { id: projectId, pairId } = req.params;

    // Check if pair exists and belongs to this project
    const existingPair = await prisma.volunteerPair.findFirst({
      where: {
        id: pairId,
        projectId: projectId
      },
      include: {
        volunteer1: true,
        volunteer2: true
      }
    });

    if (!existingPair) {
      return res.status(404).json({
        success: false,
        error: 'Pair not found'
      });
    }

    // Delete the pair
    await prisma.volunteerPair.delete({
      where: {
        id: pairId
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: projectId,
        action: 'deleted_volunteer_pair',
        details: {
          pairId: pairId,
          volunteer1: `${existingPair.volunteer1.firstName} ${existingPair.volunteer1.lastName}`,
          volunteer2: `${existingPair.volunteer2.firstName} ${existingPair.volunteer2.lastName}`
        }
      }
    });

    res.json({
      success: true,
      message: 'Pair deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting pair:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete pair',
      message: error.message
    });
  }
});


// ================================
// TRAINING ROUTES
// ================================

// Update training attendance for individual volunteer
app.patch('/api/projects/:id/volunteers/:volunteerId/training', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { volunteerId } = req.params;
    const { trainingAttended } = req.body;

    const updatedVolunteer = await prisma.projectVolunteer.update({
      where: {
        id: volunteerId  // Using ProjectVolunteer ID, not volunteer ID
      },
      data: {
        trainingAttended: trainingAttended
      }
    });

    res.json({ success: true, data: updatedVolunteer });
  } catch (error) {
    console.error('Error updating training attendance:', error);
    res.status(500).json({ error: 'Failed to update training attendance' });
  }
});

// Update training selection for waitlisted volunteer
app.patch('/api/projects/:id/volunteers/:volunteerId/training-selection', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { volunteerId } = req.params;
    const { selectedForTraining } = req.body;

    const updatedVolunteer = await prisma.projectVolunteer.update({
      where: {
        id: volunteerId  // Using ProjectVolunteer ID, not volunteer ID
      },
      data: {
        selectedForTraining: selectedForTraining
      }
    });

    res.json({ success: true, data: updatedVolunteer });
  } catch (error) {
    console.error('Error updating training selection:', error);
    res.status(500).json({ error: 'Failed to update training selection' });
  }
});

// Save all training attendance data
app.post('/api/projects/:id/training-attendance', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { attendance, waitlistedSelection } = req.body;

    // Update attendance for each volunteer
    if (attendance) {
      for (const [projectVolunteerId, attended] of Object.entries(attendance)) {
        await prisma.projectVolunteer.update({
          where: {
            id: projectVolunteerId  // Using ProjectVolunteer ID
          },
          data: {
            trainingAttended: attended
          }
        });
      }
    }

    // Update waitlisted selection for each volunteer
    if (waitlistedSelection) {
      for (const [projectVolunteerId, selected] of Object.entries(waitlistedSelection)) {
        await prisma.projectVolunteer.update({
          where: {
            id: projectVolunteerId  // Using ProjectVolunteer ID
          },
          data: {
            selectedForTraining: selected
          }
        });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: req.params.id,
        action: 'updated_training_data',
        details: {
          attendanceUpdates: Object.keys(attendance || {}).length,
          selectionUpdates: Object.keys(waitlistedSelection || {}).length
        }
      }
    });

    res.json({ success: true, message: 'Training data updated successfully' });
  } catch (error) {
    console.error('Error saving training data:', error);
    res.status(500).json({ error: 'Failed to save training data' });
  }
});

// Update training attendance for a specific volunteer
app.patch('/api/projects/:id/volunteers/:volunteerId/training', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { volunteerId } = req.params;
    const { trainingAttended } = req.body;

    const updatedVolunteer = await prisma.projectVolunteer.update({
      where: {
        projectId_volunteerId: {
          projectId: req.params.id,
          volunteerId: volunteerId
        }
      },
      data: {
        trainingAttended: trainingAttended
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: req.params.id,
        action: 'updated_training_attendance',
        details: {
          volunteerId: volunteerId,
          attended: trainingAttended
        }
      }
    });

    res.json({ success: true, data: updatedVolunteer });
  } catch (error) {
    console.error('Error updating training attendance:', error);
    res.status(500).json({ error: 'Failed to update training attendance' });
  }
});

// Bulk update training attendance
app.post('/api/projects/:id/training-attendance', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { attendance } = req.body;
    let updatedCount = 0;

    // Update each volunteer's training attendance
    for (const [projectVolunteerId, attended] of Object.entries(attendance)) {
      try {
        await prisma.projectVolunteer.updateMany({
          where: {
            id: projectVolunteerId,
            projectId: req.params.id
          },
          data: {
            trainingAttended: attended
          }
        });
        updatedCount++;
      } catch (error) {
        console.error(`Error updating attendance for volunteer ${projectVolunteerId}:`, error);
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: req.params.id,
        action: 'bulk_updated_training_attendance',
        details: {
          updatedCount: updatedCount,
          totalVolunteers: Object.keys(attendance).length
        }
      }
    });

    res.json({ 
      success: true, 
      message: `Updated training attendance for ${updatedCount} volunteers` 
    });
  } catch (error) {
    console.error('Error bulk updating training attendance:', error);
    res.status(500).json({ error: 'Failed to update training attendance' });
  }
});

// ================================
// CLIENTS ROUTES
// ================================

// Delete all client groups for a project
app.delete('/api/projects/:id/client-groups/all', authenticateToken, checkProjectAccess, async (req, res) => {
  try { 
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const projectId = req.params.id;
    console.log(projectId)
    // Get count of existing groups
    const groupCount = await prisma.clientGroup.count({
      where: { projectId }
    });
    console.log(groupCount)
    if (groupCount === 0) {
      // Return success instead of 404 when no groups exist
      return res.json({
        success: true,
        message: 'No client groups found to delete'
      });
    }

    // Delete all groups for the project
    await prisma.clientGroup.deleteMany({
      where: { projectId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: projectId,
        action: 'deleted_all_client_groups',
        details: {
          groupsDeleted: groupCount
        }
      }
    });

    res.json({
      success: true,
      message: `Successfully deleted ${groupCount} client groups`
    });

  } catch (error) {
    console.error('Delete all client groups error:', error);
    res.status(500).json({ error: 'Failed to delete all client groups' });
  }
});



// Get group statistics
app.get('/api/projects/:id/client-groups/stats', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const groups = await prisma.clientGroup.findMany({
      where: { projectId: req.params.id },
      include: {
        groupClients: {
          include: {
            client: true
          }
        }
      }
    });

    const stats = {
      totalGroups: groups.length,
      totalClients: 0,
      mandatoryClients: 0,
      optionalClients: 0,
      locations: new Set(),
      averageGroupSize: 0,
      locationBreakdown: {}
    };

    groups.forEach(group => {
      stats.locations.add(group.location);
      
      if (!stats.locationBreakdown[group.location]) {
        stats.locationBreakdown[group.location] = {
          groups: 0,
          clients: 0,
          mandatory: 0,
          optional: 0
        };
      }
      
      stats.locationBreakdown[group.location].groups++;
      
      group.groupClients.forEach(gc => {
        stats.totalClients++;
        stats.locationBreakdown[group.location].clients++;
        
        if (gc.type === 'MANDATORY') {
          stats.mandatoryClients++;
          stats.locationBreakdown[group.location].mandatory++;
        } else {
          stats.optionalClients++;
          stats.locationBreakdown[group.location].optional++;
        }
      });
    });

    stats.locations = Array.from(stats.locations);
    stats.averageGroupSize = stats.totalGroups > 0 ? (stats.totalClients / stats.totalGroups).toFixed(1) : 0;

    res.json(stats);

  } catch (error) {
    console.error('Get group statistics error:', error);
    res.status(500).json({ error: 'Failed to get group statistics' });
  }
});

// Auto-group clients by area and create optimal groups
app.post('/api/projects/:id/clients/auto-group', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const projectClients = await prisma.projectClient.findMany({
      where: { projectId: req.params.id },
      include: { client: true },
      orderBy: { priority: 'asc' }
    });

    // Group by location
    const locationGroups = {};
    projectClients.forEach(pc => {
      const location = pc.client.location || 'Unknown';
      if (!locationGroups[location]) locationGroups[location] = [];
      locationGroups[location].push(pc.client);
    });

    // Create optimized groups (3 mandatory + 2 optional = 5 per group)
    const optimizedGroups = {};
    Object.keys(locationGroups).forEach(location => {
      const clients = locationGroups[location];
      const groups = [];
      
      for (let i = 0; i < clients.length; i += 5) {
        const group = clients.slice(i, i + 5);
        groups.push({
          groupId: `${location}-${Math.floor(i/5) + 1}`,
          location,
          mandatory: group.slice(0, 3), // First 3 are mandatory
          optional: group.slice(3, 5),  // Next 2 are optional
          totalClients: group.length
        });
      }
      optimizedGroups[location] = groups;
    });

    res.json({
      success: true,
      locationGroups: optimizedGroups,
      summary: Object.keys(optimizedGroups).map(loc => ({
        location: loc,
        totalClients: locationGroups[loc].length,
        groupCount: optimizedGroups[loc].length
      }))
    });

  } catch (error) {
    console.error('Auto-group error:', error);
    res.status(500).json({ error: 'Failed to create auto groups' });
  }
});
// ================================
// CLIENT GROUP ROUTES
// ================================

// Get client groups for a project
// In your server.js, update the client-groups endpoint:
app.get('/api/projects/:id/client-groups', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const groups = await prisma.clientGroup.findMany({
      where: { projectId: req.params.id },
      include: {
        groupClients: {
          include: {
            client: true // Include the actual client data
          },
          orderBy: { priority: 'asc' }
        }
      },
      orderBy: [
        { location: 'asc' },
        { groupNumber: 'asc' }
      ]
    });

    res.json(groups);
  } catch (error) {
    console.error('Get client groups error:', error);
    res.status(500).json({ error: 'Failed to get client groups' });
  }
});


// Add to your server.js
const { geocodeAddress } = require('./utils/nominatimService');

// Add these functions to your server.js file
function groupClientsByProximity(clients, maxDistanceKm) {
  const groups = [];
  const used = new Set();

  for (let i = 0; i < clients.length; i++) {
    if (used.has(i) || !clients[i].coordinates) continue;

    const group = [clients[i]];
    used.add(i);

    for (let j = i + 1; j < clients.length; j++) {
      if (used.has(j) || !clients[j].coordinates) continue;

      const distance = calculateDistance(
        clients[i].coordinates.lat,
        clients[i].coordinates.lon,
        clients[j].coordinates.lat,
        clients[j].coordinates.lon
      );

      if (distance <= maxDistanceKm) {
        group.push(clients[j]);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Modified clustering function that respects location boundaries
function clusterClientsByLocationAndProximity(clients, maxDistanceKm) {
  const locationGroups = new Map();

  // First, group all clients by their location field
  clients.forEach(client => {
    const location = client.location || 'Unknown Location';
    if (!locationGroups.has(location)) {
      locationGroups.set(location, []);
    }
    locationGroups.get(location).push(client);
  });

  const allClusters = [];
  
  // Then, within each location, apply proximity clustering
  for (const [locationName, clientsInLocation] of locationGroups.entries()) {
    if (clientsInLocation.length === 0) continue;
    
    // Use your existing proximity clustering function within this location
    const proximityClusters = groupClientsByProximity(clientsInLocation, maxDistanceKm);
    
    // Add location information to each cluster
    proximityClusters.forEach((cluster, index) => {
      cluster.locationName = locationName;
      cluster.clusterIndex = index + 1;
    });
    
    allClusters.push(...proximityClusters);
  }

  return allClusters;
}

app.post('/api/projects/:id/clients/auto-group-enhanced', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const projectId = req.params.id;
    const { useGeocoding = true, maxDistance = 2 } = req.body;

    const projectClients = await prisma.projectClient.findMany({
      where: { projectId },
      include: { client: true },
      orderBy: { priority: 'asc' }
    });

    if (projectClients.length === 0) {
      return res.status(400).json({ error: 'No clients found to group' });
    }

    // Clear existing groups first
    await prisma.clientGroup.deleteMany({
      where: { projectId }
    });

    let totalGroupsCreated = 0;
    let totalClientsGrouped = 0;
    let locationsProcessed = 0;

    if (useGeocoding) {
      console.log("Using location-aware geocoding");
      
      let clientsWithCoordinates = [];
      for (const pc of projectClients) {
        const coordinates = await geocodeAddress(pc.client.address);
        clientsWithCoordinates.push({
          ...pc.client,
          coordinates
        });
        await new Promise(resolve => setTimeout(resolve, 1100)); // Rate limiting
      }

      // Use location-first clustering
      const locationClusters = clusterClientsByLocationAndProximity(clientsWithCoordinates, maxDistance);
      
      for (const cluster of locationClusters) {
        const locationName = cluster.locationName;
        const groupName = cluster.length > 1 
          ? `${locationName} - Group ${cluster.clusterIndex}` 
          : `${locationName} - Solo`;
        
        const dbGroup = await prisma.clientGroup.create({
          data: {
            name: groupName,
            location: locationName, // Use the actual location name
            groupNumber: cluster.clusterIndex,
            projectId,
            maxMandatory: Math.min(3, cluster.length),
            maxOptional: Math.max(0, cluster.length - 3)
          }
        });

        // Add clients to the group
        for (let j = 0; j < cluster.length; j++) {
          await prisma.groupClient.create({
            data: {
              clientId: cluster[j].id,
              groupId: dbGroup.id,
              type: j < 3 ? 'MANDATORY' : 'OPTIONAL',
              priority: j + 1
            }
          });
        }
        
        totalClientsGrouped += cluster.length;
        totalGroupsCreated++;
      }
      
      locationsProcessed = new Set(locationClusters.map(c => c.locationName)).size;

    } else {
           // Location-based grouping (FIXED - now saves to database)
      const locationGroups = {};
      projectClients.forEach(pc => {
        const location = pc.client.location || 'Unknown';
        if (!locationGroups[location]) locationGroups[location] = [];
        locationGroups[location].push(pc.client);
      });

      locationsProcessed = Object.keys(locationGroups).length;

      // Create and save groups to database
      for (const [location, clients] of Object.entries(locationGroups)) {
        for (let i = 0; i < clients.length; i += 5) {
          const groupClients = clients.slice(i, i + 5);
          const groupNumber = Math.floor(i / 5) + 1;
          
          // Create group in database
          const dbGroup = await prisma.clientGroup.create({
            data: {
              name: `${location} - Group ${groupNumber}`,
              location: location,
              groupNumber: groupNumber,
              projectId,
              maxMandatory: Math.min(3, groupClients.length),
              maxOptional: Math.max(0, groupClients.length - 3)
            }
          });

          // Add clients to group
          for (let j = 0; j < groupClients.length; j++) {
            await prisma.groupClient.create({
              data: {
                clientId: groupClients[j].id,
                groupId: dbGroup.id,
                type: j < 3 ? 'MANDATORY' : 'OPTIONAL',
                priority: j + 1
              }
            });
          }
          
          totalGroupsCreated++;
          totalClientsGrouped += groupClients.length;
        }
      }
    }

    res.json({
      success: true,
      groupsCreated: totalGroupsCreated,
      clientsGrouped: totalClientsGrouped,
      locations: locationsProcessed,
      message: `Created ${totalGroupsCreated} groups with ${totalClientsGrouped} clients across ${locationsProcessed} locations`
    });

  } catch (error) {
    console.error('Enhanced auto-group error:', error);
    res.status(500).json({ error: 'Failed to create enhanced groups' });
  }
});


// Create custom client groups
app.post('/api/projects/:id/client-groups', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { groups } = req.body;
    const projectId = req.params.id;

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ error: 'No groups provided' });
    }

    const createdGroups = [];

    // Use transaction to ensure all groups are created successfully
    await prisma.$transaction(async (tx) => {
      for (const groupData of groups) {
        const { name, location, mandatoryClients = [], optionalClients = [] } = groupData;
        
        if (!name || !location) {
          throw new Error('Group name and location are required');
        }

        // FIXED: Calculate the next group number for this project/location combination
        const existingGroups = await tx.clientGroup.findMany({
          where: { 
            projectId: projectId, 
            location: location 
          },
          select: { groupNumber: true },
          orderBy: { groupNumber: 'desc' }
        });
        
        const nextGroupNumber = existingGroups.length > 0 ? existingGroups[0].groupNumber + 1 : 1;

        // Create the group with the calculated group number
        const group = await tx.clientGroup.create({
          data: {
            name,
            location,
            groupNumber: nextGroupNumber, // Use calculated number instead of hardcoded 1
            projectId,
            maxMandatory: 3,
            maxOptional: 2
          }
        });

        // Add mandatory clients
        for (let i = 0; i < mandatoryClients.length && i < 3; i++) {
          await tx.groupClient.create({
            data: {
              clientId: mandatoryClients[i].id,
              groupId: group.id,
              type: 'MANDATORY',
              priority: i + 1
            }
          });
        }

        // Add optional clients  
        for (let i = 0; i < optionalClients.length && i < 2; i++) {
          await tx.groupClient.create({
            data: {
              clientId: optionalClients[i].id,
              groupId: group.id,
              type: 'OPTIONAL',
              priority: mandatoryClients.length + i + 1
            }
          });
        }

        createdGroups.push(group);
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: projectId,
        action: 'createdclientgroups',
        details: { groupsCreated: createdGroups.length }
      }
    });

    res.json({
      success: true,
      message: `Created ${createdGroups.length} client groups successfully`,
      groups: createdGroups
    });

  } catch (error) {
    console.error('Create client groups error:', error);
    res.status(500).json({ error: error.message || 'Failed to create client groups' });
  }
});


// Update a client group
app.put('/api/projects/:id/client-groups/:groupId', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { groupId } = req.params;
    const { name, location, mandatoryClients = [], optionalClients = [] } = req.body;

    // Verify group belongs to project
    const existingGroup = await prisma.clientGroup.findFirst({
      where: {
        id: groupId,
        projectId: req.params.id
      }
    });

    if (!existingGroup) {
      return res.status(404).json({ error: 'Client group not found' });
    }

    // Use transaction for atomic updates
    const updatedGroup = await prisma.$transaction(async (tx) => {
      // Update group info
      const group = await tx.clientGroup.update({
        where: { id: groupId },
        data: {
          ...(name && { name }),
          ...(location && { location })
        }
      });

      // Remove existing group clients
      await tx.groupClient.deleteMany({
        where: { groupId: groupId }
      });

      // Add mandatory clients
      for (let i = 0; i < mandatoryClients.length && i < group.maxMandatory; i++) {
        await tx.groupClient.create({
          data: {
            clientId: mandatoryClients[i].id,
            groupId: groupId,
            type: 'MANDATORY',
            priority: i + 1
          }
        });
      }

      // Add optional clients
      for (let i = 0; i < optionalClients.length && i < group.maxOptional; i++) {
        await tx.groupClient.create({
          data: {
            clientId: optionalClients[i].id,
            groupId: groupId,
            type: 'OPTIONAL',
            priority: mandatoryClients.length + i + 1
          }
        });
      }

      return group;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: req.params.id,
        action: 'updated_client_group',
        details: {
          groupId: groupId,
          groupName: updatedGroup.name
        }
      }
    });

    res.json({
      success: true,
      message: 'Client group updated successfully',
      group: updatedGroup
    });

  } catch (error) {
    console.error('Update client group error:', error);
    res.status(500).json({ error: 'Failed to update client group' });
  }
});

// Delete a client group
app.delete('/api/projects/:id/client-groups/:groupId', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { groupId } = req.params;

    // Verify group belongs to project
    const existingGroup = await prisma.clientGroup.findFirst({
      where: {
        id: groupId,
        projectId: req.params.id
      }
    });

    if (!existingGroup) {
      return res.status(404).json({ error: 'Client group not found' });
    }

    // Delete the group (cascade will remove group clients)
    await prisma.clientGroup.delete({
      where: { id: groupId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: req.params.id,
        action: 'deleted_client_group',
        details: {
          groupId: groupId,
          groupName: existingGroup.name
        }
      }
    });

    res.json({ 
      success: true, 
      message: 'Client group deleted successfully' 
    });

  } catch (error) {
    console.error('Delete client group error:', error);
    res.status(500).json({ error: 'Failed to delete client group' });
  }
});



// Add client to group
app.post('/api/projects/:id/client-groups/:groupId/clients', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { groupId } = req.params;
    const { clientId, type = 'OPTIONAL' } = req.body;

    // Verify group belongs to project
    const group = await prisma.clientGroup.findFirst({
      where: {
        id: groupId,
        projectId: req.params.id
      },
      include: {
        groupClients: true
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Client group not found' });
    }

    // Check if client is already in this group
    const existingMember = group.groupClients.find(gc => gc.clientId === clientId);
    if (existingMember) {
      return res.status(400).json({ error: 'Client is already in this group' });
    }

    // Check capacity limits
    const mandatoryCount = group.groupClients.filter(gc => gc.type === 'MANDATORY').length;
    const optionalCount = group.groupClients.filter(gc => gc.type === 'OPTIONAL').length;

    if (type === 'MANDATORY' && mandatoryCount >= group.maxMandatory) {
      return res.status(400).json({ 
        error: `Group already has maximum mandatory clients (${group.maxMandatory})` 
      });
    }

    if (type === 'OPTIONAL' && optionalCount >= group.maxOptional) {
      return res.status(400).json({ 
        error: `Group already has maximum optional clients (${group.maxOptional})` 
      });
    }

    // Calculate next priority
    const maxPriority = Math.max(0, ...group.groupClients.map(gc => gc.priority));
    const priority = maxPriority + 1;

    // Add client to group
    const groupClient = await prisma.groupClient.create({
      data: {
        clientId,
        groupId,
        type,
        priority
      },
      include: {
        client: true
      }
    });

    res.json({
      success: true,
      message: 'Client added to group successfully',
      groupClient
    });

  } catch (error) {
    console.error('Add client to group error:', error);
    res.status(500).json({ error: 'Failed to add client to group' });
  }
});

// Remove client from group
app.delete('/api/projects/:id/client-groups/:groupId/clients/:clientId', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { groupId, clientId } = req.params;

    // Verify group belongs to project
    const group = await prisma.clientGroup.findFirst({
      where: {
        id: groupId,
        projectId: req.params.id
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Client group not found' });
    }

    // Remove client from group
    const deletedGroupClient = await prisma.groupClient.deleteMany({
      where: {
        groupId,
        clientId
      }
    });

    if (deletedGroupClient.count === 0) {
      return res.status(404).json({ error: 'Client not found in this group' });
    }

    res.json({
      success: true,
      message: 'Client removed from group successfully'
    });

  } catch (error) {
    console.error('Remove client from group error:', error);
    res.status(500).json({ error: 'Failed to remove client from group' });
  }
});

// ================================
// PROJECT FINALISATION
// ================================

// Finalise project - apply replacements and remove non-participating volunteers
app.post('/api/projects/:id/finalise', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    if (req.userPermission === 'VIEW') {
      return res.status(403).json({ error: 'Insufficient permissions to finalise project' });
    }

    const projectId = req.params.id;
    const { replacements, finalAssignments } = req.body;

    await prisma.$transaction(async (tx) => {
      // Step 1: Apply replacements by updating volunteer pairs
      if (replacements && Object.keys(replacements).length > 0) {
        for (const [key, replacementVolunteerId] of Object.entries(replacements)) {
          const [pairId, originalVolunteerId] = key.split('-');
          
          // Find the pair and determine which volunteer to replace
          const pair = await tx.volunteerPair.findUnique({
            where: { id: pairId }
          });
          
          if (pair) {
            const updateData = {};
            if (pair.volunteer1Id === originalVolunteerId) {
              updateData.volunteer1Id = replacementVolunteerId;
            } else if (pair.volunteer2Id === originalVolunteerId) {
              updateData.volunteer2Id = replacementVolunteerId;
            }
            
            if (Object.keys(updateData).length > 0) {
              await tx.volunteerPair.update({
                where: { id: pairId },
                data: updateData
              });
            }
          }
        }
      }

      // Step 2: Get all volunteers currently participating in final assignments
      const participatingVolunteerIds = new Set();
      
      // Get updated pairs after replacements
      const updatedPairs = await tx.volunteerPair.findMany({
        where: { 
          projectId: projectId,
          isActive: true 
        }
      });
      
      // Add all volunteers from active pairs to participating set
      updatedPairs.forEach(pair => {
        participatingVolunteerIds.add(pair.volunteer1Id);
        participatingVolunteerIds.add(pair.volunteer2Id);
      });

      // Step 3: Remove volunteers who are not participating
      const allProjectVolunteers = await tx.projectVolunteer.findMany({
        where: { projectId: projectId },
        select: { id: true, volunteerId: true }
      });

      const volunteersToRemove = allProjectVolunteers.filter(pv => 
        !participatingVolunteerIds.has(pv.volunteerId)
      );

      // Step 4: Delete non-participating project volunteer relationships
      if (volunteersToRemove.length > 0) {
        const projectVolunteerIdsToRemove = volunteersToRemove.map(pv => pv.id);
        
        await tx.projectVolunteer.deleteMany({
          where: {
            id: { in: projectVolunteerIdsToRemove }
          }
        });
      }

      // Step 5: Check for volunteers that are now only in this project after removal
      // and delete them completely if they're not in any other projects
      const volunteerIdsToCheck = volunteersToRemove.map(pv => pv.volunteerId);
      
      if (volunteerIdsToCheck.length > 0) {
        // Find volunteers that are only in this project
        const volunteersOnlyInThisProject = await tx.volunteer.findMany({
          where: {
            id: { in: volunteerIdsToCheck }
          },
          include: {
            projectVolunteers: {
              select: { projectId: true }
            }
          }
        });

        const volunteerIdsToCompletelyDelete = volunteersOnlyInThisProject
          .filter(v => v.projectVolunteers.length === 0) // No project relationships left
          .map(v => v.id);

        if (volunteerIdsToCompletelyDelete.length > 0) {
          await tx.volunteer.deleteMany({
            where: {
              id: { in: volunteerIdsToCompletelyDelete }
            }
          });
        }
      }

      // Step 6: Update project status or add finalisation metadata
      await tx.project.update({
        where: { id: projectId },
        data: {
          settings: {
            ...req.project.settings,
            finalised: true,
            finalisedAt: new Date().toISOString(),
            finalisedBy: req.user.userId
          }
        }
      });

      // Step 7: Log the activity
      await tx.activityLog.create({
        data: {
          userId: req.user.userId,
          projectId: projectId,
          action: 'finalised_project',
          details: {
            totalAssignments: finalAssignments?.length || 0,
            replacementsApplied: Object.keys(replacements || {}).length,
            volunteersRemoved: volunteersToRemove.length,
            participatingVolunteers: participatingVolunteerIds.size
          }
        }
      });

      return {
        success: true,
        message: 'Project finalised successfully',
        removedVolunteers: volunteersToRemove.length,
        participatingVolunteers: participatingVolunteerIds.size,
        replacements: Object.keys(replacements || {}).length
      };
    });

    res.json({
      success: true,
      message: 'Project finalised successfully! Non-participating volunteers have been removed.',
    });

  } catch (error) {
    console.error('Error finalising project:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to finalise project',
      details: error.message 
    });
  }
});

// ================================
// ACTIVITY LOGS
// ================================

// Get activity logs
app.get('/api/projects/:id/activity', authenticateToken, checkProjectAccess, async (req, res) => {
  try {
    const activities = await prisma.activityLog.findMany({
      where: { projectId: req.params.id },
      include: {
        user: {
          select: { username: true }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 50 // Limit to last 50 activities
    });

    res.json(activities);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity logs' });
  }
});



// ================================
// ERROR HANDLING & STARTUP
// ================================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});


// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
