const COOKIE = '__Host-studio_session';
const CLIENT_COOKIE = 'client_session';
const ROLES = new Set(['admin', 'sales', 'photographer', 'filmmaker', 'editor']);
const PROJECT_STATES = new Set(['lead', 'confirmed', 'preproduction', 'scheduled', 'in_session', 'editing', 'client_review', 'delivered', 'archived']);

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

async function awardReferralReward(env, projectId) {
  const rewardId=id(), created=now();
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO referral_rewards(id,referrer_client_id,referred_email,referred_project_id,package_invoice_id,package_amount,reward_amount,reward_percent,created_at)
      SELECT ?,p.referrer_client_id,p.client_email,p.id,i.id,i.amount,CAST(i.amount*5/100 AS INTEGER),5,?
      FROM projects p JOIN invoices i ON i.project_id=p.id AND i.kind='package' AND i.status='paid' AND i.amount_paid>=i.amount
      WHERE p.id=? AND p.referrer_client_id IS NOT NULL AND i.amount>0
        AND LOWER(p.client_email)!=(SELECT LOWER(email) FROM clients WHERE id=p.referrer_client_id)
        AND NOT EXISTS(SELECT 1 FROM referral_rewards r WHERE LOWER(r.referred_email)=LOWER(p.client_email))
        AND NOT EXISTS(SELECT 1 FROM projects oldp JOIN invoices oldi ON oldi.project_id=oldp.id AND oldi.kind='package' AND oldi.status='paid' WHERE LOWER(oldp.client_email)=LOWER(p.client_email) AND oldp.id!=p.id AND oldp.created_at<p.created_at)`)
      .bind(rewardId,created,projectId),
    env.DB.prepare(`INSERT OR IGNORE INTO wallet_transactions(id,client_id,reward_id,kind,amount,description,created_at)
      SELECT ?,referrer_client_id,id,'referral_reward',reward_amount,'5% referral reward after referred client’s first paid package',created_at FROM referral_rewards WHERE referred_project_id=? AND reward_amount>0`)
      .bind(id(),projectId)
  ]);
}

async function reconcileBankTransaction(env, input, staffId, source='manual_bank_alert') {
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
    await env.DB.prepare('INSERT INTO bank_transactions(id,utr,amount,transaction_at,source,status,invoice_id,imported_by,imported_at,note,source_message_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id(),utr,amount,transactionISO,source,status,invoice?.id||null,staffId||null,importedAt,candidates.length>1?'Multiple exact-amount invoices fall within the 24-hour window.':candidates.length===0?'No exact unpaid invoice found within the 24-hour window.':'',source==='manual_bank_alert'?null:String(input.email_message_id)).run();
  } catch(error) {
      if(String(error?.message||'').includes('UNIQUE'))return {error:fail('This UTR or email alert has already been recorded.',409)};
    throw error;
  }
  if(invoice){
    const paid=invoice.amount_paid+amount;
    await env.DB.prepare(`UPDATE invoices SET amount_paid=?,status=CASE WHEN ? >= amount THEN 'paid' ELSE 'partially_paid' END,updated_at=? WHERE id=?`).bind(paid,paid,importedAt,invoice.id).run();
    if(paid>=invoice.amount&&invoice.kind==='package')await awardReferralReward(env,invoice.project_id);
    await logEvent(env,invoice.project_id,staffId,'bank_payment_matched',{invoice_id:invoice.id,utr,amount,transaction_at:transactionISO,source});
  }
  return {result:{ok:true,status,invoice_id:invoice?.id||null,message:status==='matched'?'Payment matched and ledger updated.':status==='review'?'Multiple possible invoices found; transaction saved for review.':'No unique invoice matched; transaction saved without changing balances.'}};
}

async function clientProject(env, key) {
  if (!key || key.length < 32 || key.length > 128) return null;
  return env.DB.prepare('SELECT * FROM projects WHERE client_key_hash=?').bind(await digest(key)).first();
}
function clientToken(request){return String(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');}

async function handle(request, env, route) {
  if (!env.DB) return fail('Studio database is not connected yet.', 503);
  const method = request.method.toUpperCase();
  const parts = route.split('/').filter(Boolean).map(decodeURIComponent);
  const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await request.json().catch(() => ({})) : {};

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

  if(parts[0]==='inquiries'&&parts.length===1&&method==='POST'){
    if(String(body.website||'').trim())return json({ok:true,message:'Thanks, your inquiry has been received.'},201);
    const name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),service=String(body.service||'').trim(),referralCode=String(body.referral_code||'').trim().toUpperCase();
    if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!service)return fail('Please provide your name, a valid email, and the shoot category.');
    if(referralCode&&!await env.DB.prepare('SELECT id FROM clients WHERE referral_code=?').bind(referralCode).first())return fail('This referral link is invalid or expired.');
    const ip=request.headers.get('CF-Connecting-IP')||'unknown';const ipHash=await digest(`${env.APP_SECRET||'studio-rate-limit'}:${ip}`);
    const since=new Date(Date.now()-60*60_000).toISOString();const recent=await env.DB.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE ip_hash=? AND created_at>?').bind(ipHash,since).first();
    if((recent?.n||0)>=5)return fail('Too many inquiries from this connection. Please contact the studio directly.',429);
    const created=now();await env.DB.prepare('INSERT INTO inquiries(id,name,email,phone,city,service,brief,status,source,ip_hash,referral_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,\'new\',\'website\',?,?,?,?)')
      .bind(id(),name,email,String(body.phone||'').trim().slice(0,40),String(body.city||'').trim().slice(0,100),service.slice(0,150),String(body.brief||'').trim().slice(0,5000),ipHash,referralCode,created,created).run();
    return json({ok:true,message:'Thanks, your inquiry has been received. Our studio coordinator will review it and follow up.'},201);
  }

  if(parts[0]==='inquiries'&&parts.length===1&&method==='GET'){
    const auth=await requireStaff(request,env,['admin','sales']);if(auth.response)return auth.response;
    const rows=await env.DB.prepare('SELECT i.*,s.name AS assignee_name FROM inquiries i LEFT JOIN staff s ON s.id=i.assigned_to ORDER BY CASE i.status WHEN \'new\' THEN 0 WHEN \'contacted\' THEN 1 WHEN \'qualified\' THEN 2 ELSE 3 END,i.created_at DESC').all();
    return json({inquiries:rows.results||[]});
  }

  if(parts[0]==='inquiries'&&parts[1]&&method==='PATCH'){
    const auth=await requireStaff(request,env,['admin','sales']);if(auth.response)return auth.response;
    const status=body.status;if(status&&!['new','contacted','qualified','closed'].includes(status))return fail('Invalid inquiry status.');
    if(body.assigned_to){const assignee=await env.DB.prepare('SELECT id FROM staff WHERE id=? AND active=1').bind(body.assigned_to).first();if(!assignee)return fail('Select an active team member.');}
    await env.DB.prepare('UPDATE inquiries SET status=COALESCE(?,status),assigned_to=COALESCE(?,assigned_to),updated_at=? WHERE id=?').bind(status||null,body.assigned_to||null,now(),parts[1]).run();
    return json({ok:true});
  }

  if (parts[0] === 'auth' && parts[1] === 'login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!env.APP_SECRET) return fail('Studio authentication is not configured.',503);
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 20 || password.length > 200) return fail('Enter your work email and password (at least 20 characters).');
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
    if (nextPassword.length < 20 || nextPassword.length > 200) return fail('Choose a new password with at least 20 characters.');
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
      SELECT id, project_code, client_name, client_email, service, package_name, status, shoot_at, location, brief, booked_minutes, grace_minutes, overtime_step_minutes, overtime_rate, package_price, deposit_amount, created_at
      FROM projects WHERE LOWER(client_email)=LOWER(?)
      ORDER BY CASE status WHEN 'in_session' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'confirmed' THEN 2 WHEN 'editing' THEN 3 WHEN 'client_review' THEN 4 WHEN 'delivered' THEN 5 ELSE 6 END, shoot_at DESC, created_at DESC
    `).bind(client.email).all();

    const projectList = [];
    for (const p of (projects.results || [])) {
      const session = await env.DB.prepare("SELECT id,started_at,ended_at,elapsed_minutes,overtime_minutes,overtime_units,overtime_fee,status FROM sessions WHERE project_id=? ORDER BY started_at DESC LIMIT 1").bind(p.id).first();
      const invoices = await env.DB.prepare("SELECT id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url FROM invoices WHERE project_id=? AND status!='void' ORDER BY created_at").bind(p.id).all();
      const deliveries = await env.DB.prepare('SELECT title,url,note,created_at FROM deliveries WHERE project_id=? ORDER BY created_at DESC').bind(p.id).all();
      projectList.push({
        ...p,
        session,
        invoices: invoices.results || [],
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
    const invoices = await env.DB.prepare("SELECT id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url FROM invoices WHERE project_id=? AND status!='void' ORDER BY created_at").bind(project.id).all();
    const deliveries = await env.DB.prepare('SELECT title,url,note,created_at FROM deliveries WHERE project_id=? ORDER BY created_at DESC').bind(project.id).all();
    return json({ project: { id: project.id, project_code: project.project_code, client_name: project.client_name, service: project.service, package_name: project.package_name, shoot_at: project.shoot_at, booked_minutes: project.booked_minutes, grace_minutes: project.grace_minutes, overtime_step_minutes: project.overtime_step_minutes, overtime_rate: project.overtime_rate, status: project.status }, session, invoices: invoices.results || [], deliveries: deliveries.results || [] });
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

  if (parts[0] === 'projects' && parts.length === 1 && method === 'GET') {
    const auth = await requireStaff(request, env);
    if (auth.response) return auth.response;
    const rows = await env.DB.prepare(`SELECT p.*, s.name AS created_by_name,
      (SELECT group_concat(st.name || ' · ' || a.assignment, ', ') FROM assignments a JOIN staff st ON st.id=a.staff_id WHERE a.project_id=p.id) AS team,
      (SELECT id FROM sessions se WHERE se.project_id=p.id AND se.status='active' LIMIT 1) AS active_session_id,
      (SELECT started_at FROM sessions se WHERE se.project_id=p.id AND se.status='active' LIMIT 1) AS active_started_at,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status!='done') AS open_tasks,
      (SELECT COALESCE(SUM(i.amount-i.amount_paid),0) FROM invoices i WHERE i.project_id=p.id AND i.status NOT IN ('void','paid')) AS balance_due
      FROM projects p JOIN staff s ON s.id=p.created_by WHERE (? IN ('admin','sales') OR p.created_by=? OR EXISTS(SELECT 1 FROM assignments a WHERE a.project_id=p.id AND a.staff_id=?) OR EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.assigned_to=?)) ORDER BY CASE p.status WHEN 'lead' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'preproduction' THEN 2 WHEN 'scheduled' THEN 3 WHEN 'in_session' THEN 4 WHEN 'editing' THEN 5 WHEN 'client_review' THEN 6 WHEN 'delivered' THEN 7 ELSE 8 END, p.shoot_at IS NULL, p.shoot_at ASC, p.created_at DESC`).bind(auth.staff.role,auth.staff.id,auth.staff.id,auth.staff.id).all();
    const projects=(rows.results||[]).map(project=>{if(!['admin','sales'].includes(auth.staff.role)){delete project.package_price;delete project.deposit_amount;delete project.balance_due;}return project;});
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
    const settings={studio_name:'Chiranjit Kar Photography',support_email:'iamchiranjitkar@hotmail.com',support_phone:'+917005238823',timezone:'Asia/Kolkata',default_duration_minutes:180,default_overtime_rate:0};
    for(const row of rows.results||[]){const key=row.setting_key;settings[key]=['default_duration_minutes','default_overtime_rate'].includes(key)?Number(row.setting_value):row.setting_value;}
    const webhook=await env.DB.prepare("SELECT setting_value FROM studio_settings WHERE setting_key='gmail_webhook_token_hash'").first();
    return json({settings,policy:{grace_minutes:30,overtime_step_minutes:30,currency:'INR'},integrations:{bank_alerts:{status:webhook?'webhook_ready':'needs_setup',detail:webhook?'Authenticated webhook receiver is configured. Connect an authorized Gmail alert relay to deliver parsed HDFC/Kotak transactions.':'Webhook receiver supports HDFC/Kotak alert payloads. Generate a one-time shared token and connect a Gmail alert relay.'},client_codes:{status:'client_portal',detail:'Client generates the one-time code on their private link; staff enters it to confirm start or finish.'},sms_email:{status:'not_connected',detail:'No SMS or transactional email provider is connected. Send client portal links through your existing contact channel.'},payments:{status:'manual_ledger',detail:'Invoices and payment status are recorded from UTR alerts. No payment processor is connected.'},media_storage:{status:'external_links',detail:'Use a secure file service and add HTTPS review/delivery links to each project.'}}});
  }

  if(parts[0]==='settings'&&method==='PUT'){
    const auth=await requireStaff(request,env,['admin']);if(auth.response)return auth.response;
    const name=String(body.studio_name||'').trim(),email=String(body.support_email||'').trim(),phone=String(body.support_phone||'').trim();
    const duration=Math.round(Number(body.default_duration_minutes)),rate=Math.round(Number(body.default_overtime_rate));
    if(!name||name.length>120)return fail('Studio name is required and must be under 120 characters.');
    if(email&&!/^\S+@\S+\.\S+$/.test(email))return fail('Enter a valid support email address.');
    if(phone.length>40)return fail('Phone number must be under 40 characters.');
    if(!Number.isFinite(duration)||duration<30||duration>1440)return fail('Default session duration must be 30 minutes to 24 hours.');
    if(!Number.isFinite(rate)||rate<0||rate>10000000)return fail('Default overtime rate must be zero or greater.');
    const entries={studio_name:name,support_email:email,support_phone:phone,timezone:'Asia/Kolkata',default_duration_minutes:String(duration),default_overtime_rate:String(rate)};
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
      const priorPurchase=await env.DB.prepare(`SELECT 1 AS purchased FROM projects p JOIN invoices i ON i.project_id=p.id WHERE LOWER(p.client_email)=? AND i.kind='package' AND i.status='paid' LIMIT 1`).bind(client_email).first();
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
    const projectId = id();
    const key = b64(bytes(32));
    const projectCode = `CK-${new Date().getFullYear()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(0, 6).padStart(6,'0')}`;
    const created = now();
    await env.DB.prepare(`INSERT INTO projects(id,project_code,client_name,client_email,client_phone,service,package_name,status,shoot_at,location,brief,booked_minutes,grace_minutes,overtime_step_minutes,overtime_rate,package_price,deposit_amount,client_key_hash,selection_due_at,delivery_due_at,created_by,created_at,updated_at,referrer_client_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      projectId, projectCode, client_name, client_email, String(body.client_phone || '').trim(), service,
      String(body.package_name || '').trim(), body.status && PROJECT_STATES.has(body.status) ? body.status : 'lead',
      body.shoot_at || null, String(body.location || '').trim(), String(body.brief || '').trim(), booked, grace, step, rate,
      Math.max(0, Math.round(Number(body.package_price) || 0)), Math.max(0, Math.round(Number(body.deposit_amount) || 0)),
      await digest(key), body.selection_due_at || null, body.delivery_due_at || null, auth.staff.id, created, created, referrerClientId
    ).run();
    const assignments = Array.isArray(body.assignments) ? body.assignments : [];
    for (const item of assignments) {
      if (item?.staff_id && ROLES.has(item.role)) await env.DB.prepare('INSERT OR IGNORE INTO assignments(project_id,staff_id,assignment,assigned_at) VALUES(?,?,?,?)').bind(projectId, item.staff_id, item.role, created).run();
    }
    await logEvent(env, projectId, auth.staff.id, 'project_created', { project_code: projectCode, status: body.status || 'lead' });
    if (Number(body.package_price) > 0) {
      await env.DB.prepare('INSERT INTO invoices(id,project_id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id(),projectId,`INV-${projectCode}-01`,'package',String(body.package_name||service),Math.round(Number(body.package_price)||0),Math.min(Math.round(Number(body.deposit_amount)||0),Math.round(Number(body.package_price)||0)),Number(body.deposit_amount)>=Number(body.package_price)?'paid':Number(body.deposit_amount)>0?'partially_paid':'draft',null,'',auth.staff.id,created,created).run();
      if(Number(body.deposit_amount)>=Number(body.package_price)&&Number(body.package_price)>0)await awardReferralReward(env,projectId);
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
      if (['booked_minutes','overtime_rate','package_price','deposit_amount'].includes(field)) {
        const v = Number(body[field]);
        if (!Number.isFinite(v) || v < (field === 'booked_minutes' ? 1 : 0)) return fail(`Invalid ${field.replaceAll('_',' ')}.`);
        values.push(Math.round(v));
      } else values.push(body[field] || null);
      sets.push(`${field}=?`);
    }
    if (!sets.length) return fail('No supported project fields supplied.');
    sets.push('updated_at=?'); values.push(now(), parts[1]);
    const result = await env.DB.prepare(`UPDATE projects SET ${sets.join(',')} WHERE id=?`).bind(...values).run();
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
    if(invoice.kind==='package'&&paid>=invoice.amount)await awardReferralReward(env,invoice.project_id);
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
    await env.DB.prepare("UPDATE projects SET status='editing',updated_at=? WHERE id=?").bind(ended, project.id).run();
    if(fee>0){
      const prior=await env.DB.prepare('SELECT id FROM invoices WHERE session_id=?').bind(session.id).first();
      if(!prior)await env.DB.prepare('INSERT INTO invoices(id,project_id,session_id,invoice_code,kind,description,amount,amount_paid,status,due_at,payment_url,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,0,\'draft\',NULL,\'\',?,?,?)')
        .bind(id(),project.id,session.id,`INV-${project.project_code}-OT-${Date.now().toString().slice(-5)}`, 'overtime',`${units} × ${project.overtime_step_minutes}-minute overtime block${units===1?'':'s'} after 30-minute grace`,fee,auth.staff.id,ended,ended).run();
    }
    await logEvent(env, project.id, auth.staff.id, 'session_completed', { session_id: session.id, ended_at: ended, elapsed_minutes: elapsed, grace_minutes: project.grace_minutes, overtime_minutes: overtime, overtime_units: units, overtime_rate: project.overtime_rate, overtime_fee: fee, client_approved: true });
    return json({ ok: true, session: { ended_at: ended, elapsed_minutes: elapsed, overtime_minutes: overtime, overtime_units: units, overtime_rate: project.overtime_rate, overtime_fee: fee } });
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
