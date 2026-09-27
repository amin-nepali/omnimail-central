const state = { messages: [], accounts: [], view: 'All mail', loading: false };
const elements = Object.fromEntries([
  'setup-banner', 'setup-state', 'sync-status', 'message-list', 'account-list', 'account-count',
  'all-count', 'account-filter', 'search-input', 'result-count', 'current-view', 'page-title',
  'page-subtitle', 'footer-project', 'toast', 'message-dialog', 'message-detail',
  'access-dialog', 'access-form', 'access-password', 'access-error', 'access-submit',
].map((id) => [id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()), document.getElementById(id)]));

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function notify(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  window.clearTimeout(notify.timeout);
  notify.timeout = window.setTimeout(() => elements.toast.classList.remove('visible'), 3200);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function renderAccounts() {
  elements.accountCount.textContent = String(state.accounts.length);
  if (!state.accounts.length) {
    elements.accountList.innerHTML = '<p class="sidebar-empty">No accounts connected</p>';
  } else {
    elements.accountList.innerHTML = state.accounts.map((account) => `
      <div class="account-item-wrap">
        <button class="account-item" data-account="${escapeHtml(account.email)}">
          <span class="account-avatar">${escapeHtml(account.email.slice(0, 1).toUpperCase())}</span>
          <span class="account-email">${escapeHtml(account.email)}</span>
          <span class="account-online" title="Connected"></span>
        </button>
        <button class="account-remove" data-remove-account="${escapeHtml(account.email)}" aria-label="Remove ${escapeHtml(account.email)}">Remove</button>
      </div>
    `).join('');
  }
  const selected = elements.accountFilter.value;
  elements.accountFilter.innerHTML = '<option value="">All accounts</option>' + state.accounts.map((account) => `<option value="${escapeHtml(account.email)}">${escapeHtml(account.email)}</option>`).join('');
  elements.accountFilter.value = state.accounts.some((account) => account.email === selected) ? selected : '';
}

function formatDate(message) {
  const timestamp = message.internalDate || Date.parse(message.date);
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date) : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function visibleMessages() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const account = elements.accountFilter.value;
  return state.messages.filter((message) => (state.view === 'All mail' || message.category === state.view) &&
    (!account || message.accountEmail === account) &&
    (!query || `${message.sender} ${message.subject} ${message.snippet} ${message.accountEmail}`.toLowerCase().includes(query)));
}

function renderMessages() {
  const messages = visibleMessages();
  elements.allCount.textContent = String(state.messages.length);
  elements.resultCount.textContent = `${messages.length} ${messages.length === 1 ? 'message' : 'messages'}`;
  if (!messages.length) {
    const configured = document.body.dataset.configured === 'true';
    const title = state.messages.length ? 'No matching messages' : (configured ? 'Nothing to show yet' : 'Your inbox starts here');
    const detail = state.messages.length ? 'Try another search or account filter.' : (configured ? 'Connect a Google account and sync to bring your inbox into view.' : 'Add Google and Firebase credentials when you\'re ready, then connect an account to see your mail.');
    elements.messageList.innerHTML = `<div class="empty-state"><div class="empty-illustration" aria-hidden="true"><span class="empty-envelope"></span><span class="empty-spark spark-one"></span><span class="empty-spark spark-two"></span></div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p>${state.messages.length ? '' : '<button class="text-button" data-action="connect">Connect a Google account <span aria-hidden="true">&#8594;</span></button>'}</div>`;
    return;
  }
  elements.messageList.innerHTML = messages.map((message) => `<button class="message-row" data-message-id="${escapeHtml(message.id)}" data-account-email="${escapeHtml(message.accountEmail)}"><span class="message-main"><span class="sender-line"><strong>${escapeHtml(message.sender || message.accountEmail)}</strong><span class="category-tag category-${escapeHtml(message.category.toLowerCase())}">${escapeHtml(message.category)}</span></span><span class="subject-line">${escapeHtml(message.subject)}</span><span class="snippet-line">${escapeHtml(message.snippet)}</span></span><span class="message-source"><span class="source-avatar">${escapeHtml(message.accountEmail.slice(0, 1).toUpperCase())}</span><span>${escapeHtml(message.accountEmail)}</span></span><time class="message-date">${escapeHtml(formatDate(message))}</time></button>`).join('');
}

function setView(view) {
  state.view = view;
  elements.currentView.textContent = view;
  elements.pageTitle.textContent = view;
  elements.pageSubtitle.textContent = view === 'All mail' ? 'A quiet view across every connected inbox.' : `${view} messages from your connected accounts.`;
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  renderMessages();
}

