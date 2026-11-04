
// ==========================================
// ADMIN AUTHENTICATION
// ==========================================
async function checkAdminAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');

    if (!loginScreen || !dashboardScreen) return; // Not on admin page

    if (session) {
        // Logged in
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        // Load initial data
        loadStudents();
        loadPositions();
        loadCandidateForm();
    } else {
        // Not logged in
        dashboardScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
    }
}

async function adminLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');

    errorDiv.style.display = 'none';

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } else {
        checkAdminAuth(); // Success! Show dashboard
    }
}

async function adminLogout() {
    await supabaseClient.auth.signOut();
    window.location.reload();
}

// Check auth on page load
window.addEventListener('DOMContentLoaded', checkAdminAuth);


// ==========================================
// HELPER: ESCAPE HTML
// ==========================================
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ==========================================
// 1. ADMIN LOGIC
// ==========================================
function openTab(evt, tabName) {
    document.querySelectorAll('.tablinks').forEach(btn => btn.classList.remove('active'));
    evt.currentTarget.classList.add('active');
    document.querySelectorAll('.tabcontent').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    if (tabName === 'students') loadStudents();
    if (tabName === 'positions') loadPositions();
    if (tabName === 'candidates') loadCandidateForm();
}

async function addStudent() {
    const index = document.getElementById('studentIndex').value.trim();
    const name = document.getElementById('studentName').value.trim();
    if (!index || !name) return alert('Fill in both fields');

    const { error } = await supabaseClient.from('students').insert([{ index_num: index, full_name: name, voted: false }]);
    if (error) alert('Error: ' + error.message);
    else {
        document.getElementById('studentIndex').value = '';
        document.getElementById('studentName').value = '';
        loadStudents();
    }
}

async function loadStudents() {
    const { data, error } = await supabaseClient.from('students').select('*').order('index_num');
    const tbody = document.querySelector('#studentsTable tbody');
    if (error || !data) return;
    tbody.innerHTML = data.map(s => `
        <tr>
            <td>${escapeHtml(s.index_num)}</td>
            <td>${escapeHtml(s.full_name)}</td>
            <td>${s.voted ? '✅' : '❌'}</td>
        </tr>
    `).join('');
}

async function addPosition() {
    const title = document.getElementById('positionTitle').value.trim();
    const order = parseInt(document.getElementById('positionOrder').value) || 0;
    if (!title) return alert('Enter position title');

    const { error } = await supabaseClient.from('positions').insert([{ title: title, sort_order: order }]);
    if (error) alert('Error: ' + error.message);
    else {
        document.getElementById('positionTitle').value = '';
        loadPositions();
        loadCandidateForm();
    }
}

async function loadPositions() {
    const { data, error } = await supabaseClient.from('positions').select('*').order('sort_order');
    const list = document.getElementById('positionsList');
    if (error || !data) return;
    list.innerHTML = data.map(p => `<li style="padding:16px; background:rgba(255,255,255,0.08); margin-bottom:12px; border-radius:14px; border:1px solid rgba(255,255,255,0.15);">${escapeHtml(p.title)} <span style="opacity:0.5; font-size:0.8rem; margin-left:10px;">(Order: ${p.sort_order})</span></li>`).join('');
}

async function loadCandidateForm() {
    const { data, error } = await supabaseClient.from('positions').select('*').order('sort_order');
    const select = document.getElementById('candidatePosition');
    if (error || !data) return;
    
    select.innerHTML = data.map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
    if (data.length > 0) {
        select.onchange = () => loadCandidatesList(select.value);
        loadCandidatesList(data[0].id);
    }
}

