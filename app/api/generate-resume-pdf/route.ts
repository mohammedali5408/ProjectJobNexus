// app/api/generate-resume-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// This explicitly names and exports the POST function
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeData, jobTitle, company } = body;

    if (!resumeData) {
      return NextResponse.json(
        { error: 'Resume data is required' },
        { status: 400 }
      );
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add a page to the document
    let currentPage = pdfDoc.addPage([612, 792]); // US Letter size
    
    // Get fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Set document properties
    pdfDoc.setTitle(`${resumeData.personalInfo?.name || 'Resume'} - ${jobTitle || ''} at ${company || ''}`);
    pdfDoc.setAuthor(resumeData.personalInfo?.name || 'Job Applicant');
    pdfDoc.setSubject(`Resume for ${jobTitle || ''} at ${company || ''}`);
    pdfDoc.setKeywords(['resume', 'job application', jobTitle || '', company || '']);
    
    // Start drawing content
    const { width, height } = currentPage.getSize();
    let yPosition = height - 50; // Start from top
    const margin = 50;
    const lineHeight = 16;
    
    // Helper function to sanitize text (remove problematic characters)
    const sanitizeText = (text) => {
      if (!text) return '';
      // Replace en-dash, em-dash and other special characters with standard ones
      return text
        .replace(/[\u2010-\u2015]/g, '-') // Replace various dashes with hyphen
        .replace(/[\u2018\u2019]/g, "'") // Replace smart single quotes
        .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
        .replace(/[\u2022]/g, '*') // Replace bullets
        .replace(/[\u2026]/g, '...') // Replace ellipsis
        .replace(/[^\x00-\x7F]/g, ''); // Remove any other non-ASCII characters
    };
    
    // Helper function to add text with proper wrapping
    const addText = (text, { 
      x, 
      y, 
      size = 12, 
      font = helveticaFont, 
      color = rgb(0, 0, 0), 
      maxWidth = width - 2 * margin 
    }) => {
      // Sanitize the text to avoid encoding issues
      const safeText = sanitizeText(text);
      const words = safeText.split(' ');
      let line = '';
      let currentY = y;
      
      for (const word of words) {
        try {
          const testLine = line ? line + ' ' + word : word;
          const lineWidth = font.widthOfTextAtSize(testLine, size);
          
          if (lineWidth > maxWidth && line) {
            currentPage.drawText(line, { x, y: currentY, size, font, color });
            line = word;
            currentY -= lineHeight;
          } else {
            line = testLine;
          }
        } catch (error) {
          console.error(`Error processing word: "${word}"`, error);
          // Skip this word and continue with the next one
          if (line) {
            try {
              currentPage.drawText(line, { x, y: currentY, size, font, color });
              currentY -= lineHeight;
              line = '';
            } catch (drawError) {
              console.error('Error drawing text:', drawError);
              // Just move on if we can't draw this line
              currentY -= lineHeight;
              line = '';
            }
          }
        }
      }
      
      if (line) {
        try {
          currentPage.drawText(line, { x, y: currentY, size, font, color });
          currentY -= lineHeight;
        } catch (error) {
          console.error('Error drawing final line:', error);
          currentY -= lineHeight;
        }
      }
      
      return currentY;
    };
    
    // Helper function to check if we need a new page
    const checkForNewPage = () => {
      if (yPosition < 150) {
        currentPage = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;
        return true;
      }
      return false;
    };
    
    // Add header with name and contact info
    if (resumeData.personalInfo) {
      // Name
      yPosition = addText(resumeData.personalInfo.name || 'Name Not Provided', {
        x: margin,
        y: yPosition,
        size: 20,
        font: helveticaBold
      });
      
      yPosition -= 10; // Add some spacing
      
      // Contact Information
      const contactInfo = [
        resumeData.personalInfo.email,
        resumeData.personalInfo.phone,
        resumeData.personalInfo.location
      ].filter(Boolean).join(' | ');
      
      if (contactInfo) {
        yPosition = addText(contactInfo, {
          x: margin,
          y: yPosition,
          size: 10
        });
      }
      
      yPosition -= 10; // Add spacing after contact info
    }
    
    // Add horizontal line
    currentPage.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: width - margin, y: yPosition },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7)
    });
    
    yPosition -= 20; // Space after line
    
    // Summary section
    if (resumeData.summary) {
      yPosition = addText('SUMMARY', {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaBold
      });
      
      yPosition -= 10;
      
      yPosition = addText(resumeData.summary, {
        x: margin,
        y: yPosition
      });
      
      yPosition -= 20; // Space after section
    }
    
    // Skills section
    if (resumeData.skills && (Array.isArray(resumeData.skills) ? resumeData.skills.length > 0 : resumeData.skills)) {
      checkForNewPage();
      
      yPosition = addText('SKILLS', {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaBold
      });
      
      yPosition -= 10;
      
      const skillsText = Array.isArray(resumeData.skills) 
        ? resumeData.skills.join(' • ') 
        : resumeData.skills;
      
      yPosition = addText(skillsText, {
        x: margin,
        y: yPosition
      });
      
      yPosition -= 20; // Space after section
    }
    
    // Experience section
    if (resumeData.experience && resumeData.experience.length > 0) {
      checkForNewPage();
      
      yPosition = addText('PROFESSIONAL EXPERIENCE', {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaBold
      });
      
      yPosition -= 15;
      
      for (const exp of resumeData.experience) {
        // Check if we need a new page
        checkForNewPage();
        
        // Title and Company
        yPosition = addText(`${exp.title || ''} | ${exp.company || ''}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: helveticaBold
        });
        
        // Dates
        const dateRange = `${exp.startDate || 'N/A'} - ${exp.endDate || 'Present'}`;
        yPosition = addText(dateRange, {
          x: margin,
          y: yPosition,
          size: 10,
          color: rgb(0.4, 0.4, 0.4)
        });
        
        yPosition -= 5;
        
        // Description
        if (exp.description) {
          yPosition = addText(exp.description, {
            x: margin,
            y: yPosition
          });
        }
        
        // Achievements
        if (exp.achievements && exp.achievements.length > 0) {
          yPosition -= 5;
          
          for (const achievement of exp.achievements) {
            // Check if we need a new page
            checkForNewPage();
            
            yPosition = addText(`• ${achievement}`, {
              x: margin + 10, // Indent bullets
              y: yPosition
            });
          }
        }
        
        yPosition -= 20; // Space between experiences
      }
    }
    
    // Education section
    if (resumeData.education && resumeData.education.length > 0) {
      // Check if we need a new page
      checkForNewPage();
      
      yPosition = addText('EDUCATION', {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaBold
      });
      
      yPosition -= 15;
      
      for (const edu of resumeData.education) {
        checkForNewPage();
        
        // Degree and Institution
        yPosition = addText(`${edu.degree || 'Degree'} | ${edu.institution || 'Institution'}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: helveticaBold
        });
        
        // Dates
        if (edu.startDate || edu.endDate) {
          const dateRange = `${edu.startDate || 'N/A'} - ${edu.endDate || 'Present'}`;
          yPosition = addText(dateRange, {
            x: margin,
            y: yPosition,
            size: 10,
            color: rgb(0.4, 0.4, 0.4)
          });
        }
        
        if (edu.description) {
          yPosition -= 5;
          yPosition = addText(edu.description, {
            x: margin,
            y: yPosition
          });
        }
        
        yPosition -= 15; // Space between education entries
      }
    }
    
    // Generate the PDF bytes
    const pdfBytes = await pdfDoc.save();
    
    // Return the PDF as a response
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="enhanced_resume.pdf"'
      }
    });
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error.message },
      { status: 500 }
    );
  }
}
