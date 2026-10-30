const fs = require('fs');
const path = require('path');

const token = 'OVCYE5sCN42gpLZJ5jVEAw4Bxt6cKxbg';
const profileId = 'dhZSbBk';
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

async function createDemoAgreement() {
  const contractCode = `CKP-DEMO-${Date.now().toString().slice(-4)}`;
  const nowDt = new Date();
  const mm = String(nowDt.getMonth() + 1).padStart(2, '0');
  const dd = String(nowDt.getDate()).padStart(2, '0');
  const yyyy = nowDt.getFullYear();
  const todayUS = `${mm}/${dd}/${yyyy}`;

  const signerName = 'Chiranjit Kar';
  const signerEmail = 'iamchiranjitkar@hotmail.com';
  const signerPhone = '9402369889';

  console.log(`\n========================================`);
  console.log(`Generating Demo Aadhaar OTP eSign Request`);
  console.log(`Signer: ${signerName} | ${signerEmail} | +91 ${signerPhone}`);
  console.log(`Contract Code: ${contractCode}`);
  console.log(`Profile ID: ${profileId}`);
  console.log(`========================================\n`);

  const payload = {
    profileId,
    file: {
      name: `${contractCode}.pdf`,
      file: pdfBase64,
      fields: [
        { id: '1769351065891', name: 'Contract ID', value: contractCode, type: 'text' },
        { id: '1769351096036', name: 'Date', value: todayUS, type: 'date', format: 'mm/dd/yyyy' },
        { id: '1769351924210', name: 'Collaborator Name', value: signerName, type: 'text' },
        { id: '1769352288464', name: 'Phone Number', value: signerPhone, type: 'text' },
        { id: '1769352332429', name: 'Email ID', value: signerEmail, type: 'text' },
        { id: '1769352237988', name: 'Address', value: 'Studio Set, Hauz Khas, New Delhi', type: 'text' },
        { id: '1769359000001', name: 'Paid Commission', value: 'false', type: 'checkbox' },
        { id: '1769359000002', name: 'Unpaid TFP', value: 'true', type: 'checkbox' },
        { id: '1769359000004', name: 'Deliverable Scope', value: "Curated selects chosen exclusively at Photographer's sole artistic discretion (color-graded). No fixed delivery timeline or deadline applies; edited & published per studio workflow. Collaborator permitted to repost personal selects with mandatory tag (@iamchiranjitkar).", type: 'textarea' },
        { id: '1769356992373', name: 'Signer Name', value: signerName, type: 'text' },
        { id: '1769351126190', name: 'Execution Date', value: todayUS, type: 'date', format: 'mm/dd/yyyy' },
        { id: '1769352371986', name: 'City Name', value: 'New Delhi', type: 'text' },
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

  if (data.status === 1 && data.data) {
    const docId = data.data.documentId;
    const signUrl = data.data.invitees?.[0]?.signUrl || data.data.invitations?.[0]?.signUrl || '';
    console.log(`✅ SUCCESS! Leegality Agreement Created:`);
    console.log(`Document ID : ${docId}`);
    console.log(`Sign URL    : ${signUrl}\n`);
    return { docId, signUrl, contractCode };
  } else {
    console.error('❌ Leegality API Error:', JSON.stringify(data.messages || data));
    process.exit(1);
  }
}

createDemoAgreement();
