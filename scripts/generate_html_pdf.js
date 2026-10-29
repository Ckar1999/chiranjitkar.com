const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function buildHtmlPdf(outputPath) {
  const assetsDir = path.join(__dirname, '../assets');
  const logoB64 = fs.readFileSync(path.join(assetsDir, 'camera_logo.png')).toString('base64');
  const sigB64 = fs.readFileSync(path.join(assetsDir, 'signature.png')).toString('base64');
  const sealB64 = fs.readFileSync(path.join(assetsDir, 'verified_seal.png')).toString('base64');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Master Photography & Creative Production Agreement</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Montserrat:wght@400;500;600;700&display=swap');

    @page {
      size: A4 portrait;
      margin: 14mm 14mm 14mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Lora', 'Georgia', serif;
      color: #1a1b1f;
      background: #ffffff;
      font-size: 9.8pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      page-break-after: always;
      break-after: page;
      position: relative;
    }

    .page:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    /* Double Luxury Gold Border */
    .border-frame {
      border: 1.2pt solid #1a1b1f;
      outline: 0.6pt solid #c9a44e;
      outline-offset: -3.5pt;
      padding: 16pt 20pt;
      height: 265mm;
      max-height: 265mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Running Header */
    .running-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 7pt;
      margin-bottom: 14pt;
      border-bottom: 0.75pt solid #c9a44e;
      font-family: 'Montserrat', sans-serif;
      font-size: 7.2pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #444;
    }

    .running-header-left {
      display: flex;
      align-items: center;
      gap: 7pt;
      font-weight: 700;
      color: #111;
    }

    .running-header-left img {
      height: 13pt;
      width: auto;
    }

    .running-header-right {
      color: #9e6b12;
      font-weight: 600;
    }

    /* Running Footer */
    .running-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 7pt;
      margin-top: 14pt;
      border-top: 0.6pt solid #dcd7ce;
      font-family: 'Montserrat', sans-serif;
      font-size: 6.8pt;
      color: #666;
    }

    .running-footer strong {
      color: #222;
    }

    /* Header Block */
    .studio-header {
      text-align: center;
      margin-bottom: 12pt;
    }

    .studio-logo {
      height: 34pt;
      width: auto;
      margin-bottom: 5pt;
    }

    .studio-title {
      font-family: 'Cinzel', serif;
      font-size: 15pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #0c0d12;
      text-transform: uppercase;
    }

    .studio-sub {
      font-family: 'Montserrat', sans-serif;
      font-size: 7pt;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #666;
      margin-top: 2pt;
    }

    .gold-divider {
      height: 1pt;
      background: linear-gradient(90deg, transparent, #c9a44e, transparent);
      margin: 8pt auto 10pt;
      width: 80%;
    }

    /* Official e-Stamp Box */
    .estamp-card {
      background: #faf8f4;
      border: 1pt solid #c9a44e;
      border-radius: 4pt;
      padding: 9pt 12pt;
      margin-bottom: 12pt;
    }

    .estamp-headline {
      font-family: 'Montserrat', sans-serif;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0c0d12;
    }

    .estamp-subhead {
      font-family: 'Montserrat', sans-serif;
      font-size: 7.2pt;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #9e6b12;
      margin-top: 1.5pt;
    }

    .estamp-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3pt 14pt;
      margin-top: 6pt;
      font-family: 'Montserrat', sans-serif;
      font-size: 6.9pt;
      color: #333;
      border-top: 0.5pt solid #e6dfd1;
      padding-top: 5pt;
    }

    .estamp-grid div strong {
      color: #111;
      font-weight: 600;
    }

    /* Deed Heading */
    .deed-title-block {
      text-align: center;
      margin-bottom: 10pt;
    }

    .deed-title {
      font-family: 'Cinzel', serif;
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #0c0d12;
      text-transform: uppercase;
    }

    .deed-badge {
      display: inline-block;
      font-family: 'Montserrat', sans-serif;
      font-size: 6.8pt;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #9e6b12;
      background: #fdf6e7;
      border: 0.6pt solid #e5c368;
      padding: 2pt 8pt;
      border-radius: 10pt;
      margin-top: 3pt;
    }

    .preamble {
      font-size: 8.8pt;
      line-height: 1.5;
      text-align: justify;
      color: #2a2b30;
      margin-bottom: 11pt;
    }

    /* Schedule Tables */
    .schedule-title {
      font-family: 'Cinzel', serif;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #0c0d12;
      margin-bottom: 4pt;
    }

    .schedule-box {
      border: 0.8pt solid #d6cfc2;
      border-radius: 3.5pt;
      background: #ffffff;
      padding: 7pt 10pt;
      margin-bottom: 10pt;
    }

    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Montserrat', sans-serif;
      font-size: 7.2pt;
      line-height: 1.45;
    }

    .schedule-table td {
      padding: 2.5pt 5pt;
      vertical-align: top;
    }

    .schedule-table td strong {
      color: #111;
      font-weight: 600;
    }

    .schedule-table .field-label {
      color: #555;
      width: 25%;
    }

    .schedule-table .field-val {
      color: #1a1a1a;
      width: 25%;
    }

    .sched-b-sec {
      font-family: 'Montserrat', sans-serif;
      font-size: 7.4pt;
      font-weight: 700;
      color: #0c0d12;
      margin-top: 3pt;
      margin-bottom: 2pt;
      letter-spacing: 0.04em;
    }

    .sched-b-text {
      font-family: 'Lora', serif;
      font-size: 7.6pt;
      line-height: 1.45;
      color: #2b2b2b;
      margin-left: 8pt;
      margin-bottom: 4pt;
    }

    /* Operative Articles */
    .section-banner {
      font-family: 'Cinzel', serif;
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0c0d12;
      border-bottom: 1pt solid #c9a44e;
      padding-bottom: 4pt;
      margin-bottom: 12pt;
    }

    .article {
      margin-bottom: 10.5pt;
      text-align: justify;
    }

    .article-num {
      font-family: 'Cinzel', serif;
      font-size: 8.8pt;
      font-weight: 700;
      color: #0c0d12;
      letter-spacing: 0.03em;
      margin-bottom: 2pt;
    }

    .article-body {
      font-size: 8.5pt;
      line-height: 1.5;
      color: #26272b;
    }

    /* Execution Block */
    .exec-box {
      border: 1pt solid #c9a44e;
      border-radius: 4pt;
      background: #faf8f5;
      padding: 12pt;
      margin-top: 10pt;
    }

    .exec-title {
      font-family: 'Cinzel', serif;
      font-size: 9.5pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #0c0d12;
      margin-bottom: 8pt;
      text-align: center;
    }

    .exec-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16pt;
      border-top: 0.6pt solid #e2dbcd;
      padding-top: 10pt;
    }

    .exec-col-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #9e6b12;
      margin-bottom: 2pt;
    }

    .exec-name {
      font-family: 'Lora', serif;
      font-size: 10.5pt;
      font-weight: 700;
      color: #111;
      margin-bottom: 2pt;
    }

    .exec-sub {
      font-family: 'Montserrat', sans-serif;
      font-size: 6.8pt;
      color: #555;
      margin-bottom: 6pt;
    }

    .sig-seal-wrap {
      display: flex;
      align-items: center;
      gap: 10pt;
      margin-top: 4pt;
      margin-bottom: 6pt;
    }

    .sig-img {
      height: 38pt;
      width: auto;
    }

    .seal-img {
      height: 42pt;
      width: auto;
    }

    .sig-status {
      font-family: 'Montserrat', sans-serif;
      font-size: 6.8pt;
      color: #1d7237;
      font-weight: 700;
    }

    .sig-status-sub {
      font-family: 'Montserrat', sans-serif;
      font-size: 6.2pt;
      color: #666;
    }

    .sign-line {
      border-bottom: 0.8pt dashed #888;
      height: 28pt;
      margin-top: 12pt;
      margin-bottom: 4pt;
    }

    .sign-prompt {
      font-family: 'Montserrat', sans-serif;
      font-size: 6.5pt;
      font-style: italic;
      color: #777;
    }
  </style>
