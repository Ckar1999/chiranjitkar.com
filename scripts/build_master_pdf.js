const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createMasterAgreementPdf(outputPath) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Embed assets
  const logoPath = path.join(__dirname, '../assets/camera_logo.png');
  const sigPath = path.join(__dirname, '../assets/signature.png');
  const sealPath = path.join(__dirname, '../assets/verified_seal.png');

  let logoImg = null, sigImg = null, sealImg = null;
  if (fs.existsSync(logoPath)) logoImg = await pdfDoc.embedPng(fs.readFileSync(logoPath));
  if (fs.existsSync(sigPath)) sigImg = await pdfDoc.embedPng(fs.readFileSync(sigPath));
  if (fs.existsSync(sealPath)) sealImg = await pdfDoc.embedPng(fs.readFileSync(sealPath));

  // A4 dimensions: 595.28 x 841.89 points
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const contentWidth = pageWidth - (margin * 2);

  let currentPage = null;
  let y = 0;
  let pageNum = 0;

  function newPage() {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pageNum++;
    y = pageHeight - margin;

    // Running Header (pages 2+) with ample breathing room
    if (pageNum > 1) {
      if (logoImg) {
        currentPage.drawImage(logoImg, {
          x: margin,
          y: pageHeight - 34,
          width: 20,
          height: 13
        });
      }
      currentPage.drawText('CHIRANJIT KAR PHOTOGRAPHY  |  MASTER CREATIVE PRODUCTION DEED', {
        x: margin + 28,
        y: pageHeight - 28,
        size: 7.2,
        font: fontBold,
        color: rgb(0.18, 0.2, 0.24)
      });
      currentPage.drawText('GOVT E-STAMP: IN-DL22366535014840X', {
        x: pageWidth - margin - 170,
        y: pageHeight - 28,
        size: 7.2,
        font: fontBold,
        color: rgb(0.68, 0.4, 0.08)
      });
      currentPage.drawLine({
        start: { x: margin, y: pageHeight - 38 },
        end: { x: pageWidth - margin, y: pageHeight - 38 },
        thickness: 0.6,
        color: rgb(0.82, 0.76, 0.65)
      });
      // 24pt breathing space below running header line
      y = pageHeight - 64;
    }
  }

  function checkPageBreak(neededHeight) {
    if (y - neededHeight < 56) {
      newPage();
    }
  }

  function drawParagraph(text, font, size, leading, color = rgb(0.15, 0.16, 0.18), indent = 0) {
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

  // ==========================================
  // PAGE 1: COVER DEED, E-STAMP & SCHEDULES
  // ==========================================
  newPage();

  // 1. Studio Logo & Brand Header
  if (logoImg) {
    currentPage.drawImage(logoImg, {
      x: margin + (contentWidth / 2) - 25,
      y: y - 32,
      width: 50,
      height: 32.5
    });
  }
  y -= 44;

  const titleText = 'CHIRANJIT KAR PHOTOGRAPHY';
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 16);
  currentPage.drawText(titleText, {
    x: margin + (contentWidth - titleWidth) / 2,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 14;

  const subText = 'NEW DELHI · MUMBAI · AGARTALA  |  OFFICIAL CONTRACTUAL DEED';
  const subWidth = fontRegular.widthOfTextAtSize(subText, 7.5);
  currentPage.drawText(subText, {
    x: margin + (contentWidth - subWidth) / 2,
    y,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.42, 0.44, 0.48)
  });
  y -= 12;

  currentPage.drawLine({
    start: { x: margin + 40, y },
    end: { x: pageWidth - margin - 40, y },
    thickness: 0.8,
    color: rgb(0.78, 0.65, 0.35)
  });
  y -= 16;

  // 2. Official Govt NCT of Delhi e-Stamp Certificate Box
  const stampBoxHeight = 74;
  currentPage.drawRectangle({
    x: margin,
    y: y - stampBoxHeight,
    width: contentWidth,
    height: stampBoxHeight,
    borderColor: rgb(0.78, 0.65, 0.35),
    borderWidth: 1.0,
    color: rgb(0.98, 0.97, 0.95)
  });

  currentPage.drawText('GOVERNMENT OF NATIONAL CAPITAL TERRITORY OF DELHI', {
    x: margin + 12,
    y: y - 16,
    size: 8.5,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  currentPage.drawText('CERTIFICATE OF STAMP DUTY · NON-JUDICIAL E-STAMP (ARTICLE 5 GENERAL AGREEMENT)', {
    x: margin + 12,
    y: y - 29,
    size: 7.8,
    font: fontBold,
    color: rgb(0.68, 0.4, 0.08)
  });
  currentPage.drawText('Certificate No: IN-DL22366535014840X  |  Unique Doc Ref: SUBIN-DLDL75210370036032316761X  |  Duty: Rs. 100.00', {
    x: margin + 12,
    y: y - 42,
    size: 7.2,
    font: fontRegular,
    color: rgb(0.2, 0.22, 0.25)
  });
  currentPage.drawText('First Party: CHIRANJIT KAR  |  Second Party: CLIENT OR COLLABORATOR  |  Consideration Price: Rs. 0 (Zero)', {
    x: margin + 12,
    y: y - 54,
    size: 7.2,
    font: fontRegular,
    color: rgb(0.2, 0.22, 0.25)
  });
  currentPage.drawText('Account Ref: IMPACC (IV)/ dl752103/ DELHI/ DL-ESD  |  Issued: 29-Dec-2025  |  StockHolding (SHCIL) Verified', {
    x: margin + 12,
    y: y - 65,
    size: 6.8,
    font: fontOblique,
    color: rgb(0.4, 0.42, 0.46)
  });

  y -= (stampBoxHeight + 16);

  // 3. Deed Title & Preamble
  currentPage.drawText('MASTER PHOTOGRAPHY & CREATIVE PRODUCTION AGREEMENT', {
    x: margin,
    y,
    size: 12.5,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 13;
  currentPage.drawText('UNIVERSAL DEED GOVERNING BOTH PAID COMMISSIONS & UNPAID TFP COLLABORATIONS', {
    x: margin,
    y,
    size: 7.6,
    font: fontBold,
    color: rgb(0.68, 0.4, 0.08)
  });
  y -= 14;

  drawParagraph(
    'This Master Agreement is executed between Chiranjit Kar ("Photographer"), operating under the brand Chiranjit Kar Photography, New Delhi, and the Second Party designated below ("Client" or "Collaborator"). This universal deed operates dynamically across both Paid Commercial Commissions and Unpaid TFP Collaborations under the Indian Contract Act 1872 and Information Technology Act 2000.',
    fontRegular, 8.2, 12.5
  );
  y -= 12;

  // 4. Schedule A: Engagement Specifications & Parties
  currentPage.drawText('SCHEDULE A: ENGAGEMENT SPECIFICATIONS & PARTIES', {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 10;

  const schedAHeight = 84;
  currentPage.drawRectangle({
    x: margin,
    y: y - schedAHeight,
    width: contentWidth,
    height: schedAHeight,
    borderColor: rgb(0.78, 0.65, 0.35),
    borderWidth: 0.8,
    color: rgb(0.99, 0.99, 0.99)
  });

  const col2X = margin + (contentWidth / 2) + 8;
  currentPage.drawText('Contract Reference: {{Contract ID}}', { x: margin + 10, y: y - 16, size: 7.8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText('First Party: Chiranjit Kar (Studio Director)', { x: margin + 10, y: y - 30, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('Official Email: iamchiranjitkar@hotmail.com', { x: margin + 10, y: y - 44, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('Production Venue: {{Address}}', { x: margin + 10, y: y - 58, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('UIDAI eSign Doc Fee: Rs. 99.00 (Separate Payment)', { x: margin + 10, y: y - 72, size: 7.5, font: fontBold, color: rgb(0.68, 0.4, 0.08) });

  currentPage.drawText('Execution Date: {{Date}}', { x: col2X, y: y - 16, size: 7.8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText('Second Party: {{Collaborator Name}}', { x: col2X, y: y - 30, size: 7.8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText('Phone: {{Phone Number}}  |  Email: {{Email ID}}', { x: col2X, y: y - 44, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('Project Classification:', { x: col2X, y: y - 58, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  currentPage.drawText('[ ] Paid Commercial Commission   [ ] Unpaid TFP Collaboration', { x: col2X, y: y - 72, size: 7.5, font: fontBold, color: rgb(0.68, 0.4, 0.08) });

  y -= (schedAHeight + 14);

  // 5. Schedule B: Consideration & Deliverables
  currentPage.drawText('SCHEDULE B: CONSIDERATION, FINANCIAL TERMS & DELIVERABLES', {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 10;

  const schedBHeight = 74;
  currentPage.drawRectangle({
    x: margin,
    y: y - schedBHeight,
    width: contentWidth,
    height: schedBHeight,
    borderColor: rgb(0.78, 0.65, 0.35),
    borderWidth: 0.8,
    color: rgb(0.99, 0.99, 0.99)
  });

  currentPage.drawText('B.1 PAID COMMERCIAL COMMISSION TERMS', { x: margin + 10, y: y - 15, size: 8, font: fontBold, color: rgb(0.08, 0.1, 0.15) });
  currentPage.drawText('• Total Fee: {{Total Quotation}}  |  Strict 20% Non-refundable Advance: {{Advance Deposit}}', { x: margin + 14, y: y - 27, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  currentPage.drawText('• Strict 80% Post-Shoot Balance: {{Balance Due}} — Strictly payable upon shoot conclusion prior to delivery.', { x: margin + 14, y: y - 39, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  currentPage.drawText('B.2 UNPAID / TFP CREATIVE COLLABORATION TERMS', { x: margin + 10, y: y - 53, size: 8, font: fontBold, color: rgb(0.08, 0.1, 0.15) });
  currentPage.drawText('• Monetary Fee: Rs. 0.00 (Zero Consideration)  |  Mutual TFP portfolio exchange  |  RAW files strictly excluded.', { x: margin + 14, y: y - 64, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  y -= (schedBHeight + 14);


  // ==========================================
  // PAGE 2: OPERATIVE ARTICLES 1 TO 7
  // ==========================================
  newPage();

  currentPage.drawText('OPERATIVE LEGAL PROVISIONS & PRODUCTION GOVERNANCE', {
    x: margin,
    y,
    size: 10.5,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 16;

  const articlesP2 = [
    {
      num: '1. Nature of Collaboration & Master Scope',
      text: '1.1 This Master Agreement governs all creative engagements between Photographer and Client/Collaborator. 1.2 For unpaid collaborations, participation is voluntary for mutual artistic exposure and portfolio building; zero monetary fee is owed by either Party. 1.3 For paid commissions, services and commercial deliverables are strictly governed by Schedule A and Schedule B.'
    },
    {
      num: '2. Project Scope & Sole Creative Authority',
      text: '2.1 Shoot concept, mood, theme, location, and tentative deliverables shall be agreed prior to the shoot. 2.2 Final Creative Control: Absolute artistic control over lighting, camera angles, poses, styling, grading, and final selection rests solely with the Photographer.'
    },
    {
      num: '3. Financial Claims & Payment Structure',
      text: '3.1 For Unpaid Collaborations, Collaborator irrevocably agrees not to demand payment, royalty, revenue share, or compensation now or in the future; portfolio images constitute complete and final consideration. Any future commercial licensing by external brands shall be negotiated exclusively through the Photographer. 3.2 For Paid Commissions, retouching begins only after 100% full balance clearance.'
    },
    {
      num: '4. Image Delivery & Strict No-RAW Policy',
      text: '4.1 Unedited RAW camera files and digital negatives are proprietary confidential trade assets and will NEVER be released, sold, or provided under any circumstances. 4.2 Photographer delivers a curated set of finished master retouched JPEGs. Proofs are delivered within 48-72 hours; retouched deliverables require 1-2 months based on studio post-production queue.'
    },
    {
      num: '5. Ownership, Statutory Copyright & Rights',
      text: '5.1 Under Section 17 of the Indian Copyright Act 1957, all photographs and videos remain the exclusive intellectual property of Chiranjit Kar. 5.2 Collaborator grants Photographer perpetual, irrevocable, worldwide rights to use, publish, exhibit, modify, and license images in any medium. 5.3 Collaborator may use delivered images solely for personal portfolio and social media, and shall not sell, license, or commercially exploit images.'
    },
    {
      num: '6. Mandatory Social Media Attribution',
      text: '6.1 Whenever images are posted publicly or on social media by Client/Collaborator, credit must be prominently given as: Photo: @iamchiranjitkar (Chiranjit Kar Photography). 6.2 Removal of watermark, cropping credits, or altering color grading with third-party filters is strictly prohibited.'
    },
    {
      num: '7. Image Use Restrictions',
      text: '7.1 Collaborator/Client shall NOT use images for: (a) Pornographic or adult platforms, (b) Political campaigns, (c) Misleading or deceptive advertisements, (d) NFT minting or web3 tokens, (e) Stock photography websites or automated AI model scraping.'
    }
  ];

  for (const art of articlesP2) {
    currentPage.drawText(art.num, {
      x: margin,
      y,
      size: 8.5,
      font: fontBold,
      color: rgb(0.08, 0.1, 0.15)
    });
    y -= 12;
    drawParagraph(art.text, fontRegular, 7.8, 11.8, rgb(0.18, 0.18, 0.2));
    y -= 8;
  }


  // ==========================================
  // PAGE 3: ARTICLES 8 TO 14 & EXECUTION
  // ==========================================
  newPage();

  currentPage.drawText('GOVERNANCE, COMMUNICATION & DIGITAL EXECUTION', {
    x: margin,
    y,
    size: 10.5,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 16;

  const articlesP3 = [
    {
      num: '8. Strict Written Communication Policy (Critical)',
      text: '8.1 Only written communication via email to iamchiranjitkar@hotmail.com shall be considered legally valid and binding. 8.2 Any discussion via WhatsApp, phone calls, social media DMs, or verbal conversation shall have zero legal validity unless expressly confirmed in writing via email.'
    },
    {
      num: '9. Confidentiality, Set Safety & Chaperone Policy',
      text: '9.1 All creative concepts, unreleased proofs, and business arrangements remain strictly confidential. 9.2 Chaperone Right: Client/Collaborator is fully entitled to bring one designated companion or chaperone to the production set. 9.3 Inappropriate or unsafe behavior warrants immediate termination without refund.'
    },
    {
      num: '10. Cancellations & 48-Hour Rescheduling Policy',
      text: '10.1 The 20% advance booking deposit is non-refundable under all circumstances. 10.2 Rescheduling requires at least 48 hours prior notice in writing via email; requests made within 48 hours forfeit the booking deposit.'
    },
    {
      num: '11. Limitation of Liability & Indemnity',
      text: '11.1 Photographer shall not be liable for any indirect loss, injury, or force majeure events; liability is strictly capped at net fees received. 11.2 Collaborator agrees to indemnify and hold harmless the Photographer against all claims arising from misuse of images or breach of this deed.'
    },
    {
      num: '12. Digital Execution via Leegality & IT Act 2000',
      text: '12.1 Execution via UIDAI Aadhaar OTP through Leegality is legally binding and admissible under Section 10A of the Information Technology Act 2000 and Indian Evidence Act. 12.2 The Rs. 99 UIDAI documentation fee is payable separately by the user before digital execution.'
    },
    {
      num: '13. Governing Law & Exclusive Jurisdiction',
      text: '13.1 This Agreement is governed by the laws of India. 13.2 Courts in New Delhi, National Capital Territory of Delhi, shall have sole and exclusive territorial jurisdiction.'
    },
    {
      num: '14. Entire Agreement & Non-Modification',
      text: '14.1 This Agreement constitutes the complete understanding between Parties and supersedes all prior discussions. Any modification must be in writing and digitally executed.'
    }
  ];

  for (const art of articlesP3) {
    currentPage.drawText(art.num, {
      x: margin,
      y,
      size: 8.5,
      font: fontBold,
      color: rgb(0.08, 0.1, 0.15)
    });
    y -= 12;
    drawParagraph(art.text, fontRegular, 7.8, 11.8, rgb(0.18, 0.18, 0.2));
    y -= 7;
  }

  y -= 8;

  // Execution & Signature Block
  currentPage.drawText('EXECUTION, DIGITAL SEALS & UIDAI AADHAAR AUTHENTICATION', {
    x: margin,
    y,
    size: 9.5,
    font: fontBold,
    color: rgb(0.08, 0.1, 0.15)
  });
  y -= 12;

  const sigBoxHeight = 110;
  currentPage.drawRectangle({
    x: margin,
    y: y - sigBoxHeight,
    width: contentWidth,
    height: sigBoxHeight,
    borderColor: rgb(0.78, 0.65, 0.35),
    borderWidth: 1.0,
    color: rgb(0.99, 0.99, 0.99)
  });

  const halfWidth = contentWidth / 2;

  // Vertical divider between parties
  currentPage.drawLine({
    start: { x: margin + halfWidth, y },
    end: { x: margin + halfWidth, y: y - sigBoxHeight },
    thickness: 0.6,
    color: rgb(0.85, 0.8, 0.75)
  });

  // FIRST PARTY (Photographer)
  currentPage.drawText('FIRST PARTY (PHOTOGRAPHER / STUDIO DIRECTOR)', {
    x: margin + 12,
    y: y - 16,
    size: 7.8,
    font: fontBold,
    color: rgb(0.68, 0.4, 0.08)
  });
  currentPage.drawText('CHIRANJIT KAR', {
    x: margin + 12,
    y: y - 29,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  currentPage.drawText('Lead Photographer · Studio Director · Chiranjit Kar Photography', {
    x: margin + 12,
    y: y - 41,
    size: 7.2,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.4)
  });

  // Embed authentic handwritten signature & circular verified seal!
  if (sigImg) {
    currentPage.drawImage(sigImg, {
      x: margin + 10,
      y: y - 96,
      width: 68,
      height: 48
    });
  }
  if (sealImg) {
    currentPage.drawImage(sealImg, {
      x: margin + 84,
      y: y - 100,
      width: 54,
      height: 53
    });
  }

  currentPage.drawText('Signature & Seal Applied', {
    x: margin + 144,
    y: y - 66,
    size: 7,
    font: fontBold,
    color: rgb(0.1, 0.45, 0.2)
  });
  currentPage.drawText('e-Stamp Certificate:', {
    x: margin + 144,
    y: y - 76,
    size: 6.5,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4)
  });
  currentPage.drawText('IN-DL22366535014840X', {
    x: margin + 144,
    y: y - 86,
    size: 6.7,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.18)
  });
  currentPage.drawText('SHCIL Base Verified', {
    x: margin + 144,
    y: y - 96,
    size: 6.2,
    font: fontOblique,
    color: rgb(0.45, 0.45, 0.5)
  });

  // SECOND PARTY (Client / Collaborator)
  const party2X = margin + halfWidth + 14;
  currentPage.drawText('SECOND PARTY (CLIENT / COLLABORATOR)', {
    x: party2X,
    y: y - 16,
    size: 7.8,
    font: fontBold,
    color: rgb(0.68, 0.4, 0.08)
  });
  currentPage.drawText('{{Collaborator Name}}', {
    x: party2X,
    y: y - 29,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  currentPage.drawText('Digital Execution: UIDAI Aadhaar OTP eSign via Leegality', {
    x: party2X,
    y: y - 41,
    size: 7.2,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.4)
  });
  currentPage.drawText('Legal Admissibility: Section 10A IT Act 2000', {
    x: party2X,
    y: y - 52,
    size: 6.8,
    font: fontOblique,
    color: rgb(0.4, 0.4, 0.45)
  });

  // Second Party signature dotted line / Aadhaar placeholder
  currentPage.drawLine({
    start: { x: party2X, y: y - 80 },
    end: { x: margin + contentWidth - 14, y: y - 80 },
    thickness: 0.8,
    color: rgb(0.7, 0.7, 0.7)
  });
  currentPage.drawText('Second Party Signature / Aadhaar OTP Stamp', {
    x: party2X,
    y: y - 92,
    size: 6.8,
    font: fontOblique,
    color: rgb(0.5, 0.5, 0.5)
  });
  currentPage.drawText('Date: {{Date}}  |  Place: New Delhi', {
    x: party2X,
    y: y - 102,
    size: 6.8,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3)
  });


  // Add clean page numbers and footers across all pages
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    page.drawLine({
      start: { x: margin, y: 38 },
      end: { x: pageWidth - margin, y: 38 },
      thickness: 0.5,
      color: rgb(0.82, 0.76, 0.65)
    });
    page.drawText('Confidential  ·  Master Photography Agreement Executed under IT Act 2000 & Indian Stamp Act 1899', {
      x: margin,
      y: 26,
      size: 6.8,
      font: fontRegular,
      color: rgb(0.45, 0.45, 0.48)
    });
    page.drawText(`Page ${i + 1} of ${totalPages}`, {
      x: pageWidth - margin - 50,
      y: 26,
      size: 7.2,
      font: fontBold,
      color: rgb(0.25, 0.25, 0.28)
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`Generated luxury Master Agreement PDF (${pdfBytes.length} bytes, ${totalPages} pages): ${outputPath}`);
}

createMasterAgreementPdf(process.argv[2] || 'Master_Photography_And_Creative_Production_Agreement.pdf').catch(console.error);
