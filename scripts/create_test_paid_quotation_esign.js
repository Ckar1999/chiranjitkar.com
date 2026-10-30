const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const token = 'OVCYE5sCN42gpLZJ5jVEAw4Bxt6cKxbg';
const profileId = 'Sbyx9po';
const estampNumber = 'IN-DL22366535014840X';

const pdfPath = path.join(__dirname, '../Master_Photography_And_Creative_Production_Agreement.pdf');
const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');

let stampB64 = '';
const stampPath = path.join(__dirname, '../functions/api/stamp_data.js');
if (fs.existsSync(stampPath)) {
  const content = fs.readFileSync(stampPath, 'utf8');
  const m = content.match(/\"([A-Za-z0-9+/=]+)\"/);
  if (m) stampB64 = m[1];
}

async function run() {
  const now = new Date();
  const dateStr = now.toISOString();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const todayFormatted = `${day}/${month}/${year}`;
  const todayUS = `${month}/${day}/${year}`;

  const projCodeSuffix = Date.now().toString().slice(-4);
  const projectCode = `PAID-${projCodeSuffix}`;
  const contractCode = `CKP-AGR-${projectCode}`;
  const projectId = `proj-test-${projCodeSuffix}`;
  const invoiceId = `inv-test-${projCodeSuffix}`;
  const invoiceCode = `INV-${projectCode}-DEP`;
  const txnId = `txn-test-${projCodeSuffix}`;
  const utr = `UPI/HDFC/TEST${Date.now().toString().slice(-6)}/PAID`;

  const signerName = 'Chiranjit Kar';
  const signerEmail = 'iamchiranjitkar@hotmail.com';
  const signerPhone = '9402369889';
  const clientLocation = 'Studio Set, Hauz Khas, New Delhi';
  const packageName = 'Signature Commercial Production';
  const totalCommercialFee = 25000;
  const advanceDeposit = 5000;
  const balanceDue = 20000;
  const deliverableScope = 'Complete commercial campaign deliverable scope, high-resolution color-graded master deliverables with private proofing gallery delivered within 48-72 hours.';

  console.log('========================================================');
  console.log('1. DISPATCHING LEGALITY PAID COMMERCIAL eSIGN AGREEMENT');
  console.log(`Contract Code : ${contractCode}`);
  console.log(`Package       : ${packageName}`);
  console.log(`Total Fee     : ₹${totalCommercialFee.toLocaleString('en-IN')}`);
  console.log(`Advance (Paid): ₹${advanceDeposit.toLocaleString('en-IN')}`);
  console.log(`Balance Due   : ₹${balanceDue.toLocaleString('en-IN')}`);
  console.log('========================================================\n');

  const payload = {
    profileId,
    file: {
      name: `${contractCode}.pdf`,
      file: pdfBase64,
      fields: [
        { id: '1769351065891', name: 'Contract ID', value: contractCode, type: 'text' },
        { id: '1769351096036', name: 'Date', value: todayFormatted, type: 'date', format: 'dd/mm/yyyy' },
        { id: '1769351924210', name: 'Collaborator Name', value: signerName, type: 'text' },
        { id: '1769352288464', name: 'Phone Number', value: signerPhone, type: 'text' },
        { id: '1769352317374', name: 'Email ID', value: signerEmail, type: 'text' },
        { id: '1769352332429', name: 'Email ID (Alt)', value: signerEmail, type: 'text' },
        { id: '1769352342938', name: 'Address', value: clientLocation, type: 'text' },
        { id: '1769352237988', name: 'Address (Alt)', value: clientLocation, type: 'text' },
        { id: '1769358000001', name: 'Paid Commission', value: 'true', type: 'checkbox' },
        { id: '1769358000002', name: 'Unpaid TFP', value: 'false', type: 'checkbox' },
        { id: '1769359000010', name: 'Booked Package', value: packageName, type: 'text' },
        { id: '1769359000011', name: 'Total Commercial Fee', value: `INR ${totalCommercialFee.toLocaleString('en-IN')}`, type: 'text' },
        { id: '1769359000012', name: '20% Advance Deposit', value: `INR ${advanceDeposit.toLocaleString('en-IN')} (Paid / Non-refundable)`, type: 'text' },
        { id: '1769359000013', name: '80% Post-Shoot Balance', value: `INR ${balanceDue.toLocaleString('en-IN')} (Due upon wrap)`, type: 'text' },
        { id: '1769352220464', name: 'Deliverable Scope', value: deliverableScope, type: 'textarea' },
        { id: '1769356992373', name: 'Signer Name', value: signerName, type: 'text' },
        { id: '1793385528751', name: 'Collaborator Name P3', value: signerName, type: 'text' },
        { id: '1769351126190', name: 'Execution Date', value: todayFormatted, type: 'date', format: 'dd/mm/yyyy' },
        { id: '1769352371986', name: 'City Name', value: 'New Delhi', type: 'text' },
        { name: 'City Name', value: 'New Delhi', type: 'text' },
        { name: 'Place', value: 'New Delhi', type: 'text' }
      ]
    },
    invitees: [
      {
        name: signerName,
        email: signerEmail,
        phone: signerPhone,
        aadhaarConfig: {
          verifyState: 'Delhi',
          verifyGender: 'M',
          verifyYob: 1999
        }
      }
    ],
    stampUpload: {
      firstPartyName: 'CHIRANJIT KAR',
      secondPartyName: signerName,
      state: 'Delhi',
      denomination: 100,
      stampSerial: estampNumber,
      serialNumber: estampNumber,
      stampFile: stampB64
    },
    irn: contractCode
  };

  const resp = await fetch('https://app1.leegality.com/api/v3.0/sign/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': token
    },
    body: JSON.stringify(payload)
  });

  const data = await resp.json().catch(() => ({}));

  if (data.status !== 1 || !data.data) {
    console.error('❌ Leegality API Error:', JSON.stringify(data.messages || data));
    process.exit(1);
  }

  const documentId = data.data.documentId;
  const signUrl = data.data.invitees?.[0]?.signUrl || data.data.invitations?.[0]?.signUrl || '';

  console.log('✅ Agreement Dispatched Successfully!');
  console.log(`Document ID : ${documentId}`);
  console.log(`Sign URL    : ${signUrl}\n`);

  console.log('========================================================');
  console.log('2. SYNCING RECORD TO CLOUDFLARE D1 (PROJECT, INVOICE, PAYMENT)');
  console.log('========================================================');

  const d1Sql = `
    INSERT OR REPLACE INTO projects (
      id, project_code, client_name, client_email, client_phone,
      service, package_name, status, shoot_at, location, brief,
      package_price, deposit_amount, client_key_hash, created_by,
      created_at, updated_at
    ) VALUES (
      '${projectId}', '${projectCode}', '${signerName}', '${signerEmail}', '${signerPhone}',
      'Commercial Production', '${packageName}', 'confirmed', datetime('now', '+3 days'), '${clientLocation}',
      '{"state":"Delhi","gender":"M","yob":1999,"deliverables":"${deliverableScope}"}',
      ${totalCommercialFee}, ${advanceDeposit}, 'demo-test-hash', '2501dc1f-bb7b-471e-b387-ffc4a923ac3b',
      '${dateStr}', '${dateStr}'
    );

    INSERT OR REPLACE INTO invoices (
      id, project_id, invoice_code, kind, description,
      amount, amount_paid, status, due_at, payment_url,
      created_by, created_at, updated_at
    ) VALUES (
      '${invoiceId}', '${projectId}', '${invoiceCode}', 'package',
      '20% Advance Booking Deposit - ${packageName}',
      ${advanceDeposit}, ${advanceDeposit}, 'paid', '${dateStr}', 'https://chiranjitkar.com/pay',
      '2501dc1f-bb7b-471e-b387-ffc4a923ac3b', '${dateStr}', '${dateStr}'
    );

    INSERT OR REPLACE INTO bank_transactions (
      id, utr, amount, transaction_at, source, status,
      invoice_id, imported_by, imported_at, note
    ) VALUES (
      '${txnId}', '${utr}', ${advanceDeposit}, '${dateStr}', 'manual_bank_alert', 'matched',
      '${invoiceId}', '2501dc1f-bb7b-471e-b387-ffc4a923ac3b', '${dateStr}', 'Advance deposit verified via domestic UPI'
    );

    INSERT OR REPLACE INTO project_agreements (
      id, project_id, agreement_type, contract_code, leegality_document_id, leegality_sign_url,
      estamp_number, documentation_fee, status, signer_name, signer_email, signer_phone,
      created_at, updated_at, fee_status, fee_paid_at
    ) VALUES (
      'agr-${projCodeSuffix}', '${projectId}', 'master_paid', '${contractCode}', '${documentId}', '${signUrl}',
      '${estampNumber}', 99, 'sent', '${signerName}', '${signerEmail}', '${signerPhone}',
      '${dateStr}', '${dateStr}', 'paid', '${dateStr}'
    );
  `;

  try {
    const tmpSql = path.join(__dirname, '../temp_paid_quotation.sql');
    fs.writeFileSync(tmpSql, d1Sql, 'utf8');
    const d1Out = execSync(`npx wrangler d1 execute chiranjitkar-studio-ops --file "${tmpSql}" --remote`, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..')
    });
    fs.unlinkSync(tmpSql);
    console.log('✅ D1 Database Updated Successfully:');
    console.log('  - Project: ' + projectCode + ' [CONFIRMED]');
    console.log('  - Invoice: ' + invoiceCode + ' [PAID - ₹' + advanceDeposit + ']');
    console.log('  - Bank Transaction: ' + utr + ' [MATCHED]');
    console.log('  - Agreement: ' + documentId + ' [DISPATCHED]');
  } catch (err) {
    console.error('⚠️ D1 Sync notice:', err.message);
  }

  return { documentId, signUrl, contractCode, projectCode, utr, totalCommercialFee, advanceDeposit, balanceDue };
}

run();