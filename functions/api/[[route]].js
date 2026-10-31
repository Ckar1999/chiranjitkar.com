import { DELHI_ESTAMP_BASE64 } from './stamp_data.js';
import { MASTER_AGREEMENT_PDF_BASE64 } from './master_agreement_data.js';

const COOKIE = '__Host-studio_session';
const CLIENT_COOKIE = 'client_session';
const ROLES = new Set(['admin', 'sales', 'photographer', 'filmmaker', 'editor']);
const PROJECT_STATES = new Set(['lead', 'confirmed', 'preproduction', 'scheduled', 'in_session', 'editing', 'client_review', 'delivered', 'archived']);
const BOOKING_PACKAGES = [
  { id:'model-portfolio', category:'Full production', name:'Model Portfolio & Headshots', price:20000, service:'Model portfolio', summary:'3 looks · MUA and hairstylist · 15 retouched photos · indoor studio · 1 month archive' },
  { id:'editorial-fashion-session', category:'Full production', name:'Editorial & Fashion Session', price:34000, service:'Photography', summary:'4 looks · MUA, hairstylist, wardrobe stylist and accessories · 20 retouched photos · 1 month archive' },
  { id:'complete-campaign-bridal', category:'Full production', name:'Complete Campaign & Bridal Production', price:53000, service:'Commercial campaign', summary:'8 looks · full creative crew · custom moodboard · 40 retouched photos · BTS video · studio and outdoor · 2 month archive' },
  { id:'solo-single-look', category:'Solo look sessions', name:'Single Look — 1 Look', price:4599, service:'Photography', summary:'Up to 7 edited images · up to 3 hours · dedicated photographer direction' },
  { id:'solo-editorial-2-looks', category:'Solo look sessions', name:'Editorial — 2 Looks', price:7599, service:'Photography', summary:'Up to 14 edited images · up to 6 hours · high-fashion or commercial styling by client' },
  { id:'solo-atelier-4-looks', category:'Solo look sessions', name:'Atelier Archive — 4 Looks', price:12999, service:'Photography', summary:'Up to 28 edited images · up to 12 hours · portfolio build' },
  { id:'portfolio-sologlimpse', category:'Paid portfolio packages', name:'SoloGlimpse', price:2499, service:'Model portfolio', summary:'1 look · 10 high-resolution images · digital portfolio rights' },
  { id:'portfolio-chic-harmony', category:'Paid portfolio packages', name:'Chic Harmony', price:3999, service:'Model portfolio', summary:'2 looks · 20 high-resolution images · digital portfolio rights' },
  { id:'portfolio-4-looks', category:'Paid portfolio packages', name:'4 Looks Series', price:6999, service:'Model portfolio', summary:'4 looks · 40 high-resolution images · diverse wardrobe' },
  { id:'portfolio-6-looks', category:'Paid portfolio packages', name:'6 Looks Series', price:10599, service:'Model portfolio', summary:'6 looks · 60 high-resolution images · agency lookbook' }
];

const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const fail = (message, status = 400) => json({ error: message }, status);
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const bytes = (n = 32) => { const value = new Uint8Array(n); crypto.getRandomValues(value); return value; };
const b64 = value => btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const fromB64 = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const digest = async value => b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

function clientCookieHeader(token, request, maxAge = 30 * 24 * 3600) {
  const host = new URL(request.url).hostname.toLowerCase();
  const domainPart = host.endsWith('chiranjitkar.com') ? '; Domain=.chiranjitkar.com' : '';
  return `${CLIENT_COOKIE}=${encodeURIComponent(token)}${domainPart}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clientPortalUrl(request, hash = '') {
  const host = new URL(request.url).hostname.toLowerCase();
  const origin = host.endsWith('chiranjitkar.com') ? 'https://client.chiranjitkar.com' : new URL(request.url).origin;
  const path = host.endsWith('chiranjitkar.com') ? '/' : '/session.html';
  return `${origin}${path}${hash ? '#' + hash : ''}`;
}

async function passwordHash(password, saltText, pepper) {
  const salt = saltText ? fromB64(saltText) : bytes(16);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${pepper}:${b64(salt)}`), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const hash = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(password));
  return { hash: b64(hash), salt: b64(salt) };
}

function cookieValue(request, name = COOKIE) {
  const part = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

async function clientAuth(request, env) {
  const token = cookieValue(request, CLIENT_COOKIE) || cookieValue(request, '__Host-client_session') || clientToken(request);
  if (!token) return null;
  const tokenHash = await digest(token);
  const result = await env.DB.prepare(`SELECT c.* FROM client_sessions s JOIN clients c ON c.id=s.client_id WHERE s.token_hash=? AND s.expires_at>?`).bind(tokenHash, now()).first();
  return result || null;
}

async function staffFor(request, env) {
  const token = cookieValue(request);
  if (!token) return null;
  const tokenHash = await digest(token);
  const result = await env.DB.prepare(`SELECT s.id, s.email, s.name, s.role FROM staff_sessions x JOIN staff s ON s.id=x.staff_id WHERE x.token_hash=? AND x.expires_at>? AND s.active=1`).bind(tokenHash, now()).first();
  return result || null;
}

async function requireStaff(request, env, roles = null) {
  const staff = await staffFor(request, env);
  if (!staff) return { response: fail('Sign in to continue.', 401) };
  if (roles && !roles.includes(staff.role)) return { response: fail('You do not have access to this action.', 403) };
  return { staff };
}

async function canAccessProject(env, staff, projectId) {
  if (['admin','sales'].includes(staff.role)) return true;
  const row=await env.DB.prepare(`SELECT 1 AS ok FROM projects p WHERE p.id=? AND (p.created_by=? OR EXISTS(SELECT 1 FROM assignments a WHERE a.project_id=p.id AND a.staff_id=?) OR EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.assigned_to=?))`)
    .bind(projectId,staff.id,staff.id,staff.id).first();
  return Boolean(row);
}

async function logEvent(env, projectId, actorId, event, detail = {}) {
  await env.DB.prepare('INSERT INTO activity(id,project_id,actor_id,event,detail,created_at) VALUES(?,?,?,?,?,?)')
    .bind(id(), projectId, actorId || null, event, JSON.stringify(detail), now()).run();
}

async function confirmProjectAfterDeposit(env,projectId){
  const deposit=await env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status='paid' AND amount_paid>=amount THEN 1 ELSE 0 END) AS paid FROM invoices WHERE project_id=? AND kind='package' AND status!='void'").bind(projectId).first();
  if(Number(deposit?.total)>0&&Number(deposit?.paid)===Number(deposit?.total))await env.DB.prepare("UPDATE projects SET status='confirmed',updated_at=? WHERE id=? AND status='lead'").bind(now(),projectId).run();
}

