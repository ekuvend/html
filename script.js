// 1. SUPABASE CONFIGURATION
const SUPABASE_URL = "https://mktbiiypppgeksowmhmi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rdGJpaXlwcHBnZWtzb3dtaG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NjM4MzUsImV4cCI6MjEwNDUzOTgzNX0.Rsy9WGGaidMv4zfFvdDUJeJRdcrnVaQuEtG5TiIqaaw";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let isSignUpMode = false;

// 2. PAGE NAVIGATION & URL HASH HANDLING
function navigateTo(pageId) {
  document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
  } else {
    document.getElementById('page-home').classList.add('active');
  }
}

function handleHashChange() {
  const hash = window.location.hash.replace('#', '') || 'home';
  navigateTo(hash);
}

window.addEventListener('hashchange', handleHashChange);
window.addEventListener('load', handleHashChange);

// 3. AUTHENTICATION LOGIC
function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-title').textContent = isSignUpMode ? 'Loo konto' : 'Logi sisse';
  document.getElementById('auth-sub').textContent = isSignUpMode ? 'Registreeri uus kasutaja' : 'Sisesta oma andmed failidele ligipääsuks';
  document.getElementById('auth-submit-btn').textContent = isSignUpMode ? 'Registreeru' : 'Logi sisse';
  document.getElementById('auth-toggle-text').textContent = isSignUpMode ? 'Konto olemas?' : 'Pole kontot?';
  document.getElementById('auth-toggle-btn').textContent = isSignUpMode ? 'Logi sisse' : 'Loo konto';
}

async function handleAuth(event) {
  event.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const rememberMe = document.getElementById('remember-me').checked;

  if (isSignUpMode) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) alert('Registreerimise viga: ' + error.message);
    else alert('Konto loodud! Kontrolli oma e-posti kinnitamiseks.');
  } else {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      alert('Sisselogimise viga: ' + error.message);
    } else {
      if (!rememberMe) {
        localStorage.setItem('is_temp_session', 'true');
        sessionStorage.setItem('active_tab', 'true');
      } else {
        localStorage.removeItem('is_temp_session');
        sessionStorage.removeItem('active_tab');
      }
      checkSession();
    }
  }
}

async function handleLogout() {
  localStorage.removeItem('is_temp_session');
  sessionStorage.removeItem('active_tab');
  await sb.auth.signOut();
  checkSession();
}

async function checkSession() {
  const isTempSession = localStorage.getItem('is_temp_session') === 'true';
  const hasActiveTab = sessionStorage.getItem('active_tab') === 'true';

  if (isTempSession && !hasActiveTab) {
    localStorage.removeItem('is_temp_session');
    await sb.auth.signOut();
  }

  const { data: { session } } = await sb.auth.getSession();
  const authContainer = document.getElementById('auth-container');
  const fileContainer = document.getElementById('file-manager-container');

  if (session) {
    authContainer.style.display = 'none';
    fileContainer.style.display = 'block';
    loadUserFiles();
  } else {
    authContainer.style.display = 'block';
    fileContainer.style.display = 'none';
  }
}

// 4. FILE STORAGE & DOWNLOAD LOGIC
async function uploadSelectedFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return alert("Pead olema sisse logitud!");

  const filePath = `${user.id}/${Date.now()}_${file.name}`;
  const { error } = await sb.storage.from('user-files').upload(filePath, file);

  if (error) {
    alert('Upload ebaõnnestus: ' + error.message);
  } else {
    alert('Fail edukalt üles laetud!');
    loadUserFiles();
  }
}

async function loadUserFiles() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data, error } = await sb.storage.from('user-files').list(user.id);
  const fileListEl = document.getElementById('file-list');
  fileListEl.innerHTML = '';

  if (error || !data || data.length === 0) {
    fileListEl.innerHTML = '<p style="color: var(--muted); font-size: 13px;">Failid puuduvad.</p>';
    return;
  }

  data.forEach(file => {
    const filePath = `${user.id}/${file.name}`;
    const cleanFileName = file.name.replace(/^\d+_/, '');

    const row = document.createElement('div');
    row.className = 'file-row';
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 8px 0; border-bottom: 1px solid var(--border);';
    row.innerHTML = `
      <div class="file-info" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;">
        <div class="file-name" style="font-weight: 600; font-size: 13.5px;">${cleanFileName}</div>
      </div>
      <button 
        type="button" 
        class="btn-download" 
        onclick="downloadFile('${filePath}', '${cleanFileName}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Lae alla
      </button>
    `;
    fileListEl.appendChild(row);
  });
}

async function downloadFile(filePath, fileName) {
  const { data, error } = await sb.storage.from('user-files').download(filePath);
  
  if (error) {
    alert('Allalaadimise viga: ' + error.message);
    return;
  }

  const blobUrl = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

// Monitor Authentication State
sb.auth.onAuthStateChange(() => checkSession());