// Handle Image Upload (Base64 conversion)
let base64Image = null;
function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Resize image to save space in database
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                const MAX = 300;
                if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
                else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                base64Image = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById('fileNameDisplay').textContent = '✅ Selected: ' + input.files[0].name;
                document.getElementById('fileNameDisplay').style.color = '#30d158';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function addCandidate() {
    const posId = document.getElementById('candidatePosition').value;
    const name = document.getElementById('candidateName').value.trim();
    if (!posId || !name) return alert('Select position and enter name');

    const finalImage = base64Image || 'https://via.placeholder.com/150';
    const { error } = await supabaseClient.from('candidates').insert([{ position_id: posId, name: name, image_url: finalImage, vote_count: 0 }]);

    if (error) alert('Error: ' + error.message);
    else {
        document.getElementById('candidateName').value = '';
        document.getElementById('candidateImage').value = '';
        document.getElementById('fileNameDisplay').textContent = 'No file selected';
        base64Image = null;
        loadCandidatesList(posId);
    }
}

async function loadCandidatesList(posId) {
    const { data, error } = await supabaseClient.from('candidates').select('*').eq('position_id', posId);
    const list = document.getElementById('candidatesList');
    if (error || !data) return;

    list.innerHTML = data.map(c => `
        <div style="display:flex; align-items:center; gap:15px; margin:12px 0; background:rgba(255,255,255,0.06); padding:16px; border-radius:14px; border:1px solid rgba(255,255,255,0.1);">
            <img src="${c.image_url}" width="48" height="48" style="border-radius:50%; object-fit:cover; border:2px solid rgba(255,255,255,0.3);">
            <strong>${escapeHtml(c.name)}</strong>
        </div>
    `).join('') || '<p style="opacity:0.6; text-align:center;">No candidates yet.</p>';
}


// ==========================================
// 2. STUDENT LOGIN
// ==========================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const index_num = document.getElementById('indexNum').value.trim();
        const full_name = document.getElementById('fullName').value.trim();
        const errorDiv = document.getElementById('errorMsg');
        const btn = e.target.querySelector('button');
        
        errorDiv.style.display = 'none';
        btn.disabled = true; btn.textContent = 'Signing in...';

        const { data, error } = await supabaseClient.from('students').select('*').eq('index_num', index_num).eq('full_name', full_name);

        if (error) {
            errorDiv.textContent = 'Connection error.'; errorDiv.style.display = 'block';
            btn.disabled = false; btn.textContent = 'Sign In';
            return;
        }

        if (data && data.length > 0) {
            const student = data[0];
            if (student.voted) {
                errorDiv.textContent = 'You have already cast your vote.'; errorDiv.style.display = 'block';
                btn.disabled = false; btn.textContent = 'Sign In';
            } else {
                sessionStorage.setItem('currentVoter', JSON.stringify(student));
                window.location.href = 'vote.html';
            }
        } else {
            errorDiv.textContent = 'Invalid credentials. Please contact the admin.'; errorDiv.style.display = 'block';
            btn.disabled = false; btn.textContent = 'Sign In';
        }
    });
}


// ==========================================
// 3. VOTING WIZARD
// ==========================================
let votingPositions = [];
let votingIndex = 0;
let selectedCandidateId = null;
const voter = JSON.parse(sessionStorage.getItem('currentVoter'));

if (document.getElementById('votingArea')) {
    if (!voter) {
        window.location.href = 'index.html';
    } else {
        loadBallot();
    }
}

async function loadBallot() {
    const area = document.getElementById('votingArea');
    // Fetch positions and their candidates
    const { data: positions, error } = await supabaseClient.from('positions').select('*').order('sort_order');
    if (error || !positions || positions.length === 0) {
        area.innerHTML = '<p>No positions available yet.</p>';
        return;
    }

    for (let pos of positions) {
        const { data: candidates } = await supabaseClient.from('candidates').select('*').eq('position_id', pos.id);
        pos.candidates = candidates || [];
    }
    votingPositions = positions;
    renderPosition();
}

