(() => {
  const $ = selector => document.querySelector(selector);
  const GOOGLE_CLIENT_ID = '590487797563-iuln56iefm3lgpdmq8rh0egqbke0ugp9.apps.googleusercontent.com';
  const params = new URLSearchParams(location.hash.slice(1));
  let key = params.get('key') || '';
  let currentClient = null, clientProjects = [], activeProject = null, activeSession = null, walletState = null;
  let countdownHandle = null, refreshHandle = null;

  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const statusNames = {
    lead: 'Inquiry', confirmed: 'Confirmed', preproduction: 'Pre-production',
    scheduled: 'Scheduled', in_session: 'In session', editing: 'Editing',
    client_review: 'Client review', delivered: 'Delivered', archived: 'Closed'
  };
  const safeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (key) headers['Authorization'] = `Bearer ${key}`;
    const response = await fetch(`/api/${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to complete request.');
    return data;
  }

  async function init() {
    initGoogleAuth();
    $('#client-package-upgrade')?.addEventListener('submit', requestPackageUpgrade);

    // Check if client is already signed in via Google session
    try {
      const meResult = await api('client/me');
      if (meResult.ok && meResult.client) {
        currentClient = meResult.client;
        clientProjects = meResult.projects || [];
        renderClientHeader(currentClient);
        await loadClientWallet();

        if (clientProjects.length > 0) {
          // If a key or code is in hash, match that project; else pick first/active
          const codeParam = params.get('code');
          const matched = clientProjects.find(p => p.project_code === codeParam || p.id === codeParam) || clientProjects[0];
          loadProjectDetails(matched);
        } else {
          showNoProjects(currentClient.email);
        }
        return;
      }
    } catch (e) {
      // Not signed in with Google
    }

    // Fallback: If #key=... was provided, load direct session
    if (key) {
      loadDirectProject();
    } else {
      // Prompt Google Sign-In
      $('#session-loading').hidden = true;
      $('#client-auth-card').hidden = false;
    }
  }

  function initGoogleAuth() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      setupGoogleGSI();
    } else {
      window.onGoogleLibraryLoad = setupGoogleGSI;
      // Also poll briefly in case script loads asynchronously
      const checkGSI = setInterval(() => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          clearInterval(checkGSI);
          setupGoogleGSI();
        }
      }, 200);
      setTimeout(() => clearInterval(checkGSI), 10000);
    }
  }

  function setupGoogleGSI() {
    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: true
      });

      // Render the official Google Sign-In Button
      const btnContainer = $('#google-signin-btn');
      if (btnContainer) {
        btnContainer.replaceChildren();
        google.accounts.id.renderButton(btnContainer, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 280
        });
      }

      // One-tap prompt
      google.accounts.id.prompt();
    } catch (err) {
      console.warn('Google Identity initialization notice:', err);
    }
  }

  async function handleGoogleCredential(response) {
    const statusEl = $('#auth-status');
    if (statusEl) statusEl.textContent = 'Verifying Google credentials…';
    try {
      const authResult = await api('client/google-auth', {
        method: 'POST',
        body: JSON.stringify({ credential: response.credential })
      });

      if (authResult.ok) {
        currentClient = authResult.client;
        if (statusEl) statusEl.textContent = '';
        $('#client-auth-card').hidden = true;
        renderClientHeader(currentClient);
        await loadClientWallet();

        // Fetch user projects
        const meResult = await api('client/me');
        clientProjects = meResult.projects || [];
        if (clientProjects.length > 0) {
          loadProjectDetails(clientProjects[0]);
        } else {
          showNoProjects(currentClient.email);
        }
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || 'Google sign in failed.';
    }
  }

  function renderClientHeader(client) {
    const userBar = $('#client-user-bar');
    if (!userBar) return;
    userBar.hidden = false;
    $('#client-display-name').textContent = client.name || 'Client';
    $('#client-display-email').textContent = client.email || '';
    const avatar = $('#client-avatar');
    if (client.picture) {
      avatar.src = client.picture;
      avatar.hidden = false;
    } else {
      avatar.hidden = true;
    }

    const logoutBtn = $('#client-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        try { await api('client/logout', { method: 'POST' }); } catch {}
        location.reload();
      };
    }
  }

  function showNoProjects(email) {
    $('#session-loading').hidden = true;
    $('#session-content').hidden = true;
    $('#session-error').hidden = true;
    $('#no-projects-email').textContent = email;
    $('#client-no-projects').hidden = false;
  }

  async function loadDirectProject() {
    try {
      const result = await api('client/project');
      activeProject = result.project;
      activeSession = result.session;
      renderProjectView(activeProject, activeSession, result.invoices || [], result.deliveries || []);
    } catch (error) {
      showError(error.message);
    }
  }

  function loadProjectDetails(projectItem) {
    activeProject = projectItem;
    activeSession = projectItem.session || null;
    renderProjectView(activeProject, activeSession, projectItem.invoices || [], projectItem.deliveries || []);

    // Project picker if multiple
    const picker = $('#client-project-picker');
    if (picker && clientProjects.length > 1) {
      picker.hidden = false;
      picker.replaceChildren();
      clientProjects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.project_code;
        opt.textContent = `${p.project_code} · ${p.service}`;
        if (p.project_code === activeProject.project_code) opt.selected = true;
        picker.append(opt);
      });
      picker.onchange = () => {
        const found = clientProjects.find(p => p.project_code === picker.value);
        if (found) loadProjectDetails(found);
      };
    } else if (picker) {
      picker.hidden = true;
    }
  }

  function renderProjectView(project, session, invoices, deliveries) {
    $('#session-loading').hidden = true;
    $('#session-error').hidden = true;
    $('#client-no-projects').hidden = true;
    $('#session-content').hidden = false;

    $('#session-project-code').textContent = project.project_code;
    $('#session-title').textContent = `${project.client_name} · ${project.service}`;
    $('#session-description').textContent = project.package_name || 'Photography session';
    $('#booked-time').textContent = `${Math.floor(project.booked_minutes / 60)}h${project.booked_minutes % 60 ? ` ${project.booked_minutes % 60}m` : ''}`;
    $('#overtime-rate').textContent = `${money(project.overtime_rate)} / 30 min`;
    $('#session-status').textContent = statusNames[project.status] || project.status;
    $('#session-status').className = `status ${project.status}`;

    renderClientResources(invoices, deliveries);
    renderPackageUpgrades(project,session);

    const form = $('#client-feedback-form');
    if (form) {
      form.hidden = false;
      form.onsubmit = sendFeedback;
    }

    if (session?.status === 'active') {
      renderActive();
    } else if (session?.status === 'complete') {
      renderComplete();
    } else if (project.status === 'scheduled') {
      showAction('start');
    } else {
      $('#client-action-area').hidden = true;
      $('#policy-copy').textContent = `Your booking is ${statusNames[project.status] || project.status.toLowerCase()}. The session approval action will become available when the studio marks the booking as scheduled.`;
    }

    if (refreshHandle) clearInterval(refreshHandle);
    refreshHandle = setInterval(refreshSessionState, 5000);
  }

  async function renderPackageUpgrades(project,session){
    const form=$('#client-package-upgrade'),select=$('#upgrade-package-select');
    if(!form||session||!Number(project.package_price)||['in_session','editing','client_review','delivered','archived'].includes(project.status)){if(form)form.hidden=true;return;}
    try{
      const result=await api('packages');
      const upgrades=(result.packages||[]).filter(item=>Number(item.price)>Number(project.package_price));
      if(!upgrades.length){form.hidden=true;return;}
      form.dataset.projectId=project.id;form.dataset.projectCode=project.project_code;
      select.innerHTML='<option value="">Choose a higher package</option>'+upgrades.map(item=>`<option value="${safeText(item.id)}">${safeText(item.name)} · ${money(item.price)} (+${money(item.price-project.package_price)})</option>`).join('');
      form.hidden=false;
    }catch{form.hidden=true;}
  }

  async function requestPackageUpgrade(event){
    event.preventDefault();
    const form=event.currentTarget,select=$('#upgrade-package-select'),message=$('#upgrade-package-message'),button=form.querySelector('button[type="submit"]');
    if(!select.value){message.textContent='Choose a higher package first.';return;}
    const packageName=select.options[select.selectedIndex].text.split(' · ')[0];
    if(!confirm(`Upgrade your booking to ${packageName}? The 30% upgrade deposit will be added now; the remainder will be due after your session.`))return;
    button.disabled=true;message.textContent='Updating your package…';
    try{
      const result=await api('client/project/upgrade',{method:'POST',body:JSON.stringify({project_id:form.dataset.projectId,project_code:form.dataset.projectCode,package_id:select.value})});
      message.textContent=result.message;
      setTimeout(()=>location.reload(),800);
    }catch(error){message.textContent=error.message;button.disabled=false;}
  }

  function showError(message) {
    $('#session-loading').hidden = true;
    $('#session-content').hidden = true;
    $('#session-error').hidden = false;
    $('#session-error-text').textContent = message;
  }

  function renderClientResources(invoices, deliveries) {
    const billing = $('#client-billing'), invoiceItems = $('#invoice-items');
    invoiceItems.replaceChildren();
    billing.hidden = !invoices.length;

    invoices.forEach(invoice => {
      const item = document.createElement('div');
      item.className = 'client-resource invoice-gateway-card';
      const balance = Math.max(0, invoice.amount - invoice.amount_paid);
      const isPaid = invoice.status === 'paid' || balance <= 0;

      const left = document.createElement('div');
      left.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span style="font-family:var(--font-mono); font-size:11px; color:var(--gold-bright); font-weight:700;">${safeText(invoice.invoice_code)}</span>
          <span class="status ${isPaid ? 'delivered' : balance < invoice.amount ? 'editing' : 'scheduled'}" style="font-size:9px; padding:2px 8px;">${isPaid ? 'PAID' : balance < invoice.amount ? 'PARTIAL' : 'DUE'}</span>
        </div>
        <strong>${safeText(invoice.description)}</strong>
        <small style="margin-top:4px;">${invoice.due_at ? 'Due ' + new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(invoice.due_at)) : 'On demand'}</small>
      `;

      const right = document.createElement('div');
      right.style.textAlign = 'right';
      right.innerHTML = `
        <strong style="font-size:15px; font-variant-numeric:tabular-nums; color:#ffffff;">${money(invoice.amount)}</strong>
        <small style="margin-top:3px; color:var(--muted);">${isPaid ? 'Fully Settled' : 'Paid ' + money(invoice.amount_paid) + ' · Due ' + money(balance)}</small>
      `;

      const actionArea = document.createElement('div');
      actionArea.style.display = 'flex';
      actionArea.style.alignItems = 'center';
      actionArea.style.gap = '8px';

      if (!isPaid) {
        const payLink = document.createElement('a');
        payLink.className = 'button gold';
        payLink.style.padding = '8px 14px';
        payLink.style.fontSize = '11.5px';
        payLink.style.whiteSpace = 'nowrap';
        payLink.href = `/pay.html?invoice=${encodeURIComponent(invoice.invoice_code)}`;
        payLink.target = '_blank';
        payLink.rel = 'noopener noreferrer';
        payLink.innerHTML = `<span>⚡ Pay ${money(balance)}</span>`;
        actionArea.append(payLink);
      }

      if (invoice.kind === 'package' && !isPaid && walletState?.balance > 0) {
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'small-button wallet-apply';
        apply.textContent = `Apply Wallet (₹${Math.min(walletState.balance, balance)})`;
        apply.onclick = async () => {
          apply.disabled = true;
          try {
            const result = await api('client/wallet/apply', { method: 'POST', body: JSON.stringify({ invoice_id: invoice.id }) });
            $('#client-referral-message').textContent = result.message;
            await loadClientWallet();
            const me = await api('client/me'); clientProjects = me.projects || [];
            const updated = clientProjects.find(project => project.id === activeProject?.id);
            if (updated) loadProjectDetails(updated);
          } catch (error) { $('#client-referral-message').textContent = error.message; apply.disabled = false; }
        };
        actionArea.append(apply);
      }

      if (invoice.payment_url) {
        try {
          const url = new URL(invoice.payment_url);
          if (url.protocol === 'https:') {
            const link = document.createElement('a');
            link.className = 'small-button';
            link.href = url.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Custom Link ↗';
            actionArea.append(link);
          }
        } catch {}
      }

      item.append(left, right, actionArea);
      invoiceItems.append(item);
    });

    const deliveryArea = $('#client-deliveries'), deliveryList = $('#delivery-items');
    deliveryList.replaceChildren();
    const openBalance=invoices.reduce((sum,invoice)=>sum+Math.max(0,Number(invoice.amount)-Number(invoice.amount_paid)),0);
    deliveryArea.hidden = !deliveries.length && openBalance<=0;
    if(!deliveries.length&&openBalance>0){const notice=document.createElement('p');notice.className='muted';notice.textContent=`Final image delivery unlocks after all dues are cleared. Current outstanding balance: ${money(openBalance)}.`;deliveryList.append(notice);}

    deliveries.forEach(delivery => {
      const row = document.createElement('div');
      row.className = 'client-resource';
      const text = document.createElement('div');
      text.innerHTML = `<strong>${safeText(delivery.title)}</strong><small>${safeText(delivery.note || 'Shared by the studio')}</small>`;
      let link;
      try {
        const url = new URL(delivery.url);
        if (url.protocol === 'https:') {
          link = document.createElement('a');
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'small-button';
          link.textContent = 'Open ↗';
          row.append(text, link);
          deliveryList.append(row);
        }
      } catch {}
    });
  }

  async function loadClientWallet() {
    try {
      const wallet = await api('client/wallet'); walletState = wallet;
      const section = $('#client-referral-wallet'); section.hidden = false;
      $('#client-referral-code').textContent = wallet.referral_code || 'Unavailable';
      $('#client-wallet-balance').textContent = money(wallet.balance);
      $('#client-referral-copy').onclick = async () => {
        try { await navigator.clipboard.writeText(wallet.share_url); $('#client-referral-message').textContent = 'Referral invite link copied. Share it with a friend.'; }
        catch { $('#client-referral-message').textContent = wallet.share_url; }
      };
      const history = $('#client-wallet-history');
      history.innerHTML = (wallet.transactions || []).map(tx => `<div class="wallet-history-row"><span>${safeText(tx.description)}<small>${new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(tx.created_at))}</small></span><strong class="${Number(tx.amount)<0?'debit':''}">${Number(tx.amount)>0?'+':''}${money(tx.amount)}</strong></div>`).join('') || '<small>No wallet activity yet.</small>';
    } catch { $('#client-referral-wallet').hidden = true; }
  }

  async function sendFeedback(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('#feedback-message');
    const payload = Object.fromEntries(new FormData(form));
    if (activeProject) payload.project_id = activeProject.id || activeProject.project_code;

    try {
      await api('client/feedback', { method: 'POST', body: JSON.stringify(payload) });
      message.textContent = 'Sent to the studio team. Thank you.';
      form.reset();
    } catch (error) {
      message.textContent = error.message;
    }
  }

  async function refreshSessionState() {
    if (!activeProject) return;
    try {
      let result;
      if (key) {
        result = await api('client/project');
      } else {
        result = await api(`client/project?code=${encodeURIComponent(activeProject.project_code)}`);
      }
      if (result.session?.status !== activeSession?.status) {
        activeSession = result.session;
        activeProject = result.project;
        renderPackageUpgrades(activeProject,activeSession);
        if (activeSession?.status === 'active') renderActive();
        else if (activeSession?.status === 'complete') {
          if (countdownHandle) clearInterval(countdownHandle);
          if (refreshHandle) clearInterval(refreshHandle);
          renderComplete();
          renderClientResources(result.invoices || [], result.deliveries || []);
        }
      }
    } catch {}
  }

  function showAction(kind) {
    $('#client-action-area').hidden = false;
    $('#client-approve-button').textContent = kind === 'start' ? 'Approve session start' : 'Approve session finish';
    $('#client-approve-button').onclick = () => requestApproval(kind);
  }

  async function requestApproval(kind) {
    const button = $('#client-approve-button'), message = $('#client-message');
    button.disabled = true;
    message.textContent = 'Generating a one-time code…';
    const payload = { kind };
    if (activeProject) payload.project_id = activeProject.id || activeProject.project_code;

    try {
      const result = await api('client/challenge', { method: 'POST', body: JSON.stringify(payload) });
      $('#client-code').textContent = result.code;
      $('#client-code-area').hidden = false;
      message.textContent = '';
      $('#client-code-instruction').textContent = kind === 'start'
        ? 'Give this code to your photographer when you are ready to begin. The timer starts only after they enter it.'
        : 'Give this code to your photographer when you are ready to end. The timer stops only after they enter it.';
      button.textContent = 'Code generated';
      button.disabled = true;
      const expires = Date.parse(result.expires_at);
      const interval = setInterval(() => {
        if (Date.now() >= expires) {
          clearInterval(interval);
          $('#client-code-area').hidden = true;
          button.disabled = false;
          button.textContent = kind === 'start' ? 'Generate a new start code' : 'Generate a new finish code';
          message.textContent = 'Code expired. Generate another when ready.';
        }
      }, 1000);
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  }

  function renderActive() {
    $('#client-timer-area').hidden = false;
    $('#client-action-area').hidden = true;
    $('#session-status').textContent = 'In session';
    $('#session-status').className = 'status in_session';
    $('#timer-caption').textContent = `Timer started ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activeSession.started_at))}.`;
    updateTimer();
    if (countdownHandle) clearInterval(countdownHandle);
    countdownHandle = setInterval(updateTimer, 1000);
    showAction('end');
  }

  function updateTimer() {
    if (!activeSession?.started_at || !activeProject) return;
    const total = Math.floor((Date.now() - Date.parse(activeSession.started_at)) / 60000);
    const booked = Number(activeProject.booked_minutes), grace = 30;
    const format = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;

    if (total < booked) {
      $('#client-timer').textContent = format(booked - total);
      $('#timer-caption').textContent = 'Time remaining in the booked session.';
    } else if (total < booked + grace) {
      $('#client-timer').textContent = format(booked + grace - total);
      $('#timer-caption').textContent = 'Booked time is complete. Grace period is running; overtime starts after this reaches zero.';
    } else {
      const overtime = total - booked - grace, units = Math.ceil(overtime / 30);
      $('#client-timer').textContent = `+${format(overtime)}`;
      $('#client-timer').classList.add('over');
      $('#timer-caption').textContent = `Overtime estimate: ${money(units * activeProject.overtime_rate)} (${units} × 30-minute block${units === 1 ? '' : 's'}).`;
    }
  }

  function renderComplete() {
    $('#client-timer-area').hidden = true;
    $('#client-action-area').hidden = true;
    $('#session-status').textContent = 'Session complete';
    $('#session-status').className = 'status delivered';
    $('#policy-copy').textContent = 'The client-approved finish time has been recorded. The studio team will confirm your final invoice and delivery schedule.';
    const elapsed = activeSession.elapsed_minutes || 0, overtime = activeSession.overtime_minutes || 0, units = activeSession.overtime_units || 0, fee = activeSession.overtime_fee || 0;
    const summary = document.createElement('div');
    summary.className = 'session-stat-grid';
    summary.innerHTML = `<div class="session-stat"><small>Total session time</small><strong>${Math.floor(elapsed / 60)}h ${elapsed % 60}m</strong></div><div class="session-stat"><small>Chargeable overtime</small><strong>${Math.floor(overtime / 60)}h ${overtime % 60}m · ${units} block${units === 1 ? '' : 's'}</strong></div><div class="session-stat"><small>Overtime fee</small><strong>${money(fee)}</strong></div>`;
    $('#session-summary').replaceChildren(summary);
    $('#session-summary').hidden = false;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