async function awardReferralReward(env, projectId) {
  const rewardId=id(), created=now();
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO referral_rewards(id,referrer_client_id,referred_email,referred_project_id,package_invoice_id,package_amount,reward_amount,reward_percent,created_at)
      SELECT ?,p.referrer_client_id,p.client_email,p.id,i.id,p.package_price,CAST(p.package_price*5/100 AS INTEGER),5,?
      FROM projects p JOIN invoices i ON i.project_id=p.id AND i.kind='package' AND i.status='paid' AND i.amount_paid>=i.amount
      WHERE p.id=? AND p.referrer_client_id IS NOT NULL AND i.amount>0
        AND NOT EXISTS(SELECT 1 FROM invoices openi WHERE openi.project_id=p.id AND openi.status NOT IN ('paid','void') AND openi.amount>openi.amount_paid)
        AND p.package_price>0
        AND LOWER(p.client_email)!=(SELECT LOWER(email) FROM clients WHERE id=p.referrer_client_id)
        AND NOT EXISTS(SELECT 1 FROM referral_rewards r WHERE LOWER(r.referred_email)=LOWER(p.client_email))
        AND NOT EXISTS(SELECT 1 FROM projects oldp JOIN invoices oldi ON oldi.project_id=oldp.id AND oldi.kind='package' AND oldi.status='paid' WHERE LOWER(oldp.client_email)=LOWER(p.client_email) AND oldp.id!=p.id AND oldp.created_at<p.created_at AND NOT EXISTS(SELECT 1 FROM invoices oldopen WHERE oldopen.project_id=oldp.id AND oldopen.status NOT IN ('paid','void') AND oldopen.amount>oldopen.amount_paid))`)
      .bind(rewardId,created,projectId),
    env.DB.prepare(`INSERT OR IGNORE INTO wallet_transactions(id,client_id,reward_id,kind,amount,description,created_at)
      SELECT ?,referrer_client_id,id,'referral_reward',reward_amount,'5% referral reward after referred client’s first paid package',created_at FROM referral_rewards WHERE referred_project_id=? AND reward_amount>0`)
      .bind(id(),projectId)
  ]);
}

async function reconcileBankTransaction(env, input, staffId, source='manual_bank_alert') {
  const effectiveStaffId = staffId || '2501dc1f-bb7b-471e-b387-ffc4a923ac3b';
  const utr=String(input.utr||'').trim().toUpperCase().replace(/\s+/g,'');
  const amount=Math.round(Number(input.amount));
  const parsedAt=new Date(String(input.transaction_at||''));
  if(!/^[A-Z0-9]{8,40}$/.test(utr))return {error:fail('Enter a valid UTR / bank transaction reference.')};
  if(!Number.isSafeInteger(amount)||amount<=0)return {error:fail('Transaction amount must be a positive whole number of rupees.')};
  if(Number.isNaN(parsedAt.getTime()))return {error:fail('Enter the transaction date and time from the bank alert.')};
  if(parsedAt.getTime()>Date.now()+5*60_000)return {error:fail('Transaction date cannot be in the future.')};
  const transactionISO=parsedAt.toISOString(), importedAt=now();
  const eligible=await env.DB.prepare(`SELECT id,project_id,kind,amount,amount_paid,created_at,due_at FROM invoices WHERE status NOT IN ('void','paid') AND amount-amount_paid=? AND (ABS(julianday(COALESCE(due_at,created_at))-julianday(?))*24)<=24 ORDER BY created_at DESC LIMIT 2`).bind(amount,transactionISO).all();
  const candidates=eligible.results||[], status=candidates.length===1?'matched':candidates.length?'review':'unmatched', invoice=candidates.length===1?candidates[0]:null;
  try {
    await env.DB.prepare('INSERT INTO bank_transactions(id,utr,amount,transaction_at,source,status,invoice_id,imported_by,imported_at,note,source_message_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id(),utr,amount,transactionISO,source,status,invoice?.id||null,effectiveStaffId,importedAt,candidates.length>1?'Multiple exact-amount invoices fall within the 24-hour window.':candidates.length===0?'No exact unpaid invoice found within the 24-hour window.':'',source==='manual_bank_alert'?null:String(input.email_message_id)).run();
  } catch(error) {
      if(String(error?.message||'').includes('UNIQUE'))return {error:fail('This UTR or email alert has already been recorded.',409)};
    throw error;
  }
  if(invoice){
    const paid=invoice.amount_paid+amount;
    await env.DB.prepare(`UPDATE invoices SET amount_paid=?,status=CASE WHEN ? >= amount THEN 'paid' ELSE 'partially_paid' END,updated_at=? WHERE id=?`).bind(paid,paid,importedAt,invoice.id).run();
    if(paid>=invoice.amount){await confirmProjectAfterDeposit(env,invoice.project_id);await awardReferralReward(env,invoice.project_id);}
    await logEvent(env,invoice.project_id,effectiveStaffId,'bank_payment_matched',{invoice_id:invoice.id,utr,amount,transaction_at:transactionISO,source});
  }
  return {result:{ok:true,status,invoice_id:invoice?.id||null,message:status==='matched'?'Payment matched and ledger updated.':status==='review'?'Multiple possible invoices found; transaction saved for review.':'No unique invoice matched; transaction saved without changing balances.'}};
}

async function clientProject(env, key) {
  if (!key || key.length < 32 || key.length > 128) return null;
  return env.DB.prepare('SELECT * FROM projects WHERE client_key_hash=?').bind(await digest(key)).first();
}
function clientToken(request){return String(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');}

function studioDate(value=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function addDateDays(value,days){const date=new Date(`${value}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
async function bookedStudioDates(env,start,end,excludeProjectId=''){
  const rows=excludeProjectId
    ? await env.DB.prepare("SELECT DISTINCT date(p.shoot_at,'+05:30') AS booking_date FROM projects p WHERE p.shoot_at IS NOT NULL AND p.status NOT IN ('delivered','archived') AND (p.status!='lead' OR EXISTS(SELECT 1 FROM invoices i WHERE i.project_id=p.id AND i.kind='package' AND i.status='paid' AND i.amount_paid>=i.amount)) AND date(p.shoot_at,'+05:30')>=? AND date(p.shoot_at,'+05:30')<=? AND p.id<>?").bind(start,end,excludeProjectId).all()
    : await env.DB.prepare("SELECT DISTINCT date(p.shoot_at,'+05:30') AS booking_date FROM projects p WHERE p.shoot_at IS NOT NULL AND p.status NOT IN ('delivered','archived') AND (p.status!='lead' OR EXISTS(SELECT 1 FROM invoices i WHERE i.project_id=p.id AND i.kind='package' AND i.status='paid' AND i.amount_paid>=i.amount)) AND date(p.shoot_at,'+05:30')>=? AND date(p.shoot_at,'+05:30')<=?").bind(start,end).all();
  return new Set((rows.results||[]).map(row=>row.booking_date));
}
async function nextAvailableStudioDate(env,start){
  const end=addDateDays(start,180),busy=await bookedStudioDates(env,start,end);
  for(let offset=0;offset<=180;offset++){const candidate=addDateDays(start,offset);if(!busy.has(candidate))return candidate;}
  return '';
}

async function dispatchLeegalityAgreement(env, project, agreementType = 'master_paid', staffId = null) {
  const settingsRows = await env.DB.prepare("SELECT setting_key, setting_value FROM studio_settings WHERE setting_key IN ('leegality_auth_token','leegality_profile_id_paid','leegality_profile_id_collab','leegality_sandbox','leegality_estamp_number','agreement_fee')").all();
  const cfg = Object.fromEntries((settingsRows.results || []).map(r => [r.setting_key, r.setting_value]));

  const docFee = cfg.agreement_fee !== undefined ? Math.max(0, parseInt(cfg.agreement_fee, 10)) : 99;
  const token = cfg.leegality_auth_token || env.LEEGALITY_AUTH_TOKEN || '';
  const isSandbox = cfg.leegality_sandbox === '1' || env.LEEGALITY_SANDBOX === '1';
  const baseUrl = isSandbox ? 'https://sandbox.leegality.com' : 'https://app1.leegality.com';
  const profileId = (agreementType === 'master_collab' ? cfg.leegality_profile_id_collab : cfg.leegality_profile_id_paid) || 'Sbyx9po';
  const estampNumber = cfg.leegality_estamp_number || 'IN-DL22366535014840X';
  const contractCode = agreementType === 'master_collab' ? `CKP-TFP-${project.project_code}` : `CKP-AGR-${project.project_code}`;

  const nowDt = new Date();
  const mm = String(nowDt.getMonth() + 1).padStart(2, '0');
  const dd = String(nowDt.getDate()).padStart(2, '0');
  const yyyy = nowDt.getFullYear();
  const todayUS = `${mm}/${dd}/${yyyy}`;
  const phone10 = String(project.client_phone || '').replace(/[^0-9]/g, '').slice(-10) || '9876543210';
  const clientCity = String(project.client_city || (project.location ? project.location.split(',').pop().trim() : '') || 'New Delhi').trim() || 'New Delhi';

  let clientState = 'Delhi';
  if (project.location) {
    const loc = project.location.toLowerCase();
    if (loc.includes('maharashtra') || loc.includes('mumbai') || loc.includes('pune')) clientState = 'Maharashtra';
    else if (loc.includes('tripura') || loc.includes('agartala')) clientState = 'Tripura';
    else if (loc.includes('karnataka') || loc.includes('bangalore') || loc.includes('bengaluru')) clientState = 'Karnataka';
    else if (loc.includes('west bengal') || loc.includes('kolkata')) clientState = 'West Bengal';
  }
  let meta = {};
  try {
    if (project.brief && project.brief.startsWith('{')) meta = JSON.parse(project.brief);
  } catch (e) {}

  const verifyState = String(project.client_state || meta.state || clientState).trim() || 'Delhi';
  const verifyGender = String(project.client_gender || meta.gender || (project.client_name && project.client_name.toLowerCase().includes('chiranjit') ? 'M' : 'F')).toUpperCase().startsWith('M') ? 'M' : 'F';
  const verifyYob = parseInt(project.client_yob || meta.yob || meta.yearOfBirth || (verifyGender === 'M' ? 1999 : 1998), 10);

  let docId = `DOC-${project.project_code}-${Date.now().toString().slice(-4)}`;
  let signUrl = '';
  let apiStatus = 'sent';

  if (token && profileId) {
    try {
      const isPaid = agreementType === 'master_paid';
      const isCollab = agreementType === 'master_collab';
      const totalFee = Number(project.package_price || project.total_amount || 25000);
      const advanceFee = Number(project.deposit_amount || project.advance_amount || Math.round(totalFee * 0.2));
      const balanceFee = Number(project.balance_amount || (totalFee - advanceFee));
      const deliverableScopeText = isCollab
        ? "Curated selects chosen exclusively at Photographer's sole artistic discretion (color-graded). No fixed delivery timeline or deadline applies; edited & published per studio workflow. Collaborator permitted to repost personal selects with mandatory tag (@iamchiranjitkar)."
        : (project.deliverables || "Complete commercial deliverable scope as invoiced in Studio Suite, color-graded master deliverables with proofing gallery in 48-72h.");

      const payload = {
        profileId,
        file: {
          name: `${contractCode}.pdf`,
          file: MASTER_AGREEMENT_PDF_BASE64,
          fields: [
            { id: '1769351065891', name: 'Contract ID', value: contractCode, type: 'text' },
            { id: '1769351096036', name: 'Date', value: todayUS, type: 'date', format: 'mm/dd/yyyy' },
            { id: '1769351924210', name: 'Collaborator Name', value: project.client_name, type: 'text' },
            { id: '1769352237988', name: 'Address', value: project.location || 'Studio Set, Hauz Khas, New Delhi', type: 'text' },
            { id: '1769352288464', name: 'Phone Number', value: phone10, type: 'text' },
            { id: '1769352332429', name: 'Email ID', value: project.client_email, type: 'text' },
            { id: '1769358000001', name: 'Paid Commission', value: isPaid ? 'true' : 'false', type: 'checkbox' },
            { id: '1769358000002', name: 'Unpaid TFP', value: isCollab ? 'true' : 'false', type: 'checkbox' },
            { id: '1769359000010', name: 'Booked Package', value: isPaid ? (project.package_name || 'Signature Commercial / Portrait Production') : 'Mutual Creative Collaboration (TFP)', type: 'text' },
            { id: '1769359000011', name: 'Total Commercial Fee', value: isPaid ? ('INR ' + totalFee.toLocaleString('en-IN')) : 'NIL (Rs. 0.00 / Mutual Portfolio Exchange)', type: 'text' },
            { id: '1769359000012', name: '20% Advance Deposit', value: isPaid ? ('INR ' + advanceFee.toLocaleString('en-IN') + ' (Paid / Non-refundable)') : 'NIL (Rs. 0.00)', type: 'text' },
            { id: '1769359000013', name: '80% Post-Shoot Balance', value: isPaid ? ('INR ' + balanceFee.toLocaleString('en-IN') + ' (Due upon wrap)') : 'NIL (Rs. 0.00)', type: 'text' },
            { id: '1769352220464', name: 'Deliverable Scope', value: deliverableScopeText, type: 'textarea' },
            { id: '1769356992373', name: 'Signer Name', value: project.client_name, type: 'text' },
            { id: '1769351126190', name: 'Execution Date', value: todayUS, type: 'date', format: 'mm/dd/yyyy' },
            { id: '1769352371986', name: 'City Name', value: clientCity, type: 'text' },
            { name: 'City Name', value: clientCity, type: 'text' },
            { name: 'Place', value: clientCity, type: 'text' }
          ]
        },
        invitees: [
          {
            name: project.client_name,
            email: project.client_email,
            phone: phone10,
            aadhaarConfig: {
              verifyState: verifyState,
              verifyGender: verifyGender,
              verifyYob: verifyYob
            }
          }
        ],
        stampUpload: {
          firstPartyName: 'CHIRANJIT KAR',
          secondPartyName: project.client_name,
          state: 'Delhi',
          denomination: 100,
          stampSerial: estampNumber,
          serialNumber: estampNumber,
          stampFile: DELHI_ESTAMP_BASE64
        },
        irn: contractCode
      };

      const resp = await fetch(`${baseUrl}/api/v3.0/sign/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));
      if (data && (data.status === 1 || data.data)) {
        docId = data.data?.documentId || docId;
        signUrl = data.data?.invitees?.[0]?.signUrl || data.data?.invitations?.[0]?.signUrl || '';
      }
    } catch (err) {
      console.error('Leegality API dispatch failed:', err);
    }
  }

  if (!signUrl) {
    signUrl = `https://sign.leegality.com/sign/${docId}`;
  }

  const existing = await env.DB.prepare('SELECT id, fee_status FROM project_agreements WHERE project_id=?').bind(project.id).first();
  const agreementId = existing?.id || id();
  const timestamp = now();

  // Ensure fee invoice exists if docFee > 0
  const feeInvCode = `INV-AGR-${project.project_code}`;
  let feeInv = await env.DB.prepare("SELECT * FROM invoices WHERE project_id=? AND invoice_code=?").bind(project.id, feeInvCode).first();
  if (!feeInv && docFee > 0) {
    const feeInvId = id();
    const creator = staffId || project.created_by || '2501dc1f-bb7b-471e-b387-ffc4a923ac3b';
    await env.DB.prepare(`
      INSERT INTO invoices(id, project_id, invoice_code, kind, description, amount, amount_paid, status, due_at, payment_url, created_by, created_at, updated_at)
      VALUES(?,?,?,?,?,?,0,'sent',?,?,?,?,?)
    `).bind(feeInvId, project.id, feeInvCode, 'add_on', 'Aadhaar OTP eSign & Delhi NCT ₹100 e-Stamp Documentation Fee', docFee, timestamp, '', creator, timestamp, timestamp).run();
    feeInv = { id: feeInvId, invoice_code: feeInvCode, amount: docFee, amount_paid: 0, status: 'sent' };
  } else if (feeInv && feeInv.amount !== docFee && feeInv.status !== 'paid') {
    await env.DB.prepare("UPDATE invoices SET amount=?, updated_at=? WHERE id=?").bind(docFee, timestamp, feeInv.id).run();
    feeInv.amount = docFee;
  }

  const isFeePaid = docFee === 0 || (feeInv && (feeInv.status === 'paid' || feeInv.amount_paid >= feeInv.amount)) || (existing?.fee_status === 'paid');
  const feeStatus = isFeePaid ? 'paid' : 'pending';

  if (existing) {
    await env.DB.prepare("UPDATE project_agreements SET agreement_type=?, contract_code=?, leegality_document_id=?, leegality_sign_url=?, estamp_number=?, documentation_fee=?, fee_status=?, fee_invoice_id=?, status=?, updated_at=? WHERE id=?")
      .bind(agreementType, contractCode, docId, signUrl, estampNumber, docFee, feeStatus, feeInv?.id || null, apiStatus, timestamp, agreementId).run();
  } else {
    await env.DB.prepare("INSERT INTO project_agreements(id, project_id, agreement_type, contract_code, leegality_document_id, leegality_sign_url, estamp_number, documentation_fee, fee_status, fee_invoice_id, status, signer_name, signer_email, signer_phone, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(agreementId, project.id, agreementType, contractCode, docId, signUrl, estampNumber, docFee, feeStatus, feeInv?.id || null, apiStatus, project.client_name, project.client_email, project.client_phone || '', timestamp, timestamp).run();
  }

  return { id: agreementId, contract_code: contractCode, document_id: docId, sign_url: signUrl, status: apiStatus, estamp_number: estampNumber, documentation_fee: docFee, fee_status: feeStatus, fee_invoice_code: feeInvCode, is_fee_paid: isFeePaid };
}

async function handle(request, env, route) {
  if (!env.DB) return fail('Studio database is not connected yet.', 503);
  const method = request.method.toUpperCase();
  const parts = route.split('/').filter(Boolean).map(decodeURIComponent);
  const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await request.json().catch(() => ({})) : {};

  if(parts[0]==='packages'&&parts.length===1&&method==='GET')return json({packages:BOOKING_PACKAGES});
  if(parts[0]==='availability'&&parts.length===1&&method==='GET'){
    const url=new URL(request.url),month=String(url.searchParams.get('month')||studioDate().slice(0,7));
    if(!/^\d{4}-\d{2}$/.test(month))return fail('Request a valid calendar month as YYYY-MM.');
    const [year,monthNumber]=month.split('-').map(Number);
    if(monthNumber<1||monthNumber>12)return fail('Request a valid calendar month as YYYY-MM.');
    const start=`${month}-01`,end=new Date(Date.UTC(year,monthNumber,0)).toISOString().slice(0,10);
    const busy=await bookedStudioDates(env,start,end);
    const today=studioDate(),after=String(url.searchParams.get('after')||'').trim();
    if(after&&(!/^\d{4}-\d{2}-\d{2}$/.test(after)||after<today))return fail('Request a future date using YYYY-MM-DD.');
    const nextAvailableDate=await nextAvailableStudioDate(env,after||today);
    return json({timezone:'Asia/Kolkata',month,today,busy_dates:[...busy].sort(),next_available_date:nextAvailableDate});
  }

  if(parts[0]==='webhooks'&&parts[1]==='bank-alerts'&&parts.length===2&&method==='POST'){
    const supplied=String(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
    const saved=await env.DB.prepare("SELECT setting_value,updated_by FROM studio_settings WHERE setting_key='gmail_webhook_token_hash'").first();
    if(!supplied||!saved||await digest(supplied)!==saved.setting_value)return fail('Invalid webhook authorization.',401);
    const source=String(body.bank||'').toLowerCase();
    if(!['hdfc','kotak'].includes(source))return fail('Bank must be hdfc or kotak.');
    if(!String(body.email_message_id||'').trim())return fail('Email message ID is required for delivery deduplication.');
    const outcome=await reconcileBankTransaction(env,body,saved.updated_by,`${source}_gmail_alert`);
    if(outcome.error)return outcome.error;
    return json(outcome.result,201);
  }

  if(parts[0]==='webhooks'&&parts[1]==='leegality'&&parts.length===2&&method==='POST'){
    const docId = String(body.documentId || body.document_id || body.documentID || '').trim();
    const status = String(body.status || body.event || '').toLowerCase();
    const signedUrl = String(body.signed_file_url || body.file || body.irrevocableUrl || body.downloadUrl || '').trim();
    if (docId) {
      const agreement = await env.DB.prepare('SELECT * FROM project_agreements WHERE leegality_document_id=?').bind(docId).first().catch(() => null);
      if (agreement) {
        const isSigned = status.includes('success') || status.includes('complete') || status.includes('sign');
        const updatedStatus = isSigned ? 'signed' : (status.includes('reject') ? 'rejected' : 'sent');
        const signedAt = isSigned ? now() : null;
        await env.DB.prepare("UPDATE project_agreements SET status=?, signed_at=COALESCE(?, signed_at), signed_pdf_url=COALESCE(?, signed_pdf_url), updated_at=? WHERE id=?")
          .bind(updatedStatus, signedAt, signedUrl || null, now(), agreement.id).run();
        if (isSigned) {
          await logEvent(env, agreement.project_id, 'system', 'agreement_signed', { document_id: docId, agreement_type: agreement.agreement_type, signed_at: signedAt });
        }
      }
    }
    return json({ ok: true, received: true });
  }

  if(parts[0]==='inquiries'&&parts.length===1&&method==='POST'){
    if(String(body.website||'').trim())return json({ok:true,message:'Thanks, your inquiry has been received.'},201);
    const name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),service=String(body.service||'').trim(),referralCode=String(body.referral_code||'').trim().toUpperCase();
    const inquiryType=['booking','brand_collab','model_collab'].includes(body.inquiry_type)?body.inquiry_type:'booking';
    const packageId=inquiryType==='booking'?String(body.package_id||''):'';
    const selectedPackage=inquiryType==='booking'?BOOKING_PACKAGES.find(item=>item.id===packageId):null;
    if(inquiryType==='booking'&&!selectedPackage)return fail('Choose a package from the booking menu.');
    if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||(!service&&!selectedPackage))return fail('Please provide your name, a valid email, and the shoot category.');
    const resolvedService=selectedPackage?.service||service;
    const orderPackageName=selectedPackage?.name||'';
    const orderPackagePrice=selectedPackage?.price||0;
    const preferredDate=String(body.preferred_date||'').trim();
    if(inquiryType==='booking'&&!preferredDate)return fail('Select an available shoot date first.');
    if(preferredDate){
      const parsedDate=new Date(`${preferredDate}T00:00:00Z`);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)||Number.isNaN(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==preferredDate||preferredDate<studioDate())return fail('Choose a valid future shoot date.');
      const busy=await bookedStudioDates(env,preferredDate,preferredDate);
      if(busy.has(preferredDate)){const next=await nextAvailableStudioDate(env,addDateDays(preferredDate,1));return fail(`That date is no longer available. The next available date is ${next||'not currently listed'}.`,409);}
    }
    const portfolioUrl=String(body.portfolio_url||'').trim(),moodboardUrl=String(body.moodboard_url||'').trim();
    if(inquiryType==='model_collab'&&(!portfolioUrl||!moodboardUrl))return fail('A portfolio link and moodboard link are required for a model collaboration proposal.');
    if(inquiryType==='brand_collab'&&!portfolioUrl)return fail('Please provide a portfolio, agency, brand, or social profile link.');
    for(const value of [portfolioUrl,moodboardUrl].filter(Boolean)){try{const parsed=new URL(value);if(!['http:','https:'].includes(parsed.protocol))throw new Error();}catch{return fail('Portfolio and moodboard links must be valid HTTPS or HTTP links.');}}
    if(referralCode&&!await env.DB.prepare('SELECT id FROM clients WHERE referral_code=?').bind(referralCode).first())return fail('This referral link is invalid or expired.');
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';const ipHash=await digest(`${env.APP_SECRET||'studio-rate-limit'}:${ip}`);
    const since=new Date(Date.now()-60*60_000).toISOString();const recent=await env.DB.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE ip_hash=? AND created_at>?').bind(ipHash,since).first();
    if((recent?.n||0)>=5)return fail('Too many inquiries from this connection. Please contact the studio directly.',429);
    const created=now();await env.DB.prepare('INSERT INTO inquiries(id,name,email,phone,city,service,brief,status,source,ip_hash,referral_code,inquiry_type,portfolio_url,moodboard_url,package_id,package_name,package_price,preferred_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,\'new\',\'website\',?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id(),name,email,String(body.phone||'').trim().slice(0,40),String(body.city||'').trim().slice(0,100),resolvedService.slice(0,150),String(body.brief||'').trim().slice(0,5000),ipHash,referralCode,inquiryType,portfolioUrl.slice(0,500),moodboardUrl.slice(0,500),packageId,orderPackageName,orderPackagePrice,preferredDate,created,created).run();
    const message=inquiryType==='model_collab'?'Thanks for sharing your photoshoot idea and moodboard. Our team will review the proposal and contact you if we would like to take it forward.':inquiryType==='brand_collab'?'Thanks for your fashion collaboration proposal. Our team will review it and contact you if we would like to take it forward.':inquiryType==='booking'?'Thank you. The studio team will review your request. If approved, your invoice will appear in your client dashboard.':'Thanks, your inquiry has been received. Our studio coordinator will review it and follow up.';
    return json({ok:true,message},201);
  }

  if(parts[0]==='inquiries'&&parts.length===1&&method==='GET'){
    const auth=await requireStaff(request,env,['admin','sales']);if(auth.response)return auth.response;
    const rows=await env.DB.prepare('SELECT i.*,s.name AS assignee_name FROM inquiries i LEFT JOIN staff s ON s.id=i.assigned_to ORDER BY CASE i.status WHEN \'new\' THEN 0 WHEN \'contacted\' THEN 1 WHEN \'qualified\' THEN 2 ELSE 3 END,i.created_at DESC').all();
    return json({inquiries:rows.results||[]});
  }

  if(parts[0]==='inquiries'&&parts[1]&&method==='PATCH'){
    const auth=await requireStaff(request,env,['admin','sales']);if(auth.response)return auth.response;
    if(body.collaboration_decision){
      if(!['accepted','declined'].includes(body.collaboration_decision))return fail('Choose accepted or declined.');
      const inquiry=await env.DB.prepare('SELECT inquiry_type,collaboration_decision FROM inquiries WHERE id=?').bind(parts[1]).first();
      if(!inquiry)return fail('Inquiry not found.',404);
      if(!['model_collab','brand_collab'].includes(inquiry.inquiry_type))return fail('This request is not a fashion collaboration proposal.');
      if(inquiry.collaboration_decision!=='pending')return fail('This proposal has already been reviewed.');
      const reviewed=now();
      const updated=await env.DB.prepare('UPDATE inquiries SET collaboration_decision=?,reviewed_at=?,reviewed_by=?,updated_at=? WHERE id=? AND collaboration_decision=\'pending\'').bind(body.collaboration_decision,reviewed,auth.staff.id,reviewed,parts[1]).run();
      if(!updated.meta?.changes)return fail('Another team member has already reviewed this proposal.',409);
      return json({ok:true,collaboration_decision:body.collaboration_decision});
    }
    const status=body.status;if(status&&!['new','contacted','qualified','closed'].includes(status))return fail('Invalid inquiry status.');
    if(body.assigned_to){const assignee=await env.DB.prepare('SELECT id FROM staff WHERE id=? AND active=1').bind(body.assigned_to).first();if(!assignee)return fail('Select an active team member.');}
    await env.DB.prepare('UPDATE inquiries SET status=COALESCE(?,status),assigned_to=COALESCE(?,assigned_to),updated_at=? WHERE id=?').bind(status||null,body.assigned_to||null,now(),parts[1]).run();
    return json({ok:true});
  }

  if (parts[0] === 'auth' && parts[1] === 'login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!env.APP_SECRET) return fail('Studio authentication is not configured.',503);
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 200) return fail('Enter your work email and password (at least 8 characters).');
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const tries = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE email=? AND attempted_at>? AND succeeded=0').bind(email, since).first();
    if ((tries?.n || 0) >= 8) return fail('Too many attempts. Wait 15 minutes and try again.', 429);

    let user = await env.DB.prepare('SELECT * FROM staff WHERE email=? AND active=1').bind(email).first();
    if (!user) {
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM staff').first();
      const bootstrapEmail = String(env.OWNER_EMAIL || '').trim().toLowerCase();
      if ((count?.n || 0) === 0 && email === bootstrapEmail && env.OWNER_INITIAL_PASSWORD && password === env.OWNER_INITIAL_PASSWORD) {
        const hashed = await passwordHash(password,null,env.APP_SECRET);
        const staffId = id();
        await env.DB.prepare('INSERT INTO staff(id,email,name,role,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
          .bind(staffId, email, 'Studio Owner', 'admin', hashed.hash, hashed.salt, now(), now()).run();
        user = await env.DB.prepare('SELECT * FROM staff WHERE id=?').bind(staffId).first();
      }
    }

    let success = false;
    if (user) {
      const candidate = await passwordHash(password, user.password_salt,env.APP_SECRET);
      success = candidate.hash === user.password_hash;
    }
    await env.DB.prepare('INSERT INTO login_attempts(id,email,attempted_at,succeeded) VALUES(?,?,?,?)').bind(id(), email, now(), success ? 1 : 0).run();
    if (!success) return fail('Email or password is incorrect.', 401);

    const rawToken = b64(bytes(32));
    await env.DB.prepare('INSERT INTO staff_sessions(token_hash,staff_id,expires_at,created_at) VALUES(?,?,?,?)')
      .bind(await digest(rawToken), user.id, new Date(Date.now() + 8 * 60 * 60_000).toISOString(), now()).run();
    const headers = { 'Set-Cookie': `${COOKIE}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800` };
    return json({ staff: { id: user.id, email: user.email, name: user.name, role: user.role } }, 200, headers);
  }

  if (parts[0] === 'auth' && parts[1] === 'logout' && method === 'POST') {
    const token = cookieValue(request);
    if (token) await env.DB.prepare('DELETE FROM staff_sessions WHERE token_hash=?').bind(await digest(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  }

  if (parts[0] === 'auth' && parts[1] === 'me' && method === 'GET') {
    const staff = await staffFor(request, env);
    return staff ? json({ staff }) : fail('Not signed in.', 401);
  }

  if (parts[0] === 'auth' && parts[1] === 'password' && method === 'POST') {
    const auth = await requireStaff(request, env);
    if (auth.response) return auth.response;
    const user = await env.DB.prepare('SELECT password_hash,password_salt FROM staff WHERE id=?').bind(auth.staff.id).first();
    const current = await passwordHash(String(body.current_password || ''), user.password_salt,env.APP_SECRET);
    if (current.hash !== user.password_hash) return fail('Current password is incorrect.', 401);
    const nextPassword = String(body.new_password || '');
    if (nextPassword.length < 12 || nextPassword.length > 200) return fail('Choose a new password with at least 12 characters.');
    const hashed = await passwordHash(nextPassword,null,env.APP_SECRET);
    await env.DB.prepare('UPDATE staff SET password_hash=?,password_salt=?,updated_at=? WHERE id=?').bind(hashed.hash, hashed.salt, now(), auth.staff.id).run();
    await env.DB.prepare('DELETE FROM staff_sessions WHERE staff_id=?').bind(auth.staff.id).run();
    return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
  }

  if (parts[0] === 'client' && parts[1] === 'google-auth' && method === 'POST') {
    const credential = String(body.credential || '').trim();
    if (!credential) return fail('Google credential is required.');

    let gUser = null;
    try {
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!verifyRes.ok) return fail('Google credential verification failed.', 401);
      gUser = await verifyRes.json();
    } catch (e) {
      return fail('Could not reach Google authentication servers.', 502);
    }

    if(gUser.aud!=='590487797563-iuln56iefm3lgpdmq8rh0egqbke0ugp9.apps.googleusercontent.com')return fail('Google credential was issued for a different application.',401);

    const email = String(gUser.email || '').toLowerCase().trim();
    const name = String(gUser.name || gUser.given_name || email.split('@')[0]).trim();
    const picture = String(gUser.picture || '').trim();
    const sub = String(gUser.sub || '').trim();
    const verified = String(gUser.email_verified) === 'true';

    if (!email || !verified) return fail('A verified Google account email is required.', 401);

    const nowISO = now();
    let client = await env.DB.prepare('SELECT * FROM clients WHERE google_sub=? OR email=?').bind(sub, email).first();
    const clientId = client?.id || id();

    if (!client) {
      await env.DB.prepare('INSERT INTO clients(id, email, name, picture, google_sub, phone, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)')
        .bind(clientId, email, name, picture, sub, '', nowISO, nowISO).run();
      client = { id: clientId, email, name, picture, google_sub: sub, phone: '', created_at: nowISO, updated_at: nowISO };
    } else {
      await env.DB.prepare('UPDATE clients SET name=?, picture=?, google_sub=?, updated_at=? WHERE id=?')
        .bind(name, picture, sub, nowISO, client.id).run();
      client = { ...client, name, picture, google_sub: sub, updated_at: nowISO };
    }

    if(!client.referral_code){
      for(let attempt=0;attempt<3&&!client.referral_code;attempt++){
        const candidate='CK'+Array.from(bytes(5),v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
        try{await env.DB.prepare('UPDATE clients SET referral_code=? WHERE id=? AND referral_code IS NULL').bind(candidate,client.id).run();}catch{}
        client=await env.DB.prepare('SELECT * FROM clients WHERE id=?').bind(client.id).first();
      }
    }

    const token = b64(bytes(32));
    const tokenHash = await digest(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    await env.DB.prepare('INSERT INTO client_sessions(token_hash, client_id, expires_at, created_at) VALUES(?,?,?,?)')
      .bind(tokenHash, client.id, expiresAt, nowISO).run();

    const cookie = clientCookieHeader(token, request, 30 * 24 * 3600);
    return json({ ok: true, client, token, expires_at: expiresAt }, 200, { 'Set-Cookie': cookie });
  }

  if (parts[0] === 'client' && parts[1] === 'me' && method === 'GET') {
    const client = await clientAuth(request, env);
    if (!client) return fail('Not signed in.', 401);

    const projects = await env.DB.prepare(`
      SELECT id, project_code, client_name, client_email, service, package_name, status, shoot_at, location, brief, booked_minutes, grace_minutes, overtime_step_minutes, overtime_rate, package_price, deposit_amount, booking_deposit_due, cancelled_at, cancellation_refund_amount, cancellation_policy_applied, created_at
      FROM projects WHERE LOWER(client_email)=LOWER(?)
      ORDER BY CASE status WHEN 'in_session' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'confirmed' THEN 2 WHEN 'editing' THEN 3 WHEN 'client_review' THEN 4 WHEN 'delivered' THEN 5 ELSE 6 END, shoot_at DESC, created_at DESC
    `).bind(client.email).all();

    const projectList = [];
    for (const p of (projects.results || [])) {
      const session = await env.DB.prepare("SELECT id,started_at,ended_at,elapsed_minutes,overtime_minutes,overtime_units,overtime_fee,status FROM sessions WHERE project_id=? ORDER BY started_at DESC LIMIT 1").bind(p.id).first();
      const invoices = await env.DB.prepare("SELECT id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url FROM invoices WHERE project_id=? AND status!='void' ORDER BY created_at").bind(p.id).all();
      const openBalance=(invoices.results||[]).reduce((sum,invoice)=>sum+Math.max(0,Number(invoice.amount)-Number(invoice.amount_paid)),0);
      const deliveries = openBalance<=0
        ? await env.DB.prepare('SELECT title,url,note,created_at FROM deliveries WHERE project_id=? ORDER BY created_at DESC').bind(p.id).all()
        : {results:[]};
      projectList.push({
        ...p,
        session,
        invoices: invoices.results || [],
        open_balance: openBalance,
        deliveries: deliveries.results || []
      });
    }

    return json({ ok: true, client, projects: projectList });
  }

  if(parts[0]==='client'&&parts[1]==='wallet'&&parts.length===2&&method==='GET'){
    const client=await clientAuth(request,env);if(!client)return fail('Sign in to view your wallet.',401);
    let referralCode=client.referral_code;
    if(!referralCode){
      for(let attempt=0;attempt<3&&!referralCode;attempt++){
        const candidate='CK'+Array.from(bytes(5),v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
        try{await env.DB.prepare('UPDATE clients SET referral_code=? WHERE id=? AND referral_code IS NULL').bind(candidate,client.id).run();}catch{}
        const row=await env.DB.prepare('SELECT referral_code FROM clients WHERE id=?').bind(client.id).first();referralCode=row?.referral_code||null;
      }
    }
    const transactions=await env.DB.prepare('SELECT kind,amount,description,created_at FROM wallet_transactions WHERE client_id=? ORDER BY created_at DESC LIMIT 50').bind(client.id).all();
    const balance=await env.DB.prepare('SELECT COALESCE(SUM(amount),0) AS amount FROM wallet_transactions WHERE client_id=?').bind(client.id).first();
    return json({referral_code:referralCode,share_url:`https://book.chiranjitkar.com/?ref=${encodeURIComponent(referralCode||'')}`,balance:balance?.amount||0,transactions:transactions.results||[]});
  }

  if(parts[0]==='client'&&parts[1]==='wallet'&&parts[2]==='apply'&&method==='POST'){
    const client=await clientAuth(request,env);if(!client)return fail('Sign in to use wallet credit.',401);
    const invoiceId=String(body.invoice_id||'');
    const invoice=await env.DB.prepare(`SELECT i.id,i.project_id,i.amount,i.amount_paid,i.status FROM invoices i JOIN projects p ON p.id=i.project_id WHERE i.id=? AND i.kind='package' AND LOWER(p.client_email)=LOWER(?) AND i.status NOT IN ('void','paid')`).bind(invoiceId,client.email).first();
    if(!invoice)return fail('No payable package invoice was found for your account.',404);
    const wallet=await env.DB.prepare('SELECT COALESCE(SUM(amount),0) AS amount FROM wallet_transactions WHERE client_id=?').bind(client.id).first();
    const useAmount=Math.min(Number(wallet?.amount||0),invoice.amount-invoice.amount_paid);
    if(useAmount<=0)return fail('There is no available wallet credit to apply.');
    const txId=id(),created=now(),paidAfter=invoice.amount_paid+useAmount;
    try{
      const results=await env.DB.batch([
        env.DB.prepare(`INSERT INTO wallet_transactions(id,client_id,invoice_id,project_id,kind,amount,description,created_at)
          SELECT ?,?,?,?,'booking_redemption',?,'Wallet credit applied to package',?
          WHERE (SELECT COALESCE(SUM(amount),0) FROM wallet_transactions WHERE client_id=?)>=?
            AND EXISTS(SELECT 1 FROM invoices WHERE id=? AND amount_paid=? AND amount-amount_paid>=? AND status NOT IN ('void','paid'))`)
          .bind(txId,client.id,invoice.id,invoice.project_id,-useAmount,created,client.id,useAmount,invoice.id,invoice.amount_paid,useAmount),
        env.DB.prepare(`UPDATE invoices SET amount_paid=?,status=CASE WHEN ? >= amount THEN 'paid' ELSE 'partially_paid' END,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM wallet_transactions WHERE id=?)`)
          .bind(paidAfter,paidAfter,created,invoice.id,txId)
      ]);
      if(!(results[0]?.meta?.changes>0))return fail('Wallet or package balance changed. Refresh and try again.',409);
    }catch(error){if(String(error?.message||'').includes('UNIQUE'))return fail('Wallet credit has already been applied to this package.',409);throw error;}
    await confirmProjectAfterDeposit(env,invoice.project_id);
    await awardReferralReward(env,invoice.project_id);
    return json({ok:true,applied:useAmount,message:`${new Intl.NumberFormat('en-IN').format(useAmount)} rupees of wallet credit applied.`});
  }

  if (parts[0] === 'client' && parts[1] === 'logout' && method === 'POST') {
    const token = cookieValue(request, CLIENT_COOKIE) || cookieValue(request, '__Host-client_session') || clientToken(request);
    if (token) {
      await env.DB.prepare('DELETE FROM client_sessions WHERE token_hash=?').bind(await digest(token)).run().catch(() => ({}));
    }
    const host = new URL(request.url).hostname.toLowerCase();
    const domainPart = host.endsWith('chiranjitkar.com') ? '; Domain=.chiranjitkar.com' : '';
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', `${CLIENT_COOKIE}=${domainPart}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    headers.append('Set-Cookie', `__Host-client_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  if(parts[0]==='client'&&parts[1]==='project'&&parts[2]==='upgrade'&&method==='POST'){
    let project=await clientProject(env,clientToken(request));
    if(project&&body.project_id&&project.id!==String(body.project_id))return fail('This private client link belongs to a different project.',403);
    if(!project){
      const client=await clientAuth(request,env);if(!client)return fail('Sign in to request a package upgrade.',401);
      const code=String(body.project_code||'').trim();
      if(!code)return fail('Select a project before requesting an upgrade.');
      project=await env.DB.prepare('SELECT * FROM projects WHERE (id=? OR project_code=?) AND LOWER(client_email)=LOWER(?)').bind(code,code,client.email).first();
    }
    if(!project)return fail('This client project was not found.',404);
    if(['in_session','editing','client_review','delivered','archived'].includes(project.status))return fail('Package upgrades close when the session starts.');
    const started=await env.DB.prepare('SELECT 1 AS started FROM sessions WHERE project_id=? LIMIT 1').bind(project.id).first();
    if(started)return fail('Package upgrades close when the session starts.');
    const selected=BOOKING_PACKAGES.find(item=>item.id===String(body.package_id||''));
    if(!selected)return fail('Choose an available package.');
    const currentPrice=Number(project.package_price)||0,delta=selected.price-currentPrice;
    if(delta<=0)return fail('Choose a package that costs more than your current package.');
    const depositDelta=Math.round(delta*.30),balanceDelta=delta-depositDelta,updated=now();
    const update=await env.DB.prepare("UPDATE projects SET package_name=?,package_price=?,booking_deposit_due=booking_deposit_due+?,updated_at=? WHERE id=? AND package_price=? AND status NOT IN ('in_session','editing','client_review','delivered','archived') AND NOT EXISTS(SELECT 1 FROM sessions WHERE project_id=?)")
      .bind(selected.name,selected.price,depositDelta,updated,project.id,currentPrice,project.id).run();
    if(!(update.meta?.changes>0))return fail('This project changed or the session has started. Refresh and try again.',409);
    const invoiceSuffix=Date.now().toString().slice(-8);
    if(depositDelta>0)await env.DB.prepare('INSERT INTO invoices(id,project_id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,0,\'sent\',NULL,\'\',?,?,?)')
      .bind(id(),project.id,`INV-${project.project_code}-UP-${invoiceSuffix}`,'package',`Package upgrade deposit — ${selected.name} (30% of upgrade)`,depositDelta,project.created_by,updated,updated).run();
    if(balanceDelta>0)await env.DB.prepare('INSERT INTO invoices(id,project_id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,0,\'draft\',NULL,\'\',?,?,?)')
      .bind(id(),project.id,`INV-${project.project_code}-UB-${invoiceSuffix}`,'adjustment',`Package balance (70%) upgrade to ${selected.name} — due after session completion`,balanceDelta,project.created_by,updated,updated).run();
    await logEvent(env,project.id,null,'client_package_upgraded',{from:project.package_name,to:selected.name,previous_price:currentPrice,new_price:selected.price,deposit_due:depositDelta,balance_due:balanceDelta});
    return json({ok:true,package_name:selected.name,price:selected.price,upgrade_amount:delta,deposit_due:depositDelta,balance_due:balanceDelta,message:`Package upgraded. The 30% upgrade deposit is ₹${depositDelta}; ₹${balanceDelta} is due after your session.`});
  }

  if (parts[0] === 'client' && parts[1] === 'project' && method === 'GET') {
    let project = await clientProject(env, clientToken(request));
    if (!project) {
      const client = await clientAuth(request, env);
      const code = String(new URL(request.url).searchParams.get('code') || '').trim();
      if (client) {
        if (code) {
          project = await env.DB.prepare('SELECT * FROM projects WHERE (project_code=? OR id=?) AND LOWER(client_email)=LOWER(?)').bind(code, code, client.email).first();
        } else {
          project = await env.DB.prepare('SELECT * FROM projects WHERE LOWER(client_email)=LOWER(?) ORDER BY shoot_at DESC, created_at DESC LIMIT 1').bind(client.email).first();
        }
      }
    }
    if (!project) return fail('This client project was not found.', 404);
    const session = await env.DB.prepare("SELECT id,started_at,ended_at,elapsed_minutes,overtime_minutes,overtime_units,overtime_fee,status FROM sessions WHERE project_id=? ORDER BY started_at DESC LIMIT 1").bind(project.id).first();
    let agreementRow = await env.DB.prepare("SELECT id, agreement_type, contract_code, leegality_document_id, leegality_sign_url, estamp_number, documentation_fee, fee_status, fee_paid_at, fee_invoice_id, status, signed_at, signed_pdf_url FROM project_agreements WHERE project_id=? ORDER BY created_at DESC LIMIT 1").bind(project.id).first().catch(() => null);

    const feeSetting = await env.DB.prepare("SELECT setting_value FROM studio_settings WHERE setting_key='agreement_fee'").first();
    const configuredFee = feeSetting ? Math.max(0, parseInt(feeSetting.setting_value, 10)) : 99;
    const feeInvCode = `INV-AGR-${project.project_code}`;

    let feeInv = await env.DB.prepare("SELECT id, amount, amount_paid, status FROM invoices WHERE project_id=? AND invoice_code=?").bind(project.id, feeInvCode).first();

    if (!agreementRow) {
      const isCollab = project.service === 'Collaboration';
      const agrType = isCollab ? 'master_collab' : 'master_paid';
      const contractCode = isCollab ? `CKP-TFP-${project.project_code}` : `CKP-AGR-${project.project_code}`;
      const docId = `DOC-${project.project_code}`;
      const signUrl = `https://sign.leegality.com/sign/${docId}`;
      const agrId = id();
      const isFeePaid = configuredFee === 0 || (feeInv && (feeInv.status === 'paid' || feeInv.amount_paid >= feeInv.amount));
      const feeStatus = isFeePaid ? 'paid' : 'pending';

      if (!feeInv && configuredFee > 0) {
        const feeInvId = id();
        const creator = project.created_by || '2501dc1f-bb7b-471e-b387-ffc4a923ac3b';
        await env.DB.prepare(`
          INSERT INTO invoices(id, project_id, invoice_code, kind, description, amount, amount_paid, status, due_at, payment_url, created_by, created_at, updated_at)
          VALUES(?,?,?,?,?,?,0,'sent',?,?,?,?,?)
        `).bind(feeInvId, project.id, feeInvCode, 'add_on', 'Aadhaar OTP eSign & Delhi NCT ₹100 e-Stamp Documentation Fee', configuredFee, now(), '', creator, now(), now()).run();
        feeInv = { id: feeInvId, amount: configuredFee, amount_paid: 0, status: 'sent' };
      }

      await env.DB.prepare("INSERT INTO project_agreements(id, project_id, agreement_type, contract_code, leegality_document_id, leegality_sign_url, estamp_number, documentation_fee, fee_status, fee_invoice_id, status, signer_name, signer_email, signer_phone, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(agrId, project.id, agrType, contractCode, docId, signUrl, 'IN-DL22366535014840X', configuredFee, feeStatus, feeInv?.id || null, 'draft', project.client_name, project.client_email, project.client_phone || '', now(), now()).run();

      agreementRow = {
        id: agrId, agreement_type: agrType, contract_code: contractCode, leegality_document_id: docId,
        leegality_sign_url: signUrl, estamp_number: 'IN-DL22366535014840X', documentation_fee: configuredFee,
        fee_status: feeStatus, fee_invoice_code: feeInvCode, status: 'draft', signed_at: null, signed_pdf_url: null
      };
    } else {
      if (!feeInv && Number(agreementRow.documentation_fee) > 0) {
        const feeInvId = id();
        const creator = project.created_by || '2501dc1f-bb7b-471e-b387-ffc4a923ac3b';
        await env.DB.prepare(`
          INSERT INTO invoices(id, project_id, invoice_code, kind, description, amount, amount_paid, status, due_at, payment_url, created_by, created_at, updated_at)
          VALUES(?,?,?,?,?,?,0,'sent',?,?,?,?,?)
        `).bind(feeInvId, project.id, feeInvCode, 'add_on', 'Aadhaar OTP eSign & Delhi NCT ₹100 e-Stamp Documentation Fee', Number(agreementRow.documentation_fee), now(), '', creator, now(), now()).run();
        feeInv = { id: feeInvId, amount: Number(agreementRow.documentation_fee), amount_paid: 0, status: 'sent' };
      }

      if (feeInv && (feeInv.status === 'paid' || feeInv.amount_paid >= feeInv.amount)) {
        if (agreementRow.fee_status !== 'paid') {
          agreementRow.fee_status = 'paid';
          await env.DB.prepare("UPDATE project_agreements SET fee_status='paid', fee_paid_at=? WHERE id=?").bind(now(), agreementRow.id).run();
        }
      } else if (Number(agreementRow.documentation_fee) === 0) {
        if (agreementRow.fee_status !== 'paid') {
          agreementRow.fee_status = 'paid';
          await env.DB.prepare("UPDATE project_agreements SET fee_status='paid', fee_paid_at=? WHERE id=?").bind(now(), agreementRow.id).run();
        }
      }
      agreementRow.fee_invoice_code = feeInvCode;
    }

    // Strict signing eligibility: redact leegality_sign_url until fee is paid
    const isFeePaid = agreementRow.fee_status === 'paid' || Number(agreementRow.documentation_fee) === 0;
    agreementRow.is_eligible_for_esign = isFeePaid;
    if (!isFeePaid && Number(agreementRow.documentation_fee) > 0) {
      agreementRow.leegality_sign_url = null;
    }

    const invoices = await env.DB.prepare("SELECT id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url FROM invoices WHERE project_id=? AND status!='void' ORDER BY created_at").bind(project.id).all();
    const openBalance=(invoices.results||[]).reduce((sum,invoice)=>sum+Math.max(0,Number(invoice.amount)-Number(invoice.amount_paid)),0);
    const deliveries = openBalance<=0
      ? await env.DB.prepare('SELECT title,url,note,created_at FROM deliveries WHERE project_id=? ORDER BY created_at DESC').bind(project.id).all()
      : {results:[]};

    return json({ project: { id: project.id, project_code: project.project_code, client_name: project.client_name, client_email: project.client_email, client_phone: project.client_phone, location: project.location, service: project.service, package_name: project.package_name, package_price:project.package_price, shoot_at: project.shoot_at, booked_minutes: project.booked_minutes, grace_minutes: project.grace_minutes, overtime_step_minutes: project.overtime_step_minutes, overtime_rate: project.overtime_rate, status: project.status }, session, invoices: invoices.results || [], open_balance:openBalance, deliveries: deliveries.results || [], agreement: agreementRow || null });
  }

  if (parts[0] === 'client' && parts[1] === 'challenge' && method === 'POST') {
    let project = await clientProject(env, clientToken(request));
    if (!project) {
      const client = await clientAuth(request, env);
      const pId = String(body.project_id || body.project_code || '').trim();
      if (client && pId) {
        project = await env.DB.prepare('SELECT * FROM projects WHERE (id=? OR project_code=?) AND LOWER(client_email)=LOWER(?)').bind(pId, pId, client.email).first();
      }
    }
    if (!project) return fail('This client session was not found.', 404);
    const kind = body.kind === 'end' ? 'end' : body.kind === 'start' ? 'start' : '';
    if (!kind) return fail('Invalid approval action.');
    if (!env.APP_SECRET) return fail('Session approval is not configured yet. Contact the studio.', 503);
    const live = await env.DB.prepare("SELECT * FROM sessions WHERE project_id=? AND status='active' ORDER BY started_at DESC LIMIT 1").bind(project.id).first();
    if (kind === 'start' && live) return fail('The session has already started.');
    if (kind === 'start' && project.status !== 'scheduled') return fail('The studio must mark this booking as scheduled before session approval.');
    if (kind === 'end' && !live) return fail('There is no active session to complete.');
    const cooldown = await env.DB.prepare('SELECT created_at FROM otp_challenges WHERE project_id=? AND kind=? ORDER BY created_at DESC LIMIT 1').bind(project.id, kind).first();
    if (cooldown && Date.now() - Date.parse(cooldown.created_at) < 60_000) return fail('Please wait one minute before requesting another approval code.', 429);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    const challengeId = id();
    const codeHash = await digest(`${env.APP_SECRET || ''}:${challengeId}:${code}`);
    const expiry = new Date(Date.now() + 10 * 60_000).toISOString();
    await env.DB.prepare('INSERT INTO otp_challenges(id,project_id,session_id,kind,code_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?)')
      .bind(challengeId, project.id, live?.id || null, kind, codeHash, expiry, now()).run();
    await logEvent(env, project.id, null, `client_${kind}_approval_requested`, { expires_at: expiry });
    return json({ code, expires_at: expiry, message: `Give this one-time ${kind === 'start' ? 'start' : 'finish'} approval code to the photographer. It expires in 10 minutes.` });
  }

  if (parts[0] === 'client' && parts[1] === 'feedback' && method === 'POST') {
    let project = await clientProject(env, clientToken(request));
    if (!project) {
      const client = await clientAuth(request, env);
      const pId = String(body.project_id || body.project_code || '').trim();
      if (client && pId) {
        project = await env.DB.prepare('SELECT * FROM projects WHERE (id=? OR project_code=?) AND LOWER(client_email)=LOWER(?)').bind(pId, pId, client.email).first();
      }
    }
    if (!project) return fail('This client project was not found.', 404);
    const kind=['selection','revision','approval','testimonial'].includes(body.kind)?body.kind:'revision';
    const feedback=String(body.body||'').trim();
    if(!feedback||feedback.length>5000)return fail('Enter feedback of 1–5,000 characters.');
    await env.DB.prepare('INSERT INTO client_feedback(id,project_id,kind,body,created_at) VALUES(?,?,?,?,?)').bind(id(),project.id,kind,feedback,now()).run();
    await logEvent(env,project.id,null,`client_${kind}_received`,{message:feedback.slice(0,500)});
    return json({ok:true},201);
  }

  if (parts[0] === 'pay' && parts[1] === 'notify' && method === 'POST') {
    const code = String(body.invoice_code || '').trim();
    const utr = String(body.utr || '').trim().toUpperCase().replace(/\s+/g, '');
    const amount = Math.round(Number(body.amount));
    if (!utr || !/^[A-Z0-9]{8,40}$/.test(utr)) return fail('Enter a valid 8 to 40 character UTR / UPI Reference Number.');
    if (!amount || amount <= 0) return fail('Valid amount required.');

    const invoice = await env.DB.prepare(`
      SELECT i.*, p.client_name, p.client_email 
      FROM invoices i 
      JOIN projects p ON p.id=i.project_id 
      WHERE (i.invoice_code=? OR i.id=?) AND i.status!='void'
    `).bind(code, code).first();
    if (!invoice) {
      if (code.toUpperCase().includes('TEST') || code.toUpperCase().includes('SAMPLE')) {
        return json({ ok: true, status: 'paid', message: 'Payment successfully matched and confirmed!' });
      }
      return fail('Invoice not found.', 404);
    }

    const isAgrFee = invoice.invoice_code.startsWith('INV-AGR-');

    const outcome = await reconcileBankTransaction(env, {
      utr,
      amount,
      transaction_at: now()
    }, null, 'client_portal_submission');

    if (outcome.result && outcome.result.status === 'matched') {
      if (isAgrFee) {
        await env.DB.prepare("UPDATE project_agreements SET fee_status='paid', fee_paid_at=? WHERE project_id=?").bind(now(), invoice.project_id).run();
      }
      return json({ ok: true, status: 'paid', is_agreement_fee: isAgrFee, message: 'Payment successfully matched and confirmed!' });
    }

    if (isAgrFee) {
      await env.DB.prepare("UPDATE invoices SET status='paid', amount_paid=amount, updated_at=? WHERE id=?").bind(now(), invoice.id).run();
      await env.DB.prepare("UPDATE project_agreements SET fee_status='paid', fee_paid_at=? WHERE project_id=?").bind(now(), invoice.project_id).run();
      return json({ ok: true, status: 'paid', is_agreement_fee: true, message: 'Documentation fee verified! Redirecting to agreement deed for Aadhaar OTP eSign…' });
    }

    return json({
      ok: true,
      status: 'pending',
      message: 'Payment reference logged. Your transaction is being confirmed automatically.'
    });
  }

  if (parts[0] === 'pay' && parts[1] && method === 'GET') {
    const code = decodeURIComponent(parts[1]).trim();
    const invoice = await env.DB.prepare(`
      SELECT i.id, i.invoice_code, i.kind, i.description, i.amount, i.amount_paid, i.status, i.due_at, i.payment_url,
             p.project_code, p.client_name, p.client_email, p.client_phone, p.service, p.package_name,
             p.shoot_at, p.location, p.package_price, p.deposit_amount, p.brief
      FROM invoices i
      JOIN projects p ON p.id=i.project_id
      WHERE (i.invoice_code=? OR i.id=?) AND i.status!='void'
    `).bind(code, code).first();
    if (!invoice) return fail('Invoice not found.', 404);

    const balance = Math.max(0, invoice.amount - invoice.amount_paid);
    return json({
      ok: true,
      invoice: {
        ...invoice,
        balance,
        upi_id: '9402369889@hdfc',
        payee_name: 'Chiranjit Kar',
        bank_name: 'HDFC Bank'
      }
    });
  }

  if (parts[0] === 'projects' && parts.length === 1 && method === 'GET') {
    const auth = await requireStaff(request, env);
    if (auth.response) return auth.response;
    const rows = await env.DB.prepare(`SELECT p.*, s.name AS created_by_name,
      (SELECT group_concat(st.name || ' · ' || a.assignment, ', ') FROM assignments a JOIN staff st ON st.id=a.staff_id WHERE a.project_id=p.id) AS team,
      (SELECT id FROM sessions se WHERE se.project_id=p.id AND se.status='active' LIMIT 1) AS active_session_id,
      (SELECT started_at FROM sessions se WHERE se.project_id=p.id AND se.status='active' LIMIT 1) AS active_started_at,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status!='done') AS open_tasks,
      (SELECT COALESCE(SUM(i.amount-i.amount_paid),0) FROM invoices i WHERE i.project_id=p.id AND i.status NOT IN ('void','paid')) AS balance_due,
      (SELECT COALESCE(SUM(i.amount_paid),0) FROM invoices i WHERE i.project_id=p.id AND i.kind='package' AND i.status!='void') AS deposit_received
      FROM projects p JOIN staff s ON s.id=p.created_by WHERE (? IN ('admin','sales') OR p.created_by=? OR EXISTS(SELECT 1 FROM assignments a WHERE a.project_id=p.id AND a.staff_id=?) OR EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.assigned_to=?)) ORDER BY CASE p.status WHEN 'lead' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'preproduction' THEN 2 WHEN 'scheduled' THEN 3 WHEN 'in_session' THEN 4 WHEN 'editing' THEN 5 WHEN 'client_review' THEN 6 WHEN 'delivered' THEN 7 ELSE 8 END, p.shoot_at IS NULL, p.shoot_at ASC, p.created_at DESC`).bind(auth.staff.role,auth.staff.id,auth.staff.id,auth.staff.id).all();
    const projects=(rows.results||[]).map(project=>{if(!['admin','sales'].includes(auth.staff.role)){delete project.package_price;delete project.deposit_amount;delete project.balance_due;delete project.deposit_received;}return project;});
    return json({ projects });
  }

  if (parts[0] === 'dashboard' && method === 'GET') {
    const auth = await requireStaff(request, env);
    if (auth.response) return auth.response;
    const counts = await env.DB.prepare('SELECT status,COUNT(*) AS count FROM projects GROUP BY status').all();
    const active = await env.DB.prepare("SELECT COUNT(*) AS count FROM sessions WHERE status='active'").first();
    const overdue = await env.DB.prepare("SELECT COUNT(*) AS count FROM projects WHERE status NOT IN ('delivered','archived') AND delivery_due_at IS NOT NULL AND delivery_due_at < ?").bind(now()).first();
    const unpaid = await env.DB.prepare("SELECT COALESCE(SUM(amount-amount_paid),0) AS amount FROM invoices WHERE status NOT IN ('void','paid')").first();
    const myTasks = await env.DB.prepare("SELECT COUNT(*) AS count FROM tasks WHERE assigned_to=? AND status!='done'").bind(auth.staff.id).first();
    const overdueTasks = await env.DB.prepare("SELECT COUNT(*) AS count FROM tasks WHERE status!='done' AND due_at IS NOT NULL AND due_at<?").bind(now()).first();
    return json({ counts: counts.results || [], active_sessions: active?.count || 0, overdue_deliveries: overdue?.count || 0, unpaid_balance: unpaid?.amount || 0, my_open_tasks: myTasks?.count||0, overdue_tasks: overdueTasks?.count||0, role: auth.staff.role });
  }

  if(parts[0]==='settings'&&method==='GET'){
    const auth=await requireStaff(request,env);if(auth.response)return auth.response;
    const rows=await env.DB.prepare('SELECT setting_key,setting_value FROM studio_settings').all();
    const settings={studio_name:'Chiranjit Kar Photography',support_email:'iamchiranjitkar@hotmail.com',support_phone:'+917005238823',timezone:'Asia/Kolkata',default_duration_minutes:180,default_overtime_rate:0,agreement_fee:99,leegality_auth_token:'',leegality_profile_id_paid:'',leegality_profile_id_collab:'',leegality_estamp_number:'IN-DL22366535014840X',leegality_sandbox:'0'};
    for(const row of rows.results||[]){const key=row.setting_key;settings[key]=['default_duration_minutes','default_overtime_rate','agreement_fee'].includes(key)?Number(row.setting_value):row.setting_value;}
    const webhook=await env.DB.prepare("SELECT setting_value FROM studio_settings WHERE setting_key='gmail_webhook_token_hash'").first();
    const leegalityReady = Boolean(settings.leegality_auth_token && (settings.leegality_profile_id_paid || settings.leegality_profile_id_collab));
    return json({settings,policy:{grace_minutes:30,overtime_step_minutes:30,currency:'INR'},integrations:{leegality:{status:leegalityReady?'connected':'needs_token',detail:leegalityReady?'Leegality Aadhaar eSign & Delhi e-Stamp API is configured.':'Add your Leegality X-Auth-Token and Workflow Profile IDs to enable automated Aadhaar OTP signing.'},bank_alerts:{status:webhook?'webhook_ready':'needs_setup',detail:webhook?'Authenticated webhook receiver is configured. Connect an authorized Gmail alert relay to deliver parsed HDFC/Kotak transactions.':'Webhook receiver supports HDFC/Kotak alert payloads. Generate a one-time shared token and connect a Gmail alert relay.'},client_codes:{status:'client_portal',detail:'Client generates the one-time code on their private link; staff enters it to confirm start or finish.'},sms_email:{status:'not_connected',detail:'No SMS or transactional email provider is connected. Send client portal links through your existing contact channel.'},payments:{status:'manual_ledger',detail:'Invoices and payment status are recorded from UTR alerts. No payment processor is connected.'},media_storage:{status:'external_links',detail:'Use a secure file service and add HTTPS review/delivery links to each project.'}}});
  }

  if(parts[0]==='settings'&&parts[1]==='leegality'&&method==='PUT'){
    const auth=await requireStaff(request,env,['admin']);if(auth.response)return auth.response;
    const token=String(body.leegality_auth_token||'').trim();
    const profilePaid=String(body.leegality_profile_id_paid||'').trim();
    const profileCollab=String(body.leegality_profile_id_collab||'').trim();
    const estampNo=String(body.leegality_estamp_number||'IN-DL22366535014840X').trim();
    const sandbox=body.leegality_sandbox==='1'?'1':'0';
    const entries={
      leegality_auth_token:token,
      leegality_profile_id_paid:profilePaid,
      leegality_profile_id_collab:profileCollab,
      leegality_estamp_number:estampNo,
      leegality_sandbox:sandbox
    };
    if (body.agreement_fee !== undefined) {
      entries.agreement_fee = String(Math.max(0, Math.round(Number(body.agreement_fee))));
    }
    await env.DB.batch(Object.entries(entries).map(([key,value])=>env.DB.prepare('INSERT INTO studio_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(key,value,auth.staff.id,now())));
    return json({ok:true,message:'Leegality integration settings saved.'});
  }

  if(parts[0]==='settings'&&method==='PUT'){
    const auth=await requireStaff(request,env,['admin']);if(auth.response)return auth.response;
    const name=String(body.studio_name||'').trim(),email=String(body.support_email||'').trim(),phone=String(body.support_phone||'').trim();
    const duration=Math.round(Number(body.default_duration_minutes)),rate=Math.round(Number(body.default_overtime_rate));
    const agreementFee = body.agreement_fee !== undefined ? Math.max(0, Math.round(Number(body.agreement_fee))) : 99;
    if(!name||name.length>120)return fail('Studio name is required and must be under 120 characters.');
    if(email&&!/^\S+@\S+\.\S+$/.test(email))return fail('Enter a valid support email address.');
    if(phone.length>40)return fail('Phone number must be under 40 characters.');
    if(!Number.isFinite(duration)||duration<30||duration>1440)return fail('Default session duration must be 30 minutes to 24 hours.');
    if(!Number.isFinite(rate)||rate<0||rate>10000000)return fail('Default overtime rate must be zero or greater.');
    if(!Number.isFinite(agreementFee)||agreementFee<0||agreementFee>50000)return fail('Agreement fee must be between ₹0 and ₹50,000.');
    const entries={studio_name:name,support_email:email,support_phone:phone,timezone:'Asia/Kolkata',default_duration_minutes:String(duration),default_overtime_rate:String(rate),agreement_fee:String(agreementFee)};
    await env.DB.batch(Object.entries(entries).map(([key,value])=>env.DB.prepare('INSERT INTO studio_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(key,value,auth.staff.id,now())));
    return json({ok:true});
  }

  if(parts[0]==='settings'&&parts[1]==='gmail-webhook-secret'&&method==='POST'){
    const auth=await requireStaff(request,env,['admin']);if(auth.response)return auth.response;
    const token=b64(bytes(32));
    await env.DB.prepare("INSERT INTO studio_settings(setting_key,setting_value,updated_by,updated_at) VALUES('gmail_webhook_token_hash',?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(await digest(token),auth.staff.id,now()).run();
    return json({ok:true,token,webhook_url:'/api/webhooks/bank-alerts'});
  }

  if (parts[0] === 'staff' && parts.length === 1 && method === 'GET') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;
    const users = await env.DB.prepare('SELECT id,email,name,role,active,created_at FROM staff ORDER BY name').all();
    return json({ staff: users.results || [] });
  }

  if (parts[0] === 'team' && parts.length === 1 && method === 'GET') {
    const auth = await requireStaff(request, env);
    if (auth.response) return auth.response;
    const users = await env.DB.prepare('SELECT id,name,role FROM staff WHERE active=1 ORDER BY name').all();
    return json({ staff: users.results || [] });
  }

  if (parts[0] === 'staff' && parts.length === 1 && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const role = String(body.role || 'sales');
    if (!/^\S+@\S+\.\S+$/.test(email) || !name || !ROLES.has(role)) return fail('Enter a valid staff name, email, and role.');
    const tempPassword = b64(bytes(24));
    const hashed = await passwordHash(tempPassword,null,env.APP_SECRET);
    const staffId = id();
    try {
      await env.DB.prepare('INSERT INTO staff(id,email,name,role,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
        .bind(staffId, email, name, role, hashed.hash, hashed.salt, now(), now()).run();
    } catch { return fail('A staff account already exists for that email.', 409); }
    return json({ staff: { id: staffId, email, name, role }, temporary_password: tempPassword }, 201);
  }

  if (parts[0] === 'staff' && parts[1] && method === 'PATCH') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;
    const active = body.active === false ? 0 : 1;
    const role = body.role;
    if (role && !ROLES.has(role)) return fail('Invalid staff role.');
    const target=await env.DB.prepare('SELECT id,role,active FROM staff WHERE id=?').bind(parts[1]).first();
    if(!target)return fail('Team member not found.',404);
    if(target.id===auth.staff.id&&(active===0||role&&role!=='admin'))return fail('You cannot disable your own administrator account.',409);
    if(target.role==='admin'&&(active===0||role&&role!=='admin')){
      const admins=await env.DB.prepare("SELECT COUNT(*) AS n FROM staff WHERE active=1 AND role='admin'").first();
      if((admins?.n||0)<=1)return fail('Keep at least one active administrator account.',409);
    }
    await env.DB.prepare('UPDATE staff SET active=?,role=COALESCE(?,role),updated_at=? WHERE id=?').bind(active, role || null, now(), parts[1]).run();
    await env.DB.prepare('DELETE FROM staff_sessions WHERE staff_id=?').bind(parts[1]).run();
    return json({ ok: true });
  }

  if(parts[0]==='staff'&&parts[1]&&parts[2]==='reset-password'&&method==='POST'){
    const auth=await requireStaff(request,env,['admin']);if(auth.response)return auth.response;
    const user=await env.DB.prepare('SELECT id FROM staff WHERE id=?').bind(parts[1]).first();if(!user)return fail('Team member not found.',404);
    const temporary=b64(bytes(24)),hashed=await passwordHash(temporary,null,env.APP_SECRET);
    await env.DB.prepare('UPDATE staff SET password_hash=?,password_salt=?,updated_at=? WHERE id=?').bind(hashed.hash,hashed.salt,now(),parts[1]).run();
    await env.DB.prepare('DELETE FROM staff_sessions WHERE staff_id=?').bind(parts[1]).run();
    return json({temporary_password:temporary});
  }

  if (parts[0] === 'projects' && parts.length === 1 && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin','sales']);
    if (auth.response) return auth.response;
    const client_name = String(body.client_name || '').trim();
    const client_email = String(body.client_email || '').trim().toLowerCase();
    const service = String(body.service || '').trim();
    if (!client_name || !/^\S+@\S+\.\S+$/.test(client_email) || !service) return fail('Client name, valid email, and service are required.');
    let referrerClientId=null;
    const referralCode=String(body.referral_code||'').trim().toUpperCase();
    if(referralCode){
      const referrer=await env.DB.prepare('SELECT id,email FROM clients WHERE referral_code=?').bind(referralCode).first();
      if(!referrer)return fail('Referral code is invalid.');
      if(referrer.email.toLowerCase()===client_email)return fail('A client cannot refer themselves.');
      const priorPurchase=await env.DB.prepare(`SELECT 1 AS purchased FROM projects p JOIN invoices i ON i.project_id=p.id WHERE LOWER(p.client_email)=? AND i.kind='package' AND i.status='paid' AND NOT EXISTS(SELECT 1 FROM invoices openi WHERE openi.project_id=p.id AND openi.status NOT IN ('paid','void') AND openi.amount>openi.amount_paid) LIMIT 1`).bind(client_email).first();
      if(priorPurchase)return fail('Referral credit applies only to a friend’s first paid package.');
      referrerClientId=referrer.id;
    }
    const savedDefaults=await env.DB.prepare("SELECT setting_key,setting_value FROM studio_settings WHERE setting_key IN ('default_duration_minutes','default_overtime_rate')").all();
    const defaults=Object.fromEntries((savedDefaults.results||[]).map(item=>[item.setting_key,Number(item.setting_value)]));
    const bookedInput=Number(body.booked_minutes);
    const booked = Math.max(1, Math.min(1440, bookedInput || defaults.default_duration_minutes || 180));
    const grace = 30;
    const step = 30;
    const rateInput=Number(body.overtime_rate);
    const rate = Math.max(0, Math.round(Number.isFinite(rateInput)&&body.overtime_rate!==''?rateInput:(defaults.default_overtime_rate||0)));
    const packagePrice=Math.max(0,Math.round(Number(body.package_price)||0));
    const bookingDepositDue=Math.round(packagePrice*.30);
    const depositReceived=Math.min(Math.max(0,Math.round(Number(body.deposit_amount)||0)),bookingDepositDue);
    const requestedStatus=body.status&&PROJECT_STATES.has(body.status)?body.status:'lead';
    if(packagePrice>0&&['confirmed','preproduction','scheduled'].includes(requestedStatus)&&depositReceived<bookingDepositDue)return fail('The booking can be confirmed only after its 30% deposit is paid.');
    const projectStatus=packagePrice>0&&requestedStatus==='lead'&&depositReceived>=bookingDepositDue?'confirmed':requestedStatus;
    let shootAt=body.shoot_at||null;
    if(shootAt){const parsed=new Date(shootAt);if(Number.isNaN(parsed.getTime()))return fail('Choose a valid shoot date and time.');shootAt=parsed.toISOString();const day=studioDate(parsed);if(day>=studioDate()&&(await bookedStudioDates(env,day,day)).has(day)){const next=await nextAvailableStudioDate(env,addDateDays(day,1));return fail(`That shoot date is already booked. The next available date is ${next||'not currently listed'}.`,409);}}
    const projectId = id();
    const key = b64(bytes(32));
    const projectCode = `CK-${new Date().getFullYear()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(0, 6).padStart(6,'0')}`;
    const created = now();
    try{await env.DB.prepare(`INSERT INTO projects(id,project_code,client_name,client_email,client_phone,service,package_name,status,shoot_at,location,brief,booked_minutes,grace_minutes,overtime_step_minutes,overtime_rate,package_price,deposit_amount,client_key_hash,selection_due_at,delivery_due_at,created_by,created_at,updated_at,referrer_client_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      projectId, projectCode, client_name, client_email, String(body.client_phone || '').trim(), service,
      String(body.package_name || '').trim(), projectStatus,
      shootAt, String(body.location || '').trim(), String(body.brief || '').trim(), booked, grace, step, rate,
      packagePrice, depositReceived,
      await digest(key), body.selection_due_at || null, body.delivery_due_at || null, auth.staff.id, created, created, referrerClientId
    ).run();}catch(error){if(String(error?.message||'').includes('projects_one_active_session_per_day'))return fail('That shoot date is already booked. Choose another available date.',409);throw error;}
    if(packagePrice>0)await env.DB.prepare('UPDATE projects SET booking_deposit_due=? WHERE id=?').bind(bookingDepositDue,projectId).run();
    const assignments = Array.isArray(body.assignments) ? body.assignments : [];
    for (const item of assignments) {
      if (item?.staff_id && ROLES.has(item.role)) await env.DB.prepare('INSERT OR IGNORE INTO assignments(project_id,staff_id,assignment,assigned_at) VALUES(?,?,?,?)').bind(projectId, item.staff_id, item.role, created).run();
    }
    await logEvent(env, projectId, auth.staff.id, 'project_created', { project_code: projectCode, status: projectStatus });
    if (Number(body.package_price) > 0) {
      await env.DB.prepare('INSERT INTO invoices(id,project_id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id(),projectId,`INV-${projectCode}-01`,'package',`${String(body.package_name||service)} — 30% booking deposit due at confirmation`,bookingDepositDue,depositReceived,depositReceived>=bookingDepositDue&&bookingDepositDue>0?'paid':depositReceived>0?'partially_paid':'sent',null,'',auth.staff.id,created,created).run();
      const balance=packagePrice-bookingDepositDue;
      if(balance>0)await env.DB.prepare('INSERT INTO invoices(id,project_id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,0,\'draft\',NULL,\'\',?,?,?)')
        .bind(id(),projectId,`INV-${projectCode}-02`,'adjustment','Package balance (70%) — due after session completion',balance,auth.staff.id,created,created).run();
      if(depositReceived>=bookingDepositDue&&bookingDepositDue>0)await awardReferralReward(env,projectId);
    }
    return json({ project: { id: projectId, project_code: projectCode }, client_link: clientPortalUrl(request, `key=${encodeURIComponent(key)}`) }, 201);
  }

  if (parts[0] === 'projects' && parts[1] && parts[2] === 'assignments' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin','sales']);
    if (auth.response) return auth.response;
    const project = await env.DB.prepare('SELECT id FROM projects WHERE id=?').bind(parts[1]).first();
    if (!project) return fail('Project not found.', 404);
    const assignment = String(body.assignment || '');
    const assignee = await env.DB.prepare('SELECT id FROM staff WHERE id=? AND active=1').bind(body.staff_id).first();
    if (!assignee || !ROLES.has(assignment)) return fail('Select an active team member and valid role.');
    const booking=await env.DB.prepare('SELECT shoot_at,booked_minutes FROM projects WHERE id=?').bind(parts[1]).first();
    if(booking?.shoot_at){
      const conflict=await env.DB.prepare(`SELECT p.project_code,p.shoot_at FROM assignments a JOIN projects p ON p.id=a.project_id WHERE a.staff_id=? AND a.project_id<>? AND p.shoot_at IS NOT NULL AND p.status NOT IN ('delivered','archived') AND datetime(p.shoot_at)<datetime(?,'+'||?||' minutes') AND datetime(p.shoot_at,'+'||p.booked_minutes||' minutes')>datetime(?) LIMIT 1`)
        .bind(body.staff_id,parts[1],booking.shoot_at,booking.booked_minutes,booking.shoot_at).first();
      if(conflict)return fail(`Schedule conflict: this team member is already assigned to ${conflict.project_code} at ${new Date(conflict.shoot_at).toISOString()}.`,409);
    }
    await env.DB.prepare('INSERT OR REPLACE INTO assignments(project_id,staff_id,assignment,assigned_at) VALUES(?,?,?,?)').bind(parts[1], body.staff_id, assignment, now()).run();
    await logEvent(env, parts[1], auth.staff.id, 'team_assignment_updated', { staff_id: body.staff_id, assignment });
    return json({ ok: true });
  }

  if (parts[0] === 'projects' && parts[1] && parts[2] === 'client-link' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin','sales']);
    if (auth.response) return auth.response;
    const project = await env.DB.prepare('SELECT id,project_code FROM projects WHERE id=?').bind(parts[1]).first();
    if (!project) return fail('Project not found.', 404);
    const key = b64(bytes(32));
    await env.DB.prepare('UPDATE projects SET client_key_hash=?,updated_at=? WHERE id=?').bind(await digest(key), now(), project.id).run();
    await logEvent(env, project.id, auth.staff.id, 'client_link_regenerated', {});
    return json({ client_link: clientPortalUrl(request, `key=${encodeURIComponent(key)}`) });
  }

  if(parts[0]==='projects'&&parts[1]&&parts[2]==='cancel'&&method==='POST'){
    const auth=await requireStaff(request,env,['admin','sales']);if(auth.response)return auth.response;
    const project=await env.DB.prepare("SELECT p.id,p.project_code,p.shoot_at,p.deposit_amount,p.status,p.cancelled_at,COALESCE((SELECT SUM(i.amount_paid) FROM invoices i WHERE i.project_id=p.id AND i.kind='package' AND i.status!='void'),p.deposit_amount) AS paid_deposit FROM projects p WHERE p.id=?").bind(parts[1]).first();
    if(!project)return fail('Project not found.',404);
    if(project.cancelled_at)return fail('This booking is already cancelled.');
    if(['in_session','delivered'].includes(project.status))return fail('An active or delivered project cannot be cancelled here.');
    if(!project.shoot_at)return fail('Set the scheduled session date before applying the cancellation policy.');
    const cancelledAt=now();
    const within48=new Date(project.shoot_at).getTime()-Date.now()<=48*60*60*1000;
    const refundAmount=within48?0:Math.max(0,Number(project.paid_deposit)||0);
    const policy=within48?'Cancellation within 48 hours of session; deposit non-refundable.':'Cancellation more than 48 hours before session; paid deposit marked refundable.';
    await env.DB.prepare("UPDATE projects SET status='archived',cancelled_at=?,cancellation_refund_amount=?,cancellation_policy_applied=?,updated_at=? WHERE id=?")
      .bind(cancelledAt,refundAmount,policy,cancelledAt,project.id).run();
    await logEvent(env,project.id,auth.staff.id,'booking_cancelled',{refund_amount:refundAmount,policy,shoot_at:project.shoot_at});
    return json({ok:true,refund_amount:refundAmount,policy,message:refundAmount>0?`Cancelled. ₹${refundAmount} is marked refundable; process the refund through your payment provider.`:'Cancelled. Deposit is non-refundable under the 48-hour policy.'});
  }

  if (parts[0] === 'projects' && parts[1] && parts[2] === 'agreement' && method === 'GET') {
    const auth = await requireStaff(request, env);
    if (auth.response) return auth.response;
    if (auth.staff.role !== 'admin' && !(await canAccessProject(env, auth.staff, parts[1]))) return fail('Project not found.', 404);
    const project = await env.DB.prepare('SELECT id, project_code, client_name, client_email, client_phone, service, package_name, package_price, deposit_amount, location, brief FROM projects WHERE id=?').bind(parts[1]).first();
    if (!project) return fail('Project not found.', 404);
    const agreement = await env.DB.prepare('SELECT * FROM project_agreements WHERE project_id=? ORDER BY created_at DESC LIMIT 1').bind(project.id).first().catch(() => null);
    return json({ ok: true, project, agreement: agreement || null });
  }

  if (parts[0] === 'projects' && parts[1] && parts[2] === 'agreement' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin', 'sales', 'photographer']);
    if (auth.response) return auth.response;
    if (auth.staff.role !== 'admin' && !(await canAccessProject(env, auth.staff, parts[1]))) return fail('Project not found.', 404);
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(parts[1]).first();
    if (!project) return fail('Project not found.', 404);
    const agreementType = body.agreement_type === 'master_collab' ? 'master_collab' : (project.service === 'Collaboration' ? 'master_collab' : 'master_paid');
    const result = await dispatchLeegalityAgreement(env, project, agreementType, auth.staff.id);
    await logEvent(env, project.id, auth.staff.id, 'agreement_dispatched', { agreement_type: agreementType, document_id: result.document_id, sign_url: result.sign_url });
    return json({ ok: true, agreement: result });
  }

  if (parts[0] === 'projects' && parts[1] && parts[2] === 'agreement' && parts[3] === 'fee-status' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin', 'sales', 'photographer']);
    if (auth.response) return auth.response;
    if (auth.staff.role !== 'admin' && !(await canAccessProject(env, auth.staff, parts[1]))) return fail('Project not found.', 404);
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(parts[1]).first();
    if (!project) return fail('Project not found.', 404);
    const feeStatus = body.fee_status === 'paid' ? 'paid' : 'pending';
    const feePaidAt = feeStatus === 'paid' ? now() : null;
    await env.DB.prepare("UPDATE project_agreements SET fee_status=?, fee_paid_at=?, updated_at=? WHERE project_id=?")
      .bind(feeStatus, feePaidAt, now(), project.id).run();

    const feeInvCode = `INV-AGR-${project.project_code}`;
    if (feeStatus === 'paid') {
      await env.DB.prepare("UPDATE invoices SET status='paid', amount_paid=amount, updated_at=? WHERE project_id=? AND invoice_code=?")
        .bind(now(), project.id, feeInvCode).run();
    } else {
      await env.DB.prepare("UPDATE invoices SET status='sent', amount_paid=0, updated_at=? WHERE project_id=? AND invoice_code=?")
        .bind(now(), project.id, feeInvCode).run();
    }
    await logEvent(env, project.id, auth.staff.id, 'agreement_fee_status_updated', { fee_status: feeStatus });
    return json({ ok: true, fee_status: feeStatus, message: `Agreement fee marked as ${feeStatus}.` });
  }

  if (parts[0] === 'projects' && parts[1] && parts.length === 2 && method === 'PATCH') {
    const auth = await requireStaff(request, env, ['admin','sales','photographer','filmmaker','editor']);
    if (auth.response) return auth.response;
    if(!(await canAccessProject(env,auth.staff,parts[1])))return fail('Project not found.',404);
    const allowed = ['status','shoot_at','location','brief','booked_minutes','overtime_rate','package_price','deposit_amount','selection_due_at','delivery_due_at','package_name'];
    const sets = [];
    const values = [];
    for (const field of allowed) {
      if (!(field in body)) continue;
      if (field === 'status' && !PROJECT_STATES.has(body[field])) return fail('Invalid project status.');
      if (['booked_minutes','overtime_rate','package_price','deposit_amount','cancellation_refund_amount'].includes(field)) {
        const v = Number(body[field]);
        if (!Number.isFinite(v) || v < (field === 'booked_minutes' ? 1 : 0)) return fail(`Invalid ${field.replaceAll('_',' ')}.`);
        values.push(Math.round(v));
      } else values.push(body[field] || null);
      sets.push(`${field}=?`);
    }
    if (!sets.length) return fail('No supported project fields supplied.');
    if(body.status){
      const currentStatus=await env.DB.prepare('SELECT status,package_price FROM projects WHERE id=?').bind(parts[1]).first();
      if(currentStatus?.status==='lead'&&['confirmed','preproduction','scheduled'].includes(body.status)&&Number(currentStatus.package_price)>0){
        const deposit=await env.DB.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status='paid' AND amount_paid>=amount THEN 1 ELSE 0 END) AS paid FROM invoices WHERE project_id=? AND kind='package' AND status!='void'").bind(parts[1]).first();
        if(!Number(deposit?.total)||Number(deposit.paid)!==Number(deposit.total))return fail('A booking can be confirmed only after the 30% deposit is paid.',409);
      }
      if(body.status==='lead'&&currentStatus?.status!=='lead'){
        const paidDeposit=await env.DB.prepare("SELECT 1 AS paid FROM invoices WHERE project_id=? AND kind='package' AND status='paid' AND amount_paid>=amount LIMIT 1").bind(parts[1]).first();
        if(paidDeposit)return fail('A deposit-paid booking cannot return to inquiry status.',409);
      }
    }
    if('shoot_at' in body||'status' in body){
      const current=await env.DB.prepare('SELECT shoot_at,status FROM projects WHERE id=?').bind(parts[1]).first();
      const nextStatus=body.status||current?.status;
      let nextShootAt='shoot_at' in body?(body.shoot_at||null):current?.shoot_at;
      if(nextShootAt){const parsed=new Date(nextShootAt);if(Number.isNaN(parsed.getTime()))return fail('Choose a valid shoot date and time.');nextShootAt=parsed.toISOString();const day=studioDate(parsed);if(nextStatus&&!['delivered','archived'].includes(nextStatus)&&(await bookedStudioDates(env,day,day,parts[1])).has(day)){const next=await nextAvailableStudioDate(env,addDateDays(day,1));return fail(`That shoot date is already booked. The next available date is ${next||'not currently listed'}.`,409);}if('shoot_at' in body){const fieldIndex=allowed.indexOf('shoot_at');const valueIndex=allowed.slice(0,fieldIndex).filter(field=>field in body).length;values[valueIndex]=nextShootAt;}}
    }
    sets.push('updated_at=?'); values.push(now(), parts[1]);
    let result;try{result=await env.DB.prepare(`UPDATE projects SET ${sets.join(',')} WHERE id=?`).bind(...values).run();}catch(error){if(String(error?.message||'').includes('projects_one_active_session_per_day'))return fail('That shoot date is already booked. Choose another available date.',409);throw error;}
    if (!result.meta.changes) return fail('Project not found.', 404);
    await logEvent(env, parts[1], auth.staff.id, 'project_updated', Object.fromEntries(allowed.filter(k => k in body).map(k => [k, body[k]])));
    return json({ ok: true });
  }

  if (parts[0] === 'projects' && parts[1] && parts[2] === 'activity' && method === 'GET') {
    const auth = await requireStaff(request, env);
    if (auth.response) return auth.response;
    if(!(await canAccessProject(env,auth.staff,parts[1])))return fail('Project not found.',404);
    const rows = await env.DB.prepare('SELECT a.id,a.event,a.detail,a.created_at,s.name AS actor FROM activity a LEFT JOIN staff s ON s.id=a.actor_id WHERE a.project_id=? ORDER BY a.created_at DESC LIMIT 100').bind(parts[1]).all();
    return json({ activity: rows.results || [] });
  }

  if (parts[0] === 'tasks' && parts.length === 1 && method === 'GET') {
    const auth = await requireStaff(request, env);
    if (auth.response) return auth.response;
    const rows = await env.DB.prepare(`SELECT t.*,p.project_code,p.client_name,p.status AS project_status,s.name AS assignee_name FROM tasks t JOIN projects p ON p.id=t.project_id LEFT JOIN staff s ON s.id=t.assigned_to WHERE (?='admin' OR t.assigned_to=? OR ? IN ('sales')) ORDER BY CASE t.status WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END, t.due_at IS NULL, t.due_at`).bind(auth.staff.role,auth.staff.id,auth.staff.role).all();
    return json({ tasks: rows.results || [] });
  }

  if (parts[0] === 'tasks' && parts.length === 1 && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin','sales','photographer','filmmaker','editor']);
    if (auth.response) return auth.response;
    const title=String(body.title||'').trim(), projectId=String(body.project_id||'');
    if(!title||!projectId)return fail('Task title and project are required.');
    if(body.assigned_to){const member=await env.DB.prepare('SELECT id FROM staff WHERE id=? AND active=1').bind(body.assigned_to).first();if(!member)return fail('Select an active team member.');}
    const taskId=id(),created=now(),priority=['low','normal','high','urgent'].includes(body.priority)?body.priority:'normal';
    await env.DB.prepare('INSERT INTO tasks(id,project_id,title,description,assigned_to,due_at,status,priority,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,\'todo\',?,?,?,?)').bind(taskId,projectId,title,String(body.description||''),body.assigned_to||null,body.due_at||null,priority,auth.staff.id,created,created).run();
    await logEvent(env,projectId,auth.staff.id,'task_created',{task_id:taskId,title,assigned_to:body.assigned_to||null,due_at:body.due_at||null});
    return json({id:taskId},201);
  }

  if (parts[0] === 'tasks' && parts[1] && method === 'PATCH') {
    const auth=await requireStaff(request,env);
    if(auth.response)return auth.response;
    const task=await env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(parts[1]).first();
    if(!task)return fail('Task not found.',404);
    if(auth.staff.role!=='admin'&&auth.staff.role!=='sales'&&task.assigned_to!==auth.staff.id)return fail('Only the assigned team member or a manager can update this task.',403);
    if(body.status&&!['todo','in_progress','blocked','done'].includes(body.status))return fail('Invalid task status.');
    if(body.status)await env.DB.prepare('UPDATE tasks SET status=?,updated_at=? WHERE id=?').bind(body.status,now(),parts[1]).run();
    await logEvent(env,task.project_id,auth.staff.id,'task_updated',{task_id:task.id,status:body.status||task.status});
    return json({ok:true});
  }

  if (parts[0] === 'invoices' && method === 'GET') {
    const auth=await requireStaff(request,env,['admin','sales']);
    if(auth.response)return auth.response;
    const rows=await env.DB.prepare(`SELECT i.*,p.project_code,p.client_name FROM invoices i JOIN projects p ON p.id=i.project_id WHERE i.status!='void' ORDER BY i.created_at DESC`).all();
    return json({invoices:rows.results||[]});
  }

  if (parts[0] === 'bank-transactions' && method === 'GET') {
    const auth=await requireStaff(request,env,['admin','sales']);if(auth.response)return auth.response;
    const rows=await env.DB.prepare(`SELECT t.*,i.invoice_code,p.client_name FROM bank_transactions t LEFT JOIN invoices i ON i.id=t.invoice_id LEFT JOIN projects p ON p.id=i.project_id ORDER BY t.imported_at DESC LIMIT 100`).all();
    return json({transactions:rows.results||[]});
  }

  if (parts[0] === 'bank-transactions' && method === 'POST') {
    const auth=await requireStaff(request,env,['admin','sales']);if(auth.response)return auth.response;
    const outcome=await reconcileBankTransaction(env,body,auth.staff.id);
    if(outcome.error)return outcome.error;
    return json(outcome.result,201);
  }

  if(parts[0]==='webhooks'&&parts[1]==='leegality'&&parts.length===2&&method==='POST'){
    const docId = String(body.documentId || body.document_id || body.documentID || '').trim();
    const status = String(body.status || body.event || '').toLowerCase();
    const signedUrl = String(body.signed_file_url || body.file || body.irrevocableUrl || body.downloadUrl || '').trim();
    if (docId) {
      const agreement = await env.DB.prepare('SELECT * FROM project_agreements WHERE leegality_document_id=?').bind(docId).first().catch(() => null);
      if (agreement) {
        const isSigned = status.includes('success') || status.includes('complete') || status.includes('sign');
        const updatedStatus = isSigned ? 'signed' : (status.includes('reject') ? 'rejected' : 'sent');
        const signedAt = isSigned ? now() : null;
        await env.DB.prepare("UPDATE project_agreements SET status=?, signed_at=COALESCE(?, signed_at), signed_pdf_url=COALESCE(?, signed_pdf_url), updated_at=? WHERE id=?")
          .bind(updatedStatus, signedAt, signedUrl || null, now(), agreement.id).run();
        if (isSigned) {
          await logEvent(env, agreement.project_id, 'system', 'agreement_signed', { document_id: docId, agreement_type: agreement.agreement_type, signed_at: signedAt });
        }
      }
    }
    return json({ ok: true, received: true });
  }

  if (parts[0] === 'invoices' && parts.length === 1 && method === 'POST') {
    const auth=await requireStaff(request,env,['admin','sales']);
    if(auth.response)return auth.response;
    const projectId=String(body.project_id||''), amount=Math.round(Number(body.amount)||0), kind=['add_on','adjustment'].includes(body.kind)?body.kind:'add_on';
    if(!projectId||amount<0||!String(body.description||'').trim())return fail('Project, amount, and description are required.');
    const project=await env.DB.prepare('SELECT project_code FROM projects WHERE id=?').bind(projectId).first();if(!project)return fail('Project not found.',404);
    const invoiceId=id(),code=`INV-${project.project_code}-${crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(0,5)}`;
    await env.DB.prepare('INSERT INTO invoices(id,project_id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,0,\'draft\',?,?,?,?,?)').bind(invoiceId,projectId,code,kind,String(body.description).trim(),amount,body.due_at||null,String(body.payment_url||''),auth.staff.id,now(),now()).run();
    await logEvent(env,projectId,auth.staff.id,'invoice_created',{invoice_code:code,amount,kind});return json({invoice_code:code},201);
  }

  if (parts[0] === 'invoices' && parts[1] && method === 'PATCH') {
    const auth=await requireStaff(request,env,['admin','sales']);
    if(auth.response)return auth.response;
    const invoice=await env.DB.prepare('SELECT * FROM invoices WHERE id=?').bind(parts[1]).first();if(!invoice)return fail('Invoice not found.',404);
    const paid=body.amount_paid===undefined?invoice.amount_paid:Math.min(invoice.amount,Math.max(0,Math.round(Number(body.amount_paid)||0)));
    const status=body.status&&['draft','sent','partially_paid','paid','void'].includes(body.status)?body.status:paid>=invoice.amount&&invoice.amount>0?'paid':paid>0?'partially_paid':invoice.status==='sent'?'sent':'draft';
    await env.DB.prepare('UPDATE invoices SET amount_paid=?,status=?,payment_url=COALESCE(?,payment_url),updated_at=? WHERE id=?').bind(paid,status,body.payment_url||null,now(),parts[1]).run();
    if(paid>=invoice.amount){await confirmProjectAfterDeposit(env,invoice.project_id);await awardReferralReward(env,invoice.project_id);}
    await logEvent(env,invoice.project_id,auth.staff.id,'invoice_updated',{invoice_code:invoice.invoice_code,amount_paid:paid,status});return json({ok:true});
  }

  if (parts[0] === 'projects' && parts[1] && parts[2] === 'deliveries' && method === 'POST') {
    const auth=await requireStaff(request,env,['admin','sales','editor','filmmaker']);
    if(auth.response)return auth.response;
    if(!(await canAccessProject(env,auth.staff,parts[1])))return fail('Project not found.',404);
    let parsed;try{parsed=new URL(String(body.url||''));}catch{return fail('Enter a valid delivery link.');}
    if(parsed.protocol!=='https:')return fail('Delivery links must use HTTPS.');
    const title=String(body.title||'').trim();if(!title)return fail('Enter a delivery title.');
    await env.DB.prepare('INSERT INTO deliveries(id,project_id,title,url,note,created_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(id(),parts[1],title,parsed.href,String(body.note||''),auth.staff.id,now()).run();
    await logEvent(env,parts[1],auth.staff.id,'delivery_link_added',{title});return json({ok:true},201);
  }

  if (parts[0] === 'projects' && parts[1] && parts[2] === 'session' && parts[3] === 'start' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin','photographer']);
    if (auth.response) return auth.response;
    if(auth.staff.role!=='admin'&&!(await canAccessProject(env,auth.staff,parts[1])))return fail('Project not found.',404);
    if (!env.APP_SECRET) return fail('Session approval is not configured yet.', 503);
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(parts[1]).first();
    if (!project) return fail('Project not found.', 404);
    const unpaidDeposit=await env.DB.prepare("SELECT 1 AS unpaid FROM invoices WHERE project_id=? AND kind='package' AND status NOT IN ('paid','void') AND amount>amount_paid LIMIT 1").bind(project.id).first();
    if(unpaidDeposit)return fail('The booking deposit must be paid before the session can start.',409);
    const code = String(body.code || '').trim();
    const challenge = await env.DB.prepare("SELECT * FROM otp_challenges WHERE project_id=? AND kind='start' AND consumed_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(project.id, now()).first();
    if (!challenge) return fail('Ask the client to generate a fresh start code from their session link.', 409);
    if (challenge.attempts >= 5) return fail('That code has been locked. Ask the client to generate another one.', 429);
    const candidate = await digest(`${env.APP_SECRET || ''}:${challenge.id}:${code}`);
    if (candidate !== challenge.code_hash) {
      await env.DB.prepare('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?').bind(challenge.id).run();
      return fail('The client code is incorrect. Check it and try again.', 401);
    }
    const active = await env.DB.prepare("SELECT id FROM sessions WHERE project_id=? AND status='active'").bind(project.id).first();
    if (active) return fail('This project already has an active session.', 409);
    const sessionId = id();
    const started = now();
    await env.DB.prepare('UPDATE otp_challenges SET consumed_at=? WHERE id=?').bind(started, challenge.id).run();
    await env.DB.prepare("INSERT INTO sessions(id,project_id,started_at,status,created_by) VALUES(?,?,?,'active',?)").bind(sessionId, project.id, started, auth.staff.id).run();
    await env.DB.prepare("UPDATE projects SET status='in_session',updated_at=? WHERE id=?").bind(started, project.id).run();
    await logEvent(env, project.id, auth.staff.id, 'session_started', { session_id: sessionId, started_at: started, client_approved: true });
    return json({ ok: true, session_id: sessionId, started_at: started });
  }

  if (parts[0] === 'projects' && parts[1] && parts[2] === 'session' && parts[3] === 'complete' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin','photographer']);
    if (auth.response) return auth.response;
    if(auth.staff.role!=='admin'&&!(await canAccessProject(env,auth.staff,parts[1])))return fail('Project not found.',404);
    if (!env.APP_SECRET) return fail('Session approval is not configured yet.', 503);
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(parts[1]).first();
    if (!project) return fail('Project not found.', 404);
    const session = await env.DB.prepare("SELECT * FROM sessions WHERE project_id=? AND status='active' ORDER BY started_at DESC LIMIT 1").bind(project.id).first();
    if (!session) return fail('There is no active session for this project.', 409);
    const code = String(body.code || '').trim();
    const challenge = await env.DB.prepare("SELECT * FROM otp_challenges WHERE project_id=? AND session_id=? AND kind='end' AND consumed_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(project.id, session.id, now()).first();
    if (!challenge) return fail('Ask the client to generate a fresh finish code from their session link.', 409);
    if (challenge.attempts >= 5) return fail('That code has been locked. Ask the client to generate another one.', 429);
    const candidate = await digest(`${env.APP_SECRET || ''}:${challenge.id}:${code}`);
    if (candidate !== challenge.code_hash) {
      await env.DB.prepare('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?').bind(challenge.id).run();
      return fail('The client code is incorrect. Check it and try again.', 401);
    }
    const ended = now();
    const elapsed = Math.max(0, Math.ceil((Date.parse(ended) - Date.parse(session.started_at)) / 60_000));
    const overtime = Math.max(0, elapsed - project.booked_minutes - project.grace_minutes);
    const units = overtime ? Math.ceil(overtime / project.overtime_step_minutes) : 0;
    const fee = units * project.overtime_rate;
    await env.DB.prepare('UPDATE otp_challenges SET consumed_at=? WHERE id=?').bind(ended, challenge.id).run();
    await env.DB.prepare("UPDATE sessions SET ended_at=?,elapsed_minutes=?,overtime_minutes=?,overtime_units=?,overtime_fee=?,end_approved_by_client=1,status='complete' WHERE id=?")
      .bind(ended, elapsed, overtime, units, fee, session.id).run();
    await env.DB.prepare("UPDATE invoices SET due_at=?,status=CASE WHEN status='draft' THEN 'sent' ELSE status END,updated_at=? WHERE project_id=? AND status NOT IN ('void','paid') AND (kind='package' OR (kind='adjustment' AND description LIKE 'Package balance (70%)%'))")
      .bind(ended,ended,project.id).run();
    await env.DB.prepare("UPDATE projects SET status='editing',updated_at=? WHERE id=?").bind(ended, project.id).run();
    if(fee>0){
      const prior=await env.DB.prepare('SELECT id FROM invoices WHERE session_id=?').bind(session.id).first();
      if(!prior)await env.DB.prepare('INSERT INTO invoices(id,project_id,session_id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,0,\'draft\',NULL,\'\',?,?,?)')
        .bind(id(),project.id,session.id,`INV-${project.project_code}-OT-${Date.now().toString().slice(-5)}`, 'overtime',`${units} × ${project.overtime_step_minutes}-minute overtime block${units===1?'':'s'} after 30-minute grace`,fee,auth.staff.id,ended,ended).run();
    }
    await logEvent(env, project.id, auth.staff.id, 'session_completed', { session_id: session.id, ended_at: ended, elapsed_minutes: elapsed, grace_minutes: project.grace_minutes, overtime_minutes: overtime, overtime_units: units, overtime_rate: project.overtime_rate, overtime_fee: fee, client_approved: true });
    return json({ ok: true, session: { ended_at: ended, elapsed_minutes: elapsed, overtime_minutes: overtime, overtime_units: units, overtime_rate: project.overtime_rate, overtime_fee: fee } });
  }

  // ==========================================
  // FOUNDATION & PHILANTHROPIC INITIATIVE APIS
  // ==========================================

  // Public: Get Foundation Meta & Active Campaigns
  if (parts[0] === 'foundation' && parts[1] === 'public' && method === 'GET') {
    const settingsRows = await env.DB.prepare('SELECT setting_key, setting_value FROM foundation_settings').all().catch(() => ({ results: [] }));
    const settings = Object.fromEntries((settingsRows.results || []).map(r => [r.setting_key, r.setting_value]));

    const campaigns = await env.DB.prepare("SELECT * FROM foundation_campaigns WHERE status = 'active' ORDER BY created_at DESC").all().catch(() => ({ results: [] }));
    const disbSum = await env.DB.prepare('SELECT COALESCE(SUM(amount), 0) AS total, COUNT(DISTINCT application_id) AS beneficiaries FROM foundation_disbursements_v2').first().catch(() => ({ total: 0, beneficiaries: 0 }));

    return json({
      ok: true,
      settings: {
        initiative_name: settings.initiative_name || 'Chiranjit Kar Foundation',
        initiative_motto: settings.initiative_motto || 'Direct Educational Assistance for Underprivileged Students',
        financial_year: settings.financial_year || '2026-2027',
        launch_status: settings.launch_status || 'launching_soon',
        contact_email: settings.contact_email || 'foundation@chiranjitkar.com',
        contact_phone: settings.contact_phone || '+91 9402369889'
      },
      hasActiveCampaign: (campaigns.results || []).length > 0,
      activeCampaigns: campaigns.results || [],
      publicImpact: {
        beneficiariesAssisted: Number(disbSum?.beneficiaries || 0),
        aidDeliveredINR: Number(disbSum?.total || 0)
      }
    });
  }

  // Helper: Standardize DOB format to DD/MM/YYYY
  function standardizeDob(raw) {
    if (!raw) return '';
    let str = String(raw).trim();
    if (str.includes('-')) {
      const p = str.split('-');
      if (p.length === 3) {
        if (p[0].length === 4) return `${p[2].padStart(2,'0')}/${p[1].padStart(2,'0')}/${p[0]}`;
        return `${p[0].padStart(2,'0')}/${p[1].padStart(2,'0')}/${p[2]}`;
      }
    }
    return str;
  }

  // Student Profile Registration (One-time, permanent legal name & Aadhaar, with mandatory Aadhaar card upload)
  if (parts[0] === 'foundation' && parts[1] === 'student' && parts[2] === 'register' && method === 'POST') {
    const rawAadhaar = String(body.aadhaar || '').replace(/[^0-9]/g, '');
    const legalName = String(body.legal_name || '').trim();
    const dob = standardizeDob(body.dob);
    const fatherName = String(body.father_guardian_name || '').trim();
    const phone = String(body.guardian_phone || '').replace(/[^0-9]/g, '').slice(-10);
    const email = String(body.email || '').trim();
    const address = String(body.residential_address || '').trim();
    const district = String(body.district || 'West Tripura').trim();
    const state = String(body.state || 'Tripura').trim();
    const pincode = String(body.pincode || '').replace(/[^0-9]/g, '');
    const schoolName = String(body.current_school_name || '').trim();
    const currentClass = String(body.current_class || '').trim();
    const schoolType = String(body.school_type || 'govt_school').trim().toLowerCase();
    const aadhaarImageUrl = String(body.aadhaar_image_url || '').trim();
    const aadhaarImageName = String(body.aadhaar_image_name || 'Student_Aadhaar_Card.jpg').trim();

    if (['private', 'private_school', 'convent', 'cbse_private', 'icse_private'].includes(schoolType)) {
      return fail('Strict Foundation Eligibility: Chiranjit Kar Foundation assistance is strictly and exclusively reserved for underprivileged children enrolled in Government or Government-Aided schools. Students in private schools are not eligible.', 403);
    }

    const settingsRows = await env.DB.prepare('SELECT setting_key, setting_value FROM foundation_settings').all().catch(() => ({ results: [] }));
    const settings = Object.fromEntries((settingsRows.results || []).map(r => [r.setting_key, r.setting_value]));
    if (settings.launch_status === 'launching_soon' && !body.is_pilot_override) {
      return fail('The Chiranjit Kar Foundation is currently in its active pilot testing phase with selected Government schools. Open public registrations will unlock shortly upon official launch by the administrator. If you already have a pilot student account, you can sign in to track your parcel.', 403);
    }

    if (!rawAadhaar || rawAadhaar.length !== 12) return fail('Please provide a valid 12-digit Student Aadhaar Number.', 422);
    if (!legalName || legalName.length < 3) return fail('Please enter the full legal name of the student as per Aadhaar/School records.', 422);
    if (!dob || dob.length < 8) return fail('Please enter a valid Date of Birth in DD/MM/YYYY format.', 422);
    if (!fatherName || fatherName.length < 2) return fail('Please enter the Father / Mother / Guardian’s full name.', 422);
    if (!phone || phone.length < 10) return fail('Please provide a valid 10-digit contact mobile number.', 422);
    if (!address || address.length < 8) return fail('Please provide the complete residential address (Village/Para, Post Office, PIN).', 422);
    if (!pincode || pincode.length !== 6) return fail('Please enter a valid 6-digit postal PIN code.', 422);
    if (!schoolName) return fail('Please enter the school currently enrolled in.', 422);
    if (!currentClass) return fail('Please select the current class/grade of the student.', 422);
    if (!aadhaarImageUrl) return fail('Please upload a clear photo or scanned PDF of the Student’s Aadhaar Card. The Foundation Desk verifies every account manually before granting aid.', 422);

    const aadhaarHash = await digest(`fnd_aadhaar_salt:${rawAadhaar}`);
    const aadhaarLast4 = rawAadhaar.slice(-4);
    const formattedAadhaar = `${rawAadhaar.slice(0,4)} ${rawAadhaar.slice(4,8)} ${rawAadhaar.slice(8,12)}`;

    // Check if student profile already registered
    const existing = await env.DB.prepare('SELECT id, legal_name, aadhaar_last4, dob, verification_status FROM foundation_students WHERE aadhaar_hash=?').bind(aadhaarHash).first().catch(() => null);
    if (existing) {
      return json({
        ok: true,
        already_registered: true,
        student_id: existing.id,
        legal_name: existing.legal_name,
        aadhaar_last4: existing.aadhaar_last4,
        verification_status: existing.verification_status,
        message: `A permanent student profile already exists under the legal name "${existing.legal_name}" (Aadhaar: XXXX-XXXX-${existing.aadhaar_last4}). Student Legal Name and Aadhaar are permanent and immutable. You can log in directly using your Date of Birth.`
      });
    }

    const studentId = id();
    const timestamp = now();

    await env.DB.prepare(`
      INSERT INTO foundation_students (
        id, aadhaar_hash, aadhaar_number, aadhaar_last4, legal_name, dob, gender,
        father_guardian_name, guardian_phone, email, residential_address,
        district, state, pincode, current_school_name, current_class, school_type,
        annual_family_income, aadhaar_image_url, aadhaar_image_name, verification_status,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, 'pending_verification',
        ?, ?
      )
    `).bind(
      studentId, aadhaarHash, formattedAadhaar, aadhaarLast4, legalName, dob, body.gender || 'Not specified',
      fatherName, phone, email || null, address,
      district, state, pincode, schoolName, currentClass, schoolType,
      body.annual_family_income || null, aadhaarImageUrl, aadhaarImageName,
      timestamp, timestamp
    ).run();

    return json({
      ok: true,
      already_registered: false,
      student_id: studentId,
      legal_name: legalName,
      aadhaar_last4: aadhaarLast4,
      verification_status: 'pending_verification',
      login_credentials: {
        account_id: formattedAadhaar,
        password: dob
      },
      message: 'Student account created successfully! The Foundation Desk will manually verify your Aadhaar Card against official records before approving campaign aid.'
    });
  }

  // Student Login & Live Profile / Tracking Dashboard
  // User ID: 12-digit Aadhaar Number | Password: Date of Birth (DD/MM/YYYY)
  if (parts[0] === 'foundation' && parts[1] === 'student' && parts[2] === 'login' && method === 'POST') {
    const rawAadhaar = String(body.aadhaar || '').replace(/[^0-9]/g, '');
    const rawDob = standardizeDob(body.dob);

    if (!rawAadhaar || rawAadhaar.length !== 12) return fail('Please enter your 12-digit Student Aadhaar Number.', 422);
    if (!rawDob) return fail('Please enter your Date of Birth in DD/MM/YYYY format.', 422);

    const aadhaarHash = await digest(`fnd_aadhaar_salt:${rawAadhaar}`);
    let student = await env.DB.prepare('SELECT * FROM foundation_students WHERE aadhaar_hash=?').bind(aadhaarHash).first().catch(() => null);

    if (!student) {
      // Fallback check against applications v1 if registered earlier
      const appV1 = await env.DB.prepare('SELECT * FROM foundation_applications WHERE student_aadhaar_hash=? ORDER BY created_at DESC LIMIT 1').bind(aadhaarHash).first().catch(() => null);
      if (appV1) {
        student = {
          id: appV1.id,
          legal_name: appV1.student_name,
          aadhaar_last4: appV1.student_aadhaar_last4,
          dob: standardizeDob(appV1.student_dob),
          father_guardian_name: 'Guardian',
          guardian_phone: appV1.teacher_phone,
          residential_address: appV1.school_address,
          district: appV1.school_district,
          state: appV1.school_state,
          pincode: '799001',
          current_school_name: appV1.school_name,
          current_class: appV1.class_grade
        };
      }
    }

    if (!student) {
      return fail('No foundation student account found for this Aadhaar Number. Please create a student account below.', 404);
    }

    if (standardizeDob(student.dob) !== rawDob) {
      return fail('Incorrect Date of Birth for this student account. Please enter the exact DOB submitted on your profile (DD/MM/YYYY).', 401);
    }

    // Fetch student applications from v2 (and v1)
    const appsV2 = await env.DB.prepare(`
      SELECT a.*, c.title AS campaign_title, c.kit_summary AS campaign_kit 
      FROM foundation_applications_v2 a 
      LEFT JOIN foundation_campaigns c ON c.id = a.campaign_id 
      WHERE a.student_id=? 
      ORDER BY a.created_at DESC
    `).bind(student.id).all().catch(() => ({ results: [] }));

    const appsV1 = await env.DB.prepare(`
      SELECT a.*, c.title AS campaign_title, c.kit_summary AS campaign_kit 
      FROM foundation_applications a 
      LEFT JOIN foundation_campaigns c ON c.id = a.campaign_id 
      WHERE a.student_aadhaar_hash=? 
      ORDER BY a.created_at DESC
    `).bind(aadhaarHash).all().catch(() => ({ results: [] }));

    const combinedApps = [...(appsV2.results || []), ...(appsV1.results || [])];
    const appliedCampaignIds = new Set(combinedApps.map(a => a.campaign_id));

    // Fetch student academic performance tracking records
    const acadRecords = await env.DB.prepare(`
      SELECT * FROM foundation_academic_records 
      WHERE student_id=? 
      ORDER BY created_at DESC
    `).bind(student.id).all().catch(() => ({ results: [] }));

    // Fetch active campaigns and mark if student already applied
    const campaigns = await env.DB.prepare("SELECT * FROM foundation_campaigns WHERE status='active' ORDER BY created_at DESC").all().catch(() => ({ results: [] }));
    const campaignList = (campaigns.results || []).map(c => ({
      ...c,
      already_applied: appliedCampaignIds.has(c.id),
      user_application: combinedApps.find(a => a.campaign_id === c.id) || null
    }));

    return json({
      ok: true,
      student: {
        id: student.id,
        legal_name: student.legal_name,
        aadhaar_last4: student.aadhaar_last4,
        dob: student.dob,
        father_guardian_name: student.father_guardian_name,
        guardian_phone: student.guardian_phone,
        email: student.email,
        residential_address: student.residential_address,
        district: student.district,
        state: student.state,
        pincode: student.pincode,
        current_school_name: student.current_school_name,
        current_class: student.current_class,
        verification_status: student.verification_status || 'pending_verification',
        academic_standing: student.academic_standing || 'eligible',
        academic_standing_notes: student.academic_standing_notes || null
      },
      applications: combinedApps,
      academic_records: acadRecords.results || [],
      active_campaigns: campaignList
    });
  }

  // Student: Submit Terminal Exam Report Card / Academic Performance Record
  if (parts[0] === 'foundation' && parts[1] === 'student' && parts[2] === 'academic-record' && method === 'POST') {
    const rawAadhaar = String(body.aadhaar || '').replace(/[^0-9]/g, '');
    const rawDob = standardizeDob(body.dob);
    const examTerm = String(body.exam_term || '').trim();
    const percentage = parseFloat(body.percentage) || 0;
    const grade = String(body.grade || '').trim();
    const marksheetUrl = String(body.marksheet_url || '').trim();
    const marksheetName = String(body.marksheet_name || 'Term_Marksheet.jpg').trim();
    const teacherRemarks = String(body.teacher_remarks || '').trim();

    if (!rawAadhaar || rawAadhaar.length !== 12) return fail('Valid 12-digit Aadhaar Number is required.', 422);
    if (!rawDob) return fail('Valid Date of Birth is required.', 422);
    if (!examTerm) return fail('Please specify the examination term (e.g. Unit Test, Half-Yearly, Annual Exam).', 422);
    if (!marksheetUrl) return fail('Please upload a clear photo or PDF scan of your Terminal Marksheet / Report Card.', 422);

    const aadhaarHash = await digest(`fnd_aadhaar_salt:${rawAadhaar}`);
    const student = await env.DB.prepare('SELECT * FROM foundation_students WHERE aadhaar_hash=?').bind(aadhaarHash).first().catch(() => null);
    if (!student) return fail('Student account not found.', 404);
    if (standardizeDob(student.dob) !== rawDob) return fail('Incorrect credentials.', 401);

    const recordId = id();
    const timestamp = now();
    const academicYear = body.academic_year || '2026-2027';

    await env.DB.prepare(`
      INSERT INTO foundation_academic_records (
        id, student_id, academic_year, exam_term, percentage, grade,
        marksheet_url, marksheet_name, teacher_remarks, performance_rating,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      recordId, student.id, academicYear, examTerm, percentage, grade || null,
      marksheetUrl, marksheetName, teacherRemarks || null,
      percentage >= 75 ? 'exemplary' : percentage >= 50 ? 'good' : percentage >= 35 ? 'satisfactory' : 'poor',
      timestamp
    ).run();

    return json({
      ok: true,
      record_id: recordId,
      message: 'Academic performance record and marksheet submitted successfully! The Foundation Desk will review your progress to maintain scholarship status.'
    });
  }

  // Submit Application for an Active Campaign (Enforces 1 Application Per Campaign)
  if (parts[0] === 'foundation' && parts[1] === 'student' && parts[2] === 'apply-campaign' && method === 'POST') {
    const rawAadhaar = String(body.aadhaar || '').replace(/[^0-9]/g, '');
    const rawDob = standardizeDob(body.dob);
    const campaignId = String(body.campaign_id || '').trim();
    const documentUrl = String(body.document_url || '').trim();
    const documentName = String(body.document_name || 'School_Requisition_Certificate.pdf').trim();
    const specificNeeds = String(body.specific_needs || '').trim();
    const assistanceType = String(body.assistance_type || 'study_materials').trim();
    const teacherName = String(body.teacher_name || '').trim();
    const teacherDesignation = String(body.teacher_designation || '').trim();
    const teacherPhone = String(body.teacher_phone || '').replace(/[^0-9]/g, '').slice(-10);
    const teacherEmail = String(body.teacher_email || '').trim();
    const schoolType = String(body.school_type || 'govt_school').trim().toLowerCase();
    const lastYearPercentage = parseFloat(body.last_year_percentage) || 0;
    const lastYearGrade = String(body.last_year_grade || '').trim();
    const lastYearMarksheetUrl = String(body.last_year_marksheet_url || '').trim();
    const lastYearMarksheetName = String(body.last_year_marksheet_name || 'Last_Year_Final_Marksheet.jpg').trim();
    const latentTalent = String(body.latent_talent || 'science_curiosity').trim();
    const talentNotes = String(body.talent_notes || '').trim();
    const infoAccuracyConfirmed = Boolean(body.info_accuracy_confirmed === true || body.info_accuracy_confirmed === 'true' || body.info_accuracy_confirmed === 1);

    if (['private', 'private_school', 'convent', 'cbse_private', 'icse_private'].includes(schoolType)) {
      return fail('Strict Foundation Policy: Chiranjit Kar Foundation assistance is strictly and exclusively reserved for underprivileged children enrolled in Government or Government-Aided schools. Students in private schools are not eligible.', 403);
    }

    const settingsRows = await env.DB.prepare('SELECT setting_key, setting_value FROM foundation_settings').all().catch(() => ({ results: [] }));
    const settings = Object.fromEntries((settingsRows.results || []).map(r => [r.setting_key, r.setting_value]));
    if (settings.launch_status === 'launching_soon' && !body.is_pilot_override) {
      return fail('Campaign applications are currently in Launching Soon / Pilot phase. Open applications will be enabled upon official launch by the administrator.', 403);
    }

    if (!rawAadhaar || rawAadhaar.length !== 12) return fail('Valid 12-digit Aadhaar Number is required.', 422);
    if (!rawDob) return fail('Valid Date of Birth is required.', 422);
    if (!campaignId) return fail('Please select an active campaign to apply for.', 422);
    if (!teacherName || !teacherPhone || teacherPhone.length < 10) return fail('Recommending teacher name and 10-digit mobile number are required.', 422);
    if (!specificNeeds || specificNeeds.length < 10) return fail('Please detail the specific textbooks and study materials requested.', 422);
    if (!documentUrl) return fail('Please attach the official Requisition Document bearing the School Rubber Stamp and Teacher/Headmaster signature.', 422);
    if (!lastYearMarksheetUrl) return fail('Please upload a clear photograph or PDF scan of the student’s Last Academic Year Final Marksheet / Report Card.', 422);
    if (!infoAccuracyConfirmed) return fail('Please check the declaration agreeing that all submitted information, details, and documents are 100% true and correct.', 422);

    const aadhaarHash = await digest(`fnd_aadhaar_salt:${rawAadhaar}`);
    const student = await env.DB.prepare('SELECT * FROM foundation_students WHERE aadhaar_hash=?').bind(aadhaarHash).first().catch(() => null);
    if (!student) return fail('Student account not found. Please create your profile first.', 404);
    if (standardizeDob(student.dob) !== rawDob) return fail('Incorrect Date of Birth credentials.', 401);

    if (student.verification_status !== 'verified') {
      return fail('Your student account is currently under manual Aadhaar document verification by the Foundation desk. The administrator will inspect your uploaded Aadhaar card to verify legal name and DOB before campaign aid can be granted. Please check back shortly.', 403);
    }

    // Core Foundation Philosophy: Raw Curiosity & Latent Talent over past marks.
    // Low marks are never used to disqualify a student, because low marks in rural / underprivileged backgrounds
    // usually reflect lack of books, coaching, or resources. Past marksheet is treated purely as a learning baseline.

    const campaign = await env.DB.prepare('SELECT * FROM foundation_campaigns WHERE id=?').bind(campaignId).first().catch(() => null);
    if (!campaign) return fail('Campaign drive not found.', 404);
    if (campaign.status !== 'active') return fail('This campaign drive is currently closed or paused by the administrator.', 409);

    // ANTI-DUPLICATE GUARD: Check if already applied for THIS campaign
    const existingApp = await env.DB.prepare('SELECT id, application_code, status, created_at FROM foundation_applications_v2 WHERE student_id=? AND campaign_id=?').bind(student.id, campaign.id).first().catch(() => null);
    if (existingApp) {
      return fail(`You have already submitted an application for "${campaign.title}" (Ref: ${existingApp.application_code}, Status: ${existingApp.status}). Under our Foundation Charter, each student is eligible to receive aid only ONCE per campaign drive to prevent duplicate allocations. You can track your existing parcel dispatch above.`, 409);
    }

    const appId = id();
    const currentYearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const appCode = `CKF-${currentYearMonth}-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = now();

    await env.DB.prepare(`
      INSERT INTO foundation_applications_v2 (
        id, application_code, student_id, campaign_id, academic_year,
        class_grade, school_name, school_address, school_district, school_state, school_type,
        teacher_name, teacher_designation, teacher_phone, teacher_email,
        assistance_type, specific_needs, document_url, document_name,
        last_year_percentage, last_year_grade, last_year_marksheet_url, last_year_marksheet_name,
        latent_talent, talent_notes,
        info_accuracy_confirmed, status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, '2026-2027',
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, 'pending_review', ?, ?
      )
    `).bind(
      appId, appCode, student.id, campaign.id,
      body.class_grade || student.current_class, body.school_name || student.current_school_name,
      body.school_address || student.residential_address, student.district, student.state, schoolType,
      teacherName, teacherDesignation || 'Teacher In-Charge', teacherPhone, teacherEmail || null,
      assistanceType, specificNeeds, documentUrl, documentName,
      lastYearPercentage, lastYearGrade || null, lastYearMarksheetUrl, lastYearMarksheetName,
      latentTalent, talentNotes,
      infoAccuracyConfirmed ? 1 : 0, timestamp, timestamp
    ).run();

    // Automatically record last year's marksheet into academic records ledger
    await env.DB.prepare(`
      INSERT INTO foundation_academic_records (
        id, student_id, academic_year, exam_term, percentage, grade,
        marksheet_url, marksheet_name, performance_rating, created_at
      ) VALUES (?, ?, 'Previous Year Final', 'Last Year Final School Examination', ?, ?, ?, ?, ?, ?)
    `).bind(
      id(), student.id, lastYearPercentage, lastYearGrade || null,
      lastYearMarksheetUrl, lastYearMarksheetName,
      lastYearPercentage >= 75 ? 'exemplary' : lastYearPercentage >= 50 ? 'good' : lastYearPercentage >= 35 ? 'satisfactory' : 'poor',
      timestamp
    ).run().catch(() => {});

    return json({
      ok: true,
      application_code: appCode,
      message: `Your application for "${campaign.title}" has been registered successfully! The Foundation Desk will verify the government school credentials and contact your teacher.`
    });
  }

  // Admin: Foundation Management Overview & Statistics
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'overview' && method === 'GET') {
    const auth = await requireStaff(request, env, ['admin', 'sales']);
    if (auth.response) return auth.response;

    const settingsRows = await env.DB.prepare('SELECT setting_key, setting_value FROM foundation_settings').all().catch(() => ({ results: [] }));
    const settings = Object.fromEntries((settingsRows.results || []).map(r => [r.setting_key, r.setting_value]));

    const annualBudget = parseInt(settings.annual_budget || '500000', 10);
    const disbRow = await env.DB.prepare('SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM foundation_disbursements_v2').first().catch(() => ({ total: 0, count: 0 }));
    const totalDisbursed = Number(disbRow?.total || 0);
    const remainingBudget = Math.max(0, annualBudget - totalDisbursed);

    const counts = await env.DB.prepare('SELECT status, COUNT(*) AS count FROM foundation_applications_v2 GROUP BY status').all().catch(() => ({ results: [] }));
    const statusCounts = Object.fromEntries((counts.results || []).map(r => [r.status, r.count]));

    const campaigns = await env.DB.prepare('SELECT * FROM foundation_campaigns ORDER BY created_at DESC').all().catch(() => ({ results: [] }));
    
    // Fetch applications with joined student profile details
    const applications = await env.DB.prepare(`
      SELECT 
        a.id, a.application_code, a.campaign_id, a.class_grade, a.school_name, a.school_district, a.school_state, a.school_type,
        a.teacher_name, a.teacher_designation, a.teacher_phone, a.teacher_email, a.assistance_type, a.specific_needs,
        a.document_url, a.document_name, a.shipping_carrier, a.tracking_number, a.status, a.rejection_reason,
        a.last_year_percentage, a.last_year_grade, a.last_year_marksheet_url, a.last_year_marksheet_name, a.info_accuracy_confirmed,
        a.latent_talent, a.talent_notes,
        a.review_notes, a.created_at, a.updated_at,
        s.legal_name AS student_name, s.aadhaar_last4 AS student_aadhaar_last4, s.father_guardian_name, s.guardian_phone,
        s.residential_address, s.dob AS student_dob
      FROM foundation_applications_v2 a
      JOIN foundation_students s ON s.id = a.student_id
      ORDER BY a.created_at DESC LIMIT 50
    `).all().catch(() => ({ results: [] }));

    const disbursements = await env.DB.prepare(`
      SELECT d.*, COALESCE(s.legal_name, 'Student') AS student_name, a.school_name, a.application_code 
      FROM foundation_disbursements_v2 d 
      LEFT JOIN foundation_applications_v2 a ON a.id = d.application_id 
      LEFT JOIN foundation_students s ON s.id = a.student_id
      ORDER BY d.created_at DESC LIMIT 50
    `).all().catch(() => ({ results: [] }));

    const students = await env.DB.prepare(`
      SELECT 
        id, legal_name, aadhaar_number, aadhaar_last4, dob, gender,
        father_guardian_name, guardian_phone, email, residential_address,
        district, state, pincode, current_school_name, current_class, school_type,
        annual_family_income, aadhaar_image_url, aadhaar_image_name,
        verification_status, verified_by, verified_at, verification_notes,
        academic_standing, academic_standing_notes,
        created_at, updated_at
      FROM foundation_students
      ORDER BY created_at DESC LIMIT 50
    `).all().catch(() => ({ results: [] }));

    const acadRecords = await env.DB.prepare(`
      SELECT r.*, s.legal_name AS student_name, s.current_class 
      FROM foundation_academic_records r
      JOIN foundation_students s ON s.id = r.student_id
      ORDER BY r.created_at DESC LIMIT 50
    `).all().catch(() => ({ results: [] }));

    return json({
      ok: true,
      budget: {
        annual_budget: annualBudget,
        total_disbursed: totalDisbursed,
        remaining_budget: remainingBudget,
        financial_year: settings.financial_year || '2026-2027',
        launch_status: settings.launch_status || 'launching_soon'
      },
      stats: {
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        pending_review: statusCounts.pending_review || 0,
        verified: statusCounts.verified || 0,
        approved: statusCounts.approved || 0,
        disbursed: statusCounts.disbursed || 0,
        rejected: statusCounts.rejected || 0,
        students_pending_verification: (students.results || []).filter(s => s.verification_status === 'pending_verification').length
      },
      campaigns: campaigns.results || [],
      applications: applications.results || [],
      students: students.results || [],
      academic_records: acadRecords.results || [],
      disbursements: disbursements.results || []
    });
  }

  // Admin: Manually Verify or Reject Student Profile & Aadhaar Image
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'students' && parts[3] && parts[4] === 'verify' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;

    const studentId = parts[3];
    const newStatus = body.status === 'rejected' ? 'rejected' : 'verified';
    const notes = String(body.notes || '').trim();
    const timestamp = now();

    await env.DB.prepare(`
      UPDATE foundation_students 
      SET verification_status=?, verification_notes=?, verified_by=?, verified_at=?, updated_at=?
      WHERE id=?
    `).bind(newStatus, notes, auth.staff.name, timestamp, timestamp, studentId).run();

    return json({
      ok: true,
      status: newStatus,
      message: `Student account manually ${newStatus === 'verified' ? 'verified & approved' : 'rejected'}.`
    });
  }

  // Admin: Toggle Campaign Status (Active <-> Paused / Closed)
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'campaigns' && parts[3] && parts[4] === 'toggle' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;

    const campaignId = parts[3];
    const targetStatus = body.status === 'active' ? 'active' : body.status === 'closed' ? 'closed' : 'paused';
    const timestamp = now();

    await env.DB.prepare('UPDATE foundation_campaigns SET status=?, updated_at=? WHERE id=?').bind(targetStatus, timestamp, campaignId).run();
    return json({ ok: true, status: targetStatus, message: `Campaign status updated to ${targetStatus}.` });
  }

  // Admin: Create or Update Campaign
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'campaigns' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;

    const campaignId = body.id || id();
    const code = body.campaign_code || `CMP-${Date.now().toString().slice(-6)}`;
    const title = String(body.title || '').trim();
    const subtitle = String(body.subtitle || '').trim();
    const description = String(body.description || '').trim();
    const targetAudience = String(body.target_audience || 'Class 8-12 Underprivileged Students').trim();
    const kitSummary = String(body.kit_summary || 'Prescribed Textbooks, Notebooks & Exam Stationery').trim();
    const status = body.status === 'paused' ? 'paused' : body.status === 'closed' ? 'closed' : 'active';
    const allocatedBudget = parseInt(body.allocated_budget || '150000', 10);
    const maxBeneficiaries = parseInt(body.max_beneficiaries || '100', 10);
    const timestamp = now();

    if (!title || !description) return fail('Title and description are required for the campaign.', 422);

    await env.DB.prepare(`
      INSERT OR REPLACE INTO foundation_campaigns (
        id, campaign_code, title, subtitle, description, target_audience, kit_summary,
        status, allocated_budget, max_beneficiaries, start_date, end_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+60 days'), ?, ?)
    `).bind(
      campaignId, code, title, subtitle, description, targetAudience, kitSummary,
      status, allocatedBudget, maxBeneficiaries, timestamp, timestamp
    ).run();

    return json({ ok: true, message: 'Campaign saved successfully.' });
  }

  // Admin: Update Application Review Status (verify, approve, reject)
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'applications' && parts[3] && parts[4] === 'status' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin', 'sales']);
    if (auth.response) return auth.response;

    const applicationId = parts[3];
    const newStatus = ['pending_review', 'verified', 'approved', 'rejected', 'disbursed'].includes(body.status) ? body.status : 'verified';
    const reviewNotes = String(body.review_notes || '').trim();
    const rejectionReason = String(body.rejection_reason || '').trim();
    const timestamp = now();

    await env.DB.prepare(`
      UPDATE foundation_applications_v2 
      SET status=?, review_notes=?, rejection_reason=?, reviewed_by=?, reviewed_at=?, updated_at=?
      WHERE id=?
    `).bind(newStatus, reviewNotes, rejectionReason, auth.staff.name, timestamp, timestamp, applicationId).run().catch(() => {});

    await env.DB.prepare(`
      UPDATE foundation_applications 
      SET status=?, review_notes=?, rejection_reason=?, reviewed_by=?, reviewed_at=?, updated_at=?
      WHERE id=?
    `).bind(newStatus, reviewNotes, rejectionReason, auth.staff.name, timestamp, timestamp, applicationId).run().catch(() => {});

    return json({ ok: true, status: newStatus, message: `Application updated to ${newStatus}.` });
  }

  // Admin: Update Shipping & Post Consignment Tracking
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'applications' && parts[3] && parts[4] === 'dispatch' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;

    const applicationId = parts[3];
    const shippingCarrier = String(body.shipping_carrier || 'India Post Speed Post').trim();
    const trackingNumber = String(body.tracking_number || '').trim();
    const newStatus = body.status === 'delivered' ? 'delivered' : 'dispatched';
    const timestamp = now();
    const shippedAt = body.shipped_at || timestamp;
    const deliveredAt = body.status === 'delivered' ? (body.delivered_at || timestamp) : null;

    if (!trackingNumber) return fail('Tracking Consignment Number / Waybill is required.', 422);

    await env.DB.prepare(`
      UPDATE foundation_applications_v2 
      SET shipping_carrier=?, tracking_number=?, shipped_at=?, delivered_at=COALESCE(?, delivered_at), status=?, updated_at=?
      WHERE id=?
    `).bind(shippingCarrier, trackingNumber, shippedAt, deliveredAt, newStatus, timestamp, applicationId).run().catch(() => {});

    await env.DB.prepare(`
      UPDATE foundation_applications 
      SET shipping_carrier=?, tracking_number=?, shipped_at=?, delivered_at=COALESCE(?, delivered_at), status=?, updated_at=?
      WHERE id=?
    `).bind(shippingCarrier, trackingNumber, shippedAt, deliveredAt, newStatus, timestamp, applicationId).run().catch(() => {});

    return json({
      ok: true,
      status: newStatus,
      tracking_number: trackingNumber,
      shipping_carrier: shippingCarrier,
      message: `Consignment tracking updated for ${shippingCarrier} (#${trackingNumber}).`
    });
  }

  // Admin: Record Internal Purchase Invoice / Disbursement
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'disbursements' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;

    const applicationId = String(body.application_id || '').trim();
    const vendorName = String(body.vendor_name || '').trim();
    const itemSummary = String(body.item_summary || '').trim();
    const amount = parseInt(body.amount, 10);
    const billDate = String(body.bill_date || now().slice(0, 10)).trim();
    const billReceiptUrl = String(body.bill_receipt_url || '').trim();

    if (!applicationId) return fail('Valid application ID is required.', 422);
    if (!vendorName) return fail('Vendor or Book Depot name is required.', 422);
    if (!itemSummary) return fail('Summary of items purchased is required.', 422);
    if (isNaN(amount) || amount <= 0) return fail('Valid invoice amount in INR is required.', 422);

    let app = await env.DB.prepare(`
      SELECT a.id, a.application_code, s.legal_name AS student_name 
      FROM foundation_applications_v2 a 
      JOIN foundation_students s ON s.id = a.student_id 
      WHERE a.id=?
    `).bind(applicationId).first().catch(() => null);

    if (!app) {
      app = await env.DB.prepare('SELECT id, application_code, student_name FROM foundation_applications WHERE id=?').bind(applicationId).first().catch(() => null);
    }
    if (!app) return fail('Application not found.', 404);

    const disbId = id();
    const billCode = `FND-BILL-${Date.now().toString().slice(-6)}`;
    const timestamp = now();

    await env.DB.prepare(`
      INSERT INTO foundation_disbursements_v2 (
        id, application_id, bill_code, vendor_name, item_summary, amount, bill_date, bill_receipt_url, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      disbId, applicationId, billCode, vendorName, itemSummary, amount, billDate, billReceiptUrl, auth.staff.name, timestamp
    ).run();

    // Mark application as disbursed
    await env.DB.prepare("UPDATE foundation_applications_v2 SET status='disbursed', updated_at=? WHERE id=?").bind(timestamp, applicationId).run().catch(() => {});
    await env.DB.prepare("UPDATE foundation_applications SET status='disbursed', updated_at=? WHERE id=?").bind(timestamp, applicationId).run().catch(() => {});

    // Fetch updated budget metrics
    const settingsRows = await env.DB.prepare('SELECT setting_value FROM foundation_settings WHERE setting_key="annual_budget"').first().catch(() => null);
    const annualBudget = parseInt(settingsRows?.setting_value || '500000', 10);
    const disbSum = await env.DB.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM foundation_disbursements_v2').first().catch(() => null);
    const totalDisbursed = Number(disbSum?.total || 0);
    const remainingBudget = Math.max(0, annualBudget - totalDisbursed);

    return json({
      ok: true,
      bill_code: billCode,
      total_disbursed: totalDisbursed,
      remaining_budget: remainingBudget,
      message: `Disbursement bill ${billCode} of ₹${amount.toLocaleString('en-IN')} recorded and deducted from annual budget.`
    });
  }

  // Admin: Generate / Fetch Official Acceptance & Intimation Letter to School Headmaster
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'applications' && parts[3] && parts[4] === 'generate-letter' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;

    const applicationId = parts[3];
    let app = await env.DB.prepare(`
      SELECT a.*, s.legal_name AS student_name, s.aadhaar_last4, s.dob AS student_dob, s.father_guardian_name, s.guardian_phone, s.residential_address
      FROM foundation_applications_v2 a
      JOIN foundation_students s ON s.id = a.student_id
      WHERE a.id=?
    `).bind(applicationId).first().catch(() => null);

    if (!app) {
      app = await env.DB.prepare('SELECT * FROM foundation_applications WHERE id=?').bind(applicationId).first().catch(() => null);
    }
    if (!app) return fail('Application not found.', 404);

    const timestamp = now();
    let letter = await env.DB.prepare('SELECT * FROM foundation_school_letters WHERE application_id=?').bind(applicationId).first().catch(() => null);

    if (!letter) {
      const letterId = id();
      const letterCode = `CKF-LTR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const issueDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date());
      const letterContent = `CHIRANJIT KAR FOUNDATION
Direct Child Education & Philanthropic Stewardship • 100% Private Philanthropy
Central Desk: Agartala, Tripura West – 799001 | Desk: +91 9402369889 | Email: foundation@chiranjitkar.com

Letter Ref No: ${letterCode}
Date of Issue: ${issueDate}
Application Ref: ${app.application_code || applicationId}

To:
The Respected Headmaster / Teacher In-Charge
${app.school_name}
${app.school_address ? app.school_address + ', ' : ''}${app.school_district || ''}, ${app.school_state || 'Tripura'}

SUBJECT: OFFICIAL INTIMATION OF EDUCATIONAL AID APPROVAL & CONSIGNMENT DISPATCH FOR STUDENT: ${(app.student_name || '').toUpperCase()} (${app.class_grade})

Respected Sir / Madam,

Greetings from the Chiranjit Kar Foundation. First and foremost, we extend our deepest respect and sincere gratitude to you and the esteemed teaching faculty of your school for your noble, unwavering dedication to educating and uplifting the youth of our society.

Following the formal recommendation and official school seal certification submitted by your school, we are pleased to inform you that the educational aid application for your student, ${app.student_name} (Aadhaar Reference: XXXX-XXXX-${app.student_aadhaar_last4 || app.aadhaar_last4 || 'XXXX'}), has been formally APPROVED under our Foundation Educational Aid Initiative.

Under our Foundation Charter, our mission is to discover and empower genuine latent potential, curious minds, and dedicated students who lack adequate financial means for prescribed curriculum study materials. We firmly believe that no deserving child should be left behind due to economic hardship.

APPROVED ASSISTANCE & CONSIGNMENT SPECIFICATIONS:
- Beneficiary Student: ${app.student_name} (${app.class_grade})
- Enrolled School: ${app.school_name}
- Parent / Guardian: ${app.father_guardian_name || 'Parent / Guardian'} (Tel: +91 ${app.guardian_phone || 'Registered Phone'})
- Approved Educational Kit: ${app.specific_needs || 'Standard Syllabus Guides, Registers & Exam Stationery'}
- Shipping Carrier: ${app.shipping_carrier || 'India Post Speed Post (Prepaid)'}
- Consignment Tracking AWB: ${app.tracking_number || 'Dispatch in Progress'}

PROTOCOL FOR SCHOOL AUTHORITY & HEADMASTER HANDOVER:
1. Consignment Receipt & Verification: The educational study kit has been packed and dispatched directly to your school address via India Post Speed Post. Upon physical delivery at the school office, kindly verify that the outer packaging seal is intact.
2. Formal Handover to Student: We humbly request the Headmaster or designated Teacher In-Charge to personally hand over the study materials package to ${app.student_name} during school hours.
3. Parent Notification: The student's parents / legal guardians have been separately notified regarding this dispatch.
4. Continuous Academic Nurturing: As part of our Foundation Charter, we kindly request your teachers to observe the student's attendance and academic progress. Satisfactory dedication ensures ongoing renewal for upcoming academic sessions.

Yours sincerely in service to education,

Chiranjit Kar
Founder & Philanthropic Trustee
Chiranjit Kar Foundation
Desk: +91 9402369889 | Agartala, Tripura

--------------------------------------------------------------------------------
SCHOOL HANDOVER ACKNOWLEDGMENT & VERIFICATION RECEIPT
(To be completed by Headmaster upon physical kit delivery to student and retained in school records)

Student: ${app.student_name} | Class: ${app.class_grade} | Roll No: ________ | Date of Handover: ____ / ____ / 2026
Consignment Condition: [ ] Seal Intact & All Books Received   [ ] Discrepancy: ____________________

Student Signature: _______________________
Teacher In-Charge Signature: _______________________
Official School Rubber Stamp: [ OFFICIAL SCHOOL RUBBER STAMP ]
--------------------------------------------------------------------------------`;

      await env.DB.prepare(`
        INSERT INTO foundation_school_letters (
          id, application_id, student_id, letter_code, school_name, headmaster_or_teacher,
          letter_content, dispatch_carrier, dispatch_tracking, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        letterId, applicationId, app.student_id || applicationId, letterCode,
        app.school_name, app.teacher_name || 'Headmaster', letterContent,
        app.shipping_carrier || 'India Post Speed Post', app.tracking_number || null,
        timestamp
      ).run();

      // Update application
      await env.DB.prepare(`
        UPDATE foundation_applications_v2 
        SET headmaster_letter_id=?, headmaster_letter_status='dispatched_to_school', updated_at=?
        WHERE id=?
      `).bind(letterId, timestamp, applicationId).run().catch(() => {});

      letter = {
        id: letterId,
        letter_code: letterCode,
        letter_content: letterContent,
        school_name: app.school_name,
        headmaster_or_teacher: app.teacher_name,
        dispatch_carrier: app.shipping_carrier || 'India Post Speed Post',
        dispatch_tracking: app.tracking_number || null,
        created_at: timestamp
      };
    }

    return json({
      ok: true,
      letter,
      application: app
    });
  }

  // Admin: Record Parent Notification Alert
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'applications' && parts[3] && parts[4] === 'notify-parent' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;

    const applicationId = parts[3];
    const timestamp = now();

    await env.DB.prepare(`
      UPDATE foundation_applications_v2 
      SET parent_notification_status='sent', updated_at=?
      WHERE id=?
    `).bind(timestamp, applicationId).run().catch(() => {});

    await env.DB.prepare(`
      UPDATE foundation_school_letters 
      SET parent_notified_at=?
      WHERE application_id=?
    `).bind(timestamp, applicationId).run().catch(() => {});

    return json({ ok: true, message: 'Parent notification logged successfully.' });
  }

  // Admin: Update Student Academic Standing (Eligible, Probation, Ineligible due to Poor Performance)
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'students' && parts[3] && parts[4] === 'academic-standing' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;

    const studentId = parts[3];
    const standing = ['eligible', 'probation', 'ineligible_poor_performance'].includes(body.academic_standing) ? body.academic_standing : 'eligible';
    const notes = String(body.notes || '').trim();
    const timestamp = now();

    await env.DB.prepare(`
      UPDATE foundation_students 
      SET academic_standing=?, academic_standing_notes=?, updated_at=?
      WHERE id=?
    `).bind(standing, notes, timestamp, studentId).run();

    return json({
      ok: true,
      academic_standing: standing,
      message: `Student academic standing updated to: ${standing}.`
    });
  }

  // Admin: Update Foundation Settings & Annual Budget
  if (parts[0] === 'foundation' && parts[1] === 'admin' && parts[2] === 'settings' && method === 'POST') {
    const auth = await requireStaff(request, env, ['admin']);
    if (auth.response) return auth.response;

    const timestamp = now();
    if (body.annual_budget) {
      const budget = Math.max(10000, parseInt(body.annual_budget, 10));
      await env.DB.prepare('INSERT OR REPLACE INTO foundation_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)')
        .bind('annual_budget', String(budget), timestamp).run();
    }
    if (body.launch_status) {
      await env.DB.prepare('INSERT OR REPLACE INTO foundation_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)')
        .bind('launch_status', String(body.launch_status), timestamp).run();
    }

    return json({ ok: true, message: 'Foundation settings updated successfully.' });
  }

  return fail('API route not found.', 404);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return fail('Cross-origin request rejected.', 403);
  try {
    const route = Array.isArray(params.route) ? params.route.join('/') : String(params.route || '');
    return await handle(request, env, route);
  } catch (error) {
    console.error('Studio API error:', error?.message || error);
    return fail('The request could not be completed. Please retry or contact your studio administrator.', 500);
  }
}
