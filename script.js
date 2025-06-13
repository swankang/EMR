document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const authView = document.getElementById('auth-view');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');
    
    let appInitialized = false;

    auth.onAuthStateChanged(user => {
        if (user) {
            authView.classList.add('hidden');
            appContainer.classList.remove('hidden');
            if (!appInitialized) {
                initializeApp(user); 
                appInitialized = true;
            }
        } else {
            authView.classList.remove('hidden');
            appContainer.classList.add('hidden');
            appInitialized = false; 
        }
    });

    if(loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            if (!email || !password) return alert('이메일과 비밀번호를 모두 입력해주세요.');
            auth.signInWithEmailAndPassword(email, password)
                .catch(error => alert(`로그인 실패: ${error.message}`));
        });
    }
    
    async function initializeApp(user) {
        const clinicsCollection = db.collection('users').doc(user.uid).collection('clinics');
        const todosCollection = db.collection('users').doc(user.uid).collection('todos');

        const userEmailSpan = document.getElementById('user-email');
        const logoutBtn = document.getElementById('logout-btn');
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
        
        let departmentChart = null, scaleChart = null, stageChart = null;
        let currentClinicId = null;
        let currentTodoFilter = 'all';

        if(userEmailSpan) userEmailSpan.textContent = user.email;
        if(logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

        async function getClinics() {
            const snapshot = await clinicsCollection.orderBy('updatedAt', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        async function getTodos() {
            const snapshot = await todosCollection.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        function renderStatistics(clinics) {
             const chartIds = ['department-chart', 'scale-chart', 'stage-chart'];
             chartIds.forEach(id => {
                const existingChart = Chart.getChart(id);
                if (existingChart) existingChart.destroy();
             });
            const departmentData = clinics.reduce((acc, clinic) => { const dept = clinic.department || "미지정"; acc[dept] = (acc[dept] || 0) + 1; return acc; }, {});
            new Chart(document.getElementById('department-chart'), { type: 'doughnut', data: { labels: Object.keys(departmentData), datasets: [{ data: Object.values(departmentData), backgroundColor: ['#cce5ff', '#b3d7ff', '#99c9ff', '#80bbff', '#66adff', '#4da0ff', '#3392ff'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: true } });
            const scaleOrder = ['0~5명', '6~10명', '11~15명', '16~20명', '21명 이상'];
            const scaleData = { labels: scaleOrder, values: Array(scaleOrder.length).fill(0) };
            clinics.forEach(clinic => { const index = scaleOrder.indexOf(clinic.scale); if (index > -1) { scaleData.values[index]++; } });
            new Chart(document.getElementById('scale-chart'), { type: 'bar', data: { labels: scaleData.labels, datasets: [{ label: '의원 수', data: scaleData.values, backgroundColor: '#a9c9ff' }] }, options: { responsive: true, maintainAspectRatio: true } });
            const stageOrder = ['인지', '관심', '고려', '구매'];
            const stageData = { labels: stageOrder, values: Array(stageOrder.length).fill(0) };
            clinics.forEach(clinic => { const index = stageOrder.indexOf(clinic.stage); if (index > -1) { stageData.values[index]++; } });
            new Chart(document.getElementById('stage-chart'), { type: 'bar', data: { labels: stageData.labels, datasets: [{ label: '의원 수', data: stageData.values, backgroundColor: ['#f8f9fa', '#eaf2ff', '#dce9ff', '#cad8ff'], borderColor: '#ccc', borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true } });
        }

        async function renderDashboard() {
            const clinics = await getClinics();
            totalClinicCountSpan.textContent = `(총 ${clinics.length}곳)`;
            const stages = [ { name: '인지', id: 'awareness' }, { name: '관심', id: 'interest' }, { name: '고려', id: 'consideration' }, { name: '구매', id: 'purchase' } ];
            dashboardView.innerHTML = '';
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
                    const updatedAt = clinic.updatedAt ? new Date(clinic.updatedAt.toDate()).toLocaleDateString() : '날짜 정보 없음';
                    card.innerHTML = `<h3>${clinic.name}</h3><p>${clinic.address}</p><p class="date">업데이트: ${updatedAt}</p>`;
                    card.addEventListener('click', () => showDetailView(clinic.id));
                    cardsContainer.appendChild(card);
                });
                column.appendChild(cardsContainer);
                dashboardView.appendChild(column);
            });
            await renderStatistics(clinics);
        }

        function setupSortable() {
            document.querySelectorAll('.clinic-cards-container').forEach(container => {
                new Sortable(container, {
                    group: 'shared', animation: 150, ghostClass: 'sortable-ghost',
                    onEnd: async function (evt) {
                        await clinicsCollection.doc(evt.item.dataset.id).update({ stage: evt.to.dataset.stage, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                        await renderDashboard();
                    }
                });
            });
        }
        
        async function renderTodoList() {
            const todoListContainer = document.getElementById('todo-list');
            if(!todoListContainer) return;
            todoListContainer.innerHTML = '';
            const allTodos = await getTodos();
            const filteredTodos = allTodos.filter(todo => { if (currentTodoFilter === 'all') return true; if (currentTodoFilter === 'complete') return todo.isComplete; if (currentTodoFilter === 'incomplete') return !todo.isComplete; });
            document.getElementById('total-todo-count').textContent = `(총 ${filteredTodos.length}개)`;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const overdue = filteredTodos.filter(t => !t.isComplete && new Date(t.dueDate) < today).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
            const upcoming = filteredTodos.filter(t => !t.isComplete && new Date(t.dueDate) >= today).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
            const completed = filteredTodos.filter(t => t.isComplete);
            const sortedTodos = [...overdue, ...upcoming, ...completed];
            if (sortedTodos.length === 0 && !document.querySelector('.todo-add-form')) { todoListContainer.innerHTML = '<p style="text-align:center; color:#888; padding: 20px 0;">등록된 일정이 없습니다.</p>'; }
            sortedTodos.forEach(todo => {
                const todoItem = document.createElement('div');
                todoItem.className = `todo-item ${todo.isComplete ? 'completed' : ''}`;
                todoItem.dataset.id = todo.id;
                const dueDate = new Date(todo.dueDate); const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                let dDayText = `D-${diffDays}`; let dDayClass = '';
                if (diffDays < 0) { dDayText = `D+${Math.abs(diffDays)}`; dDayClass = 'overdue'; }
                else if (diffDays === 0) { dDayText = 'D-Day'; }
                if (todo.isComplete) { dDayText = '완료'; dDayClass = ''; }
                todoItem.innerHTML = `<div class="todo-content">${todo.content}</div><div class="todo-due-date ${dDayClass}">${dDayText}</div><div class="todo-actions"><button class="todo-complete-btn" title="완료">${todo.isComplete ? '✅' : '✔️'}</button><button class="todo-delete-btn" title="삭제">🗑️</button></div>`;
                todoListContainer.appendChild(todoItem);
            });
        }

        async function showDetailView(id) {
            const doc = await clinicsCollection.doc(id).get();
            if (!doc.exists) return;
            const clinic = { id: doc.id, ...doc.data() };
            currentClinicId = id;
            const updatedAtText = (clinic.updatedAt && clinic.updatedAt.toDate) ? new Date(clinic.updatedAt.toDate()).toLocaleString() : '정보 없음';
            document.getElementById('detail-clinic-name').textContent = clinic.name;
            document.getElementById('detail-address').textContent = clinic.address;
            document.getElementById('detail-manager').textContent = clinic.manager || '-';
            document.getElementById('detail-contact').textContent = clinic.contact || '-';
            document.getElementById('detail-stage').textContent = clinic.stage;
            document.getElementById('detail-department').textContent = clinic.department || '-';
            document.getElementById('detail-scale').textContent = clinic.scale || '-';
            document.getElementById('detail-notes').textContent = clinic.notes || '-';
            document.getElementById('detail-updated').textContent = updatedAtText;
            document.getElementById('memo-history').value = clinic.memo || '';
            document.getElementById('list-view').classList.add('hidden');
            document.getElementById('detail-view').classList.remove('hidden');
            loadMap(clinic.address, clinic.name);
        }

        function showListView() { currentClinicId = null; document.getElementById('detail-view').classList.add('hidden'); document.getElementById('list-view').classList.remove('hidden'); renderDashboard(); }
        
        function loadMap(address, name) { /* ... */ }
        function execDaumPostcode() { /* ... */ }
        
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

        setupDashboard();
        await renderDashboard();
        await renderTodoList();
    }
});