</head>
<body>

  <!-- ================= PAGE 1 ================= -->
  <div class="page">
    <div class="border-frame">
      <div>
        <!-- Studio Brand Header -->
        <div class="studio-header">
          <img src="data:image/png;base64,${logoB64}" class="studio-logo" alt="Logo">
          <div class="studio-title">Chiranjit Kar Photography</div>
          <div class="studio-sub">New Delhi · Mumbai · Agartala | Official Production Deed</div>
          <div class="gold-divider"></div>
        </div>

        <!-- Official e-Stamp Certificate Box -->
        <div class="estamp-card">
          <div class="estamp-headline">Government of National Capital Territory of Delhi</div>
          <div class="estamp-subhead">Certificate of Stamp Duty · Non-Judicial e-Stamp (Article 5 Agreement)</div>
          <div class="estamp-grid">
            <div>Certificate No: <strong>IN-DL22366535014840X</strong></div>
            <div>Duty Amount: <strong>Rs. 100.00 (One Hundred only)</strong></div>
            <div>Unique Doc. Ref: <strong>SUBIN-DLDL75210370036032316761X</strong></div>
            <div>Account Ref: <strong>IMPACC (IV)/ dl752103/ DELHI/ DL-ESD</strong></div>
            <div>First Party: <strong>CHIRANJIT KAR</strong></div>
            <div>Second Party: <strong>CLIENT OR COLLABORATOR</strong></div>
            <div>Issue Date: <strong>29-Dec-2025</strong></div>
            <div>Verification: <strong>StockHolding (SHCIL) Verified · Not Locked</strong></div>
          </div>
        </div>

        <!-- Deed Title -->
        <div class="deed-title-block">
          <div class="deed-title">Master Photography &amp; Creative Production Agreement</div>
          <div class="deed-badge">Universal Deed Governing Both Paid Commissions &amp; Unpaid TFP Collaborations</div>
        </div>

        <p class="preamble">
          This Master Agreement ("Agreement") is executed between Chiranjit Kar ("Photographer"), Operating as Chiranjit Kar Photography, New Delhi, and the Second Party designated below ("Client" or "Collaborator"). This universal master deed operates dynamically across both Paid Commercial Commissions and Unpaid TFP Collaborations under the Indian Contract Act 1872 and Information Technology Act 2000.
        </p>

        <!-- Schedule A -->
        <div class="schedule-title">Schedule A: Engagement Specifications &amp; Parties</div>
        <div class="schedule-box">
          <table class="schedule-table">
            <tr>
              <td class="field-label">Contract Reference:</td>
              <td class="field-val"><strong>{{Contract ID}}</strong></td>
              <td class="field-label">Execution Date:</td>
              <td class="field-val"><strong>{{Date}}</strong></td>
            </tr>
            <tr>
              <td class="field-label">First Party (Studio):</td>
              <td class="field-val">Chiranjit Kar (Director)</td>
              <td class="field-label">Second Party:</td>
              <td class="field-val"><strong>{{Collaborator Name}}</strong></td>
            </tr>
            <tr>
              <td class="field-label">Official Studio Email:</td>
              <td class="field-val">iamchiranjitkar@hotmail.com</td>
              <td class="field-label">Client Contact:</td>
              <td class="field-val">{{Phone Number}} | {{Email ID}}</td>
            </tr>
            <tr>
              <td class="field-label">Production Venue:</td>
              <td class="field-val">{{Address}}</td>
              <td class="field-label">Classification:</td>
              <td class="field-val"><strong>[ ] Paid Commission &nbsp; [ ] Unpaid TFP</strong></td>
            </tr>
            <tr>
              <td class="field-label">Deliverable Scope:</td>
              <td class="field-val" colspan="3">{{Scope &amp; Package Details}}</td>
            </tr>
          </table>
        </div>

        <!-- Schedule B -->
        <div class="schedule-title">Schedule B: Consideration, Financial Terms &amp; Deliverables</div>
        <div class="schedule-box">
          <div class="sched-b-sec">B.1 PAID COMMERCIAL COMMISSION TERMS</div>
          <div class="sched-b-text">
            • Total Fee: <strong>{{Total Quotation}}</strong> | Strict 20% Non-refundable Advance: <strong>{{Advance Deposit}}</strong><br>
            • Strict 80% Post-Shoot Balance: <strong>{{Balance Due}}</strong> — Strictly payable upon shoot conclusion prior to delivery.
          </div>
          <div class="sched-b-sec">B.2 UNPAID / TFP CREATIVE COLLABORATION TERMS</div>
          <div class="sched-b-text">
            • Monetary Fee: <strong>Rs. 0.00 (Zero Monetary Consideration)</strong> | Mutual TFP portfolio exchange.<br>
            • Model Likeness Grant: Collaborator irrevocably grants Photographer perpetual worldwide likeness rights. RAW files strictly excluded.
          </div>
        </div>
      </div>

      <div class="running-footer">
        <div>Confidential · Master Photography Agreement Executed under IT Act 2000</div>
        <div>Page <strong>1 of 3</strong></div>
      </div>
    </div>
  </div>

  <!-- ================= PAGE 2 ================= -->
  <div class="page">
    <div class="border-frame">
      <div>
        <div class="running-header">
          <div class="running-header-left">
            <img src="data:image/png;base64,${logoB64}" alt="Logo">
            <span>Chiranjit Kar Photography · Master Creative Production Deed</span>
          </div>
          <div class="running-header-right">Govt e-Stamp: IN-DL22366535014840X</div>
        </div>

        <div class="section-banner">Operative Legal Provisions &amp; Production Governance</div>

        <div class="article">
          <div class="article-num">1. Nature of Collaboration &amp; Master Scope</div>
          <div class="article-body">
            1.1 This Master Agreement governs all creative engagements between Photographer and Client/Collaborator. 1.2 For unpaid collaborations, participation is voluntary for mutual artistic exposure and portfolio building; zero monetary fee is owed by either Party. 1.3 For paid commissions, services and commercial deliverables are strictly governed by Schedule A and Schedule B.
          </div>
        </div>

        <div class="article">
          <div class="article-num">2. Project Scope &amp; Sole Creative Authority</div>
          <div class="article-body">
            2.1 Shoot concept, mood, theme, location, and tentative deliverables shall be agreed prior to the shoot. 2.2 Final Creative Control: Absolute artistic control over lighting, camera angles, poses, styling, grading, and final selection rests solely with the Photographer.
          </div>
        </div>

        <div class="article">
          <div class="article-num">3. Financial Claims &amp; Strict Payment Framework</div>
          <div class="article-body">
            3.1 For Unpaid Collaborations, Collaborator irrevocably agrees not to demand payment, royalty, revenue share, or compensation now or in the future; portfolio images constitute complete and final consideration. Any future commercial licensing by external brands shall be negotiated exclusively through the Photographer. 3.2 For Paid Commissions, retouching begins only after 100% full balance clearance.
          </div>
        </div>

        <div class="article">
          <div class="article-num">4. Image Delivery &amp; Strict No-RAW Policy</div>
          <div class="article-body">
            4.1 Unedited RAW camera files and digital negatives are proprietary confidential trade assets and will NEVER be released, sold, or provided under any circumstances. 4.2 Photographer delivers a curated set of finished master retouched JPEGs. Proofs are delivered within 48-72 hours; retouched deliverables require 1-2 months based on studio post-production queue.
          </div>
        </div>

        <div class="article">
          <div class="article-num">5. Ownership, Statutory Copyright &amp; Rights</div>
          <div class="article-body">
            5.1 Under Section 17 of the Indian Copyright Act 1957, all photographs and videos remain the exclusive intellectual property of Chiranjit Kar. 5.2 Collaborator grants Photographer perpetual, irrevocable, worldwide rights to use, publish, exhibit, modify, and license images in any medium. 5.3 Collaborator may use delivered images solely for personal portfolio and social media, and shall not sell, license, or commercially exploit images.
          </div>
        </div>

        <div class="article">
          <div class="article-num">6. Mandatory Social Media Attribution</div>
          <div class="article-body">
            6.1 Whenever images are posted publicly or on social media by Client/Collaborator, credit must be prominently given as: <strong>Photo: @iamchiranjitkar (Chiranjit Kar Photography)</strong>. 6.2 Removal of watermark, cropping credits, or altering color grading with third-party filters is strictly prohibited.
          </div>
        </div>

        <div class="article">
          <div class="article-num">7. Image Use Restrictions</div>
          <div class="article-body">
            7.1 Collaborator/Client shall NOT use images for: (a) Pornographic or adult platforms, (b) Political campaigns, (c) Misleading or deceptive advertisements, (d) NFT minting or web3 tokens, (e) Stock photography websites or automated AI model scraping.
          </div>
        </div>
      </div>

      <div class="running-footer">
        <div>Confidential · Master Photography Agreement Executed under IT Act 2000</div>
        <div>Page <strong>2 of 3</strong></div>
      </div>
    </div>
  </div>

  <!-- ================= PAGE 3 ================= -->
  <div class="page">
    <div class="border-frame">
      <div>
        <div class="running-header">
          <div class="running-header-left">
            <img src="data:image/png;base64,${logoB64}" alt="Logo">
            <span>Chiranjit Kar Photography · Master Creative Production Deed</span>
          </div>
          <div class="running-header-right">Govt e-Stamp: IN-DL22366535014840X</div>
        </div>

        <div class="section-banner">Governance, Written Policy &amp; Execution</div>

        <div class="article">
          <div class="article-num">8. Strict Written Communication Policy (Critical)</div>
          <div class="article-body">
            8.1 Only written communication via email to <strong>iamchiranjitkar@hotmail.com</strong> shall be considered legally valid and binding. 8.2 Any discussion via WhatsApp, phone calls, social media DMs, or verbal conversation shall have zero legal validity unless expressly confirmed in writing via email.
          </div>
        </div>

        <div class="article">
          <div class="article-num">9. Confidentiality, Set Safety &amp; Chaperone Policy</div>
          <div class="article-body">
            9.1 All creative concepts, unreleased proofs, and business arrangements remain strictly confidential. 9.2 Chaperone Right: Client/Collaborator is fully entitled to bring one designated companion or chaperone to the production set. 9.3 Inappropriate or unsafe behavior warrants immediate termination without refund.
          </div>
        </div>

        <div class="article">
          <div class="article-num">10. Cancellations &amp; 48-Hour Rescheduling Policy</div>
          <div class="article-body">
            10.1 The 20% advance booking deposit is non-refundable under all circumstances. 10.2 Rescheduling requires at least 48 hours prior notice in writing via email; requests made within 48 hours forfeit the booking deposit.
          </div>
        </div>

        <div class="article">
          <div class="article-num">11. Limitation of Liability &amp; Indemnity</div>
          <div class="article-body">
            11.1 Photographer shall not be liable for any indirect loss, injury, or force majeure events; liability is strictly capped at net fees received. 11.2 Collaborator agrees to indemnify and hold harmless the Photographer against all claims arising from misuse of images or breach of this deed.
          </div>
        </div>

        <div class="article">
          <div class="article-num">12. Digital Execution via Leegality &amp; IT Act 2000</div>
          <div class="article-body">
            12.1 Execution via UIDAI Aadhaar OTP through Leegality is legally binding and admissible under Section 10A of the Information Technology Act 2000 and Indian Evidence Act. 12.2 The Rs. 99 UIDAI documentation fee is payable separately by the user before digital execution.
          </div>
        </div>

        <div class="article">
          <div class="article-num">13. Governing Law &amp; Exclusive Jurisdiction</div>
          <div class="article-body">
            13.1 This Agreement is governed by the laws of India. 13.2 Courts in New Delhi, National Capital Territory of Delhi, shall have sole and exclusive territorial jurisdiction over any disputes.
          </div>
        </div>

        <div class="article">
          <div class="article-num">14. Entire Agreement &amp; Non-Modification</div>
          <div class="article-body">
            14.1 This Agreement constitutes the complete understanding between Parties and supersedes all prior discussions. Any modification must be in writing and digitally executed.
          </div>
        </div>

        <!-- Execution Block -->
        <div class="exec-box">
          <div class="exec-title">Execution, Digital Seals &amp; UIDAI Aadhaar Authentication</div>
          <div class="exec-grid">
            <!-- First Party -->
            <div>
              <div class="exec-col-title">First Party (Photographer / Studio Director)</div>
              <div class="exec-name">CHIRANJIT KAR</div>
              <div class="exec-sub">Lead Photographer · Studio Director · Chiranjit Kar Photography</div>
              
              <div class="sig-seal-wrap">
                <img src="data:image/png;base64,${sigB64}" class="sig-img" alt="Chiranjit Kar Signature">
                <img src="data:image/png;base64,${sealB64}" class="seal-img" alt="Verified Agreement Seal">
              </div>

              <div class="sig-status">✓ Digital Studio Seal &amp; Signature Applied</div>
              <div class="sig-status-sub">Delhi NCT e-Stamp: IN-DL22366535014840X · SHCIL Base Verified</div>
            </div>

            <!-- Second Party -->
            <div>
              <div class="exec-col-title">Second Party (Client / Collaborator)</div>
              <div class="exec-name">{{Collaborator Name}}</div>
              <div class="exec-sub">Execution: UIDAI Aadhaar OTP Digital eSign via Leegality</div>
              <div class="exec-sub" style="color:#9e6b12; font-weight:600;">Admissible under Section 10A Information Technology Act 2000</div>

              <div class="sign-line"></div>
              <div class="sign-prompt">Second Party Signature / Aadhaar OTP Stamp Placement</div>
              <div class="exec-sub" style="margin-top:4pt;">Date: <strong>{{Date}}</strong> | Place: <strong>New Delhi, India</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div class="running-footer">
        <div>Confidential · Master Photography Agreement Executed under IT Act 2000</div>
        <div>Page <strong>3 of 3</strong></div>
      </div>
    </div>
  </div>

</body>
</html>`;

  const tmpHtmlPath = '/tmp/master_agreement_render.html';
  fs.writeFileSync(tmpHtmlPath, html);

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const cmd = `"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPath}" "file://${tmpHtmlPath}"`;
  console.log('Rendering luxury PDF with Chrome headless engine...');
  execSync(cmd);
  console.log(`Generated luxury Master Agreement PDF successfully: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
}

buildHtmlPdf(process.argv[2] || path.join(__dirname, '../Master_Photography_And_Creative_Production_Agreement.pdf'));
