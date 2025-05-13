// lib/pdfGenerator.ts
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const generatePDF = async (element: HTMLElement, filename: string = 'resume') => {
  try {
    console.log('Starting PDF generation for element:', element.id || 'unnamed');
    
    // Clone the element to avoid changing the original DOM
    const clonedElement = element.cloneNode(true) as HTMLElement;
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(clonedElement);
    document.body.appendChild(tempContainer);
    
    // Set styles for better rendering
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    clonedElement.style.width = '800px'; // Fixed width for consistent rendering
    clonedElement.style.maxHeight = 'none';
    clonedElement.style.overflow = 'visible';
    clonedElement.style.backgroundColor = '#ffffff';
    
    // Wait for any images or fonts to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('Capturing canvas...');
    const canvas = await html2canvas(clonedElement, {
      scale: 1.5, // Higher scale for better quality
      useCORS: true, // Allow loading cross-origin images
      logging: true, // Enable logging for debugging
      allowTaint: true, // Allow cross-origin images
      backgroundColor: '#ffffff',
      onclone: (document, clonedDoc) => {
        console.log('HTML cloned for PDF generation');
      }
    });
    
    console.log('Canvas captured. Dimensions:', canvas.width, 'x', canvas.height);
    
    // Remove the temporary container
    document.body.removeChild(tempContainer);
    
    // A4 dimensions in mm
    const imgWidth = 210;
    const pageHeight = 297;
    
    // Calculate height proportionally to width
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Handle multi-page PDFs
    let heightLeft = imgHeight;
    let position = 0;
    
    // Add first page
    const imgData = canvas.toDataURL('image/jpeg', 0.95); // Use JPEG for smaller file size
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    console.log('PDF created successfully');
    
    // Save the PDF
    pdf.save(`${filename}.pdf`);
    console.log('PDF saved as', `${filename}.pdf`);
    
    return pdf.output('blob');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};