const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function buildHtmlPdf(outputPath) {
  const assetsDir = path.join(__dirname, '../assets');
  const logoB64 = fs.readFileSync(path.join(assetsDir, 'camera_logo.png')).toString('base64');
  const sigB64 = fs.readFileSync(path.join(assetsDir, 'signature.png')).toString('base64');
  const sealB64 = fs.readFileSync(path.join(assetsDir, 'verified_seal.png')).toString('base64');
  const flourishB64 = fs.readFileSync(path.join(assetsDir, 'estamp_flourish.png')).toString('base64');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Master Photography & Creative Production Agreement</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Montserrat:wght@400;500;600;700&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
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
      font-size: 9.5pt;
      line-height: 1.56;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      page-break-after: always;
      break-after: page;
      height: 270mm;
      max-height: 270mm;
      overflow: hidden;
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
      height: 100%;
      min-height: 268mm;
      max-height: 268mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }

    /* Running Header */
    .running-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 0.8pt solid #c9a44e;
      padding-bottom: 5pt;
      margin-bottom: 11pt;
    }

    .running-header-left {
      display: flex;
      align-items: center;
      gap: 7pt;
      font-family: 'Cinzel', serif;
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0c0d12;
    }

    .running-header-left img {
      width: 14pt;
      height: 14pt;
      object-fit: contain;
    }

    .running-header-right {
      font-family: 'Montserrat', sans-serif;
      font-size: 7.2pt;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: #8c733e;
    }

    /* Running Footer */
    .running-footer {
      border-top: 0.8pt solid #c9a44e;
      padding-top: 5pt;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Montserrat', sans-serif;
      font-size: 6.8pt;
      color: #666666;
      margin-top: 6pt;
    }

    .running-footer strong {
      color: #0c0d12;
      font-weight: 600;
    }

    /* Studio Header - Page 1 */
    .studio-header {
      text-align: center;
      margin-bottom: 6pt;
    }

    .studio-logo {
      width: 36pt;
      height: 36pt;
      object-fit: contain;
      margin-bottom: 3pt;
    }

    .studio-title {
      font-family: 'Cinzel', serif;
      font-size: 13.5pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #0c0d12;
    }

    .studio-sub {
      font-family: 'Montserrat', sans-serif;
      font-size: 7pt;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #555;
      margin-top: 2pt;
    }

    .gold-divider {
      height: 1pt;
      background: linear-gradient(90deg, transparent, #c9a44e, #c9a44e, transparent);
      margin: 6pt auto 8pt;
      width: 75%;
    }

    /* Official e-Stamp Certificate Box */
    .estamp-card {
      background: #faf8f4;
      border: 1pt solid #c9a44e;
      border-radius: 3.5pt;
      padding: 5pt 9pt 4pt;
      margin-bottom: 8pt;
      text-align: center;
    }

    .estamp-flourish {
      width: 240px;
      height: auto;
      margin: 0 auto;
      display: block;
      opacity: 0.95;
    }

    .estamp-title-center {
      font-family: 'Cinzel', serif;
      font-size: 8.6pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #0c0d12;
      margin-top: 1pt;
    }

    .estamp-subtitle-center {
      font-family: 'Montserrat', sans-serif;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9e6b12;
      margin-bottom: 2pt;
    }

    .estamp-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Montserrat', sans-serif;
      font-size: 6.6pt;
      line-height: 1.38;
      text-align: left;
      margin: 1pt 0;
    }

    .estamp-table td {
      padding: 1pt 2pt;
      vertical-align: top;
    }

    .est-lbl {
      color: #555555;
      width: 22%;
      white-space: nowrap;
    }

    .est-sep {
      color: #888888;
      width: 2%;
      text-align: center;
    }

    .est-val {
      color: #1a1b1f;
      width: 26%;
      word-break: break-word;
    }

    .est-val strong {
      color: #0c0d12;
      font-weight: 600;
    }

    .estamp-footer-notice {
      font-family: 'Montserrat', sans-serif;
      font-size: 6pt;
      color: #666;
      letter-spacing: 0.02em;
      margin-top: 2pt;
      border-top: 0.5pt solid #eae3d2;
      padding-top: 2pt;
    }

    /* Deed Heading */
    .deed-title-block {
      text-align: center;
      margin-bottom: 7pt;
    }

    .deed-title {
      font-family: 'Cinzel', serif;
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #0c0d12;
      text-transform: uppercase;
    }

    .deed-badge {
      display: inline-block;
      font-family: 'Montserrat', sans-serif;
      font-size: 6.6pt;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #9e6b12;
      background: #fcf6ea;
      border: 0.6pt solid #e5c368;
      padding: 2pt 8pt;
      border-radius: 10pt;
      margin-top: 2.5pt;
    }

    .preamble {
      font-size: 8.8pt;
      line-height: 1.52;
      text-align: justify;
      color: #24252a;
      margin-bottom: 8pt;
    }

    /* Schedules */
    .schedule-title {
      font-family: 'Cinzel', serif;
      font-size: 8.8pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #0c0d12;
      margin-bottom: 3.5pt;
    }

    .schedule-box {
      border: 0.8pt solid #d6cfc2;
      border-radius: 3.5pt;
      background: #ffffff;
      padding: 6pt 9pt;
      margin-bottom: 7pt;
    }

    .schedule-table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Montserrat', sans-serif;
      font-size: 7.2pt;
      line-height: 1.48;
    }

    .schedule-table td {
      padding: 2.2pt 4pt;
      vertical-align: middle;
    }

    .schedule-table .field-label {
      color: #555;
      width: 25%;
    }

    .schedule-table .field-val {
      color: #1a1a1a;
      width: 25%;
      border-bottom: 0.5pt solid #e0d8cc;
      min-height: 12pt;
    }

    .field-slot {
      display: inline-block;
      width: 100%;
      min-height: 12pt;
    }

    .second-party-name-slot {
      display: inline-block;
      min-width: 160pt;
      min-height: 13pt;
      border-bottom: 0.6pt solid #bbb;
    }

    .sched-b-sec {
      font-family: 'Montserrat', sans-serif;
      font-size: 7.4pt;
      font-weight: 700;
      color: #0c0d12;
      margin-top: 2pt;
      margin-bottom: 1.5pt;
      letter-spacing: 0.03em;
    }

    .sched-b-text {
      font-family: 'Lora', serif;
      font-size: 7.8pt;
      line-height: 1.45;
      color: #2b2b2b;
      margin-left: 7pt;
      margin-bottom: 3pt;
    }

    /* Section Banner */
    .section-banner {
      font-family: 'Cinzel', serif;
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0c0d12;
      border-bottom: 1.1pt solid #c9a44e;
      padding-bottom: 4pt;
      margin-bottom: 10pt;
    }

    /* Operative Articles */
    .article {
      margin-bottom: 5.5pt;
      text-align: justify;
      text-justify: inter-word;
    }

    .article-num {
      font-family: 'Cinzel', serif;
      font-size: 8.4pt;
      font-weight: 700;
      letter-spacing: 0.03em;
      color: #0c0d12;
      margin-bottom: 1.5pt;
    }

    .article-body {
      font-size: 8.1pt;
      line-height: 1.40;
      color: #222328;
    }

    /* Execution & Signature Section */
    .exec-box {
      border: 1.1pt solid #c9a44e;
      border-radius: 4pt;
      background: #faf8f5;
      padding: 10pt 13pt;
      margin-top: 6pt;
    }

    .exec-title {
      font-family: 'Cinzel', serif;
      font-size: 9.5pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0c0d12;
      margin-bottom: 7pt;
      text-align: center;
    }

    .exec-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16pt;
      border-top: 0.8pt solid #dfd8cb;
      padding-top: 8pt;
    }

    .exec-col-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 7.4pt;
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
      color: #0c0d12;
      margin-bottom: 2pt;
    }

    .exec-sub {
      font-family: 'Montserrat', sans-serif;
      font-size: 6.8pt;
      color: #555;
      line-height: 1.4;
    }

    .sig-seal-wrap {
      display: flex;
      align-items: center;
      gap: 12pt;
      margin-top: 5pt;
      margin-bottom: 3pt;
    }

    .sig-img {
      height: 38pt;
      width: auto;
      object-fit: contain;
    }

    .seal-img {
      height: 44pt;
      width: auto;
      object-fit: contain;
    }

    .sig-status {
      font-family: 'Montserrat', sans-serif;
      font-size: 6.8pt;
      font-weight: 600;
      color: #1b6838;
      margin-top: 3pt;
    }

    .sig-status-sub {
      font-family: 'Montserrat', sans-serif;
      font-size: 6pt;
      color: #777;
    }

    .sign-line {
      border-bottom: 0.8pt dashed #9e6b12;
      height: 38pt;
      margin-top: 4pt;
      margin-bottom: 4pt;
    }

    .sign-prompt {
      font-family: 'Montserrat', sans-serif;
      font-size: 6.6pt;
      color: #888;
      text-align: center;
      font-style: italic;
    }

    /* Annexure Page 4 Styling */
    .annexure-guidance {
      background: #faf8f4;
      border: 0.8pt solid #d6cfc2;
      border-radius: 4pt;
      padding: 10pt 14pt;
      margin-bottom: 14pt;
      font-size: 8.6pt;
      line-height: 1.55;
      color: #2b2b2b;
    }

    .annexure-guidance-title {
      font-family: 'Cinzel', serif;
      font-size: 9.2pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #0c0d12;
      margin-bottom: 5pt;
    }

    .annexure-guidance ul {
      margin-left: 16pt;
      margin-top: 4pt;
    }

    .annexure-guidance li {
      margin-bottom: 3pt;
    }

    .attachment-card-box {
      border: 1.5pt dashed #c9a44e;
      background: #fdfcf9;
      border-radius: 6pt;
      height: 350pt;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20pt;
      margin-top: 6pt;
      position: relative;
    }

    .attachment-card-icon {
      width: 44pt;
      height: 44pt;
      margin-bottom: 12pt;
      opacity: 0.45;
    }

    .attachment-card-prompt {
      font-family: 'Cinzel', serif;
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #8c733e;
      text-transform: uppercase;
      margin-bottom: 6pt;
    }

    .attachment-card-sub {
      font-family: 'Montserrat', sans-serif;
      font-size: 8pt;
      color: #777;
      max-width: 320pt;
      line-height: 1.5;
    }

    .attachment-card-badge {
      display: inline-block;
      font-family: 'Montserrat', sans-serif;
      font-size: 7.2pt;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #555;
      background: #f3efe6;
      border: 0.6pt solid #d6cfc2;
      padding: 3pt 10pt;
      border-radius: 12pt;
      margin-top: 10pt;
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
          <img src="data:image/png;base64,${flourishB64}" class="estamp-flourish" alt="Decorative Divider">
          <div class="estamp-title-center">Government of National Capital Territory of Delhi</div>
          <div class="estamp-subtitle-center">e-Stamp · Certificate of Stamp Duty · Non-Judicial</div>
          
          <table class="estamp-table">
            <tr>
              <td class="est-lbl">Certificate No.</td>
              <td class="est-sep">:</td>
              <td class="est-val"><strong>IN-DL22366535014840X</strong></td>
              <td class="est-lbl">Certificate Issued Date</td>
              <td class="est-sep">:</td>
              <td class="est-val">29-Dec-2025 10:56 AM</td>
            </tr>
            <tr>
              <td class="est-lbl">Account Reference</td>
              <td class="est-sep">:</td>
              <td class="est-val">IMPACC (IV)/ dl752103/ DELHI/ DL-ESD</td>
              <td class="est-lbl">Unique Doc. Reference</td>
              <td class="est-sep">:</td>
              <td class="est-val"><strong>SUBIN-DLDL75210370036032316761X</strong></td>
            </tr>
            <tr>
              <td class="est-lbl">Purchased by</td>
              <td class="est-sep">:</td>
              <td class="est-val"><strong>CHIRANJIT KAR</strong></td>
              <td class="est-lbl">Description of Document</td>
              <td class="est-sep">:</td>
              <td class="est-val">Article 5 General Agreement</td>
            </tr>
            <tr>
              <td class="est-lbl">Property Description</td>
              <td class="est-sep">:</td>
              <td class="est-val">Not Applicable</td>
              <td class="est-lbl">Consideration Price (Rs.)</td>
              <td class="est-sep">:</td>
              <td class="est-val">0 (Zero)</td>
            </tr>
            <tr>
              <td class="est-lbl">First Party</td>
              <td class="est-sep">:</td>
              <td class="est-val"><strong>CHIRANJIT KAR</strong></td>
              <td class="est-lbl">Second Party</td>
              <td class="est-sep">:</td>
              <td class="est-val"><strong>CLIENT OR COLLABORATOR</strong></td>
            </tr>
            <tr>
              <td class="est-lbl">Stamp Duty Paid By</td>
              <td class="est-sep">:</td>
              <td class="est-val"><strong>CHIRANJIT KAR</strong></td>
              <td class="est-lbl">Stamp Duty Amount(Rs.)</td>
              <td class="est-sep">:</td>
              <td class="est-val"><strong>100 (One Hundred only)</strong></td>
            </tr>
          </table>

          <img src="data:image/png;base64,${flourishB64}" class="estamp-flourish" alt="Decorative Divider">
          
          <div class="estamp-footer-notice">
            StockHolding Base Certificate Verified · Status: <strong>Not Locked</strong> · Discrepancy email: estamping@stockholding.com
          </div>
        </div>

        <!-- Deed Title -->
        <div class="deed-title-block">
          <div class="deed-title">Master Photography &amp; Creative Production Agreement</div>
          <div class="deed-badge">Universal Deed Governing Both Paid Commissions &amp; Unpaid TFP Collaborations</div>
        </div>

        <p class="preamble">
          This Master Agreement ("Agreement") is executed between <strong>Chiranjit Kar</strong> ("Photographer"), Operating as Chiranjit Kar Photography, New Delhi, and the Second Party designated below ("Client" or "Collaborator"). This universal master deed operates dynamically across both Paid Commercial Commissions and Unpaid TFP Collaborations under the statutory framework of the Indian Contract Act 1872 and the Information Technology Act 2000.
        </p>

        <!-- Schedule A -->
        <div class="schedule-title">Schedule A: Engagement, Package &amp; Commercial Specifications</div>
        <div class="schedule-box">
          <table class="schedule-table">
            <tr>
              <td class="field-label">Contract Reference:</td>
              <td class="field-val"><span class="field-slot"></span></td>
              <td class="field-label">Execution Date:</td>
              <td class="field-val"><span class="field-slot"></span></td>
            </tr>
            <tr>
              <td class="field-label">First Party (Studio):</td>
              <td class="field-val">Chiranjit Kar (Director)</td>
              <td class="field-label">Second Party:</td>
              <td class="field-val"><span class="field-slot"></span></td>
            </tr>
            <tr>
              <td class="field-label">Studio Email:</td>
              <td class="field-val">iamchiranjitkar@hotmail.com</td>
              <td class="field-label">Client Contact:</td>
              <td class="field-val"><span class="field-slot"></span></td>
            </tr>
            <tr>
              <td class="field-label">Production Venue:</td>
              <td class="field-val"><span class="field-slot"></span></td>
              <td class="field-label">Classification:</td>
              <td class="field-val" style="white-space: nowrap; font-size: 7.8pt;"><strong>[ &nbsp; ] Paid Commission &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] Unpaid TFP</strong></td>
            </tr>
            <tr>
              <td class="field-label">Booked Package:</td>
              <td class="field-val"><span class="field-slot"></span></td>
              <td class="field-label">Total Commercial Fee:</td>
              <td class="field-val"><span class="field-slot"></span></td>
            </tr>
            <tr>
              <td class="field-label">20% Advance Deposit:</td>
              <td class="field-val"><span class="field-slot"></span></td>
              <td class="field-label">80% Post-Shoot Balance:</td>
              <td class="field-val"><span class="field-slot"></span></td>
            </tr>
            <tr>
              <td class="field-label">Deliverable Scope:</td>
              <td class="field-val" colspan="3"><span class="field-slot" style="min-height: 18pt;"></span></td>
            </tr>
          </table>
        </div>

        <!-- Schedule B -->
        <div class="schedule-title">Schedule B: Commercial Terms, Overtime &amp; Deliverables</div>
        <div class="schedule-box">
          <div class="sched-b-sec">B.1 PAID COMMERCIAL COMMISSION TERMS</div>
          <div class="sched-b-text">
            • <strong>Payment Milestones:</strong> Strict 20% Non-refundable Advance to reserve dates | Remaining 80% Balance due upon shoot wrap prior to master file release.<br>
            • <strong>30-Minute Grace Period &amp; Overtime:</strong> Complimentary 30-min grace period allowed for prep; overtime beyond grace period billed per booked package hourly rates (standard ₹3,500/hr or pro-rata).
          </div>
          <div class="sched-b-sec">B.2 UNPAID / TFP CREATIVE COLLABORATION TERMS</div>
          <div class="sched-b-text">
            • <strong>Package &amp; Dues:</strong> <strong>NIL (Rs. 0.00)</strong> | Mutual portfolio exchange. Curated selects edited exclusively per Photographer's artistic discretion. Mandatory tag: <strong>@iamchiranjitkar</strong>.
          </div>
        </div>
      </div>

      <div class="running-footer">
        <div>Confidential · Master Photography Agreement Executed under IT Act 2000</div>
        <div>Page <strong>1 of 4</strong></div>
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
            <span>Chiranjit Kar Photography · Master Production Deed</span>
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
          <div class="article-num">2. Project Scope, Creative Authority, 30-Min Grace Period &amp; Overtime</div>
          <div class="article-body">
            2.1 Shoot concept, mood, theme, location, and tentative deliverables shall be agreed prior to the shoot. 2.2 Final Creative Control: Absolute artistic control over lighting, camera angles, poses, styling, grading, and final selection rests solely with the Photographer. 2.3 <strong>Punctuality, 30-Minute Grace Period &amp; Overtime:</strong> Production commences strictly at the scheduled call time. A complimentary <strong>30-minute grace period</strong> is provided for preparation, wardrobe changes, or brief overrun. Any shoot extension exceeding 30 minutes beyond booked package duration incurs extra charges based on package hourly rates (standard ₹3,500/hour or pro-rata per package tier), billable to final balance before master release. Client tardiness does not automatically extend the booked session window.
          </div>
        </div>

        <div class="article">
          <div class="article-num">3. Package Payments, 20% Advance, Remaining Balance &amp; TFP NIL Terms</div>
          <div class="article-body">
            3.1 <strong>Paid Commercial Commission Terms:</strong> Invoiced package fees require a strict <strong>20% Non-refundable Advance Booking Deposit</strong> to confirm studio booking, reserve production dates, and mobilize studio crew. The remaining <strong>80% post-shoot balance</strong> is strictly due upon shoot wrap on the execution date. Proofs and color-graded master retouches are released strictly after 100% full balance clearance. 3.2 <strong>Unpaid / TFP Terms:</strong> For unpaid creative collaborations, all package details, monetary fees, deposits, and balances are strictly <strong>NIL (Rs. 0.00)</strong>. Mutual artistic exposure and portfolio licensing constitute complete and valuable consideration under Section 2(d) &amp; 25 of the Indian Contract Act 1872; Collaborator irrevocably agrees not to demand payment, royalty, or compensation now or in the future.
          </div>
        </div>

        <div class="article">
          <div class="article-num">4. Image Selection, Deliverables &amp; Strict No-RAW Policy</div>
          <div class="article-body">
            4.1 <strong>Strict No-RAW Policy:</strong> Unedited RAW camera files and digital negatives are proprietary confidential trade assets and will <strong>NEVER</strong> be released, sold, or provided under any circumstances. 4.2 <strong>Unpaid TFP Selection &amp; Turnaround:</strong> For unpaid creative collaborations, image curation and selection rest exclusively with the Photographer based on artistic merit. There is no guaranteed turnaround timeline or delivery deadline. Photographer will edit and publish selects per studio schedule; Collaborator may repost with mandatory tag (@iamchiranjitkar). 4.3 <strong>Paid Commission Deliverables:</strong> For paid commercial commissions, client receives proofing selects within 48–72 hours, with final color-graded retouched deliverables released following full balance clearance.
          </div>
        </div>

        <div class="article">
          <div class="article-num">5. Ownership, Statutory Copyright &amp; Irrevocable Model Release</div>
          <div class="article-body">
            5.1 <strong>Statutory Copyright:</strong> Under Section 17 &amp; 19 of the Indian Copyright Act 1957, Chiranjit Kar is the exclusive author and sole copyright proprietor of all photographs, raw negatives, and video recordings. No transfer or assignment of copyright occurs under this deed. 5.2 <strong>Perpetual Model Release:</strong> Collaborator/Client irrevocably grants Photographer the perpetual, worldwide, royalty-free license to use, display, publish, exhibit, and promote their likeness, portrait, and artistic performance across studio websites, social media, exhibitions, books, and promotional campaigns, expressly waiving moral rights, right of publicity, and any takedown claims. 5.3 Client/Collaborator receives solely a non-exclusive, personal portfolio and social media license.
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
        <div>Page <strong>2 of 4</strong></div>
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
            <span>Chiranjit Kar Photography · Master Production Deed</span>
          </div>
          <div class="running-header-right">Govt e-Stamp: IN-DL22366535014840X</div>
        </div>

        <div class="section-banner">Communication Governance, Policies &amp; Digital Execution</div>

        <div class="article">
          <div class="article-num">8. Strict Written Communication Policy (Mandatory)</div>
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
            11.1 Photographer shall not be liable for any indirect loss, injury, or force majeure events; liability is capped at net fees received. 11.2 Collaborator agrees to indemnify and hold harmless the Photographer against all claims arising from misuse of images or breach of this deed.
          </div>
        </div>

        <div class="article">
          <div class="article-num">12. Digital Execution via Leegality &amp; IT Act 2000</div>
          <div class="article-body">
            12.1 Execution via UIDAI Aadhaar OTP through Leegality is legally binding and admissible under Section 10A of the Information Technology Act 2000 and Sections 61 &amp; 63 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA). 12.2 The Rs. 99 UIDAI documentation fee is payable separately by the user before digital execution.
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

        <!-- Execution Block with Authentic Signature & Seal -->
        <div class="exec-box">
          <div class="exec-title">Execution, Digital Seals &amp; UIDAI Aadhaar Authentication</div>
          <div class="exec-grid">
            <!-- First Party Column -->
            <div>
              <div class="exec-col-title">First Party (Studio Director)</div>
              <div class="exec-name">CHIRANJIT KAR</div>
              <div class="exec-sub">Lead Photographer · Studio Director · Chiranjit Kar Photography</div>

              <div class="sig-seal-wrap">
                <img src="data:image/png;base64,${sigB64}" class="sig-img" alt="Chiranjit Kar Signature">
                <img src="data:image/png;base64,${sealB64}" class="seal-img" alt="Verified Agreement Seal">
              </div>

              <div class="sig-status">✓ Digital Studio Seal &amp; Authentic Signature Applied</div>
              <div class="sig-status-sub">Delhi NCT e-Stamp: IN-DL22366535014840X · SHCIL Base Verified</div>
            </div>

            <!-- Second Party Column -->
            <div>
              <div class="exec-col-title">Second Party (Client / Collaborator)</div>
              <div class="exec-name"><span class="second-party-name-slot"></span></div>
              <div class="exec-sub">Execution: UIDAI Aadhaar OTP Digital eSign via Leegality</div>
              <div class="exec-sub" style="color:#9e6b12; font-weight:600;">Admissible under Section 10A Information Technology Act 2000</div>

              <div class="sign-line"></div>
              <div class="sign-prompt">Second Party Signature / Aadhaar OTP Stamp Placement</div>
              <div class="exec-sub" style="margin-top:5pt;">Date: &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | Place: </div>
            </div>
          </div>
        </div>
      </div>

      <div class="running-footer">
        <div>Confidential · Master Photography Agreement Executed under IT Act 2000</div>
        <div>Page <strong>3 of 4</strong></div>
      </div>
    </div>
  </div>

  <!-- ================= PAGE 4 ================= -->
  <div class="page">
    <div class="border-frame">
      <div>
        <div class="running-header">
          <div class="running-header-left">
            <img src="data:image/png;base64,${logoB64}" alt="Logo">
            <span>Chiranjit Kar Photography · Master Production Deed</span>
          </div>
          <div class="running-header-right">Govt e-Stamp: IN-DL22366535014840X</div>
        </div>

        <div class="section-banner">Annexure A: Identity Verification &amp; Masked Aadhaar (Optional)</div>

        <div class="annexure-guidance">
          <div class="annexure-guidance-title">KYC Verification &amp; Privacy Notice</div>
          In compliance with UIDAI regulations, IT Act 2000, and client onboarding standards, the Client or Collaborator may optionally attach a digital image of their Masked Aadhaar Card or Government-issued Photo ID (Passport, Driving License, or Voter ID):
          <ul>
            <li><strong>Privacy &amp; Masking Standard:</strong> If submitting an Aadhaar card, ensure the first 8 digits are masked/redacted, displaying only the last 4 digits (e.g. <em>XXXX-XXXX-1234</em>).</li>
            <li><strong>Non-Mandatory / Voluntary:</strong> This attachment is purely optional. Digital execution remains complete and legally binding upon Aadhaar OTP authentication.</li>
            <li><strong>Confidentiality:</strong> Attached identification records are archived under strict studio confidentiality and will never be shared externally.</li>
          </ul>
        </div>

        <!-- Attachment Slot Frame -->
        <div class="attachment-card-box">
          <svg class="attachment-card-icon" viewBox="0 0 24 24" fill="none" stroke="#9e6b12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <div class="attachment-card-prompt">[ Optional: Attach Masked Aadhaar Card / Govt Photo ID Here ]</div>
          <div class="attachment-card-sub">Upload front view of your Masked Aadhaar or Govt Photo ID card. Ensure details are legible.</div>
          <div class="attachment-card-badge">Optional Attachment · Supported: JPG, PNG, PDF (Max 5MB)</div>
        </div>
      </div>

      <div class="running-footer">
        <div>Confidential · Master Photography Agreement Executed under IT Act 2000</div>
        <div>Page <strong>4 of 4</strong></div>
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

  const dataJsPath = path.join(__dirname, '../functions/api/master_agreement_data.js');
  if (fs.existsSync(path.dirname(dataJsPath))) {
    const b64 = fs.readFileSync(outputPath).toString('base64');
    fs.writeFileSync(dataJsPath, `export const MASTER_AGREEMENT_PDF_BASE64 = "${b64}";\n`);
    console.log(`Updated ${dataJsPath} with new base64 payload (${b64.length} chars)`);
  }
}

buildHtmlPdf(process.argv[2] || path.join(__dirname, '../Master_Photography_And_Creative_Production_Agreement.pdf'));