function renderPosition() {
    const area = document.getElementById('votingArea');
    if (votingIndex >= votingPositions.length) {
        // Finished voting
        area.innerHTML = `
            <h2 class="neon-title" style="font-size:2rem;">🎉 Thank you!</h2>
            <p style="text-align:center; margin-bottom:20px;">Your votes have been recorded.</p>
            <a href="results.html" class="glow-btn accent" style="text-align:center; text-decoration:none; display:block;">See Results</a>
        `;
        return;
    }

    const pos = votingPositions[votingIndex];
    selectedCandidateId = null;
    
    let html = `<h2 class="neon-title" style="font-size:1.8rem;">${escapeHtml(pos.title)}</h2>`;
    html += `<div class="voting-grid">`;
    pos.candidates.forEach(c => {
        html += `
            <div class="candidate-card" data-id="${c.id}" onclick="selectCard(this)">
                <img src="${c.image_url || 'https://via.placeholder.com/150'}">
                <p><strong>${escapeHtml(c.name)}</strong></p>
            </div>
        `;
    });
    html += `</div>`;
    
    // The 4cm Next button!
    html += `<button class="glow-btn vote-btn" id="voteButton" disabled onclick="castVote('${pos.id}')">Vote for this position</button>`;
    html += `<div class="clearfix"><button class="glow-btn next-btn" id="nextButton" disabled onclick="nextPosition()">Next ➤</button></div>`;
    
    area.innerHTML = html;
}

function selectCard(el) {
    document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedCandidateId = el.dataset.id;
    document.getElementById('voteButton').disabled = false;
}

async function castVote(positionId) {
    if (!selectedCandidateId) return;
    const btn = document.getElementById('voteButton');
    btn.disabled = true;
    btn.textContent = 'Recording...';

    try {
        // 1. Record the vote
        await supabaseClient.from('votes').insert([{
            student_id: voter.id,
            candidate_id: selectedCandidateId,
            position_id: positionId
        }]);

        // 2. Mark student as voted
        await supabaseClient.from('students').update({ voted: true }).eq('id', voter.id);

        // 3. Increment Candidate's vote count
        const { data: cand } = await supabaseClient.from('candidates').select('vote_count').eq('id', selectedCandidateId).single();
        await supabaseClient.from('candidates').update({ vote_count: (cand.vote_count || 0) + 1 }).eq('id', selectedCandidateId);

        btn.textContent = '✅ Recorded';
        btn.style.background = 'var(--success)';
        document.getElementById('nextButton').disabled = false;
    } catch (err) {
        alert('Vote failed. Check connection.');
        btn.disabled = false;
        btn.textContent = 'Vote for this position';
    }
}

function nextPosition() {
    votingIndex++;
    renderPosition();
}


// ==========================================
// 4. RESULTS PAGE
// ==========================================
async function loadResults() {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    const { data: positions, error } = await supabaseClient.from('positions').select('*').order('sort_order');
    if (error || !positions) return;

    let html = '';
    for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const { data: candidates } = await supabaseClient.from('candidates').select('*').eq('position_id', pos.id).order('vote_count', { ascending: false });
        
        if (!candidates) continue;
        
        const maxVotes = Math.max(...candidates.map(c => c.vote_count), 1);
        
        html += `<div class="result-section" style="animation-delay: ${i * 0.15}s">`;
        html += `<h2 style="color: var(--neon-yellow); margin-bottom: 20px; text-align: center;">${escapeHtml(pos.title)}</h2>`;
        
        candidates.forEach(c => {
            const pct = (c.vote_count / maxVotes) * 100;
            html += `
                <div class="candidate-result">
                    <img src="${c.image_url || 'https://via.placeholder.com/150'}">
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${escapeHtml(c.name)}</strong>
                            <span style="color: var(--accent); font-weight:bold;">${c.vote_count} votes</span>
                        </div>
                        <div class="vote-bar-container">
                            <div class="vote-bar" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>`;
        });
        html += `</div>`;
    }
    container.innerHTML = html || '<p style="text-align:center;">No results yet.</p>';
}

// Init Results (if on results page)
if (document.getElementById('resultsContainer')) {
    loadResults();
    setInterval(loadResults, 5000); // Auto-refresh every 5s
}