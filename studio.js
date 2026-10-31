(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { staff: null, projects: [], team: [], inquiries: [], inquiryFilter:'all', settings: null, metrics: null, view: 'overview', filter: 'all', search: '', timers: new Map(), action: null, pendingInquiry: null };
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
    $('#inquiry-type-filter').addEventListener('change',event=>{state.inquiryFilter=event.target.value;renderInquiries();});
    $('#agreement-form')?.addEventListener('submit', handleAgreementDispatch);
    $('#leegality-settings-form')?.addEventListener('submit', saveLeegalitySettings);
    
    // Foundation Event Listeners
    $$('.fnd-filter-btn').forEach(btn => btn.addEventListener('click', () => {
      fndData.filter = btn.dataset.fndStatus;
      $$('.fnd-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderFoundationApplications();
    }));

    $('#fnd-toggle-camp-btn')?.addEventListener('click', async (e) => {
      const campId = e.currentTarget.dataset.campId;
      const nextStatus = e.currentTarget.dataset.nextStatus || 'paused';
      if (!campId) return;
      try {
        await api(`foundation/admin/campaigns/${campId}/toggle`, {
          method: 'POST',
          body: JSON.stringify({ status: nextStatus })
        });
        toast(`Campaign status updated to ${nextStatus}.`);
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-toggle-launch-status-btn')?.addEventListener('click', async (e) => {
      const nextStatus = e.currentTarget.dataset.nextStatus || 'live';
      const isActivating = nextStatus === 'live';
      const confirmMsg = isActivating 
        ? 'Make the Foundation website publicly LIVE to all students and teachers?' 
        : 'Switch Foundation website back to Launching Soon / Pilot phase?';
      if (!confirm(confirmMsg)) return;
      try {
        await api('foundation/admin/settings', {
          method: 'POST',
          body: JSON.stringify({ launch_status: nextStatus })
        });
        toast(isActivating ? '🎉 Foundation website is now PUBLICLY LIVE!' : 'Foundation website set to Launching Soon.');
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-edit-budget-btn')?.addEventListener('click', () => {
      $('#fnd-budget-amount').value = fndData.budget.annual_budget || 500000;
      $('#fnd-budget-dialog').showModal();
    });

    $('#fnd-budget-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const annual_budget = $('#fnd-budget-amount').value;
      try {
        await api('foundation/admin/settings', {
          method: 'POST',
          body: JSON.stringify({ annual_budget })
        });
        $('#fnd-budget-dialog').close();
        toast('Annual budget updated.');
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-dlg-verify-btn')?.addEventListener('click', async () => {
      if (!window._curFndApp) return;
      const notes = $('#fnd-dlg-notes').value;
      try {
        await api(`foundation/admin/applications/${window._curFndApp.id}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'verified', review_notes: notes })
        });
        $('#fnd-app-dialog').close();
        toast('School rubber stamp & teacher credentials verified.');
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-dlg-approve-btn')?.addEventListener('click', async () => {
      if (!window._curFndApp) return;
      const notes = $('#fnd-dlg-notes').value;
      try {
        await api(`foundation/admin/applications/${window._curFndApp.id}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'approved', review_notes: notes })
        });
        $('#fnd-app-dialog').close();
        toast('Application approved! You can now log purchase bills and disburse aid.');
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-dlg-reject-btn')?.addEventListener('click', async () => {
      if (!window._curFndApp) return;
      const reason = prompt('Please enter the reason for rejection (this will be visible to the applicant):', 'Criteria not met / Duplicate school request.');
      if (!reason) return;
      try {
        await api(`foundation/admin/applications/${window._curFndApp.id}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'rejected', rejection_reason: reason })
        });
        $('#fnd-app-dialog').close();
        toast('Application marked as rejected.');
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-bill-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        application_id: $('#fnd-bill-app-id').value,
        vendor_name: $('#fnd-bill-vendor').value.trim(),
        item_summary: $('#fnd-bill-items').value.trim(),
        amount: Number($('#fnd-bill-amount').value),
        bill_date: $('#fnd-bill-date').value
      };
      try {
        const res = await api('foundation/admin/disbursements', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        $('#fnd-bill-dialog').close();
        toast(`Internal invoice logged. ₹${payload.amount} deducted from annual reserve.`);
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-dispatch-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        shipping_carrier: $('#fnd-disp-carrier').value,
        tracking_number: $('#fnd-disp-tracking').value.trim(),
        status: $('#fnd-disp-status').value
      };
      const appId = $('#fnd-disp-app-id').value;
      try {
        await api(`foundation/admin/applications/${appId}/dispatch`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        $('#fnd-dispatch-dialog').close();
        toast(`Postal waybill committed: ${payload.shipping_carrier} (#${payload.tracking_number}).`);
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-aadh-approve-btn')?.addEventListener('click', async () => {
      if (!window._curFndStudent) return;
      const notes = $('#fnd-aadh-notes').value;
      const standing = $('#fnd-aadh-standing').value;
      try {
        await api(`foundation/admin/students/${window._curFndStudent.id}/verify`, {
          method: 'POST',
          body: JSON.stringify({ status: 'verified', notes })
        });
        if (standing !== window._curFndStudent.academic_standing) {
          await api(`foundation/admin/students/${window._curFndStudent.id}/academic-standing`, {
            method: 'POST',
            body: JSON.stringify({ academic_standing: standing, notes })
          });
        }
        $('#fnd-aadhaar-dialog').close();
        toast('Student identity verified & approved!');
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-aadh-reject-btn')?.addEventListener('click', async () => {
      if (!window._curFndStudent) return;
      const notes = $('#fnd-aadh-notes').value || 'Aadhaar document does not match student records.';
      try {
        await api(`foundation/admin/students/${window._curFndStudent.id}/verify`, {
          method: 'POST',
          body: JSON.stringify({ status: 'rejected', notes })
        });
        $('#fnd-aadhaar-dialog').close();
        toast('Student account marked as rejected.');
        await loadFoundation();
      } catch (err) {
        toast(err.message);
      }
    });

    $('#fnd-new-camp-btn')?.addEventListener('click', () => {
      $('#fnd-camp-form').reset();
      $('#fnd-camp-id').value = '';
      $('#fnd-camp-budget').value = '250000';
      $('#fnd-camp-max').value = '100';
      $('#fnd-camp-target').value = 'Class 8-10 Underprivileged School Students';
      $('#fnd-camp-kit').value = 'Prescribed NCERT Textbooks, 12 Exercise Registers, Geometry Box';
      $('#fnd-camp-modal-title').textContent = 'New Educational Aid Campaign';
      $('#fnd-camp-dialog').showModal();
    });

    $('#fnd-camp-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        id: $('#fnd-camp-id').value || undefined,
        title: $('#fnd-camp-title').value.trim(),
        target_audience: $('#fnd-camp-target').value.trim(),
        kit_summary: $('#fnd-camp-kit').value.trim(),
        allocated_budget: Number($('#fnd-camp-budget').value),
        max_beneficiaries: Number($('#fnd-camp-max').value),
        description: $('#fnd-camp-desc').value.trim(),
        status: 'active'
      };
      try {
        await api('foundation/admin/campaigns', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        $('#fnd-camp-dialog').close();
        toast('Campaign launched & activated successfully!');
        await loadFoundation();
      } catch (err) {
        toast(err.message || 'Failed to save campaign.');
      }
    });

    $('#fnd-dlg-letter-btn')?.addEventListener('click', (e) => {
      const appId = e.currentTarget.dataset.appId || window._curFndApp?.id;
      if (!appId) {
        toast('Please select an application first.');
        return;
      }
      window.fndOpenLetterModal(appId);
    });

    $('#fnd-ltr-back-btn')?.addEventListener('click', () => {
      $('#fnd-letter-dialog')?.close();
      if (window._curFndLetterApp) {
        window.fndOpenAppModal(window._curFndLetterApp.id);
      }
    });

    $('#fnd-dlg-parent-btn')?.addEventListener('click', async () => {
      if (!window._curFndApp) return;
      const app = window._curFndApp;
      const phone = app.guardian_phone || '';
      const text = `নমস্কার / Greetings from Chiranjit Kar Foundation!\n\nWe are pleased to inform you that the educational aid application for ${app.student_name} (${app.class_grade}, ${app.school_name}) has been APPROVED.\n\nAll syllabus study materials, registers, and kits are being packaged and will be delivered directly to ${app.school_name} via India Post Speed Post.\n\nThe Headmaster / Teacher In-Charge will formally hand over the items to your child upon arrival.\n\nPlease encourage ${app.student_name} to study diligently. Satisfactory school exam performance maintains scholarship assistance for future academic drives.\n\nChiranjit Kar Foundation Desk: +91 9402369889 | Agartala, Tripura`;

      window.open(`https://wa.me/91${phone.replace(/\\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`, '_blank');

      try {
        await api(`foundation/admin/applications/${app.id}/notify-parent`, { method: 'POST' });
        toast('Parent WhatsApp alert opened and logged.');
      } catch (err) {
        console.error(err);
      }
    });

    $('#fnd-ltr-copy-btn')?.addEventListener('click', () => {
      if (!window._curFndLetter || !window._curFndLetterApp) return;
      const app = window._curFndLetterApp;
      const ltr = window._curFndLetter;
      const text = `CHIRANJIT KAR FOUNDATION
Direct Child Education & Philanthropic Stewardship • 100% Private Philanthropy
Central Desk: Agartala, Tripura West – 799001 | Desk: +91 9402369889 | Email: foundation@chiranjitkar.com

Letter Ref No: ${ltr.letter_code}
Date of Issue: ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(ltr.created_at || Date.now()))}
Application Ref: ${app.application_code || app.id}

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

      navigator.clipboard.writeText(text);
      toast('Official intimation letter copied to clipboard.');
    });

    $('#fnd-ltr-print-btn')?.addEventListener('click', () => {
      printOfficialLetter();
    });

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
    const cancelButton=['admin','sales'].includes(state.staff.role)&&!['archived','delivered','in_session'].includes(project.status)&&!project.cancelled_at?`<button class="small-button" data-card-action="cancel" data-id="${project.id}">Cancel booking</button>`:'';
    const refundInfo=project.cancelled_at?`<p class="brief-text">Cancelled · ${escapeHtml(project.cancellation_policy_applied||'')} Refund to process: ${money(project.cancellation_refund_amount)}.</p>`:'';
    return `<article class="project-card"><div class="project-main"><div><div class="project-title">${escapeHtml(project.client_name)} · ${escapeHtml(project.service)}</div><div class="project-code">${escapeHtml(project.project_code)}${project.package_name?' · '+escapeHtml(project.package_name):''}</div></div><div class="project-client">${escapeHtml(project.client_email)}<small>${team}</small></div><div class="project-date">${escapeHtml(date)}<small>${Number(project.booked_minutes)/60}h session · ${money(project.overtime_rate)}/30m after grace</small></div><div><span class="status ${escapeHtml(project.status)}">${escapeHtml(statusNames[project.status]||project.status)}</span>${inlineTimer}</div><div class="card-actions">${linkButton}${timerButton}<button class="small-button" data-card-action="details" data-id="${project.id}">Details</button></div></div><div class="card-expand" id="details-${project.id}" hidden>${active?`<div class="timer-box"><strong data-timer="${project.id}" data-start="${escapeHtml(project.active_started_at)}" data-booked="${project.booked_minutes}" data-grace="30" data-rate="${project.overtime_rate}">--:--:--</strong><small>Timer from client-approved start · first 30 minutes after booked duration are grace</small></div>`:''}<label class="status-select-label">Stage <select class="small-button" data-status-change data-id="${project.id}">${statusOptions}</select></label><form class="assign-inline" data-assignment data-id="${project.id}"><select name="staff_id" class="small-button" required><option value="">Assign team member</option>${staffOptions}</select><select name="assignment" class="small-button">${roleOptions}</select><button class="small-button" type="submit">Assign</button></form><button class="small-button" data-card-action="task" data-id="${project.id}">＋ Task (${taskCount})</button><button class="small-button" data-card-action="delivery" data-id="${project.id}">Share delivery</button><button class="small-button" data-card-action="activity" data-id="${project.id}">Recent activity</button><button class="small-button" data-card-action="leegality-agreement" data-id="${project.id}">⚖ Agreement</button>${cancelButton}${active?`<button class="small-button" data-card-action="finish" data-id="${project.id}">Complete with client code</button>`:project.status==='scheduled'&&['admin','photographer'].includes(state.staff.role)?`<button class="small-button" data-card-action="start" data-id="${project.id}">Start with client code</button>`:''}${['admin','sales'].includes(state.staff.role)?`<span class="balance-tag">Open balance ${money(balance)}</span>`:''}${refundInfo}<div class="brief-text">${escapeHtml(project.brief||'No brief added.')}</div></div></article>`;
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
      const result=await api('settings');state.settings=result.settings || {};
      const form=$('#settings-form');Object.entries(state.settings || {}).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value;});
      const lForm = $('#leegality-settings-form');
      if (lForm && state.settings) {
        if (state.settings.leegality_auth_token) $('#leegality-auth-token').value = state.settings.leegality_auth_token;
        if (state.settings.leegality_profile_id_paid) $('#leegality-profile-paid').value = state.settings.leegality_profile_id_paid;
        if (state.settings.leegality_profile_id_collab) $('#leegality-profile-collab').value = state.settings.leegality_profile_id_collab;
        if (state.settings.leegality_estamp_number) $('#leegality-estamp-no').value = state.settings.leegality_estamp_number;
        if ($('#leegality-doc-fee')) $('#leegality-doc-fee').value = state.settings.agreement_fee ?? 99;
      }
      $('#integration-cards').innerHTML=Object.entries(result.integrations || {}).map(([key,value])=>{
        const labels={leegality:'Leegality Aadhaar eSign',bank_alerts:'Gmail bank alerts',client_codes:'Session approvals',sms_email:'SMS & email delivery',payments:'Payment processing',media_storage:'Photo & video storage'};
        const tags={connected:'Connected',webhook_ready:'Webhook ready',needs_token:'Needs Token',needs_setup:'Needs token',client_portal:'Portal codes',not_connected:'Not connected',manual_ledger:'Manual ledger',external_links:'External links'};
        return `<article class="integration-card"><div class="integration-head"><strong>${escapeHtml(labels[key]||key)}</strong><span class="integration-state ${['client_portal','webhook_ready','connected'].includes(value.status)?'ready':''}"><i></i>${escapeHtml(tags[value.status]||value.status)}</span></div><p>${escapeHtml(value.detail)}</p></article>`;
      }).join('');
      applyProjectDefaults();
    }catch(error){toast(error.message);}
  }

  async function saveLeegalitySettings(e) {
    e.preventDefault();
    const status = $('#leegality-settings-status');
    status.textContent = 'Saving configuration…';
    try {
      await api('settings/leegality', {
        method: 'PUT',
        body: JSON.stringify({
          leegality_auth_token: $('#leegality-auth-token').value,
          leegality_profile_id_paid: $('#leegality-profile-paid').value,
          leegality_profile_id_collab: $('#leegality-profile-collab').value,
          leegality_estamp_number: $('#leegality-estamp-no').value,
          agreement_fee: $('#leegality-doc-fee')?.value || 99
        })
      });
      status.textContent = 'Configuration saved.';
      toast('Leegality configuration saved.');
      await loadSettings();
    } catch (err) {
      status.textContent = err.message;
      toast(err.message);
    }
  }

  function applyProjectDefaults(){
    const form=$('#project-form');if(!form||!state.settings)return;
    form.elements.booked_hours.value=(Number(state.settings.default_duration_minutes)||180)/60;
    form.elements.overtime_rate.value=Number(state.settings.default_overtime_rate)||0;
  }

  async function saveSettings(event){
    event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));
    data.default_duration_minutes=Number(data.default_duration_minutes);data.default_overtime_rate=Number(data.default_overtime_rate);
    data.agreement_fee=Number(data.agreement_fee)||0;
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
      renderInquiries();
    }catch(error){toast(error.message);}
  }

  function renderInquiries(){
    const items=state.inquiries.filter(item=>state.inquiryFilter==='all'||(item.inquiry_type||'booking')===state.inquiryFilter);
    const kinds={booking:'Booking request',brand_collab:'Fashion partner proposal',model_collab:'Model / talent photoshoot proposal'};
    $('#inquiries-list').innerHTML=items.length?items.map(item=>{
      const modelProposal=item.inquiry_type==='model_collab';
      const collaboration=['model_collab','brand_collab'].includes(item.inquiry_type);
      const decision=item.collaboration_decision||'pending';
      const decisionLabel={pending:'Awaiting review',accepted:'Accepted',declined:'Declined'}[decision]||'Awaiting review';
      const packageInfo=item.package_name?`${escapeHtml(item.package_name)}${Number(item.package_price)>0?' · '+money(item.package_price):' · custom quote'}`:escapeHtml(item.service);
      const reviewActions=decision==='pending'?`<button class="small-button gold-outline" data-review-proposal="accepted" data-id="${item.id}">Accept proposal</button><button class="small-button" data-review-proposal="declined" data-id="${item.id}">Decline</button>`:decision==='accepted'&&item.status!=='qualified'?`<button class="small-button gold-outline" data-convert-lead="${item.id}">${modelProposal?'Create photoshoot project':'Create collaboration project'}</button>`:decision==='accepted'?'<span class="project-created-tag">Project created</span>':'';
      const normalActions=`<button class="small-button" data-lead-status="contacted" data-id="${item.id}">Mark contacted</button><button class="small-button gold-outline" data-convert-lead="${item.id}">Create project</button>`;
      const resources=collaboration?`<div class="collab-links">${item.portfolio_url?`<a href="${escapeHtml(item.portfolio_url)}" target="_blank" rel="noopener noreferrer">Open portfolio / profile ↗</a>`:''}${item.moodboard_url?`<a href="${escapeHtml(item.moodboard_url)}" target="_blank" rel="noopener noreferrer">Open moodboard ↗</a>`:''}</div>`:'';
      return `<article class="inquiry-card"><div><span class="status ${collaboration?'editing':item.status==='new'?'lead':item.status==='qualified'?'confirmed':'editing'}">${collaboration?escapeHtml(decisionLabel):escapeHtml(item.status)}</span><span class="inquiry-kind">${escapeHtml(kinds[item.inquiry_type||'booking']||'Booking request')}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)} · ${escapeHtml(item.phone||'No phone')}</small></div><div><span class="inquiry-service">${packageInfo}</span><small>${escapeHtml(item.city||'Location not specified')} · Received ${humanDate(item.created_at)}${item.preferred_date?` · Preferred date ${escapeHtml(item.preferred_date)}`:''}${item.referral_code?` · Referral ${escapeHtml(item.referral_code)}`:''}</small>${resources}<p>${escapeHtml(item.brief||'No brief supplied.')}</p></div><div class="inquiry-actions">${collaboration?reviewActions:normalActions}</div></article>`;
    }).join(''):'<div class="empty-state">No requests in this category yet.</div>';
    $$('[data-lead-status]').forEach(button=>button.addEventListener('click',async()=>{try{await api(`inquiries/${button.dataset.id}`,{method:'PATCH',body:JSON.stringify({status:button.dataset.leadStatus})});toast('Inquiry marked contacted.');await loadInquiries();}catch(e){toast(e.message);}}));
    $$('[data-convert-lead]').forEach(button=>button.addEventListener('click',()=>prefillProjectFromInquiry(button.dataset.convertLead)));
    $$('[data-review-proposal]').forEach(button=>button.addEventListener('click',async()=>{
      const decision=button.dataset.reviewProposal;
      if(decision==='declined'&&!confirm('Decline this model photoshoot proposal? This review decision cannot be changed.'))return;
      button.disabled=true;
      try{await api(`inquiries/${button.dataset.id}`,{method:'PATCH',body:JSON.stringify({collaboration_decision:decision})});toast(decision==='accepted'?'Proposal accepted. Create the project when you are ready.':'Proposal declined.');await loadInquiries();}
      catch(error){button.disabled=false;toast(error.message);}
    }));
  }

  function prefillProjectFromInquiry(inquiryId){
    const item=state.inquiries.find(i=>i.id===inquiryId);if(!item)return;state.pendingInquiry=item;
    $('#project-form').reset();const form=$('#project-form');
    form.elements.client_name.value=item.name;form.elements.client_email.value=item.email;form.elements.client_phone.value=item.phone;form.elements.service.value=item.service;form.elements.location.value=item.city;form.elements.brief.value=item.brief;
    form.elements.package_name.value=item.package_name||'';form.elements.package_price.value=Number(item.package_price)||0;form.elements.deposit_amount.value=0;form.elements.shoot_at.value=item.preferred_date?`${item.preferred_date}T10:00`:'';
    form.elements.referral_code.value=item.referral_code||'';
    $('#project-created').hidden=true;$('#project-dialog').showModal();
  }

  async function cardAction(button) {
    const project=state.projects.find(p=>p.id===button.dataset.id); if(!project) return;
    const action=button.dataset.cardAction;
    if(action==='cancel') {
      const refundable=Number(project.deposit_received??project.deposit_amount)||0;
      if(!confirm(`Cancel ${project.project_code}? The deposit refund depends on whether this is more than 48 hours before the scheduled shoot. The refundable amount will be marked for manual processing (up to ${money(refundable)}).`))return;
      try{const result=await api(`projects/${project.id}/cancel`,{method:'POST',body:'{}'});toast(result.message);await refresh();}catch(error){toast(error.message);}
      return;
    }
    if(action==='details') { const panel=$(`#details-${project.id}`); panel.hidden=!panel.hidden; if(!panel.hidden) updateTimers(); return; }
    if(action==='client-link') {
      try { const result=await api(`projects/${project.id}/client-link`,{method:'POST',body:'{}'}); await navigator.clipboard.writeText(result.client_link); toast('New private client link copied. Previous link is revoked.'); }
      catch(e){ toast(e.message); }
      return;
    }
    if(action==='task') { $('#task-form').reset();$('#task-form [name=project_id]').value=project.id;populateStaffOptions($('#task-form [name=assigned_to]'));$('#task-dialog').showModal();return; }
    if(action==='delivery') { $('#delivery-form').reset();$('#delivery-form [name=project_id]').value=project.id;$('#delivery-dialog').showModal();return; }
    if(action==='leegality-agreement') { openAgreementDialog(project); return; }
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

  async function openAgreementDialog(project) {
    const dialog = $('#agreement-dialog');
    const form = $('#agreement-form');
    form.reset();
    form.elements.project_id.value = project.id;
    $('#agr-dlg-client').textContent = project.client_name;
    $('#agr-dlg-contact').textContent = `${project.client_phone || 'No phone'} · ${project.client_email}`;
    $('#agr-dlg-package').textContent = `${project.package_name || project.service} (${money(project.package_price)})`;
    $('#agr-dlg-type').value = project.service === 'Collaboration' ? 'master_collab' : 'master_paid';
    $('#agr-dlg-status').textContent = 'Loading agreement state…';
    $('#agr-dlg-link-container').hidden = true;
    $('#agr-dlg-message').textContent = '';
    dialog.showModal();

    try {
      const result = await api(`projects/${project.id}/agreement`);
      const agr = result.agreement;
      const docFee = Number(agr?.documentation_fee ?? state.settings?.agreement_fee ?? 99);
      const feeStatus = agr?.fee_status || (docFee === 0 ? 'paid' : 'pending');
      $('#agr-dlg-fee').textContent = `₹${docFee}.00`;
      const statusBadge = $('#agr-dlg-fee-status');
      statusBadge.textContent = feeStatus === 'paid' ? '✓ Paid' : 'Pending Payment';
      statusBadge.className = `status ${feeStatus === 'paid' ? 'confirmed' : 'scheduled'}`;

      const toggleBtn = $('#agr-dlg-toggle-fee');
      if (toggleBtn) {
        toggleBtn.textContent = feeStatus === 'paid' ? 'Mark Fee as Pending' : 'Mark Fee as Paid / Waived';
        toggleBtn.onclick = async () => {
          const newStatus = feeStatus === 'paid' ? 'pending' : 'paid';
          try {
            await api(`projects/${project.id}/agreement/fee-status`, {
              method: 'POST',
              body: JSON.stringify({ fee_status: newStatus })
            });
            toast(`Agreement fee marked as ${newStatus}.`);
            openAgreementDialog(project);
          } catch (err) {
            toast(err.message);
          }
        };
      }

      if (agr) {
        $('#agr-dlg-type').value = agr.agreement_type || 'master_paid';
        $('#agr-dlg-status').textContent = agr.status === 'signed' ? '✓ Aadhaar eSigned & Verified' : 'Dispatched via Leegality (Awaiting Sign)';
        if (agr.leegality_sign_url) {
          $('#agr-dlg-sign-link').href = agr.leegality_sign_url;
          $('#agr-dlg-sign-link').textContent = `Leegality Sign Link: ${agr.leegality_sign_url}`;
          $('#agr-dlg-link-container').hidden = false;
        }
      } else {
        $('#agr-dlg-status').textContent = 'Not Dispatched (Ready to auto-fill)';
      }
    } catch (e) {
      $('#agr-dlg-status').textContent = 'Ready to dispatch';
    }
  }

  async function handleAgreementDispatch(e) {
    e.preventDefault();
    const form = e.target;
    const btn = $('#agr-dlg-submit');
    const msg = $('#agr-dlg-message');
    const projectId = form.elements.project_id.value;
    const agreementType = form.elements.agreement_type.value;

    btn.disabled = true;
    msg.textContent = 'Auto-filling details & calling Leegality API…';
    try {
      const result = await api(`projects/${projectId}/agreement`, {
        method: 'POST',
        body: JSON.stringify({ agreement_type: agreementType })
      });
      const agr = result.agreement;
      msg.textContent = 'Agreement successfully generated & dispatched via Leegality.';
      $('#agr-dlg-status').textContent = 'Dispatched via Leegality';
      if (agr?.sign_url) {
        $('#agr-dlg-sign-link').href = agr.sign_url;
        $('#agr-dlg-sign-link').textContent = `Leegality Sign Link: ${agr.sign_url}`;
        $('#agr-dlg-link-container').hidden = false;
      }
      toast('Leegality agreement dispatched.');
    } catch (err) {
      msg.textContent = err.message;
      toast(err.message);
    } finally {
      btn.disabled = false;
    }
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

  // ==========================================
  // FOUNDATION & PHILANTHROPIC DESK MODULE
  // ==========================================
  let fndData = { applications: [], disbursements: [], campaigns: [], budget: {}, filter: 'all' };

  async function loadFoundation() {
    try {
      const res = await api('foundation/admin/overview');
      if (!res.ok) return;
      fndData.applications = res.applications || [];
      fndData.students = res.students || [];
      fndData.disbursements = res.disbursements || [];
      fndData.campaigns = res.campaigns || [];
      fndData.budget = res.budget || {};
      fndData.academic_records = res.academic_records || [];

      // 1. Fiscal & KPI cards
      const annBudget = Number(fndData.budget.annual_budget || 500000);
      const totalDisb = Number(fndData.budget.total_disbursed || 0);
      const remaining = Math.max(0, annBudget - totalDisb);
      const beneficiaries = fndData.applications.filter(a => a.status === 'disbursed' || a.status === 'delivered').length;
      const pendingCnt = fndData.applications.filter(a => a.status === 'pending_review').length;

      $('#fnd-stat-budget').textContent = money(annBudget);
      $('#fnd-stat-disbursed').textContent = money(totalDisb);
      $('#fnd-stat-bills-count').textContent = `${fndData.disbursements.length} Purchase Bills Logged`;
      $('#fnd-stat-remaining').textContent = money(remaining);
      $('#fnd-stat-beneficiaries').textContent = beneficiaries;
      $('#fnd-stat-pending').textContent = `${pendingCnt} Pending Review`;
      if ($('#fnd-students-cnt-badge')) $('#fnd-students-cnt-badge').textContent = `${fndData.students.length} Registered`;

      // Launch Status Toggle (Launching Soon vs Live)
      const launchStatus = fndData.budget.launch_status || 'launching_soon';
      const isLive = launchStatus === 'live';
      const launchBadge = $('#fnd-launch-badge');
      const toggleLaunchBtn = $('#fnd-toggle-launch-status-btn');
      if (launchBadge) {
        launchBadge.textContent = isLive ? 'PUBLICLY LIVE' : 'LAUNCHING SOON · PILOT ACTIVE';
        launchBadge.style.background = isLive ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)';
        launchBadge.style.color = isLive ? '#34d399' : '#fbbf24';
        launchBadge.style.borderColor = isLive ? 'rgba(52,211,153,0.4)' : 'rgba(245,158,11,0.4)';
      }
      if (toggleLaunchBtn) {
        toggleLaunchBtn.textContent = isLive ? '⏸ Switch to Launching Soon' : '🚀 Make Publicly Live';
        toggleLaunchBtn.dataset.nextStatus = isLive ? 'launching_soon' : 'live';
        toggleLaunchBtn.style.background = isLive ? 'rgba(245,158,11,0.15)' : 'rgba(52,211,153,0.15)';
        toggleLaunchBtn.style.color = isLive ? '#fbbf24' : 'var(--green)';
        toggleLaunchBtn.style.borderColor = isLive ? 'rgba(245,158,11,0.3)' : 'rgba(52,211,153,0.35)';
      }

      // 2. Campaign Engine
      const activeCamp = fndData.campaigns[0] || null;
      if (activeCamp) {
        $('#fnd-active-camp-title').textContent = activeCamp.title;
        $('#fnd-active-camp-desc').textContent = activeCamp.description;
        $('#fnd-active-camp-kit').textContent = activeCamp.kit_summary;
        $('#fnd-active-camp-target').textContent = activeCamp.target_audience;
        $('#fnd-active-camp-budget').textContent = money(activeCamp.allocated_budget);

        const isPaused = activeCamp.status === 'paused';
        $('#fnd-camp-status-badge').textContent = isPaused ? 'DRIVE PAUSED' : 'DRIVE ACTIVE';
        $('#fnd-camp-status-badge').className = `status ${isPaused ? 'lead' : 'confirmed'}`;
        $('#fnd-toggle-camp-btn').textContent = isPaused ? 'Resume Drive' : 'Pause Drive';
        $('#fnd-toggle-camp-btn').dataset.campId = activeCamp.id;
        $('#fnd-toggle-camp-btn').dataset.nextStatus = isPaused ? 'active' : 'paused';
      }

      // 3. Status Filter Counts
      $('#fnd-cnt-all').textContent = fndData.applications.length;
      $('#fnd-cnt-pending').textContent = fndData.applications.filter(a => a.status === 'pending_review').length;
      $('#fnd-cnt-verified').textContent = fndData.applications.filter(a => a.status === 'verified').length;
      $('#fnd-cnt-approved').textContent = fndData.applications.filter(a => a.status === 'approved').length;
      $('#fnd-cnt-disbursed').textContent = fndData.applications.filter(a => a.status === 'disbursed' || a.status === 'delivered').length;
      $('#fnd-cnt-rejected').textContent = fndData.applications.filter(a => a.status === 'rejected').length;

      renderFoundationApplications();
      renderFoundationStudents();
      renderFoundationDisbursements();
    } catch (err) {
      toast(err.message || 'Failed to load foundation overview.');
    }
  }

  function renderFoundationStudents() {
    const tbody = $('#fnd-students-tbody');
    if (!tbody) return;
    if (!fndData.students.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center; padding:20px;">No registered student profiles yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = fndData.students.map(s => {
      const verifMap = {
        pending_verification: '<span class="status lead" style="font-size:10px;">Pending Check</span>',
        verified: '<span class="status confirmed" style="font-size:10px;">Aadhaar Verified</span>',
        rejected: '<span class="status archived" style="font-size:10px;">Rejected</span>'
      };

      const acadMap = {
        eligible: '<span class="status scheduled" style="font-size:10px; background:rgba(52,211,153,0.15); color:var(--green);">Eligible</span>',
        probation: '<span class="status lead" style="font-size:10px; background:rgba(245,158,11,0.15); color:var(--amber);">Probation</span>',
        ineligible_poor_performance: '<span class="status archived" style="font-size:10px; background:rgba(248,113,113,0.15); color:var(--red);">Ineligible (Poor Exam)</span>'
      };

      return `
        <tr>
          <td><strong style="color:var(--text);">${escapeHtml(s.legal_name)}</strong></td>
          <td><span style="font-family:var(--font-mono); font-size:11px;">${escapeHtml(s.aadhaar_number || 'XXXX-XXXX-' + s.aadhaar_last4)}</span></td>
          <td><span>${escapeHtml(s.dob)}</span></td>
          <td>
            <strong>${escapeHtml(s.current_class)}</strong>
            <small class="muted" style="display:block;">${escapeHtml(s.current_school_name)}</small>
          </td>
          <td>
            <span>${escapeHtml(s.father_guardian_name)}</span>
            <small class="muted" style="display:block;">+91 ${escapeHtml(s.guardian_phone)}</small>
          </td>
          <td>
            ${s.aadhaar_image_url ? `
              <button class="small-button" onclick="window.fndOpenAadhaarModal('${s.id}')" style="font-size:10px;">
                🔍 View Card
              </button>
            ` : '<span class="muted">No upload</span>'}
          </td>
          <td>${verifMap[s.verification_status] || s.verification_status}</td>
          <td>${acadMap[s.academic_standing || 'eligible']}</td>
          <td>
            <div style="display:flex; gap:4px;">
              <button class="small-button" onclick="window.fndOpenAadhaarModal('${s.id}')">Inspect</button>
              ${s.verification_status === 'pending_verification' ? `<button class="small-button gold" onclick="window.fndQuickVerifyStudent('${s.id}')">✓ Approve</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderFoundationApplications() {
    const filter = fndData.filter || 'all';
    let filtered = fndData.applications;
    if (filter === 'disbursed') filtered = filtered.filter(a => a.status === 'disbursed' || a.status === 'delivered');
    else if (filter !== 'all') filtered = filtered.filter(a => a.status === filter);

    const tbody = $('#fnd-applications-tbody');
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center; padding:24px;">No applications found in this queue.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(app => {
      const statusMap = {
        pending_review: '<span class="status lead" style="font-size:10px;">Pending Review</span>',
        verified: '<span class="status scheduled" style="font-size:10px; background:rgba(96,165,250,0.15); color:#93c5fd;">Seal Verified</span>',
        approved: '<span class="status in_session" style="font-size:10px; background:rgba(192,132,252,0.15); color:#d8b4fe;">Aid Approved</span>',
        dispatched: '<span class="status confirmed" style="font-size:10px;">Speed Post 🚚</span>',
        delivered: '<span class="status delivered" style="font-size:10px;">Delivered 🎉</span>',
        rejected: '<span class="status archived" style="font-size:10px;">Rejected</span>'
      };

      return `
        <tr>
          <td><strong style="font-family:var(--font-mono); color:var(--green);">${escapeHtml(app.application_code)}</strong></td>
          <td>
            <strong>${escapeHtml(app.student_name)}</strong>
            <small class="muted" style="display:block;">${escapeHtml(app.class_grade)}</small>
          </td>
          <td>
            <span>${escapeHtml(app.school_name)}</span>
            <small class="muted" style="display:block;">${escapeHtml(app.school_district)}, ${escapeHtml(app.school_state)}</small>
          </td>
          <td>
            <span>${escapeHtml(app.teacher_name)}</span>
            <small class="muted" style="display:block;">${escapeHtml(app.teacher_phone)}</small>
          </td>
          <td><span style="font-family:var(--font-mono); font-size:11px;">XXXX-${escapeHtml(app.student_aadhaar_last4)}</span></td>
          <td>
            ${app.document_url ? `<a href="${escapeHtml(app.document_url)}" target="_blank" class="small-button" style="text-decoration:none; font-size:10px;">📄 View Seal ↗</a>` : '<span class="muted">—</span>'}
          </td>
          <td>
            ${app.tracking_number ? `<strong style="font-family:var(--font-mono); font-size:10.5px; color:var(--blue);">${escapeHtml(app.tracking_number)}</strong>` : '<span class="muted">Not shipped</span>'}
          </td>
          <td>${statusMap[app.status] || app.status}</td>
          <td>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
              <button class="small-button" onclick="window.fndOpenAppModal('${app.id}')">Inspect</button>
              ${['verified','approved','disbursed','delivered'].includes(app.status) ? `<button class="small-button" style="color:var(--green); font-size:10.5px;" onclick="window.fndOpenLetterModal('${app.id}')">📜 Letter</button>` : ''}
              ${app.status === 'approved' ? `<button class="small-button gold" onclick="window.fndOpenBillModal('${app.id}')">Log Bill</button>` : ''}
              ${app.status === 'disbursed' || app.status === 'approved' ? `<button class="small-button" style="color:var(--blue);" onclick="window.fndOpenDispatchModal('${app.id}')">Dispatch</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderFoundationDisbursements() {
    const tbody = $('#fnd-disbursements-tbody');
    if (!fndData.disbursements.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center; padding:20px;">No internal purchase bills recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = fndData.disbursements.map(b => `
      <tr>
        <td><strong style="font-family:var(--font-mono); color:var(--gold);">${escapeHtml(b.bill_code)}</strong></td>
        <td><span style="font-family:var(--font-mono); font-size:11px;">${escapeHtml(b.application_code || '—')}</span></td>
        <td>
          <strong>${escapeHtml(b.student_name || '—')}</strong>
          <small class="muted" style="display:block;">${escapeHtml(b.school_name || '')}</small>
        </td>
        <td><span>${escapeHtml(b.vendor_name)}</span></td>
        <td><span style="font-size:11.5px;">${escapeHtml(b.item_summary)}</span></td>
        <td><span class="muted">${humanDate(b.bill_date)}</span></td>
        <td><strong style="color:var(--amber); font-family:var(--font-mono);">${money(b.amount)}</strong></td>
        <td><span class="muted">${escapeHtml(b.created_by)}</span></td>
      </tr>
    `).join('');
  }

  // Window Helpers for Foundation Actions
  window.fndOpenAppModal = function(id) {
    const app = fndData.applications.find(a => a.id === id);
    if (!app) return;
    window._curFndApp = app;
    if ($('#fnd-dlg-letter-btn')) $('#fnd-dlg-letter-btn').dataset.appId = app.id;

    $('#fnd-dlg-student-name').textContent = app.student_name;
    $('#fnd-dlg-code').textContent = app.application_code;
    $('#fnd-dlg-class').textContent = app.class_grade;
    $('#fnd-dlg-aadhaar').textContent = `XXXX-XXXX-${app.student_aadhaar_last4}`;
    $('#fnd-dlg-school').textContent = app.school_name;
    $('#fnd-dlg-address').textContent = `${app.school_address || ''}, ${app.school_district}, ${app.school_state}`;
    $('#fnd-dlg-teacher').textContent = `${app.teacher_name} (${app.teacher_designation})`;
    $('#fnd-dlg-phone').textContent = `+91 ${app.teacher_phone}`;
    $('#fnd-dlg-phone').href = `https://wa.me/91${app.teacher_phone}`;
    $('#fnd-dlg-needs').textContent = app.specific_needs;
    $('#fnd-dlg-pct-badge').textContent = app.last_year_percentage ? `${app.last_year_percentage}% (${app.last_year_grade || 'No Grade'})` : 'Baseline Not Set';
    $('#fnd-dlg-marksheet-name').textContent = app.last_year_marksheet_name || 'Last_Year_Marksheet.pdf';
    $('#fnd-dlg-marksheet-link').href = app.last_year_marksheet_url || '#';
    $('#fnd-dlg-marksheet-link').style.display = app.last_year_marksheet_url ? 'inline-flex' : 'none';

    const talentTitles = {
      science_curiosity: '🔬 Science Curiosity & Experimentation',
      math_logic: '📐 Math Logic & Analytical Mind',
      art_creative: '🎨 Art, Poetry & Creative Expression',
      reading_language: '📖 Avid Reading & Literature',
      determined_learner: '🌟 Dedicated Self-Learner',
      other_spark: '💡 Unique Raw Talent'
    };
    $('#fnd-dlg-latent-badge').textContent = talentTitles[app.latent_talent] || app.latent_talent || 'Raw Talent';
    $('#fnd-dlg-talent-notes').textContent = app.talent_notes ? `"${app.talent_notes}"` : 'No teacher notes recorded.';

    $('#fnd-dlg-doc-name').textContent = app.document_name || 'School_Requisition.pdf';
    $('#fnd-dlg-doc-link').href = app.document_url || '#';
    $('#fnd-dlg-notes').value = app.review_notes || '';

    $('#fnd-app-dialog').showModal();
  };

  window.fndOpenBillModal = function(id) {
    const app = fndData.applications.find(a => a.id === id);
    if (!app) return;
    $('#fnd-bill-app-id').value = app.id;
    $('#fnd-bill-student-name').textContent = app.student_name;
    $('#fnd-bill-app-code').textContent = app.application_code;
    $('#fnd-bill-date').value = new Date().toISOString().slice(0, 10);
    $('#fnd-bill-form').reset();
    $('#fnd-bill-app-id').value = app.id;
    $('#fnd-bill-dialog').showModal();
  };

  window.fndOpenDispatchModal = function(id) {
    const app = fndData.applications.find(a => a.id === id);
    if (!app) return;
    $('#fnd-disp-app-id').value = app.id;
    $('#fnd-disp-student').textContent = app.student_name;
    $('#fnd-disp-school').textContent = app.school_name;
    $('#fnd-disp-tracking').value = app.tracking_number || '';
    $('#fnd-dispatch-dialog').showModal();
  };

  window.fndOpenAadhaarModal = function(id) {
    const s = fndData.students.find(x => x.id === id);
    if (!s) return;
    window._curFndStudent = s;

    $('#fnd-aadh-student-name').textContent = s.legal_name;
    $('#fnd-aadh-student-sub').textContent = `${s.current_class} • ${s.current_school_name}`;
    $('#fnd-aadh-num').textContent = s.aadhaar_number || `XXXX XXXX ${s.aadhaar_last4}`;
    $('#fnd-aadh-dob').textContent = s.dob;
    $('#fnd-aadh-guardian').textContent = s.father_guardian_name;
    $('#fnd-aadh-phone').textContent = `+91 ${s.guardian_phone}`;
    $('#fnd-aadh-phone').href = `https://wa.me/91${s.guardian_phone}`;
    $('#fnd-aadh-addr').textContent = `${s.residential_address}, ${s.district}, ${s.state} - ${s.pincode}`;
    $('#fnd-aadh-notes').value = s.verification_notes || '';
    $('#fnd-aadh-standing').value = s.academic_standing || 'eligible';

    if (s.aadhaar_image_url) {
      $('#fnd-aadh-img').src = s.aadhaar_image_url;
      $('#fnd-aadh-full-link').href = s.aadhaar_image_url;
      $('#fnd-aadh-img-container').hidden = false;
    } else {
      $('#fnd-aadh-img-container').hidden = true;
    }

    $('#fnd-aadhaar-dialog').showModal();
  };

  window.fndQuickVerifyStudent = async function(id) {
    try {
      await api(`foundation/admin/students/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status: 'verified', notes: 'Quick verified by administrator.' })
      });
      toast('Student account manually verified & approved!');
      await loadFoundation();
    } catch (err) {
      toast(err.message);
    }
  };

  window.fndOpenLetterModal = async function(id) {
    let app = fndData.applications?.find(a => String(a.id) === String(id) || String(a.application_code) === String(id)) || window._curFndApp;
    const appId = id || app?.id || window._curFndApp?.id;
    if (!appId) {
      toast('Please select an application to generate letter.');
      return;
    }

    try {
      toast('Preparing official intimation letter…');

      const res = await api(`foundation/admin/applications/${appId}/generate-letter`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(res.error || 'Failed to generate letter');

      const letter = res.letter || {};
      const fullApp = res.application || app || window._curFndApp || {};
      window._curFndLetter = letter;
      window._curFndLetterApp = fullApp;

      if ($('#fnd-ltr-title')) $('#fnd-ltr-title').textContent = `Official Letter to ${letter.school_name || fullApp.school_name || 'Government School'}`;
      if ($('#fnd-ltr-ref-num')) $('#fnd-ltr-ref-num').textContent = letter.letter_code || 'CKF-LTR-2026';
      if ($('#fnd-ltr-app-code')) $('#fnd-ltr-app-code').textContent = fullApp.application_code || 'CKF-APP';

      const issueDate = letter.created_at
        ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date(letter.created_at))
        : new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(new Date());
      if ($('#fnd-ltr-date')) $('#fnd-ltr-date').textContent = issueDate;
      if ($('#fnd-ltr-carrier')) $('#fnd-ltr-carrier').textContent = fullApp.shipping_carrier || 'India Post Speed Post';

      if ($('#fnd-ltr-school-name')) $('#fnd-ltr-school-name').textContent = fullApp.school_name || 'Government School';
      if ($('#fnd-ltr-school-addr')) $('#fnd-ltr-school-addr').textContent = `${fullApp.school_address ? fullApp.school_address + ', ' : ''}${fullApp.school_district || ''}, ${fullApp.school_state || 'Tripura'}`;

      if ($('#fnd-ltr-subj-student')) $('#fnd-ltr-subj-student').textContent = (fullApp.student_name || 'STUDENT').toUpperCase();
      if ($('#fnd-ltr-subj-class')) $('#fnd-ltr-subj-class').textContent = (fullApp.class_grade || 'CLASS').toUpperCase();

      if ($('#fnd-ltr-body-student')) $('#fnd-ltr-body-student').textContent = fullApp.student_name || 'Student';
      if ($('#fnd-ltr-body-aadhaar')) $('#fnd-ltr-body-aadhaar').textContent = `XXXX-XXXX-${fullApp.student_aadhaar_last4 || fullApp.aadhaar_last4 || 'XXXX'}`;

      // Table specs
      if ($('#fnd-ltr-tbl-student')) $('#fnd-ltr-tbl-student').textContent = fullApp.student_name || 'Student';
      if ($('#fnd-ltr-tbl-class')) $('#fnd-ltr-tbl-class').textContent = fullApp.class_grade || 'Class';
      if ($('#fnd-ltr-tbl-school')) $('#fnd-ltr-tbl-school').textContent = `${fullApp.school_name || ''}, ${fullApp.school_district || ''}`;
      if ($('#fnd-ltr-tbl-guardian')) $('#fnd-ltr-tbl-guardian').textContent = fullApp.father_guardian_name || 'Parent / Guardian';
      if ($('#fnd-ltr-tbl-phone')) $('#fnd-ltr-tbl-phone').textContent = `+91 ${fullApp.guardian_phone || 'Registered Phone'}`;
      if ($('#fnd-ltr-tbl-needs')) $('#fnd-ltr-tbl-needs').textContent = fullApp.specific_needs || 'Standard Syllabus Textbooks, Exercise Registers & Exam Kits';
      if ($('#fnd-ltr-tbl-carrier')) $('#fnd-ltr-tbl-carrier').textContent = fullApp.shipping_carrier || 'India Post Speed Post';
      if ($('#fnd-ltr-tbl-tracking')) $('#fnd-ltr-tbl-tracking').textContent = fullApp.tracking_number || 'Dispatch in Progress (India Post Speed Post)';

      if ($('#fnd-ltr-proto-student')) $('#fnd-ltr-proto-student').textContent = fullApp.student_name || 'the student';

      // Handover slip
      if ($('#fnd-ltr-slip-student')) $('#fnd-ltr-slip-student').textContent = fullApp.student_name || '____________________________';
      if ($('#fnd-ltr-slip-class')) $('#fnd-ltr-slip-class').textContent = fullApp.class_grade || '__________';

      // Fallback for any legacy script references
      if ($('#fnd-ltr-content')) $('#fnd-ltr-content').textContent = letter.letter_content || '';
      if ($('#fnd-ltr-code')) $('#fnd-ltr-code').textContent = letter.letter_code || '';

      // Safely close previous app modal and open letter modal
      const appDlg = $('#fnd-app-dialog');
      if (appDlg && appDlg.open) appDlg.close();

      const ltrDlg = $('#fnd-letter-dialog');
      if (ltrDlg && !ltrDlg.open) ltrDlg.showModal();
    } catch (err) {
      toast(err.message || 'Failed to load official letter.');
    }
  };

  function printOfficialLetter() {
    if (!window._curFndLetter || !window._curFndLetterApp) {
      toast('Please open an application letter first.');
      return;
    }

    const sheetEl = document.getElementById('fnd-letter-sheet');
    if (!sheetEl) {
      window.print();
      return;
    }

    // Check if on iOS / mobile Safari where iframe printing is restricted
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
      window.print();
      return;
    }

    let printFrame = document.getElementById('fnd-print-iframe');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'fnd-print-iframe';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
    }

    const sheetEl = document.getElementById('fnd-letter-sheet');
    if (!sheetEl) {
      window.print();
      return;
    }
    const sheetContent = sheetEl.innerHTML;

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(window._curFndLetter.letter_code)} - Chiranjit Kar Foundation Official Intimation</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 14mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Times New Roman', Cambria, Georgia, serif;
            color: #000000;
            background: #ffffff;
            font-size: 13px;
            line-height: 1.45;
          }
          .fnd-letter-header {
            text-align: center;
            border-bottom: 2px solid #000000;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .fnd-letter-crest {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #064e3b;
            color: #fbbf24;
            margin-bottom: 4px;
            border: 2px solid #d97706;
          }
          .fnd-letter-title {
            margin: 0;
            font-size: 19px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: #000000;
          }
          .fnd-letter-sub {
            font-size: 10.5px;
            font-weight: 700;
            color: #047857;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-top: 2px;
          }
          .fnd-letter-contact {
            font-size: 9.5px;
            color: #475569;
            margin-top: 3px;
          }
          .fnd-meta-grid {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 12px;
            border-bottom: 1px dotted #cbd5e1;
            padding-bottom: 8px;
          }
          .fnd-meta-right { text-align: right; }
          .fnd-addressee {
            margin-bottom: 12px;
            font-size: 12px;
            line-height: 1.4;
          }
          .fnd-subject-bar {
            background: #f1f5f9;
            border-left: 4px solid #000000;
            padding: 7px 10px;
            font-weight: 700;
            font-size: 11.5px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin: 12px 0;
          }
          .fnd-salutation {
            font-weight: 700;
            margin-bottom: 6px;
            font-size: 12px;
          }
          .fnd-body-p {
            margin-bottom: 8px;
            text-align: justify;
            line-height: 1.45;
            font-size: 12px;
          }
          .fnd-spec-table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 11px;
          }
          .fnd-spec-table th, .fnd-spec-table td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
          }
          .fnd-spec-table th {
            background: #f8fafc;
            font-weight: 700;
            width: 32%;
          }
          .fnd-handover-box {
            background: #f0fdf4;
            border: 1px solid #86efac;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 10.5px;
            line-height: 1.45;
            color: #14532d;
            margin: 10px 0;
          }
          .fnd-handover-box ol { margin: 3px 0 0 16px; padding: 0; }
          .fnd-sign-block {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 14px;
          }
          .fnd-seal-zone { display: flex; align-items: center; gap: 8px; }
          .fnd-seal-zone img { width: 60px; height: 60px; }
          .fnd-sign-zone { text-align: right; font-size: 11px; }
          .fnd-sign-zone img { height: 38px; display: block; margin: 2px 0 2px auto; }
          .fnd-tear-off-line {
            margin: 16px 0 10px;
            border-top: 1.5px dashed #64748b;
            position: relative;
            text-align: center;
          }
          .fnd-tear-off-line span {
            position: relative;
            top: -8px;
            background: #ffffff;
            padding: 0 8px;
            font-size: 8.5px;
            font-family: monospace;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .fnd-receipt-slip {
            border: 1.5px solid #64748b;
            border-radius: 4px;
            padding: 8px 10px;
            background: #fafafa;
            font-size: 10px;
            line-height: 1.35;
          }
          .fnd-receipt-head {
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
            margin-bottom: 6px;
          }
          .fnd-receipt-head strong { font-size: 10.5px; text-transform: uppercase; }
          .fnd-receipt-head small { font-size: 8.5px; color: #475569; }
          .fnd-receipt-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            margin-top: 8px;
            text-align: center;
          }
          .fnd-receipt-col {
            border: 1px dashed #cbd5e1;
            padding: 6px 4px;
            min-height: 48px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #ffffff;
            font-size: 9px;
          }
          .fnd-receipt-col.stamp-box {
            border: 1.5px solid #000000;
            background: #f8fafc;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="fnd-letter-sheet">
          ${sheetContent}
        </div>
      </body>
      </html>
    `);
    frameDoc.close();

    printFrame.contentWindow.focus();
    setTimeout(() => {
      try {
        printFrame.contentWindow.print();
      } catch (e) {
        window.print();
      }
    }, 250);
  }

  function setView(view) {
    if(!['overview','inquiries','projects','schedule','tasks','billing','team','settings','foundation'].includes(view)||['team','settings','foundation'].includes(view)&&state.staff?.role!=='admin'||['billing','inquiries'].includes(view)&&!['admin','sales'].includes(state.staff?.role)) return;
    state.view=view; $$('.view').forEach(el=>el.hidden=el.id!==`${view}-view`); $$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    $('#view-title').textContent={overview:'Overview',inquiries:'Inquiries',projects:'Projects',schedule:'Schedule',tasks:'Tasks',billing:'Billing',team:'Team',settings:'Settings',foundation:'Foundation'}[view];
    if(view==='team') loadTeam(); if(view==='schedule')renderSchedule();
    if(view==='tasks')loadTasks();if(view==='billing')loadInvoices();
    if(view==='inquiries')loadInquiries();
    if(view==='settings')loadSettings();
    if(view==='foundation')loadFoundation();
  }
  document.addEventListener('DOMContentLoaded',boot);
})();
