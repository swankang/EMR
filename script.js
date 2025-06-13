document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const authView = document.getElementById('auth-view');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');
    
    let appInitialized = false;

    auth.onAuthStateChanged(user => {
        const logoutBtn = document.getElementById('logout-btn'); // moved inside to ensure it exists
        const userEmailSpan = document.getElementById('user-email'); // moved inside
        
        if (user) {
            authView.classList.add('hidden');
            appContainer.classList.remove('hidden');
            if(userEmailSpan) userEmailSpan.textContent = user.email;

            if (!appInitialized) {
                initializeApp(user); 
                appInitialized = true;
            }
        } else {
            authView.classList.remove('hidden');
            appContainer.classList.add('hidden');
            if(userEmailSpan) userEmailSpan.textContent = '';
            appInitialized = false;
        }
    });

    if(loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            if (!email || !password) {
                alert('이메일과 비밀번호를 모두 입력해주세요.');
                return;
            }
            auth.signInWithEmailAndPassword(email, password)
                .catch(error => alert(`로그인 실패: ${error.message}`));
        });
    }

    // Logout listener is attached inside initializeApp to ensure the button exists
    
    async function initializeApp(user) {
        const clinicsCollection = db.collection('users').doc(user.uid).collection('clinics');
        const todosCollection = db.collection('users').doc(user.uid).collection('todos');

        const listView = document.getElementById('list-view');
        const detailView = document.getElementById('detail-view');
        const dashboardView = document.getElementById('dashboard-view');
        const totalClinicCountSpan = document.getElementById('total-clinic-count');
        const addClinicBtn = document.getElementById('add-clinic-btn');
        const modal = document.getElementById('clinic-modal');
        const modalTitle = document.getElementById('modal-title');
        const closeModalBtn = document.querySelector('.close-btn');
        const clinicForm = document.getElementById('clinic-form');
        const backToListBtn = document.getElementById('back-to-list-btn');
        const editClinicBtn = document.getElementById('edit-clinic-btn');
        const deleteClinicBtn = document.getElementById('delete-clinic-btn');
        const saveMemoBtn = document.getElementById('save-memo-btn');
        const searchAddressBtn = document.getElementById('search-address-btn');
        const totalTodoCountSpan = document.getElementById('total-todo-count');
        const addTodoBtn = document.getElementById('add-todo-btn');
        const todoListContainer = document.getElementById('todo-list');
        const filterButtons = document.getElementById('todo-filter-buttons');
        const logoutBtn = document.getElementById('logout-btn'); // Get it here again
        
        let departmentChart = null, scaleChart = null, stageChart = null;
        let currentClinicId = null;
        let currentTodoFilter = 'all';

        async function getClinics() {
            const snapshot = await clinicsCollection.orderBy('updatedAt', 'desc').get();
            const clinics = [];
            snapshot.forEach(doc => clinics.push({ id: doc.id, ...doc.data() }));
            return clinics;
        }
        async function getTodos() {
            const snapshot = await todosCollection.get();
            const todos = [];
            snapshot.forEach(doc => todos.push({ id: doc.id, ...doc.data() }));
            return todos;
        }

        async function renderStatistics() {
            const clinics = await getClinics();
            const departmentData = clinics.reduce((acc, clinic) => { const dept = clinic.department || "미지정"; acc[dept] = (acc[dept] || 0) + 1; return acc; }, {});
            const scaleOrder = ['0~5명', '6~10명', '11~15명', '16~20명', '21명 이상'];
            const scaleData = { labels: scaleOrder, values: Array(scaleOrder.length).fill(0) };
            clinics.forEach(clinic => { const index = scaleOrder.indexOf(clinic.scale); if (index > -1) { scaleData.values[index]++; } });
            const stageOrder = ['인지', '관심', '고려', '구매'];
            const stageData = { labels: stageOrder, values: Array(stageOrder.length).fill(0) };
            clinics.forEach(clinic => { const index = stageOrder.indexOf(clinic.stage); if (index > -1) { stageData.values[index]++; } });

            if (departmentChart) departmentChart.destroy();
            departmentChart = new Chart(document.getElementById('department-chart'), { type: 'doughnut', data: { labels: Object.keys(departmentData), datasets: [{ data: Object.values(departmentData), backgroundColor: ['#cce5ff', '#b3d7ff', '#99c9ff', '#80bbff', '#66adff', '#4da0ff', '#3392ff'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false } });
            if (scaleChart) scaleChart.destroy();
            scaleChart = new Chart(document.getElementById('scale-chart'), { type: 'bar', data: { labels: scaleData.labels, datasets: [{ label: '의원 수', data: scaleData.values, backgroundColor: '#a9c9ff' }] }, options: { responsive: true, maintainAspectRatio: false } });
            if (stageChart) stageChart.destroy();
            stageChart = new Chart(document.getElementById('stage-chart'), { type: 'bar', data: { labels: stageData.labels, datasets: [{ label: '의원 수', data: stageData.values, backgroundColor: ['#f8f9fa', '#eaf2ff', '#dce9ff', '#cad8ff'], borderColor: '#ccc', borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false } });
        }

        async function renderClinicList() {
            dashboardView.innerHTML = '';
            const clinics = await getClinics();
            totalClinicCountSpan.textContent = `(총 ${clinics.length}곳)`;
            const stages = [ { name: '인지', id: 'awareness' }, { name: '관심', id: 'interest' }, { name: '고려', id: 'consideration' }, { name: '구매', id: 'purchase' } ];
            stages.forEach(stageInfo => {
                const stageName = stageInfo.name;
                const column = document.createElement('div');
                column.className = `stage-column stage-${stageInfo.id}`;
                column.dataset.stage = stageName;
                const stageClinics = clinics.filter(c => c.stage === stageName);
                const columnHeader = document.createElement('h2');
                columnHeader.innerHTML = `${stageName} <span class="count">${stageClinics.length}곳 / ${clinics.length > 0 ? ((stageClinics.length / clinics.length) * 100).toFixed(1) : 0}%</span>`;
                column.appendChild(columnHeader);
                const cardsContainer = document.createElement('div');
                cardsContainer.className = 'clinic-cards-container';
                cardsContainer.dataset.stage = stageName;
                stageClinics.forEach(clinic => {
                    const card = document.createElement('div');
                    card.className = 'clinic-card';
                    card.dataset.id = clinic.id;
                    card.innerHTML = `<h3>${clinic.name}</h3><p>${clinic.address}</p><p class="date">업데이트: ${new Date(clinic.updatedAt.toDate()).toLocaleDateString()}</p>`;
                    card.addEventListener('click', () => showDetailView(clinic.id));
                    cardsContainer.appendChild(card);
                });
                column.appendChild(cardsContainer);
                dashboardView.appendChild(column);
                new Sortable(cardsContainer, {
                    group: 'shared', animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
                    onEnd: async function (evt) {
                        await clinicsCollection.doc(evt.item.dataset.id).update({ stage: evt.to.dataset.stage, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                        await renderClinicList();
                    }
                });
            });
            await renderStatistics();
        }
        
        async function renderTodoList() {
            // ... (previous implementation is correct)
        }

        async function showDetailView(id) {
            // ... (previous implementation is correct)
        }
        
        function showListView() { /* ... */ }
        function loadMap(address, name) { /* ... */ }
        function execDaumPostcode() { /* ... */ }
        
        // --- Event Listeners ---
        addClinicBtn.addEventListener('click', () => { /* ... */ });
        editClinicBtn.addEventListener('click', async () => { /* ... */ });
        closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
        searchAddressBtn.addEventListener('click', execDaumPostcode);
        clinicForm.addEventListener('submit', async (e) => { /* ... */ });
        backToListBtn.addEventListener('click', showListView);
        deleteClinicBtn.addEventListener('click', async () => { /* ... */ });
        saveMemoBtn.addEventListener('click', async () => { /* ... */ });
        addTodoBtn.addEventListener('click', () => { /* ... */ });
        todoListContainer.addEventListener('click', async (e) => { /* ... */ });
        filterButtons.addEventListener('click', (e) => { /* ... */ });
        logoutBtn.addEventListener('click', () => auth.signOut()); // Moved listener here

        // Initial Render
        await renderClinicList();
        await renderTodoList();
    }
});