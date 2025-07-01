const consoleStyle_title = 'color: #4e73df; font-size: 24px; font-weight: bold;';
const consoleStyle_body = 'font-size: 14px; line-height: 1.5;';

console.log('%c🏥 부산의원 관리 v2.2.2', consoleStyle_title);
console.log('%cjust for fun \n 심심해서 만들었어유', consoleStyle_body);

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const authView = document.getElementById('auth-view');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');
    
    let appInitialized = false; // 앱 초기화 여부를 추적하는 '깃발'

    // --- 로그인/아웃 상태 변경 감지 ---
    auth.onAuthStateChanged(user => {
        if (user) {
            authView.classList.add('hidden');
            appContainer.classList.remove('hidden');
            // ⭐ 로그인은 됐지만, 아직 앱 초기화가 안된 상태에서만 딱 한 번 실행!
            if (!appInitialized) {
                initializeApp(user);
                appInitialized = true;
            }
        } else {
            // 로그아웃되면 다시 초기화할 수 있도록 깃발을 내림
            appInitialized = false;
            authView.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
    });

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            if (!email || !password) return alert('이메일과 비밀번호를 모두 입력해주세요.');
            auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
                .then(() => auth.signInWithEmailAndPassword(email, password))
                .catch(error => alert(`로그인 처리 중 오류 발생: ${error.message}`));
        });
    }
    
    // --- 로그인 성공 후 딱 한 번만 실행되는 메인 함수 ---
    async function initializeApp(user) {
        const clinicsCollection = db.collection('users').doc(user.uid).collection('clinics');
        const todosCollection = db.collection('users').doc(user.uid).collection('todos');

        // --- DOM 요소 ---
        const userEmailSpan = document.getElementById('user-email');
        const logoutBtn = document.getElementById('logout-btn');
        const addClinicBtn = document.getElementById('add-clinic-btn');
        const historyBtn = document.getElementById('history-btn');
        const totalClinicCountSpan = document.getElementById('total-clinic-count');
        const dashboardView = document.getElementById('dashboard-view');
        const listView = document.getElementById('list-view');
        const detailView = document.getElementById('detail-view');
        const clinicModal = document.getElementById('clinic-modal');
        const modalTitle = document.getElementById('modal-title');
        const closeModalBtn = document.getElementById('close-clinic-modal-btn');
        const clinicForm = document.getElementById('clinic-form');
        const searchAddressBtn = document.getElementById('search-address-btn');
        const backToListBtn = document.getElementById('back-to-list-btn');
        const editClinicBtn = document.getElementById('edit-clinic-btn');
        const deleteClinicBtn = document.getElementById('delete-clinic-btn');
        const saveMemoBtn = document.getElementById('save-memo-btn');
        const searchStageSelect = document.getElementById('search-stage');
        const searchDepartmentSelect = document.getElementById('search-department');
        const searchNameInput = document.getElementById('search-name');
        const autocompleteResults = document.getElementById('autocomplete-results');
        const todoListContainer = document.getElementById('todo-list');
        const totalTodoCountSpan = document.getElementById('total-todo-count');
        const filterButtons = document.getElementById('todo-filter-buttons');
        const addTodoBtn = document.getElementById('add-todo-btn');
        const historyModal = document.getElementById('history-modal');
        const closeHistoryModalBtn = document.getElementById('close-history-modal-btn');

        // --- 전역 변수 ---
        let allClinics = [];
        let allTodos = [];
        let currentClinicId = null;
        let currentTodoFilter = 'all';
        let currentTodoPage = 1;
        const TODO_PAGE_SIZE = 5;

        // --- 함수 정의 ---
        function loadNaverMapsApi() {
            return new Promise((resolve, reject) => {
                if (window.naver && window.naver.maps) return resolve();
                const mapScript = document.createElement('script');
                mapScript.type = 'text/javascript';
                mapScript.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=d7528qc21z&submodules=geocoder`;
                mapScript.onload = resolve;
                mapScript.onerror = reject;
                document.head.appendChild(mapScript);
            });
        }
        function drawMap(address, name) {
            const mapElement = document.getElementById('map');
            if (!mapElement || !address) return;
            mapElement.innerHTML = '';
            let attempts = 0;
            const intervalId = setInterval(() => {
                if (window.naver && window.naver.maps && window.naver.maps.Service) {
                    clearInterval(intervalId);
                    naver.maps.Service.geocode({ query: address }, (status, response) => {
                        if (status !== naver.maps.Service.Status.OK || !response.v2.addresses || response.v2.addresses.length === 0) {
                            mapElement.innerHTML = '<div style="text-align:center; padding:20px; color:#dc3545;">주소의 좌표를 찾을 수 없습니다.</div>';
                            return;
                        }
                        const point = new naver.maps.Point(response.v2.addresses[0].x, response.v2.addresses[0].y);
                        const map = new naver.maps.Map(mapElement, { center: point, zoom: 16 });
                        new naver.maps.Marker({ position: point, map: map, title: name });
                    });
                    return;
                }
                attempts++;
                if (attempts > 50) { clearInterval(intervalId); mapElement.innerHTML = '<div style="text-align:center; padding:20px; color:#dc3545;">지도 로딩에 실패했습니다.</div>'; }
            }, 100);
        }
        function populateFilters() {
            searchStageSelect.innerHTML = '<option value="">-- 단계 전체 --</option>';
            searchDepartmentSelect.innerHTML = '<option value="">-- 진료과 전체 --</option>';
            const stages = ['인지', '관심', '고려', '구매'];
            const departments = ['피부과', '가정의학과', '내과', '정형외과', '치과', '한의원', '정신병원'];
            stages.forEach(stage => {
                const option = document.createElement('option');
                option.value = stage; option.textContent = stage;
                searchStageSelect.appendChild(option);
            });
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept; option.textContent = dept;
                searchDepartmentSelect.appendChild(option);
            });
        }
        function filterAndDisplay() {
            const stage = searchStageSelect.value;
            const department = searchDepartmentSelect.value;
            const name = searchNameInput.value.toLowerCase();
            let filtered = allClinics;
            if (stage) filtered = filtered.filter(clinic => clinic.stage === stage);
            if (department) filtered = filtered.filter(clinic => clinic.department === department);
            if (name) filtered = filtered.filter(clinic => clinic.name.toLowerCase().includes(name));
            updateDashboard(filtered);
            return filtered;
        }
        function handleAutocomplete() {
            const name = searchNameInput.value.toLowerCase();
            autocompleteResults.innerHTML = '';
            if (name.length === 0) {
                autocompleteResults.classList.add('hidden');
                filterAndDisplay();
                return;
            }
            const filtered = filterAndDisplay();
            if (filtered.length > 0) {
                autocompleteResults.classList.remove('hidden');
                filtered.slice(0, 7).forEach(clinic => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.innerHTML = `${clinic.name} <small>${clinic.department}, ${clinic.stage}</small>`;
                    item.addEventListener('click', () => {
                        showDetailView(clinic.id);
                        searchNameInput.value = '';
                        autocompleteResults.classList.add('hidden');
                    });
                    autocompleteResults.appendChild(item);
                });
            } else {
                autocompleteResults.classList.add('hidden');
            }
        }
        function setupDashboard() {
            dashboardView.innerHTML = '';
            const stages = [ { name: '인지', id: 'awareness' }, { name: '관심', id: 'interest' }, { name: '고려', id: 'consideration' }, { name: '구매', id: 'purchase' } ];
            stages.forEach(stageInfo => {
                const column = document.createElement('div');
                column.className = `stage-column stage-${stageInfo.id}`;
                const columnHeader = document.createElement('h2');
                columnHeader.dataset.stageName = stageInfo.name;
                const titleSpan = document.createElement('span');
                const toggleBtn = document.createElement('button');
                toggleBtn.className = 'toggle-expand-btn';
                columnHeader.appendChild(titleSpan);
                columnHeader.appendChild(toggleBtn);
                column.appendChild(columnHeader);
                const cardsContainer = document.createElement('div');
                cardsContainer.className = 'clinic-cards-container';
                cardsContainer.dataset.stage = stageInfo.name;
                column.appendChild(cardsContainer);
                dashboardView.appendChild(column);
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const container = e.target.closest('.stage-column').querySelector('.clinic-cards-container');
                    container.classList.toggle('expanded');
                    e.target.textContent = container.classList.contains('expanded') ? '간단히 보기 ▲' : '더보기 ▼';
                });
                new Sortable(cardsContainer, {
                    group: 'shared', animation: 150, ghostClass: 'sortable-ghost',
                    onEnd: async (evt) => {
                        const clinicId = evt.item.dataset.id;
                        const newStage = evt.to.dataset.stage;
                        await clinicsCollection.doc(clinicId).update({ stage: newStage, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                        const clinicToUpdate = allClinics.find(c => c.id === clinicId);
                        if (clinicToUpdate) clinicToUpdate.stage = newStage;
                        filterAndDisplay();
                    }
                });
            });
        }
        function updateDashboard(clinicsToRender) {
            const clinics = clinicsToRender;
            totalClinicCountSpan.textContent = `(총 ${allClinics.length}곳)`;
            renderStatistics(allClinics);
            document.querySelectorAll('.stage-column h2').forEach(header => {
                const stageName = header.dataset.stageName;
                const stageClinics = clinics.filter(c => c.stage === stageName);
                header.querySelector('span').textContent = `${stageName} (${stageClinics.length}곳)`;
                const column = header.closest('.stage-column');
                const toggleBtn = column.querySelector('.toggle-expand-btn');
                const cardsContainer = column.querySelector('.clinic-cards-container');
                if (stageClinics.length > 5) {
                    toggleBtn.classList.remove('hidden');
                    cardsContainer.classList.remove('no-scroll');
                    toggleBtn.textContent = cardsContainer.classList.contains('expanded') ? '간단히 보기 ▲' : '더보기 ▼';
                } else {
                    toggleBtn.classList.add('hidden');
                    cardsContainer.classList.add('no-scroll');
                    cardsContainer.classList.remove('expanded');
                }
            });
            document.querySelectorAll('.clinic-cards-container').forEach(c => c.innerHTML = '');
            clinics.forEach(clinic => {
                const container = document.querySelector(`.clinic-cards-container[data-stage="${clinic.stage}"]`);
                if(container) {
                    const card = document.createElement('div');
                    card.className = 'clinic-card';
                    card.dataset.id = clinic.id;
                    card.innerHTML = `<h3>${clinic.name}</h3><p>${clinic.address.split(',')[0]}</p>`;
                    card.addEventListener('click', () => showDetailView(clinic.id));
                    container.appendChild(card);
                }
            });
        }
        function renderStatistics(clinics) { /* ... */ }
        function renderTodoList() { /* ... */ }
        function renderTodoPagination(totalPages) { /* ... */ }
        async function showDetailView(id) { /* ... */ }
        function showListView() { /* ... */ }
        function execDaumPostcode() { /* ... */ }
        function buildHistoryHtml() { /* ... */ }

        // --- 이벤트 리스너 ---
        userEmailSpan.textContent = user.email;
        logoutBtn.addEventListener('click', () => auth.signOut());
        searchStageSelect.addEventListener('change', filterAndDisplay);
        searchDepartmentSelect.addEventListener('change', filterAndDisplay);
        searchNameInput.addEventListener('input', handleAutocomplete);
        document.addEventListener('click', (e) => { if (!e.target.closest('.search-input-wrapper')) autocompleteResults.classList.add('hidden'); });
        backToListBtn.addEventListener('click', showListView);
        addClinicBtn.addEventListener('click', () => { /* ... */ });
        closeModalBtn.addEventListener('click', () => clinicModal.classList.add('hidden'));
        clinicModal.addEventListener('click', (e) => { if (e.target === clinicModal) e.target.classList.add('hidden'); });
        searchAddressBtn.addEventListener('click', execDaumPostcode);
        clinicForm.addEventListener('submit', async (e) => { /* ... */ });
        editClinicBtn.addEventListener('click', async () => { /* ... */ });
        deleteClinicBtn.addEventListener('click', async () => { /* ... */ });
        saveMemoBtn.addEventListener('click', async () => { /* ... */ });
        addTodoBtn.addEventListener('click', () => { /* ... */ });
        todoListContainer.addEventListener('click', async (e) => { /* ... */ });
        filterButtons.addEventListener('click', (e) => { /* ... */ });
        historyBtn.addEventListener('click', () => historyModal.classList.remove('hidden'));
        closeHistoryModalBtn.addEventListener('click', () => historyModal.classList.add('hidden'));
        historyModal.addEventListener('click', (e) => { if (e.target === historyModal) historyModal.classList.add('hidden'); });
        
        // --- 앱 초기화 ---
        clinicsCollection = db.collection('users').doc(user.uid).collection('clinics');
        todosCollection = db.collection('users').doc(user.uid).collection('todos');
        [allClinics, allTodos] = await Promise.all([
            clinicsCollection.orderBy('updatedAt', 'desc').get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
            todosCollection.orderBy('createdAt', 'desc').get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        ]);
        
        populateFilters();
        setupDashboard();
        updateDashboard(allClinics);
        renderTodoList();
        buildHistoryHtml();
    }
});