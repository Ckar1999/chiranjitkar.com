const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createMasterAgreementPdf(outputPath) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // A4 dimensions: 595.28 x 841.89 points
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function checkPageBreak(neededHeight) {
    if (y - neededHeight < 50) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawRunningHeader();
    }
  }

  function drawRunningHeader() {
    currentPage.drawText('CHIRANJIT KAR PHOTOGRAPHY · MASTER CREATIVE PRODUCTION DEED', {
      x: margin,
      y: pageHeight - 28,
      size: 7.5,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    currentPage.drawText('GOVT E-STAMP: IN-DL22366535014840X', {
      x: pageWidth - margin - 180,
      y: pageHeight - 28,
      size: 7.5,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    currentPage.drawLine({
      start: { x: margin, y: pageHeight - 34 },
      end: { x: pageWidth - margin, y: pageHeight - 34 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    });
  }

  function drawParagraph(text, font, size, leading, color = rgb(0.1, 0.1, 0.1), indent = 0) {
    const maxWidth = contentWidth - indent;
    const words = text.split(' ');
    let line = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = line + (line === '' ? '' : ' ') + words[i];
      const testWidth = font.widthOfTextAtSize(testLine, size);
      if (testWidth > maxWidth && line !== '') {
        checkPageBreak(leading);
        currentPage.drawText(line, { x: margin + indent, y, size, font, color });
        y -= leading;
        line = words[i];
      } else {
        line = testLine;
      }
    }
    if (line !== '') {
      checkPageBreak(leading);
      currentPage.drawText(line, { x: margin + indent, y, size, font, color });
      y -= leading;
    }
  }

  // --- 1. Official Delhi e-Stamp Certificate Box ---
  const stampBoxHeight = 68;
  currentPage.drawRectangle({
    x: margin,
    y: y - stampBoxHeight,
    width: contentWidth,
    height: stampBoxHeight,
    borderColor: rgb(0.08, 0.1, 0.15),
    borderWidth: 1.2,
    color: rgb(0.97, 0.98, 0.99)
  });

  currentPage.drawText('GOVERNMENT OF NATIONAL CAPITAL TERRITORY OF DELHI', {
    x: margin + 10,
    y: y - 15,
    size: 8.5,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  currentPage.drawText('CERTIFICATE OF STAMP DUTY · NON-JUDICIAL E-STAMP (ARTICLE 5 GENERAL AGREEMENT)', {
    x: margin + 10,
    y: y - 27,
    size: 7.8,
    font: fontBold,
    color: rgb(0.7, 0.35, 0.05)
  });
  currentPage.drawText('Certificate No: IN-DL22366535014840X  |  Unique Doc Ref: SUBIN-DLDL75210370036032316761X  |  Duty: Rs. 100.00', {
    x: margin + 10,
    y: y - 39,
    size: 7,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  currentPage.drawText('First Party: CHIRANJIT KAR  |  Second Party: CLIENT OR COLLABORATOR  |  Consideration Price: Rs. 0 (Zero)', {
    x: margin + 10,
    y: y - 50,
    size: 7,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.3)
  });
  currentPage.drawText('Account Ref: IMPACC (IV)/ dl752103/ DELHI/ DL-ESD  |  Issued: 29-Dec-2025 10:56 AM  |  StockHolding (SHCIL) Verified', {
    x: margin + 10,
    y: y - 61,
    size: 6.6,
    font: fontOblique,
    color: rgb(0.35, 0.4, 0.45)
  });

  y -= (stampBoxHeight + 12);

  // --- 2. Master Agreement Title ---
  currentPage.drawText('MASTER PHOTOGRAPHY & CREATIVE PRODUCTION AGREEMENT', {
    x: margin,
    y,
    size: 13,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.1)
  });
  y -= 14;

  currentPage.drawText('UNIVERSAL DEED GOVERNING BOTH PAID COMMISSIONS & UNPAID TFP COLLABORATIONS', {
    x: margin,
    y,
    size: 7.8,
    font: fontBold,
    color: rgb(0.7, 0.35, 0.05)
  });
  y -= 16;

  // --- 3. Preamble ---
  drawParagraph(
    'This Master Photography & Creative Production Agreement ("Agreement") is executed on the Execution Date between Chiranjit Kar ("Photographer"), Operating as Chiranjit Kar Photography, New Delhi, and the Second Party designated below ("Client" or "Collaborator"). This universal master deed operates dynamically across both Paid Commercial Commissions and Unpaid TFP Collaborations, establishing binding terms for all visual production, likeness rights, and digital deliverables.',
    fontRegular, 7.8, 11
  );
  y -= 6;

  // --- 4. Schedule A: Schedule of Engagement & Parties ---
  checkPageBreak(120);
  currentPage.drawText('SCHEDULE A: ENGAGEMENT SPECIFICATIONS & PARTIES', {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 12;

  const schedAHeight = 84;
  currentPage.drawRectangle({
    x: margin,
    y: y - schedAHeight,
    width: contentWidth,
    height: schedAHeight,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 0.8,
    color: rgb(0.98, 0.98, 0.99)
  });

  // Table rows in Schedule A
  currentPage.drawText('Contract ID: {{Contract ID}}', { x: margin + 8, y: y - 14, size: 7.8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText('Date of Execution: {{Date}}', { x: margin + 260, y: y - 14, size: 7.8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  
  currentPage.drawText('First Party (Studio): Chiranjit Kar · Studio Director', { x: margin + 8, y: y - 28, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('Studio Email: iamchiranjitkar@hotmail.com', { x: margin + 260, y: y - 28, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  currentPage.drawText('Second Party: {{Collaborator Name}}', { x: margin + 8, y: y - 42, size: 7.8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText('Contact: {{Phone Number}} · {{Email ID}}', { x: margin + 260, y: y - 42, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  currentPage.drawText('Production Location: {{Address}}', { x: margin + 8, y: y - 56, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('Project Classification: [  ] Paid Commercial   [  ] Unpaid TFP Collaboration', { x: margin + 260, y: y - 56, size: 7.5, font: fontBold, color: rgb(0.7, 0.35, 0.05) });

  currentPage.drawText('Scope of Services: {{Scope & Package Details}}', { x: margin + 8, y: y - 72, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  y -= (schedAHeight + 14);

  // --- 5. Schedule B: Consideration, Documentation Fee & Deliverables Framework ---
  checkPageBreak(130);
  currentPage.drawText('SCHEDULE B: CONSIDERATION, FINANCIAL TERMS & DELIVERABLES FRAMEWORK', {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 12;

  const schedBHeight = 110;
  currentPage.drawRectangle({
    x: margin,
    y: y - schedBHeight,
    width: contentWidth,
    height: schedBHeight,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 0.8,
    color: rgb(0.98, 0.98, 0.99)
  });

  currentPage.drawText('B.1 PAID COMMERCIAL COMMISSION TERMS', { x: margin + 8, y: y - 14, size: 7.6, font: fontBold, color: rgb(0.08, 0.1, 0.15) });
  currentPage.drawText('- Total Quotation: {{Total Quotation}}  |  Strict 20% Booking Advance: {{Advance Deposit}} (Non-refundable)', { x: margin + 14, y: y - 26, size: 7.2, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('- Strict 80% Post-Shoot Balance: {{Balance Due}} - Strictly payable upon shoot conclusion prior to file delivery.', { x: margin + 14, y: y - 37, size: 7.2, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  currentPage.drawText('B.2 UNPAID / TFP CREATIVE COLLABORATION TERMS', { x: margin + 8, y: y - 52, size: 7.6, font: fontBold, color: rgb(0.08, 0.1, 0.15) });
  currentPage.drawText('- Monetary Fees: Rs. 0.00 (Zero Monetary Consideration) · Mutual Time-for-Print (TFP) portfolio exchange.', { x: margin + 14, y: y - 64, size: 7.2, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('- Model Likeness Grant: Collaborator irrevocably grants Photographer perpetual worldwide likeness rights.', { x: margin + 14, y: y - 75, size: 7.2, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('- Mandatory Social Credit: Mandatory tag and attribution to @iamchiranjitkar on all public media.', { x: margin + 14, y: y - 86, size: 7.2, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  currentPage.drawText('B.3 MANDATORY SEPARATE DOCUMENTATION FEE (APPLICABLE TO PAID & UNPAID)', { x: margin + 8, y: y - 99, size: 7.4, font: fontBold, color: rgb(0.7, 0.35, 0.05) });
  currentPage.drawText('UIDAI OTP Documentation Fee: Rs. 99.00 - Client/Collaborator must pay separately before Leegality eSign unlocks.', { x: margin + 14, y: y - 108, size: 7, font: fontOblique, color: rgb(0.3, 0.3, 0.3) });

  y -= (schedBHeight + 14);

  // --- 6. Operative Legal Articles (Articles 1 to 13) ---
  const articles = [
    {
      num: '1. Nature of Master Agreement',
      text: '1.1 This Master Agreement governs all creative engagements between Photographer and Client/Collaborator. Participation, booking, or eSign execution signifies unconditional acceptance of all terms herein. 1.2 No informal discussions, WhatsApp chats, verbal conversations, or friendliness shall waive or supersede this Agreement.'
    },
    {
      num: '2. Scope of Services & Creative Authority',
      text: '2.1 Photographer provides professional photography/cinematography services as outlined in Schedule A. 2.2 Sole Creative Discretion: Photographer retains absolute artistic control over lighting, camera angles, poses, mood, grading, and curation. References and moodboards serve as non-binding artistic inspiration. 2.3 On-set scope changes or additions are deemed out-of-scope and subject to overtime rates.'
    },
    {
      num: '3. Consideration & Strict Payment Framework',
      text: '3.1 For Paid Commissions, payment must adhere strictly to Schedule B. Retouching commences only after 100% full balance clearance. 3.2 For Unpaid/TFP Collaborations, zero commercial fees apply; mutual creative exchange constitutes complete consideration. 3.3 The Rs. 99 UIDAI documentation fee is payable separately by the user before digital execution.'
    },
    {
      num: '4. Proprietary RAW Files & Post-Production Integrity',
      text: '4.1 Strict No-RAW Policy: Unedited RAW camera files, digital negatives, and unprocessed burst sequences are strictly confidential studio trade assets and will NEVER be released, sold, or provided under any circumstances. 4.2 Deliverables are restricted exclusively to finished, retouched master JPEGs.'
    },
    {
      num: '5. Ownership, Copyright & Licensing',
      text: '5.1 Master Copyright Ownership: Under Section 17 of the Indian Copyright Act 1957, Chiranjit Kar is the sole author and statutory copyright proprietor of all original visual works created. 5.2 Paid License: Paid clients receive a personal/commercial usage license upon full payment. 5.3 TFP Likeness Grant: Collaborators grant Photographer perpetual, worldwide, irrevocable rights to publish imagery across portfolios, exhibitions, and social media. Neither party may sell images to commercial brands without mutual agreement.'
    },
    {
      num: '6. Mandatory Social Media Attribution',
      text: '6.1 On all social media, digital releases, and portfolio displays, Client/Collaborator must prominently credit and tag: @iamchiranjitkar. 6.2 Applying third-party destructive filters, altering colors, cropping watermarks, or obscuring attribution is strictly prohibited.'
    },
    {
      num: '7. Set Safety, Professional Conduct & Chaperone Policy',
      text: '7.1 The studio maintains a strictly safe, professional, and respectful environment. 7.2 Chaperone Right: Any client or model is fully entitled to bring one designated companion or chaperone to the production set. 7.3 Photographer reserves the right to immediately terminate production without refund if any party exhibits inappropriate or unsafe conduct.'
    },
    {
      num: '8. Delivery Timelines & Selection Workflow',
      text: '8.1 Watermarked proofing preview files are delivered within 48 to 72 hours post-session. 8.2 Final master retouched image delivery requires 1 to 2 months following client select submission, based on studio post-production queue volume.'
    },
    {
      num: '9. Cancellations, Rescheduling & 48-Hour Policy',
      text: '9.1 The 20% advance booking deposit is strictly non-refundable under all circumstances to cover reserved studio time and crew reservation. 9.2 Rescheduling requires at least 48 hours advance notice in writing via email. Rescheduling requests made under 48 hours forfeit the booking deposit.'
    },
    {
      num: '10. Limitation of Liability & Non-Coercion',
      text: '10.1 In any unforeseen circumstance (equipment malfunction, force majeure), Photographer liability is strictly limited to the actual net monetary fee received. 10.2 Disparagement and online smear attempts are strictly prohibited; disputes shall be resolved exclusively through private legal notice.'
    },
    {
      num: '11. Confidentiality & Data Protection',
      text: '11.1 Client/Collaborator personal coordinates are safeguarded under studio data protection standards. 11.2 Private unreleased proofs shared for review shall not be published or leaked prior to official studio release.'
    },
    {
      num: '12. Digital Execution via Leegality & IT Act 2000',
      text: '12.1 Execution via UIDAI Aadhaar OTP through Leegality is legally binding and admissible under Section 10A of the Information Technology Act 2000 and the Indian Evidence Act. 12.2 The official Delhi NCT Rs. 100 e-Stamp certificate IN-DL22366535014840X forms an integral component of this executed deed.'
    },
    {
      num: '13. Governing Law & Exclusive Jurisdiction',
      text: '13.1 This Agreement is construed in accordance with the laws of the Republic of India. 13.2 The courts located in New Delhi, National Capital Territory of Delhi, shall have sole and exclusive territorial jurisdiction over any disputes arising from this Agreement.'
    }
  ];

  for (const art of articles) {
    checkPageBreak(40);
    currentPage.drawText(art.num, {
      x: margin,
      y,
      size: 8.5,
      font: fontBold,
      color: rgb(0.08, 0.1, 0.15)
    });
    y -= 11;
    drawParagraph(art.text, fontRegular, 7.5, 10.5, rgb(0.15, 0.15, 0.15));
    y -= 5;
  }

  // --- 7. Execution & Signature Block ---
  checkPageBreak(110);
  currentPage.drawText('EXECUTION, SEALS & DIGITAL AADHAAR OTP AUTHENTICATION', {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 12;

  const sigBoxHeight = 82;
  currentPage.drawRectangle({
    x: margin,
    y: y - sigBoxHeight,
    width: contentWidth,
    height: sigBoxHeight,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 0.8,
    color: rgb(0.98, 0.98, 0.99)
  });

  // First party column
  currentPage.drawText('FIRST PARTY (STUDIO DIRECTOR)', { x: margin + 10, y: y - 14, size: 7.8, font: fontBold, color: rgb(0.7, 0.35, 0.05) });
  currentPage.drawText('CHIRANJIT KAR', { x: margin + 10, y: y - 28, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText('Lead Photographer & Studio Director', { x: margin + 10, y: y - 40, size: 7.2, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText('Chiranjit Kar Photography · New Delhi', { x: margin + 10, y: y - 50, size: 7.2, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText('[VERIFIED] Digital Studio Seal & Signature Applied', { x: margin + 10, y: y - 65, size: 7.2, font: fontBold, color: rgb(0.05, 0.5, 0.2) });

  // Second party column
  currentPage.drawText('SECOND PARTY (CLIENT / COLLABORATOR)', { x: margin + 265, y: y - 14, size: 7.8, font: fontBold, color: rgb(0.7, 0.35, 0.05) });
  currentPage.drawText('{{Collaborator Name}}', { x: margin + 265, y: y - 28, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText('Execution: UIDAI Aadhaar OTP Digital eSign', { x: margin + 265, y: y - 40, size: 7.2, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText('Platform: Leegality Document Execution Engine', { x: margin + 265, y: y - 50, size: 7.2, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  currentPage.drawText('e-Stamp Certificate: IN-DL22366535014840X', { x: margin + 265, y: y - 65, size: 7.2, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  y -= (sigBoxHeight + 10);

  // Add page numbers on all pages
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    page.drawLine({
      start: { x: margin, y: 38 },
      end: { x: pageWidth - margin, y: 38 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8)
    });
    page.drawText('Confidential · Universal Master Deed Executed under IT Act 2000 & Indian Stamp Act 1899', {
      x: margin,
      y: 26,
      size: 6.8,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4)
    });
    page.drawText(`Page ${i + 1} of ${totalPages}`, {
      x: pageWidth - margin - 50,
      y: 26,
      size: 6.8,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3)
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`Generated official Master Agreement PDF (${pdfBytes.length} bytes, ${totalPages} pages): ${outputPath}`);
}

createMasterAgreementPdf(process.argv[2] || 'Master_Photography_And_Creative_Production_Agreement.pdf').catch(console.error);
