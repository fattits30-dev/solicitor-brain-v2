const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGenerator {
  constructor() {
    this.defaultFont = 'Times-Roman';
    this.boldFont = 'Times-Bold';
  }

  /**
   * Generate a legal document PDF
   * @param {Object} options - Document options
   * @param {string} options.title - Document title
   * @param {string} options.content - Document content
   * @param {string} options.type - Document type (judgment, appeal, evidence, etc.)
   * @param {Object} options.metadata - Additional metadata
   * @returns {Buffer} PDF buffer
   */
  async generateDocument(options) {
    const { title, content, type, metadata = {} } = options;
    
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 72,
          bottom: 72,
          left: 72,
          right: 72
        },
        info: {
          Title: title,
          Author: 'Solicitor Brain v2',
          Subject: type,
          Keywords: metadata.keywords || '',
          CreationDate: new Date()
        }
      });

      // Collect PDF data
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add header
      this.addHeader(doc, type, metadata);
      
      // Add title
      doc.fontSize(16)
         .font(this.boldFont)
         .text(title, { align: 'center' })
         .moveDown();

      // Add metadata if present
      if (metadata.caseNumber) {
        doc.fontSize(11)
           .font(this.defaultFont)
           .text(`Case Number: ${metadata.caseNumber}`, { align: 'center' })
           .moveDown();
      }

      if (metadata.date) {
        doc.text(`Date: ${metadata.date}`, { align: 'center' })
           .moveDown(2);
      }

      // Add content
      this.addFormattedContent(doc, content, type);

      // Add footer
      this.addFooter(doc, metadata);

      // Finalize PDF
      doc.end();
    });
  }

  /**
   * Add formatted content based on document type
   */
  addFormattedContent(doc, content, type) {
    const lines = content.split('\n');
    let inSection = false;
    
    for (const line of lines) {
      // Handle section headers (all caps or numbered)
      if (/^[A-Z\s]+:/.test(line) || /^\d+\./.test(line)) {
        if (inSection) doc.moveDown(0.5);
        doc.font(this.boldFont)
           .fontSize(12)
           .text(line, { align: 'left' });
        inSection = true;
      }
      // Handle subsection headers
      else if (/^\w+:/.test(line) && line.length < 50) {
        doc.font(this.boldFont)
           .fontSize(11)
           .text(line, { align: 'left' });
      }
      // Handle numbered lists
      else if (/^\d+\.\s/.test(line)) {
        doc.font(this.defaultFont)
           .fontSize(11)
           .text(line, { indent: 20 });
      }
      // Handle bullet points
      else if (/^[•\-]\s/.test(line)) {
        doc.font(this.defaultFont)
           .fontSize(11)
           .text(line, { indent: 30 });
      }
      // Regular text
      else if (line.trim()) {
        doc.font(this.defaultFont)
           .fontSize(11)
           .text(line, { align: 'justify' });
      }
      // Empty line
      else {
        doc.moveDown(0.5);
      }
    }
  }

  /**
   * Add document header
   */
  addHeader(doc, type, metadata) {
    const headerText = this.getHeaderText(type);
    
    doc.fontSize(10)
       .font(this.defaultFont)
       .text(headerText, { align: 'center' })
       .moveDown();
    
    // Add line separator
    doc.moveTo(72, 120)
       .lineTo(doc.page.width - 72, 120)
       .stroke()
       .moveDown(2);
  }

  /**
   * Add document footer with page numbers
   */
  addFooter(doc, metadata) {
    // Simple footer - add page number at bottom
    const pageNumber = 1;
    const oldY = doc.y;
    
    doc.y = doc.page.height - 50;
    
    doc.fontSize(9)
       .font(this.defaultFont)
       .text(
         `Page ${pageNumber}`,
         0,
         doc.page.height - 50,
         { align: 'center', width: doc.page.width }
       );
    
    // Add confidentiality notice if needed
    if (metadata.confidential) {
      doc.fontSize(8)
         .text(
           'CONFIDENTIAL - LEGALLY PRIVILEGED',
           0,
           doc.page.height - 35,
           { align: 'center', width: doc.page.width }
         );
    }
    
    doc.y = oldY;
  }

  /**
   * Get header text based on document type
   */
  getHeaderText(type) {
    const headers = {
      'judgment': 'IN THE EMPLOYMENT TRIBUNAL',
      'appeal': 'FIRST-TIER TRIBUNAL - SOCIAL ENTITLEMENT CHAMBER',
      'evidence': 'MEDICAL EVIDENCE',
      'form': 'OFFICIAL FORM',
      'correspondence': 'LEGAL CORRESPONDENCE',
      'default': 'LEGAL DOCUMENT'
    };
    
    return headers[type] || headers.default;
  }

  /**
   * Generate a case bundle PDF with multiple documents
   */
  async generateBundle(caseData, documents) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 }
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add cover page
      this.addCoverPage(doc, caseData);
      
      // Add index
      doc.addPage();
      this.addIndex(doc, documents);
      
      // Add each document
      documents.forEach((document, index) => {
        doc.addPage();
        this.addBundleDocument(doc, document, index + 1);
      });

      doc.end();
    });
  }

  /**
   * Add cover page for bundle
   */
  addCoverPage(doc, caseData) {
    doc.fontSize(20)
       .font(this.boldFont)
       .text('CASE BUNDLE', { align: 'center' })
       .moveDown(2);
    
    doc.fontSize(16)
       .text(caseData.title, { align: 'center' })
       .moveDown();
    
    doc.fontSize(12)
       .font(this.defaultFont)
       .text(`Case Number: ${caseData.caseNumber}`, { align: 'center' })
       .moveDown()
       .text(`Date: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' })
       .moveDown(3);
    
    if (caseData.client) {
      doc.font(this.boldFont)
         .text('CLIENT:', { continued: true })
         .font(this.defaultFont)
         .text(` ${caseData.client}`)
         .moveDown();
    }
    
    if (caseData.opponent) {
      doc.font(this.boldFont)
         .text('OPPONENT:', { continued: true })
         .font(this.defaultFont)
         .text(` ${caseData.opponent}`)
         .moveDown();
    }
  }

  /**
   * Add index page
   */
  addIndex(doc, documents) {
    doc.fontSize(14)
       .font(this.boldFont)
       .text('INDEX', { align: 'center' })
       .moveDown(2);
    
    doc.fontSize(11)
       .font(this.defaultFont);
    
    documents.forEach((document, index) => {
      const pageNum = index + 3; // After cover and index
      doc.text(`${index + 1}. ${document.title}`, { continued: true })
         .text(`.....${pageNum}`, { align: 'right' })
         .moveDown(0.5);
    });
  }

  /**
   * Add document to bundle
   */
  addBundleDocument(doc, document, number) {
    doc.fontSize(12)
       .font(this.boldFont)
       .text(`DOCUMENT ${number}`, { align: 'center' })
       .moveDown()
       .text(document.title, { align: 'center' })
       .moveDown(2);
    
    doc.fontSize(11)
       .font(this.defaultFont)
       .text(document.content, { align: 'justify' });
  }
}

module.exports = PDFGenerator;