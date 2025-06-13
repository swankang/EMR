document.addEventListener('DOMContentLoaded', () => {
    // Firebase 서비스 객체
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- 기본 DOM 요소 ---
    const authView = document.getElementById('auth-view');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userEmailSpan = document.getElementById('user-email');

    let appInitialized = false; // 앱이 초기화되었는지 확인하는 플래그

    // --- 핵심! 인증 상태 감지 로직 ---
    auth.onAuthStateChanged(user => {
        if (user && !appInitialized) {
            // 사용자가 로그인했고, 앱이 아직 초기화되지 않았다면 실행
            appInitialized = true; // 초기화 플래그를 true로 설정
            authView.classList.add('hidden');
            appContainer.classList.remove('hidden');
            userEmailSpan.textContent = user.email;
            initializeApp(user); 
        } else if (!user) {
            // 사용자가 로그아웃한 경우
            appInitialized = false; // 로그아웃 시 플래그 리셋
            authView.classList.remove('hidden');
            appContainer.classList.add('hidden');
            userEmailSpan.textContent = '';
        }
    });

    // --- 인증 관련 이벤트 핸들러 ---
    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        if (!email || !password) {
            alert('이메일과 비밀번호를 모두 입력해주세요.');
            return;
        }
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                alert(`로그인 실패: ${error.message}`);
            });
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    // ================================================================
    //   ▼▼▼ 로그인 후 앱의 모든 기능은 이 함수 안에서 동작 ▼▼▼
    // ================================================================
    async function initializeApp(user) {
        // 사용자별 개인 컬렉션 경로 설정
        const clinicsCollection = db.collection('users').doc(user.uid).collection('clinics');
        const todosCollection = db.collection('users').doc(user.uid).collection('todos');

        // 앱 내부 DOM 요소
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
        
        // 차트 객체 변수
        let departmentChart = null;
        let scaleChart = null;
        let stageChart = null;

        let currentClinicId = null;
        let currentTodoFilter = 'all';

        // --- 데이터 관리 함수 (Firestore 버전) ---
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

        // --- 화면 렌더링 함수 ---
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
            departmentChart = new Chart(document.getElementById('department-chart'), { type: 'doughnut', data: { labels: Object.keys(departmentData), datasets: [{ data: Object.values(departmentData), backgroundColor: ['#cce5ff', '#b3d7ff', '#99c9ff', '#80bbff', '#66adff', '#4da0ff', '#3392ff'] }] }, options: { responsive: true } });
            if (scaleChart) scaleChart.destroy();
            scaleChart = new Chart(document.getElementById('scale-chart'), { type: 'bar', data: { labels: scaleData.labels, datasets: [{ label: '의원 수', data: scaleData.values, backgroundColor: '#a9c9ff' }] }, options: { responsive: true } });
            if (stageChart) stageChart.destroy();
            stageChart = new Chart(document.getElementById('stage-chart'), { type: 'bar', data: { labels: stageData.labels, datasets: [{ label: '의원 수', data: stageData.values, backgroundColor: ['#f8f9fa', '#eaf2ff', '#dce9ff', '#cad8ff'], borderColor: '#ccc', borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true } });
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
            todoListContainer.innerHTML = '';
            const allTodos = await getTodos();
            const filteredTodos = allTodos.filter(todo => { if (currentTodoFilter === 'all') return true; if (currentTodoFilter === 'complete') return todo.isComplete; if (currentTodoFilter === 'incomplete') return !todo.isComplete; });
            totalTodoCountSpan.textContent = `(총 ${filteredTodos.length}개)`;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const overdue = filteredTodos.filter(t => !t.isComplete && new Date(t.dueDate) < today);
            const upcoming = filteredTodos.filter(t => !t.isComplete && new Date(t.dueDate) >= today);
            const completed = filteredTodos.filter(t => t.isComplete);
            overdue.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            upcoming.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
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
            const updatedAtText = (clinic.updatedAt && clinic.updatedAt.toDate) ? new Date(clinic.updatedAt.toDate()).toLocaleString() : '방금 전';
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
            listView.classList.add('hidden');
            detailView.classList.remove('hidden');
            loadMap(clinic.address, clinic.name);
        }

        function showListView() { currentClinicId = null; detailView.classList.add('hidden'); listView.classList.remove('hidden'); renderClinicList(); }
        
        function loadMap(address, name) {
            const drawMap = () => {
                const map = new naver.maps.Map('map', { center: new naver.maps.LatLng(37.5665, 126.9780), zoom: 15 });
                naver.maps.Service.geocode({ query: address }, (status, response) => {
                    if (status !== naver.maps.Service.Status.OK) return console.warn('Geocode failed for address:', address);
                    const point = new naver.maps.Point(response.v2.addresses[0].x, response.v2.addresses[0].y);
                    map.setCenter(point);
                    new naver.maps.Marker({ position: point, map: map, title: name });
                });
            };
            if (window.naver && window.naver.maps) { drawMap(); } 
            else { const mapScript = document.createElement('script'); mapScript.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=d7528qc21z&submodules=geocoder`; mapScript.onload = drawMap; document.head.appendChild(mapScript); }
        }

        function execDaumPostcode() { new daum.Postcode({ oncomplete: function(data) { let addr = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress; document.getElementById('clinic-address').value = addr; document.getElementById("clinic-address-detail").focus(); } }).open(); }
        
        addClinicBtn.addEventListener('click', () => { clinicForm.reset(); modalTitle.textContent = '의원 정보 입력'; document.getElementById('clinic-id').value = ''; modal.classList.remove('hidden'); });
        editClinicBtn.addEventListener('click', async () => { if (!currentClinicId) return; const doc = await clinicsCollection.doc(currentClinicId).get(); if (doc.exists) { const clinicToEdit = { id: doc.id, ...doc.data() }; modalTitle.textContent = '의원 정보 수정'; document.getElementById('clinic-id').value = clinicToEdit.id; document.getElementById('clinic-name').value = clinicToEdit.name; const addressParts = clinicToEdit.address.split(','); document.getElementById('clinic-address').value = addressParts[0].trim(); document.getElementById('clinic-address-detail').value = addressParts.length > 1 ? addressParts.slice(1).join(',').trim() : ''; document.getElementById('clinic-manager').value = clinicToEdit.manager; document.getElementById('clinic-contact').value = clinicToEdit.contact; document.getElementById('clinic-department').value = clinicToEdit.department; document.getElementById('clinic-scale').value = clinicToEdit.scale; document.getElementById('clinic-notes').value = clinicToEdit.notes; document.getElementById('clinic-stage').value = clinicToEdit.stage; modal.classList.remove('hidden'); } });
        closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
        searchAddressBtn.addEventListener('click', execDaumPostcode);
        clinicForm.addEventListener('submit', async (e) => { e.preventDefault(); const mainAddress = document.getElementById('clinic-address').value; const detailAddress = document.getElementById('clinic-address-detail').value; const fullAddress = detailAddress ? `${mainAddress}, ${detailAddress}` : mainAddress; const clinicId = document.getElementById('clinic-id').value; const clinicPayload = { name: document.getElementById('clinic-name').value, address: fullAddress, manager: document.getElementById('clinic-manager').value, contact: document.getElementById('clinic-contact').value, department: document.getElementById('clinic-department').value, scale: document.getElementById('clinic-scale').value, notes: document.getElementById('clinic-notes').value, stage: document.getElementById('clinic-stage').value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }; if (clinicId) { await clinicsCollection.doc(clinicId).update(clinicPayload); } else { const docRef = await clinicsCollection.add({ ...clinicPayload, memo: '' }); currentClinicId = docRef.id; } modal.classList.add('hidden'); if (detailView.classList.contains('hidden')) { await renderClinicList(); } else { await showDetailView(currentClinicId); } });
        backToListBtn.addEventListener('click', showListView);
        deleteClinicBtn.addEventListener('click', async () => { if (!currentClinicId || !confirm('정말 이 의원 정보를 삭제하시겠습니까?')) return; await clinicsCollection.doc(currentClinicId).delete(); showListView(); });
        saveMemoBtn.addEventListener('click', async () => { if (!currentClinicId) return; await clinicsCollection.doc(currentClinicId).update({ memo: document.getElementById('memo-history').value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); alert('메모가 저장되었습니다.'); await showDetailView(currentClinicId); });
        addTodoBtn.addEventListener('click', () => { if (document.querySelector('.todo-add-form')) return; const formItem = document.createElement('div'); formItem.className = 'todo-item todo-add-form'; formItem.innerHTML = `<input type="text" id="new-todo-content" placeholder="새로운 할 일 내용 입력"><input type="date" id="new-todo-due-date"><div class="todo-actions" style="opacity:1;"><button id="save-new-todo-btn">저장</button></div>`; todoListContainer.prepend(formItem); document.getElementById('new-todo-content').focus(); });
        todoListContainer.addEventListener('click', async (e) => { const target = e.target; if (target.id === 'save-new-todo-btn') { const content = document.getElementById('new-todo-content').value; const dueDate = document.getElementById('new-todo-due-date').value; if (!content || !dueDate) return alert('내용과 완료예정일을 모두 입력해주세요.'); await todosCollection.add({ content, dueDate, isComplete: false }); await renderTodoList(); } const todoItem = target.closest('.todo-item'); if (!todoItem || !todoItem.dataset.id) return; const todoId = todoItem.dataset.id; if (target.classList.contains('todo-complete-btn')) { const doc = await todosCollection.doc(todoId).get(); if (doc.exists) { await todosCollection.doc(todoId).update({ isComplete: !doc.data().isComplete }); await renderTodoList(); } } if (target.classList.contains('todo-delete-btn')) { if (confirm('정말 이 일정을 삭제하시겠습니까?')) { await todosCollection.doc(todoId).delete(); await renderTodoList(); } } });
        filterButtons.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') { currentTodoFilter = e.target.dataset.filter; document.querySelectorAll('#todo-filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); renderTodoList(); } });

        // --- 앱 초기화 실행 ---
        await renderClinicList();
        await renderTodoList();
    }
});