async function loadInitialState() {
  try {
    const session = await requestJson('/api/session');
    if (session.required && !session.configured) {
      elements.setupBanner.querySelector('strong').textContent = 'Workspace access needs configuration';
      elements.setupBanner.querySelector('p').textContent = 'Set APP_ACCESS_PASSWORD and APP_SESSION_SECRET in the Vercel project environment.';
      return;
    }
    if (session.required && !session.authenticated) {
      elements.accessDialog.showModal();
      return;
    }
    const status = await requestJson('/api/status');
    document.body.dataset.configured = String(status.ready);
    elements.footerProject.textContent = `FIREBASE PROJECT: ${status.projectId}`.toUpperCase();
    elements.setupBanner.classList.toggle('is-ready', status.ready);
    elements.setupState.textContent = status.ready ? 'SERVICES READY' : 'SETUP NEEDED';
    if (status.ready) {
      elements.setupBanner.querySelector('strong').textContent = 'Services are connected';
      elements.setupBanner.querySelector('p').textContent = 'Link a Google account, then sync to bring your messages into one view.';
      const accounts = await requestJson('/api/accounts');
      state.accounts = accounts.accounts;
      renderAccounts();
    }
  } catch (error) {
    notify(error.message);
  }
}

elements.accessForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.accessSubmit.disabled = true;
  elements.accessError.textContent = '';
  try {
    await requestJson('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: elements.accessPassword.value }),
    });
    elements.accessPassword.value = '';
    elements.accessDialog.close();
    await loadInitialState();
  } catch (error) {
    elements.accessError.textContent = error.message;
  } finally {
    elements.accessSubmit.disabled = false;
  }
});

async function syncMail() {
  if (state.loading) return;
  state.loading = true;
  document.body.classList.add('is-syncing');
  elements.syncStatus.innerHTML = '<span class="status-dot"></span>Syncing';
  try {
    const result = await requestJson('/api/emails/sync', { method: 'POST' });
    state.messages = result.messages;
    elements.syncStatus.innerHTML = `<span class="status-dot"></span>Synced ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(result.syncedAt))}`;
    renderMessages();
    if (result.failures.length) notify(`${result.messages.length} messages loaded; ${result.failures.length} account(s) need attention.`);
    else notify(`${result.messages.length} messages synced.`);
  } catch (error) {
    notify(error.message);
  } finally {
    state.loading = false;
    document.body.classList.remove('is-syncing');
  }
}

function showMessage(message) {
  elements.messageDetail.innerHTML = `<div class="detail-meta"><span class="category-tag category-${escapeHtml(message.category.toLowerCase())}">${escapeHtml(message.category)}</span><span>${escapeHtml(message.accountEmail)}</span></div><h2>${escapeHtml(message.subject)}</h2><p class="detail-sender">${escapeHtml(message.sender)}<span>${escapeHtml(message.date)}</span></p><div class="detail-body">${escapeHtml(message.body)}</div>`;
  elements.messageDialog.showModal();
}

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.getElementById('sync-button').addEventListener('click', syncMail);
document.getElementById('refresh-button').addEventListener('click', syncMail);
document.getElementById('add-account').addEventListener('click', () => window.location.assign('/api/auth/google'));
document.getElementById('empty-connect').addEventListener('click', () => window.location.assign('/api/auth/google'));
elements.searchInput.addEventListener('input', renderMessages);
elements.accountFilter.addEventListener('change', renderMessages);
elements.accountList.addEventListener('click', async (event) => {
  const removeTarget = event.target.closest('[data-remove-account]');
  if (removeTarget) {
    const email = removeTarget.dataset.removeAccount;
    try {
      await requestJson(`/api/accounts?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
      state.accounts = state.accounts.filter((account) => account.email !== email);
      renderAccounts();
      if (elements.accountFilter.value === email) elements.accountFilter.value = '';
      notify(`${email} removed.`);
    } catch (error) {
      notify(error.message);
    }
    return;
  }

  const account = event.target.closest('[data-account]')?.dataset.account;
  if (account) {
    elements.accountFilter.value = account;
    renderMessages();
  }
});
elements.messageList.addEventListener('click', (event) => {
  const connect = event.target.closest('[data-action="connect"]');
  if (connect) return window.location.assign('/api/auth/google');
  const row = event.target.closest('[data-message-id]');
  if (row) showMessage(state.messages.find((message) => message.id === row.dataset.messageId && message.accountEmail === row.dataset.accountEmail));
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.searchInput.focus();
  }
});

loadInitialState();