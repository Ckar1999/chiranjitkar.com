(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { staff: null, projects: [], team: [], inquiries: [], settings: null, metrics: null, view: 'overview', filter: 'all', search: '', timers: new Map(), action: null, pendingInquiry: null };
  const statusNames = { lead:'New inquiry', confirmed:'Confirmed', preproduction:'Pre-production', scheduled:'Scheduled', in_session:'In session', editing:'Editing', client_review:'Client review', delivered:'Delivered', archived:'Archived' };
  const roleNames = { admin:'Administrator', sales:'Sales', photographer:'Photographer', filmmaker:'Filmmaker', editor:'Editor / Retoucher' };
  const filters = ['all','lead','confirmed','preproduction','scheduled','in_session','editing','client_review','delivered'];
  const money = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const humanDate = value => value ? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'Date not set';
  const localDay = value => value ? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(value)) : 'Date not set';

  async function api(path, options = {}) {
    const headers = { 'Content-Type':'application/json', ...(options.headers||{}) };
    const response = await fetch(`/api/${path}`, { credentials:'same-origin', ...options, headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  }

  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  async function boot() {
    $('#date-label').textContent = new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long'}).format(new Date()).toUpperCase();
    $('#today-label').textContent = new Intl.DateTimeFormat('en-IN',{dateStyle:'full'}).format(new Date());
    $('#login-form').addEventListener('submit', login);
    $('#logout-button').addEventListener('click', logout);
    $('#password-button').addEventListener('click', () => $('#password-dialog').showModal());
    $('#password-form').addEventListener('submit', changePassword);
    $('#settings-form').addEventListener('submit', saveSettings);
    $('#settings-password-button').addEventListener('click', () => $('#password-dialog').showModal());
    $('#generate-webhook-secret').addEventListener('click', generateWebhookSecret);
    $('#new-project-button').addEventListener('click', () => { $('#project-created').hidden = true; $('#project-form').reset(); applyProjectDefaults(); $('#project-form button[type=submit]').disabled=false; $('#project-dialog').showModal(); });
    $('#project-form').addEventListener('submit', createProject);
    $('#staff-form').addEventListener('submit', createStaff);
    $('#task-form').addEventListener('submit', createTask);
    $('#invoice-form').addEventListener('submit', createInvoice);
    $('#bank-import-form').addEventListener('submit', importBankTransaction);
    $('#delivery-form').addEventListener('submit', createDelivery);
    $('#new-invoice-button').addEventListener('click', openInvoiceDialog);
    $('#add-staff-button').addEventListener('click', () => { $('#staff-created').hidden = true; $('#staff-form').reset(); $('#staff-dialog').showModal(); });
    $('#project-search').addEventListener('input', event => { state.search = event.target.value.toLowerCase(); renderProjects(); });
    $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
    $$('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
    $$('[data-open-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.openView)));
    $('#action-form').addEventListener('submit', submitSessionCode);
    $('#status-filters').innerHTML = filters.map(key => `<button class="filter-chip ${key==='all'?'active':''}" data-filter="${key}">${key==='all'?'All':escapeHtml(statusNames[key])}</button>`).join('');
    $$('#status-filters button').forEach(button => button.addEventListener('click', () => { state.filter=button.dataset.filter; $$('#status-filters button').forEach(x=>x.classList.toggle('active',x===button)); renderProjects(); }));
    try { const result = await api('auth/me'); state.staff = result.staff; await showApp(); }
    catch { $('#login-view').hidden = false; $('#app-view').hidden = true; }
  }

  async function login(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const message = $('#login-message'); message.textContent='Signing in…';
    try { const result=await api('auth/login',{method:'POST',body:JSON.stringify({email:form.get('email'),password:form.get('password')})}); state.staff=result.staff; message.textContent=''; await showApp(); }
    catch(error) { message.textContent=error.message; }
  }

  async function logout() {
    try { await api('auth/logout',{method:'POST',body:'{}'}); } catch {}
    state.staff=null; $('#app-view').hidden=true; $('#login-view').hidden=false; $('#login-form').reset();
  }

  async function changePassword(event) {
    event.preventDefault(); const data=new FormData(event.currentTarget);
    try { await api('auth/password',{method:'POST',body:JSON.stringify(Object.fromEntries(data))}); $('#password-dialog').close(); event.currentTarget.reset(); toast('Password updated. Sign in again.'); await logout(); }
    catch(error) { toast(error.message); }
  }

  async function showApp() {
    $('#login-view').hidden=true; $('#app-view').hidden=false;
    $('#user-name').textContent=state.staff.name; $('#user-role').textContent=roleNames[state.staff.role]||state.staff.role; $('#user-avatar').textContent=state.staff.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
    $$('.admin-only').forEach(el=>el.hidden=state.staff.role!=='admin');
    $$('.finance-only').forEach(el=>el.hidden=!['admin','sales'].includes(state.staff.role));
    $$('.sales-only').forEach(el=>el.hidden=!['admin','sales'].includes(state.staff.role));
    $$('[data-roles]').forEach(el=>el.hidden=!el.dataset.roles.split(',').includes(state.staff.role));
    await refresh();
    if (state.staff.role==='admin') await loadTeam();
    if (['admin','sales'].includes(state.staff.role)) await loadInquiries();
    await loadSettings();
    clearInterval(state.syncTimer);
    state.syncTimer=setInterval(()=>{if(document.visibilityState!=='visible'||!state.staff)return;refresh();if(state.view==='tasks')loadTasks();if(state.view==='inquiries'&&['admin','sales'].includes(state.staff.role))loadInquiries();},45000);
  }

  async function refresh() {
    try {
      const [projects, dashboard, team] = await Promise.all([api('projects'),api('dashboard'),api('team')]);
      state.projects=projects.projects||[]; state.metrics=dashboard; state.team=team.staff||[];
      $('#nav-project-count').textContent=state.projects.filter(p=>!['delivered','archived'].includes(p.status)).length;
      renderMetrics(); renderProjects(); renderSchedule(); renderOverview();
      $('#nav-task-count').textContent=state.metrics?.my_open_tasks||0;
    } catch(error) { toast(error.message); }
  }

  function renderMetrics() {
    const counts=Object.fromEntries((state.metrics?.counts||[]).map(item=>[item.status,item.count]));
    const activeCount=state.projects.filter(p=>!['delivered','archived'].includes(p.status)).length;
    const shootCount=state.projects.filter(p=>p.shoot_at && new Date(p.shoot_at) >= new Date() && new Date(p.shoot_at) < new Date(Date.now()+7*86400000) && !['delivered','archived'].includes(p.status)).length;
    const newLeads=state.inquiries.filter(i=>i.status==='new').length;
    const metrics=[['Active projects',activeCount,'Across all production stages'],['New inquiries',newLeads,'Waiting for Sales follow-up'],['My open tasks',state.metrics?.my_open_tasks||0,'Assigned handoffs still in progress'],['Overdue tasks',state.metrics?.overdue_tasks||0,'Past due across the studio']];
    $('#metric-grid').innerHTML=metrics.map(([label,value,foot])=>`<div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${value}</div><div class="metric-foot">${escapeHtml(foot)}</div></div>`).join('');
  }

  function renderProjects() {
    let list=state.projects.filter(project=>state.filter==='all'||project.status===state.filter);
    if(state.search) list=list.filter(project=>`${project.project_code} ${project.client_name} ${project.service} ${project.package_name}`.toLowerCase().includes(state.search));
    $('#projects-list').innerHTML=list.length?list.map(projectCard).join(''):'<div class="empty-state">No projects match this view.</div>';
    $$('#projects-list [data-card-action]').forEach(button=>button.addEventListener('click',()=>cardAction(button)));
    $$('#projects-list [data-assignment]').forEach(form=>form.addEventListener('submit',assignStaff));
    $$('#projects-list [data-status-change]').forEach(select=>select.addEventListener('change',()=>changeStatus(select)));
  }

  function renderOverview() {
    const active=state.projects.filter(project=>!['delivered','archived'].includes(project.status)).slice(0,5);
    $('#overview-projects').innerHTML=active.length?active.map(projectCard).join(''):'<div class="empty-state">No active projects yet. Create one to start the studio pipeline.</div>';
    $$('#overview-projects [data-card-action]').forEach(button=>button.addEventListener('click',()=>cardAction(button)));
    $$('#overview-projects [data-assignment]').forEach(form=>form.addEventListener('submit',assignStaff));
    $$('#overview-projects [data-status-change]').forEach(select=>select.addEventListener('change',()=>changeStatus(select)));
  }

  function projectCard(project) {
    const active=project.status==='in_session'&&project.active_started_at;
    const team=project.team?escapeHtml(project.team):'Team not assigned';
    const date=project.shoot_at?humanDate(project.shoot_at):'Schedule not set';
    const linkButton=['admin','sales'].includes(state.staff.role)?'<button class="small-button" data-card-action="client-link" data-id="'+project.id+'">Client link</button>':'';
    const timerButton=active?`<button class="small-button" data-card-action="finish" data-id="${project.id}">Finish session</button>`:(project.status==='scheduled'&&['admin','photographer'].includes(state.staff.role)?`<button class="small-button" data-card-action="start" data-id="${project.id}">Start session</button>`:'');
    const statusOptions=PROJECT_STATUS_OPTIONS.map(([key,label])=>`<option value="${key}" ${project.status===key?'selected':''}>${label}</option>`).join('');
    const staffOptions=state.team.map(person=>`<option value="${person.id}">${escapeHtml(person.name)} · ${escapeHtml(roleNames[person.role]||person.role)}</option>`).join('');
    const roleOptions=['sales','photographer','filmmaker','editor'].map(role=>`<option value="${role}">${roleNames[role]}</option>`).join('');
    const inlineTimer=active?`<div class="timer-inline" data-timer="${project.id}" data-start="${escapeHtml(project.active_started_at)}" data-booked="${project.booked_minutes}" data-grace="30" data-rate="${project.overtime_rate}">--:--:--</div>`:'';
    const taskCount=Number(project.open_tasks)||0; const balance=Number(project.balance_due)||0;
    return `<article class="project-card"><div class="project-main"><div><div class="project-title">${escapeHtml(project.client_name)} · ${escapeHtml(project.service)}</div><div class="project-code">${escapeHtml(project.project_code)}${project.package_name?' · '+escapeHtml(project.package_name):''}</div></div><div class="project-client">${escapeHtml(project.client_email)}<small>${team}</small></div><div class="project-date">${escapeHtml(date)}<small>${Number(project.booked_minutes)/60}h session · ${money(project.overtime_rate)}/30m after grace</small></div><div><span class="status ${escapeHtml(project.status)}">${escapeHtml(statusNames[project.status]||project.status)}</span>${inlineTimer}</div><div class="card-actions">${linkButton}${timerButton}<button class="small-button" data-card-action="details" data-id="${project.id}">Details</button></div></div><div class="card-expand" id="details-${project.id}" hidden>${active?`<div class="timer-box"><strong data-timer="${project.id}" data-start="${escapeHtml(project.active_started_at)}" data-booked="${project.booked_minutes}" data-grace="30" data-rate="${project.overtime_rate}">--:--:--</strong><small>Timer from client-approved start · first 30 minutes after booked duration are grace</small></div>`:''}<label class="status-select-label">Stage <select class="small-button" data-status-change data-id="${project.id}">${statusOptions}</select></label><form class="assign-inline" data-assignment data-id="${project.id}"><select name="staff_id" class="small-button" required><option value="">Assign team member</option>${staffOptions}</select><select name="assignment" class="small-button">${roleOptions}</select><button class="small-button" type="submit">Assign</button></form><button class="small-button" data-card-action="task" data-id="${project.id}">＋ Task (${taskCount})</button><button class="small-button" data-card-action="delivery" data-id="${project.id}">Share delivery</button><button class="small-button" data-card-action="activity" data-id="${project.id}">Recent activity</button>${active?`<button class="small-button" data-card-action="finish" data-id="${project.id}">Complete with client code</button>`:project.status==='scheduled'&&['admin','photographer'].includes(state.staff.role)?`<button class="small-button" data-card-action="start" data-id="${project.id}">Start with client code</button>`:''}${['admin','sales'].includes(state.staff.role)?`<span class="balance-tag">Open balance ${money(balance)}</span>`:''}<div class="brief-text">${escapeHtml(project.brief||'No brief added.')}</div></div></article>`;
  }

  const PROJECT_STATUS_OPTIONS=[['lead','New inquiry'],['confirmed','Confirmed'],['preproduction','Pre-production'],['scheduled','Scheduled'],['in_session','In session'],['editing','Editing'],['client_review','Client review'],['delivered','Delivered'],['archived','Archived']];

  function updateTimers() {
    $$('[data-timer]').forEach(element=>{
      const elapsed=Math.max(0,Date.now()-Date.parse(element.dataset.start));
      const totalMinutes=Math.floor(elapsed/60000), booked=Number(element.dataset.booked), grace=Number(element.dataset.grace);
      const countdown=Math.max(0,booked-totalMinutes), overtime=Math.max(0,totalMinutes-booked-grace), units=overtime?Math.ceil(overtime/30):0, rate=Number(element.dataset.rate);
      const fmt=(minutes)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
      if(totalMinutes<booked) element.innerHTML=`${fmt(countdown)} <span>to booked end</span>`;
      else if(totalMinutes<booked+grace) element.innerHTML=`${fmt(booked+grace-totalMinutes)} <span>grace remaining</span>`;
      else element.innerHTML=`${fmt(overtime)} <span>overtime · ${money(units*rate)}</span>`;
      element.classList.toggle('overtime',totalMinutes>=booked+grace);
    });
  }
  setInterval(updateTimers,1000);

  function renderSchedule() {
    const upcoming=state.projects.filter(p=>p.shoot_at&&!['delivered','archived'].includes(p.status)).sort((a,b)=>new Date(a.shoot_at)-new Date(b.shoot_at));
    $('#schedule-list').innerHTML=upcoming.length?upcoming.map(projectCard).join(''):'<div class="empty-state">No shoots are scheduled yet.</div>';
    $$('#schedule-list [data-card-action]').forEach(button=>button.addEventListener('click',()=>cardAction(button)));
    $$('#schedule-list [data-assignment]').forEach(form=>form.addEventListener('submit',assignStaff));
    $$('#schedule-list [data-status-change]').forEach(select=>select.addEventListener('change',()=>changeStatus(select)));
  }

  async function loadTeam() {
    if(state.staff.role!=='admin') return;
    try {
      const result=await api('staff');
      $('#team-list').innerHTML=(result.staff||[]).map(member=>`<article class="team-card"><div class="avatar">${escapeHtml(member.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div><div class="user-meta"><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.email)}</small></div><span class="team-role">${escapeHtml(roleNames[member.role]||member.role)}</span><button class="small-button" data-member-reset="${member.id}">Reset password</button><button class="small-button" data-member-toggle="${member.id}" data-active="${member.active}">${member.active?'Disable':'Enable'}</button></article>`).join('')||'<div class="empty-state">No team accounts yet.</div>';
      $$('[data-member-toggle]').forEach(button=>button.addEventListener('click',async()=>{try{await api(`staff/${button.dataset.memberToggle}`,{method:'PATCH',body:JSON.stringify({active:button.dataset.active!=='1'})});toast('Team access updated.');await loadTeam();}catch(e){toast(e.message);}}));
      $$('[data-member-reset]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm('Reset this team member’s password? Their current sessions will be signed out.'))return;try{const result=await api(`staff/${button.dataset.memberReset}/reset-password`,{method:'POST',body:'{}'});try{await navigator.clipboard.writeText(result.temporary_password);toast('Temporary password copied. Share it privately.');}catch{prompt('Copy and share this temporary password privately:',result.temporary_password);}}catch(e){toast(e.message);}}));
    } catch(error) { toast(error.message); }
  }

  async function loadSettings(){
    try{
      const result=await api('settings');state.settings=result.settings;
      const form=$('#settings-form');Object.entries(state.settings).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value;});
      $('#integration-cards').innerHTML=Object.entries(result.integrations).map(([key,value])=>{
        const labels={bank_alerts:'Gmail bank alerts',client_codes:'Session approvals',sms_email:'SMS & email delivery',payments:'Payment processing',media_storage:'Photo & video storage'};
        const tags={webhook_ready:'Webhook ready',needs_setup:'Needs token',client_portal:'Portal codes',not_connected:'Not connected',manual_ledger:'Manual ledger',external_links:'External links'};
        return `<article class="integration-card"><div class="integration-head"><strong>${escapeHtml(labels[key]||key)}</strong><span class="integration-state ${['client_portal','webhook_ready'].includes(value.status)?'ready':''}"><i></i>${escapeHtml(tags[value.status]||value.status)}</span></div><p>${escapeHtml(value.detail)}</p></article>`;
      }).join('');
      applyProjectDefaults();
    }catch(error){toast(error.message);}
  }

  function applyProjectDefaults(){
    const form=$('#project-form');if(!form||!state.settings)return;
    form.elements.booked_hours.value=(Number(state.settings.default_duration_minutes)||180)/60;
    form.elements.overtime_rate.value=Number(state.settings.default_overtime_rate)||0;
  }

  async function saveSettings(event){
    event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));
    data.default_duration_minutes=Number(data.default_duration_minutes);data.default_overtime_rate=Number(data.default_overtime_rate);
    try{await api('settings',{method:'PUT',body:JSON.stringify(data)});toast('Admin settings saved.');await loadSettings();}
    catch(error){toast(error.message);}
  }

  async function generateWebhookSecret(){
    if(!confirm('Rotate the bank-alert webhook token? Any existing mail automation using the previous token will stop working.'))return;
    const button=$('#generate-webhook-secret');button.disabled=true;
    try{const result=await api('settings/gmail-webhook-secret',{method:'POST',body:'{}'});const output=$('#webhook-secret-output');output.hidden=false;output.innerHTML=`<strong>Copy this token now. It is shown once.</strong><code>${escapeHtml(result.token)}</code><small>Webhook URL: ${escapeHtml(new URL(result.webhook_url,location.origin).href)}</small>`;toast('Webhook token created. Copy it into your trusted mail automation.');await loadSettings();}
    catch(error){toast(error.message);}
    finally{button.disabled=false;}
  }

  async function loadInquiries(){
    if(!['admin','sales'].includes(state.staff.role))return;
    try{
      const result=await api('inquiries');state.inquiries=result.inquiries||[];$('#nav-inquiry-count').textContent=state.inquiries.filter(i=>i.status==='new').length;renderMetrics();
      $('#inquiries-list').innerHTML=state.inquiries.length?state.inquiries.map(item=>`<article class="inquiry-card"><div><span class="status ${item.status==='new'?'lead':item.status==='qualified'?'confirmed':'editing'}">${escapeHtml(item.status)}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)} · ${escapeHtml(item.phone||'No phone')}</small></div><div><span class="inquiry-service">${escapeHtml(item.service)}</span><small>${escapeHtml(item.city||'Location not specified')} · Received ${humanDate(item.created_at)}${item.referral_code?` · Referral ${escapeHtml(item.referral_code)}`:''}</small><p>${escapeHtml(item.brief||'No brief supplied.')}</p></div><div class="inquiry-actions"><button class="small-button" data-lead-status="contacted" data-id="${item.id}">Mark contacted</button><button class="small-button gold-outline" data-convert-lead="${item.id}">Create project</button></div></article>`).join(''):'<div class="empty-state">No inquiries yet. Website forms will appear here.</div>';
      $$('[data-lead-status]').forEach(button=>button.addEventListener('click',async()=>{try{await api(`inquiries/${button.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:button.dataset.leadStatus})});toast('Inquiry marked contacted.');await loadInquiries();}catch(e){toast(e.message);}}));
      $$('[data-convert-lead]').forEach(button=>button.addEventListener('click',()=>prefillProjectFromInquiry(button.dataset.convertLead)));
    }catch(error){toast(error.message);}
  }

  function prefillProjectFromInquiry(inquiryId){
    const item=state.inquiries.find(i=>i.id===inquiryId);if(!item)return;state.pendingInquiry=item;
    $('#project-form').reset();const form=$('#project-form');
    form.elements.client_name.value=item.name;form.elements.client_email.value=item.email;form.elements.client_phone.value=item.phone;form.elements.service.value=item.service;form.elements.location.value=item.city;form.elements.brief.value=item.brief;
    form.elements.referral_code.value=item.referral_code||'';
    $('#project-created').hidden=true;$('#project-dialog').showModal();
  }

  async function cardAction(button) {
    const project=state.projects.find(p=>p.id===button.dataset.id); if(!project) return;
    const action=button.dataset.cardAction;
    if(action==='details') { const panel=$(`#details-${project.id}`); panel.hidden=!panel.hidden; if(!panel.hidden) updateTimers(); return; }
    if(action==='client-link') {
      try { const result=await api(`projects/${project.id}/client-link`,{method:'POST',body:'{}'}); await navigator.clipboard.writeText(result.client_link); toast('New private client link copied. Previous link is revoked.'); }
      catch(e){ toast(e.message); }
      return;
    }
    if(action==='task') { $('#task-form').reset();$('#task-form [name=project_id]').value=project.id;populateStaffOptions($('#task-form [name=assigned_to]'));$('#task-dialog').showModal();return; }
    if(action==='delivery') { $('#delivery-form').reset();$('#delivery-form [name=project_id]').value=project.id;$('#delivery-dialog').showModal();return; }
    if(action==='start'||action==='finish') {
      state.action={projectId:project.id,action}; const isStart=action==='start';
      $('#action-eyebrow').textContent=isStart?'CLIENT START APPROVAL':'CLIENT FINISH APPROVAL';
      $('#action-title').textContent=isStart?'Start the session':'Complete the session';
      $('#action-help').innerHTML=isStart?`Ask the client to open their private session link and tap <strong>Approve session start</strong>. They will share a fresh six-digit code with you.`:`Ask the client to open their private session link and tap <strong>Approve session finish</strong>. The system records the end time only after you enter their code.`;
      $('#action-message').textContent=''; $('#action-form').reset(); $('#action-dialog').showModal(); return;
    }
    if(action==='activity') {
      try { const result=await api(`projects/${project.id}/activity`); alert((result.activity||[]).slice(0,15).map(a=>`${humanDate(a.created_at)} · ${a.actor||'Client'} · ${a.event.replaceAll('_',' ')}`).join('\n')||'No activity yet.'); } catch(e){toast(e.message);}
    }
  }

  async function submitSessionCode(event) {
    event.preventDefault(); if(!state.action) return;
    const code=new FormData(event.currentTarget).get('code'); const {projectId,action}=state.action;
    const url=action==='start'?`projects/${projectId}/session/start`:`projects/${projectId}/session/complete`;
    $('#action-message').textContent='Verifying client approval…';
    try {
      const result=await api(url,{method:'POST',body:JSON.stringify({code})});
      $('#action-dialog').close();
      toast(action==='start'?'Session started. Timer is running.':`Session closed. Overtime charge: ${money(result.session.overtime_fee)}.`);
      state.action=null; await refresh();
    } catch(error){$('#action-message').textContent=error.message;}
  }

  async function createProject(event) {
    event.preventDefault(); const form=new FormData(event.currentTarget); const data=Object.fromEntries(form);
    data.booked_minutes=Math.round(Number(data.booked_hours)*60); delete data.booked_hours;
    if(data.shoot_at) data.shoot_at=new Date(data.shoot_at).toISOString(); else data.shoot_at=null;
    data.package_price=Number(data.package_price)||0; data.deposit_amount=Number(data.deposit_amount)||0; data.overtime_rate=Number(data.overtime_rate)||0;
    try {
      const result=await api('projects',{method:'POST',body:JSON.stringify(data)});
      if(state.pendingInquiry){await api(`inquiries/${state.pendingInquiry.id}`,{method:'PATCH',body:JSON.stringify({status:'qualified'})});state.pendingInquiry=null;}
      $('#project-created').hidden=false; $('#project-created').innerHTML=`Project <strong>${escapeHtml(result.project.project_code)}</strong> created. Copy this private client link and send it through your approved client contact channel:<br><a href="${escapeHtml(result.client_link)}">${escapeHtml(result.client_link)}</a><button type="button" class="small-button" id="copy-new-link">Copy client link</button><br><small>The full link is shown once here. It is stored as a secure hash and cannot be retrieved later. Generate a replacement from project details if it is lost.</small>`;
      $('#copy-new-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(result.client_link);toast('Client link copied.');}catch{toast('Select and copy the displayed link.');}});
      event.currentTarget.querySelector('button[type=submit]').disabled=true;
      await refresh(); setView('projects');
      setTimeout(()=>{if($('#project-dialog').open){$('#project-dialog').close();$('#project-form').reset();$('#project-form button[type=submit]').disabled=false;}},12000);
    } catch(error){toast(error.message);}
  }

  async function createStaff(event) {
    event.preventDefault(); const data=Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result=await api('staff',{method:'POST',body:JSON.stringify(data)});
      $('#staff-created').hidden=false; $('#staff-created').innerHTML=`Account created for <strong>${escapeHtml(result.staff.name)}</strong>.<br>Temporary password (copy now):<div class="client-code" style="font-size:18px;letter-spacing:.06em">${escapeHtml(result.temporary_password)}</div><button type="button" class="small-button" id="copy-temp-password">Copy temporary password</button><br><small>Share this privately. Ask the team member to change it after first sign in. This password will not be shown again.</small>`;
      $('#copy-temp-password').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(result.temporary_password);toast('Temporary password copied.');}catch{toast('Select and copy the displayed password.');}});
      await loadTeam();
    }catch(error){toast(error.message);}
  }

  function populateStaffOptions(select){
    select.innerHTML='<option value="">Unassigned</option>'+state.team.map(person=>`<option value="${person.id}">${escapeHtml(person.name)} · ${escapeHtml(roleNames[person.role]||person.role)}</option>`).join('');
  }

  async function createTask(event){
    event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));if(data.due_at)data.due_at=new Date(data.due_at).toISOString();else data.due_at=null;
    try{await api('tasks',{method:'POST',body:JSON.stringify(data)});$('#task-dialog').close();toast('Task assigned to the project.');await refresh();if(state.view==='tasks')await loadTasks();}catch(error){toast(error.message);}
  }

  async function loadTasks(){
    try{const result=await api('tasks');const tasks=result.tasks||[];$('#tasks-list').innerHTML=tasks.length?tasks.map(task=>`<article class="task-card"><div class="task-priority ${escapeHtml(task.priority)}"></div><div class="task-main"><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.project_code)} · ${escapeHtml(task.client_name)} · ${escapeHtml(task.assignee_name||'Unassigned')}</small>${task.description?`<p>${escapeHtml(task.description)}</p>`:''}</div><span class="task-due">${task.due_at?humanDate(task.due_at):'No due date'}</span><select class="small-button" data-task-status="${task.id}"><option value="todo" ${task.status==='todo'?'selected':''}>To do</option><option value="in_progress" ${task.status==='in_progress'?'selected':''}>In progress</option><option value="blocked" ${task.status==='blocked'?'selected':''}>Blocked</option><option value="done" ${task.status==='done'?'selected':''}>Done</option></select></article>`).join(''):'<div class="empty-state">No tasks assigned yet. Create tasks from a project’s details.</div>';$$('[data-task-status]').forEach(select=>select.addEventListener('change',async()=>{try{await api(`tasks/${select.dataset.taskStatus}`,{method:'PATCH',body:JSON.stringify({status:select.value})});toast('Task status updated.');await refresh();await loadTasks();}catch(e){toast(e.message);}}));}catch(error){toast(error.message);}
  }

  function openInvoiceDialog(){
    const select=$('#invoice-form [name=project_id]');select.innerHTML=state.projects.map(p=>`<option value="${p.id}">${escapeHtml(p.project_code)} · ${escapeHtml(p.client_name)}</option>`).join('');$('#invoice-form').reset();$('#invoice-dialog').showModal();
  }
  async function createInvoice(event){
    event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));data.amount=Number(data.amount)||0;
    try{await api('invoices',{method:'POST',body:JSON.stringify(data)});$('#invoice-dialog').close();toast('Charge added to the billing ledger.');await loadInvoices();await refresh();}catch(error){toast(error.message);}
  }
  async function loadInvoices(){
    if(!['admin','sales'].includes(state.staff.role))return;
    try{const result=await api('invoices');const invoices=result.invoices||[];$('#invoice-list').innerHTML=invoices.length?invoices.map(invoice=>`<article class="invoice-card"><div><strong>${escapeHtml(invoice.client_name)}</strong><small>${escapeHtml(invoice.project_code)} · ${escapeHtml(invoice.invoice_code)}</small></div><div><span class="invoice-kind">${escapeHtml(invoice.kind)}</span><small>${escapeHtml(invoice.description)}</small></div><div><strong>${money(invoice.amount)}</strong><small>Paid ${money(invoice.amount_paid)} · Due ${money(invoice.amount-invoice.amount_paid)}</small></div><div class="invoice-controls"><label>Received ₹<input type="number" min="0" max="${invoice.amount}" step="1" value="${invoice.amount_paid}" data-invoice-paid="${invoice.id}"></label><label>Payment URL<input type="url" value="${escapeHtml(invoice.payment_url)}" data-invoice-url="${invoice.id}" placeholder="https://…"></label><button class="small-button" data-invoice-save="${invoice.id}">Save</button><button class="small-button" data-invoice-send="${invoice.id}" ${invoice.status==='sent'?'disabled':''}>${invoice.status==='sent'?'Sent':'Mark sent'}</button></div>${invoice.payment_url?`<a class="small-button" href="${escapeHtml(invoice.payment_url)}" target="_blank" rel="noopener noreferrer">Payment link ↗</a>`:''}</article>`).join(''):'<div class="empty-state">No invoices or charges yet.</div>';
      $$('[data-invoice-save]').forEach(button=>button.addEventListener('click',async()=>{const input=$(`[data-invoice-paid="${button.dataset.invoiceSave}"]`);const urlInput=$(`[data-invoice-url="${button.dataset.invoiceSave}"]`);try{await api(`invoices/${button.dataset.invoiceSave}`,{method:'PATCH',body:JSON.stringify({amount_paid:Number(input.value),payment_url:urlInput.value})});toast('Recorded payment saved.');await loadInvoices();await refresh();}catch(e){toast(e.message);}}));
      $$('[data-invoice-send]').forEach(button=>button.addEventListener('click',async()=>{try{await api(`invoices/${button.dataset.invoiceSend}`,{method:'PATCH',body:JSON.stringify({status:'sent'})});toast('Invoice marked as sent.');await loadInvoices();}catch(e){toast(e.message);}}));
      await loadBankTransactions();
    }catch(error){toast(error.message);}
  }
  async function importBankTransaction(event){
    event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));data.transaction_at=new Date(data.transaction_at).toISOString();
    try{const result=await api('bank-transactions',{method:'POST',body:JSON.stringify(data)});toast(result.message);event.currentTarget.reset();await loadBankTransactions();await loadInvoices();await refresh();}
    catch(error){toast(error.message);}
  }
  async function loadBankTransactions(){
    if(!['admin','sales'].includes(state.staff.role))return;
    try{const result=await api('bank-transactions');const rows=result.transactions||[];$('#bank-transaction-list').innerHTML=rows.length?`<h3 class="bank-history-title">Recent bank transactions</h3>`+rows.map(tx=>`<article class="bank-transaction ${escapeHtml(tx.status)}"><div><strong>${escapeHtml(tx.utr)}</strong><small>${humanDate(tx.transaction_at)} · ${tx.source==='manual_bank_alert'?'Bank alert entry':escapeHtml(tx.source)}</small></div><strong>${money(tx.amount)}</strong><span class="bank-status ${escapeHtml(tx.status)}">${tx.status==='matched'?'Matched':tx.status==='review'?'Needs review':'Unmatched'}</span><small>${tx.invoice_code?`${escapeHtml(tx.invoice_code)} · ${escapeHtml(tx.client_name||'')}`:escapeHtml(tx.note||'No invoice balance changed')}</small></article>`).join(''):'<div class="empty-state bank-empty">No bank transactions recorded yet.</div>';}
    catch(error){toast(error.message);}
  }
  async function createDelivery(event){
    event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget)),projectId=data.project_id;delete data.project_id;
    try{await api(`projects/${projectId}/deliveries`,{method:'POST',body:JSON.stringify(data)});$('#delivery-dialog').close();toast('Delivery link is now available in the client portal.');await refresh();}catch(error){toast(error.message);}
  }

  async function assignStaff(event) {
    event.preventDefault(); const form=new FormData(event.currentTarget); const data=Object.fromEntries(form); data.assignment=data.assignment;
    try { await api(`projects/${event.currentTarget.dataset.id}/assignments`,{method:'POST',body:JSON.stringify(data)});toast('Team assignment saved.');await refresh(); }
    catch(error){toast(error.message);}
  }

  async function changeStatus(select) {
    try { await api(`projects/${select.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:select.value})});toast('Project stage updated.');await refresh(); }
    catch(error){toast(error.message);await refresh();}
  }

  function setView(view) {
    if(!['overview','inquiries','projects','schedule','tasks','billing','team','settings'].includes(view)||['team','settings'].includes(view)&&state.staff?.role!=='admin'||['billing','inquiries'].includes(view)&&!['admin','sales'].includes(state.staff?.role)) return;
    state.view=view; $$('.view').forEach(el=>el.hidden=el.id!==`${view}-view`); $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    $('#view-title').textContent={overview:'Overview',inquiries:'Inquiries',projects:'Projects',schedule:'Schedule',tasks:'Tasks',billing:'Billing',team:'Team',settings:'Settings'}[view];
    if(view==='team') loadTeam(); if(view==='schedule')renderSchedule();
    if(view==='tasks')loadTasks();if(view==='billing')loadInvoices();
    if(view==='inquiries')loadInquiries();
    if(view==='settings')loadSettings();
  }
  document.addEventListener('DOMContentLoaded',boot);
})();
