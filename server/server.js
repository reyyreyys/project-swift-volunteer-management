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
  methods: ["GET","POST","PUT","DELETE","OPTIONS"]
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
      .map(pv => pv.volunteerId) // ✅ Fixed: Use 'volunteerId' not 'volunteer_id'
      .filter(id => id != null); // ✅ Fixed: Filter out undefined/null values

    // Step 2: Delete all project-volunteer relationships for this project first
    const projectVolunteerResult = await prisma.projectVolunteer.deleteMany({
      where: { projectId: projectId }
    });

    // Step 3: Delete volunteers that were only in this project (only if we have valid IDs)
    let deletedVolunteersResult = { count: 0 };
    if (volunteerIdsToCompletelyDelete.length > 0) {
      console.log('Deleting volunteers with IDs:', volunteerIdsToCompletelyDelete); // Debug log
      
      deletedVolunteersResult = await prisma.volunteer.deleteMany({
        where: { 
          id: { 
            in: volunteerIdsToCompletelyDelete 
          } 
        }
      });
    }

    // Step 4: Log the action
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: projectId,
        action: 'cleared_project_volunteers',
        details: { 
          removedFromProject: projectVolunteerResult.count,
          completelyDeleted: deletedVolunteersResult.count,
          volunteerIdsDeleted: volunteerIdsToCompletelyDelete
        }
      }
    });

    res.json({ 
      success: true, 
      message: `Cleared ${projectVolunteerResult.count} volunteers from project. ${deletedVolunteersResult.count} volunteers were completely deleted as they were only in this project.`,
      removedFromProject: projectVolunteerResult.count,
      completelyDeleted: deletedVolunteersResult.count
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
    
    await prisma.$transaction(async (tx) => {
      for (const volunteerData of volunteers) {
        try {
          // Ensure timestamp/submissionDate is properly handled
          const submissionDate = volunteerData.submissionDate || volunteerData.timestamp || new Date();
          
          const cleanData = {
            firstName: volunteerData.firstName || '',
            lastName: volunteerData.lastName || '',
            email: volunteerData.email || null,
            contactNumber: volunteerData.contactNumber || null,
            age: volunteerData.age || null,
            
            // Commitment & Availability
            canCommit: volunteerData.canCommit || false,
            trainingAttendance: volunteerData.trainingAttendance || null,
            languages: volunteerData.languages || [],
            regions: volunteerData.regions || [],
            canTravel: volunteerData.canTravel || false,
            availableDays: volunteerData.availableDays || [],
            availableTime: volunteerData.availableTime || [],
            
            // Experience - will be recalculated later
            hasExperience: false,
            totalProjects: 0,
            experienceSummary: volunteerData.experienceSummary || null,
            
            // Personal Requirements
            dietary: volunteerData.dietary || null,
            hasShirt: volunteerData.hasShirt,
            shirtSize: volunteerData.shirtSize || null,
            
            // Group Information
            isJoiningAsGroup: volunteerData.isJoiningAsGroup || false,
            groupName: volunteerData.groupName || null,
            groupMembers: volunteerData.groupMembers || [],
            
            // Additional
            comments: volunteerData.comments || null,
            
            // Timestamps - NOTE: Your schema only has 'timestamp', not 'submissionDate'
            timestamp: submissionDate,
            
            // System fields
            isPublic: volunteerData.isPublic !== false, // Default to true
            createdById: req.user.userId
          };

          let volunteer;
          let isExisting = false;

          // Check if volunteer exists by email or contact number
          const existingVolunteer = await tx.volunteer.findFirst({
            where: {
              OR: [
                ...(cleanData.email ? [{ email: cleanData.email }] : []),
                ...(cleanData.contactNumber ? [{ contactNumber: cleanData.contactNumber }] : [])
              ]
            }
          });

          if (existingVolunteer) {
            // Update existing volunteer with latest data
            volunteer = await tx.volunteer.update({
              where: { id: existingVolunteer.id },
              data: {
                firstName: cleanData.firstName,
                lastName: cleanData.lastName,
                age: cleanData.age,
                languages: cleanData.languages,
                regions: cleanData.regions,
                canTravel: cleanData.canTravel,
                availableDays: cleanData.availableDays,
                availableTime: cleanData.availableTime,
                canCommit: cleanData.canCommit,
                trainingAttendance: cleanData.trainingAttendance,
                dietary: cleanData.dietary,
                hasShirt: cleanData.hasShirt,
                shirtSize: cleanData.shirtSize,
                isJoiningAsGroup: cleanData.isJoiningAsGroup,
                groupName: cleanData.groupName,
                groupMembers: cleanData.groupMembers,
                comments: cleanData.comments,
                experienceSummary: cleanData.experienceSummary,
                timestamp: cleanData.timestamp,
                // Don't update createdById for existing volunteers
              }
            });
            isExisting = true;
            updatedVolunteers++;
          } else {
            // Create new volunteer
            volunteer = await tx.volunteer.create({
              data: cleanData
            });
            createdVolunteers++;
          }

          // ALWAYS link volunteer to current project using correct field names
          const projectVolunteerLink = await tx.projectVolunteer.upsert({
            where: {
              projectId_volunteerId: {
                projectId: projectId, // Keep as string since your schema uses String
                volunteerId: volunteer.id
              }
            },
            update: {
              // Update status and timestamp but keep existing link
              status: 'PENDING',
              addedAt: new Date()
            },
            create: {
              projectId: projectId,
              volunteerId: volunteer.id,
              isSelected: false,
              isWaitlist: false,
              status: 'PENDING',
              addedAt: new Date()
            }
          });

          linkedToProject++;

        } catch (error) {
          console.error(`Error processing volunteer ${volunteerData.firstName} ${volunteerData.lastName}:`, error);
          errors.push({
            volunteer: `${volunteerData.firstName || 'Unknown'} ${volunteerData.lastName || 'Volunteer'}`,
            error: error.message
          });
        }
      }
    });

    // STEP 2: Recalculate experience for ALL volunteers using correct table names
    try {
      await prisma.$executeRaw`
        WITH volunteer_counts AS (
          SELECT pv."volunteer_id", COUNT(DISTINCT pv."project_id") AS project_count
          FROM "project_volunteers" pv
          GROUP BY pv."volunteer_id"
        )
        UPDATE "volunteers" v
        SET
          "has_experience" = (vc.project_count > 1),
          "total_projects" = vc.project_count
        FROM volunteer_counts vc
        WHERE v.id = vc."volunteer_id"
      `;
    } catch (rawQueryError) {
      console.error('Raw query failed, trying alternative approach:', rawQueryError);
      
      // Alternative approach using Prisma operations with correct field names
      const volunteerCounts = await prisma.projectVolunteer.groupBy({
        by: ['volunteerId'],
        _count: {
          projectId: true
        }
      });

      for (const count of volunteerCounts) {
        await prisma.volunteer.update({
          where: { id: count.volunteerId },
          data: {
            hasExperience: count._count.projectId > 1,
            totalProjects: count._count.projectId
          }
        });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: projectId,
        action: 'imported_volunteers_with_project_linking',
        details: { 
          created: createdVolunteers,
          updated: updatedVolunteers,
          linkedToProject: linkedToProject,
          errors: errors.length,
          totalProcessed: volunteers.length
        }
      }
    });

    res.status(201).json({
      success: true,
      message: `Successfully processed ${createdVolunteers + updatedVolunteers} volunteers and linked ${linkedToProject} to project`,
      created: createdVolunteers,
      updated: updatedVolunteers,
      linkedToProject: linkedToProject,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('CSV import error:', error);
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

    const volunteers = await prisma.volunteer.findMany({
      where,
      include: {
        createdBy: {
          select: { username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

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
app.post('/api/clients/import-csv', authenticateToken, async (req, res) => {
  try {
    const { clients, projectId } = req.body;
    
    if (!clients || !Array.isArray(clients)) {
      return res.status(400).json({ error: 'Invalid client data' });
    }

    // Process the CSV data with proper field mapping
    const processedClients = clients.map(c => ({
      srcId: c['SRC #'] || c.srcId || '',
      name: c['Name'] || c.name || '',
      gender: c['Gender'] || c.gender || null,
      race: c['Race'] || c.race || null,
      languages: c['Language Spoken'] || c.languages || '',
      address: c['Full Address'] || c.address || '',
      location: c['Location'] || c.location || '',
      isPublic: true,
      createdById: req.user.userId
    }));

    // Create clients in database
    const createdClients = [];
    const errors = [];
    
    for (const clientData of processedClients) {
      try {
        // Skip empty rows
        if (!clientData.srcId || !clientData.name) {
          continue;
        }
        
        const client = await prisma.client.create({
          data: clientData
        });
        createdClients.push(client);
      } catch (error) {
        errors.push({
          client: `${clientData.name} (${clientData.srcId})`,
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
          action: 'imported_clients',
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

    // Step 2: Delete all project-client relationships for this project first
    const projectClientResult = await prisma.projectClient.deleteMany({
      where: { projectId: projectId }
    });

    // Step 3: Delete clients that were only in this project (only if we have valid IDs)
    let deletedClientsResult = { count: 0 };
    if (clientIdsToCompletelyDelete.length > 0) {
      console.log('Deleting clients with IDs:', clientIdsToCompletelyDelete); // Debug log
      deletedClientsResult = await prisma.client.deleteMany({
        where: {
          id: {
            in: clientIdsToCompletelyDelete
          }
        }
      });
    }

    // Step 4: Log the action
    await prisma.activityLog.create({
      data: {
        userId: req.user.userId,
        projectId: projectId,
        action: 'cleared_project_clients',
        details: {
          removedFromProject: projectClientResult.count,
          completelyDeleted: deletedClientsResult.count,
          clientIdsDeleted: clientIdsToCompletelyDelete
        }
      }
    });

    res.json({
      success: true,
      message: `Cleared ${projectClientResult.count} clients from project. ${deletedClientsResult.count} clients were completely deleted as they were only in this project.`,
      removedFromProject: projectClientResult.count,
      completelyDeleted: deletedClientsResult.count
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
