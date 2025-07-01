const consoleStyle_title = 'color: #4e73df; font-size: 24px; font-weight: bold;';
const consoleStyle_body = 'font-size: 14px; line-height: 1.5;';

console.log('%c🏥 부산의원 관리 v2.2.2', consoleStyle_title);
console.log('%cjust for fun \n 심심해서 만들었어유', consoleStyle_body);

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // 1. DOM 요소 가져오기
    const authView = document.getElementById('auth-view');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');
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
    const statsSection = document.getElementById('stats-section');

    // 2. 전역 상태 변수
    let appInitialized = false;
    let allClinics = [];
    let allTodos = [];
    let currentClinicId = null;
    let currentTodoFilter = 'all';
    let currentTodoPage = 1;
    const TODO_PAGE_SIZE = 5;
    let currentUser = null;
    let clinicsCollection = null;
    let todosCollection = null;

    // 3. 함수 정의
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
                    if (!clinicsCollection) return;
                    const clinicId = evt.item.dataset.id;
                    const newStage = evt.to.dataset.stage;
                    await clinicsCollection.doc(clinicId).update({ stage: newStage, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    const clinicToUpdate = allClinics.find(c => c.id === clinicId);
                    if (clinicToUpdate) {
                        clinicToUpdate.stage = newStage;
                        clinicToUpdate.updatedAt = firebase.firestore.Timestamp.now();
                    }
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

    function renderStatistics(clinics) {
        const departmentCanvas = document.getElementById('department-chart');
        const scaleCanvas = document.getElementById('scale-chart');
        const stageCanvas = document.getElementById('stage-chart');
        if (!departmentCanvas || !scaleCanvas || !stageCanvas) return;
        [departmentCanvas, scaleCanvas, stageCanvas].forEach(canvas => {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) existingChart.destroy();
        });
        const departmentData = clinics.reduce((acc, clinic) => {
            const dept = clinic.department || "미지정";
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, {});
        new Chart(departmentCanvas, { type: 'doughnut', data: { labels: Object.keys(departmentData), datasets: [{ data: Object.values(departmentData), backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false } });
        const scaleOrder = ['0~5명', '6~10명', '11~15명', '16명이상'];
        const scaleCounts = Array(scaleOrder.length).fill(0);
        clinics.forEach(clinic => {
            const index = scaleOrder.indexOf(clinic.scale);
            if (index > -1) scaleCounts[index]++;
        });
        new Chart(scaleCanvas, { type: 'bar', data: { labels: scaleOrder, datasets: [{ label: '의원 수', data: scaleCounts, backgroundColor: '#4e73df' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } });
        const stageOrder = ['인지', '관심', '고려', '구매'];
        const stageCounts = Array(stageOrder.length).fill(0);
        clinics.forEach(clinic => {
            const index = stageOrder.indexOf(clinic.stage);
            if (index > -1) stageCounts[index]++;
        });
        new Chart(stageCanvas, { type: 'bar', data: { labels: stageOrder, datasets: [{ label: '의원 수', data: stageCounts, backgroundColor: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, min: 0, ticks: { precision: 0, stepSize: 1 } } } } });
    }
    
    function renderTodoList() {
        if(!todoListContainer || !totalTodoCountSpan) return;
        todoListContainer.innerHTML = '';
        const filteredTodos = allTodos.filter(todo => {
            if (currentTodoFilter === 'all') return true;
            if (currentTodoFilter === 'complete') return todo.isComplete;
            return !todo.isComplete;
        });
        totalTodoCountSpan.textContent = `(총 ${filteredTodos.length}개)`;
        const totalPages = Math.ceil(filteredTodos.length / TODO_PAGE_SIZE);
        if(currentTodoPage > totalPages) currentTodoPage = totalPages || 1;
        const startIndex = (currentTodoPage - 1) * TODO_PAGE_SIZE;
        const endIndex = startIndex + TODO_PAGE_SIZE;
        const todosForCurrentPage = filteredTodos.slice(startIndex, endIndex);
        if (todosForCurrentPage.length === 0 && currentTodoPage === 1) {
            todoListContainer.innerHTML = '<p style="text-align:center; color:#888; padding: 20px 0;">표시할 일정이 없습니다.</p>';
        } else {
             const today = new Date(); today.setHours(0, 0, 0, 0);
             todosForCurrentPage.forEach(todo => {
                const todoItem = document.createElement('div');
                todoItem.className = `todo-item ${todo.isComplete ? 'completed' : ''}`;
                todoItem.dataset.id = todo.id;
                let dateText = '';
                let dateClass = '';
                if (todo.isComplete && todo.completedAt) {
                    const completedDate = new Date(todo.completedAt.toDate()).toLocaleDateString();
                    dateText = `✅ ${completedDate} 완료`;
                    dateClass = 'completed';
                } else {
                    const dueDate = new Date(todo.dueDate); 
                    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                    dateText = `D-${diffDays}`; 
                    dateClass = '';
                    if (diffDays < 0) { dateText = `D+${Math.abs(diffDays)}`; dateClass = 'overdue'; }
                    else if (diffDays === 0) { dateText = 'D-Day'; }
                }
                todoItem.innerHTML = `<div class="todo-content">${todo.content}</div><div class="todo-due-date ${dateClass}">${dateText}</div><div class="todo-actions"><button class="todo-complete-btn" title="완료">${todo.isComplete ? '✅' : '✔️'}</button><button class="todo-delete-btn" title="삭제">🗑️</button></div>`;
                todoListContainer.appendChild(todoItem);
            });
        }
        renderTodoPagination(totalPages);
    }

    function renderTodoPagination(totalPages) {
        const paginationContainer = document.getElementById('todo-pagination');
        if (!paginationContainer) return;
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'pagination-btn';
            pageBtn.textContent = i;
            if (i === currentTodoPage) pageBtn.classList.add('active');
            pageBtn.addEventListener('click', () => {
                currentTodoPage = i;
                renderTodoList();
            });
            paginationContainer.appendChild(pageBtn);
        }
    }

    async function showDetailView(id) {
        const clinic = allClinics.find(c => c.id === id);
        if (!clinic) { alert("의원 정보를 찾을 수 없습니다."); return; }
        currentClinicId = id;
        document.getElementById('detail-clinic-name').textContent = clinic.name;
        document.getElementById('detail-address').textContent = clinic.address;
        document.getElementById('detail-manager').textContent = clinic.manager || '-';
        document.getElementById('detail-contact').textContent = clinic.contact || '-';
        document.getElementById('detail-stage').textContent = clinic.stage;
        document.getElementById('detail-department').textContent = clinic.department || '-';
        document.getElementById('detail-scale').textContent = clinic.scale || '-';
        document.getElementById('detail-notes').textContent = clinic.notes || '-';
        document.getElementById('detail-updated').textContent = (clinic.updatedAt && clinic.updatedAt.toDate) ? new Date(clinic.updatedAt.toDate()).toLocaleString() : '정보 없음';
        document.getElementById('memo-history').value = clinic.memo || '';
        listView.classList.add('hidden');
        detailView.classList.remove('hidden');
        try {
            await loadNaverMapsApi();
            drawMap(clinic.address, clinic.name);
        } catch (error) { console.error("Naver Maps API 로딩 실패:", error); }
    }

    function showListView() {
        currentClinicId = null;
        detailView.classList.add('hidden');
        listView.classList.remove('hidden');
        filterAndDisplay();
    }
    
    function execDaumPostcode() { new daum.Postcode({ oncomplete: (data) => { document.getElementById('clinic-address').value = data.roadAddress; document.getElementById("clinic-address-detail").focus(); } }).open(); }
    
    function buildHistoryHtml() {
        const historyContent = document.getElementById('history-content');
        if(!historyContent) return;
        const historyData = [ { version: 'v2.2.1', title: '안정화 및 최종 디버깅', date: '2025년 7월 1일', features: ["<b>아키텍처 개선:</b> 로그인/로그아웃 시 이벤트 리스너가 중복 등록되던 구조적 문제 해결.", "<b>UI 복원:</b> 통계 차트 및 각종 버튼의 스타일이 잘못 표시되던 문제 수정.", "<b>전체 코드 검증:</b> 모든 기능이 포함된 최종 버전으로 코드베이스 안정화."] }, { version: 'v2.1', title: 'UI/UX 개선 및 기능 추가', date: '2025년 6월 20일', features: ["<b>프로젝트 히스토리 조회:</b> 앱의 버전별 업데이트 내역을 확인할 수 있는 '히스토리' 팝업 기능 추가."] }, { version: 'v2.0', title: '전문가용 기능 확장', date: '2025년 6월 20일', features: ["<b>칸반 보드 UI 개선:</b> 각 단계별 목록의 카드가 5개를 초과할 경우, '더보기/간단히 보기' 버튼으로 목록을 펼치거나 접는 기능 추가.", "<b>통합 검색 기능:</b> '홍보 단계', '진료과', '의원명'의 다중 조건으로 필터링하는 검색 기능 구현.", "<b>실시간 자동완성:</b> 의원명 입력 시, 조건에 맞는 결과가 드롭다운 형태로 실시간 표시.", "<b>성능 최적화:</b> 데이터베이스 조회 로직을 개선, 앱 최초 로딩 시 모든 데이터를 '캐시'하여 이후 작업의 반응 속도를 획기적으로 향상시키고 렌더링 오류 해결."] }, { version: 'v1.2', title: '사용성 및 안정성 개선', date: '2025년 6월 중순', features: ["<b>로그인 세션 정책 변경:</b> 브라우저 종료 시 자동 로그아웃되도록 세션 유지 방식 변경.", "<b>페이지네이션 구현:</b> TO-DO LIST가 5개를 초과할 경우, 페이지 번호로 나눠 볼 수 있는 기능 추가.", "<b>TO-DO LIST 완료일 기록:</b> 할 일 완료 시, D-Day 대신 실제 완료일이 표시되도록 기능 개선."] }, { version: 'v1.1', title: '대시보드 및 편의 기능 고도화', date: '2025년 6월 중순', features: ["<b>통계 대시보드 추가:</b> Chart.js를 활용하여 진료과별, 규모별, 영업 단계별 현황 차트 구현.", "<b>TO-DO LIST 기능 구현:</b> 날짜 기반의 할 일 등록 및 관리 기능 추가.", "<b>사용자 인증 도입:</b> Firebase Authentication을 이용한 로그인/로그아웃 기능 추가."] }, { version: 'v1.0', title: '핵심 기능 완성', date: '2025년 6월 초', features: ["<b>칸반 보드 UI 도입:</b> 영업 단계를 '인지/관심/고려/구매'로 시각화.", "<b>드래그 앤 드롭 기능:</b> 의원 카드를 끌어서 영업 단계를 변경하는 기능 추가.", "<b>상세 정보 조회 및 지도 연동:</b> 의원별 상세 정보 확인 및 네이버 지도 연동.", "<b>메모 기능:</b> 각 의원별 텍스트 메모 기록 및 저장 기능 추가."] }, { version: 'v0.1', title: '초기 아이디어 및 프로토타입', date: '2025년 5월', features: ["Firebase Firestore 데이터베이스 연동.", "모달을 통한 새로운 의원 정보 추가 및 저장 기능 구현."] } ];
        let html = '';
        historyData.forEach(item => { html += `<div class="history-version"><h3>${item.version} - ${item.title}</h3><p class="date">${item.date}</p><ul>${item.features.map(feature => `<li>${feature}</li>`).join('')}</ul></div>`; });
        historyContent.innerHTML = html;
    }
    
    // --- 4. '한 번만' 등록하면 되는 모든 이벤트 리스너 ---
    function setupStaticEventListeners() {
        if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());
        if (searchStageSelect) searchStageSelect.addEventListener('change', filterAndDisplay);
        if (searchDepartmentSelect) searchDepartmentSelect.addEventListener('change', filterAndDisplay);
        if (searchNameInput) searchNameInput.addEventListener('input', handleAutocomplete);
        document.addEventListener('click', (e) => { if (!e.target.closest('.search-input-wrapper')) autocompleteResults.classList.add('hidden'); });
        if (backToListBtn) backToListBtn.addEventListener('click', showListView);
        if (addClinicBtn) addClinicBtn.addEventListener('click', () => { clinicForm.reset(); modalTitle.textContent = '의원 정보 입력'; clinicModal.classList.remove('hidden'); });
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => clinicModal.classList.add('hidden'));
        if (clinicModal) clinicModal.addEventListener('click', (e) => { if (e.target === clinicModal) e.target.classList.add('hidden'); });
        if (searchAddressBtn) searchAddressBtn.addEventListener('click', execDaumPostcode);
        if (clinicForm) clinicForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) return alert("로그인이 필요합니다.");
            const clinicId = document.getElementById('clinic-id').value;
            const fullAddress = `${document.getElementById('clinic-address').value.trim()}, ${document.getElementById('clinic-address-detail').value.trim()}`.replace(/, $/, "");
            const clinicPayload = { name: document.getElementById('clinic-name').value, address: fullAddress, manager: document.getElementById('clinic-manager').value, contact: document.getElementById('clinic-contact').value, department: document.getElementById('clinic-department').value, scale: document.getElementById('clinic-scale').value, notes: document.getElementById('clinic-notes').value, stage: document.getElementById('clinic-stage').value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            if (clinicId) {
                await clinicsCollection.doc(clinicId).update(clinicPayload);
                const index = allClinics.findIndex(c => c.id === clinicId);
                if (index > -1) allClinics[index] = { ...allClinics[index], ...clinicPayload, id: clinicId };
            } else {
                const newDocRef = await clinicsCollection.add({ ...clinicPayload, memo: '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                const newClinic = { ...clinicPayload, id: newDocRef.id, createdAt: firebase.firestore.Timestamp.now() };
                allClinics.unshift(newClinic);
            }
            clinicModal.classList.add('hidden');
            filterAndDisplay();
            if(!detailView.classList.contains('hidden')) await showDetailView(clinicId);
        });
        if (editClinicBtn) editClinicBtn.addEventListener('click', async () => {
            if (!currentClinicId) return;
            const clinic = allClinics.find(c => c.id === currentClinicId);
            if (clinic) {
                modalTitle.textContent = '의원 정보 수정';
                document.getElementById('clinic-id').value = clinic.id;
                document.getElementById('clinic-name').value = clinic.name;
                const addressParts = clinic.address.split(',');
                document.getElementById('clinic-address').value = addressParts[0].trim();
                document.getElementById('clinic-address-detail').value = addressParts.length > 1 ? addressParts.slice(1).join(',').trim() : '';
                document.getElementById('clinic-manager').value = clinic.manager;
                document.getElementById('clinic-contact').value = clinic.contact;
                document.getElementById('clinic-department').value = clinic.department;
                document.getElementById('clinic-scale').value = clinic.scale;
                document.getElementById('clinic-notes').value = clinic.notes;
                document.getElementById('clinic-stage').value = clinic.stage;
                clinicModal.classList.remove('hidden');
            }
        });
        if (deleteClinicBtn) deleteClinicBtn.addEventListener('click', async () => {
            if (!currentClinicId || !confirm('정말 이 의원 정보를 삭제하시겠습니까?')) return;
            await clinicsCollection.doc(currentClinicId).delete();
            allClinics = allClinics.filter(c => c.id !== currentClinicId);
            showListView();
        });
        if (saveMemoBtn) saveMemoBtn.addEventListener('click', async () => {
            if (!currentClinicId) return;
            await clinicsCollection.doc(currentClinicId).update({ memo: document.getElementById('memo-history').value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            alert('메모가 저장되었습니다.');
        });
        if (addTodoBtn) addTodoBtn.addEventListener('click', () => {
            if (document.querySelector('.todo-add-form')) return;
            const formItem = document.createElement('div');
            formItem.className = 'todo-item todo-add-form';
            formItem.innerHTML = `<input type="text" id="new-todo-content" placeholder="새로운 할 일 내용 입력" required><input type="date" id="new-todo-due-date" required><div class="todo-actions" style="opacity:1;"><button id="save-new-todo-btn">저장</button></div>`;
            todoListContainer.prepend(formItem);
            document.getElementById('new-todo-content').focus();
        });
        if (todoListContainer) todoListContainer.addEventListener('click', async (e) => {
            const target = e.target;
            const todoItem = target.closest('.todo-item');
            if (target.id === 'save-new-todo-btn') {
                const content = document.getElementById('new-todo-content').value;
                const dueDate = document.getElementById('new-todo-due-date').value;
                if (!content || !dueDate) return alert('내용과 완료예정일을 모두 입력해주세요.');
                const newTodoRef = await todosCollection.add({ content, dueDate, isComplete: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                const newTodoData = { id: newTodoRef.id, content, dueDate, isComplete: false, createdAt: firebase.firestore.Timestamp.now() };
                allTodos.unshift(newTodoData);
                renderTodoList();
            } else if (todoItem && todoItem.dataset.id) {
                const todoId = todoItem.dataset.id;
                const todoToUpdate = allTodos.find(t => t.id === todoId);
                if (!todoToUpdate) return;
                if (target.classList.contains('todo-complete-btn')) {
                    const newIsComplete = !todoToUpdate.isComplete;
                    const updatePayload = { isComplete: newIsComplete };
                    if (newIsComplete) {
                        updatePayload.completedAt = firebase.firestore.FieldValue.serverTimestamp();
                        todoToUpdate.completedAt = firebase.firestore.Timestamp.now();
                    } else {
                        updatePayload.completedAt = firebase.firestore.FieldValue.delete();
                        delete todoToUpdate.completedAt;
                    }
                    await todosCollection.doc(todoId).update(updatePayload);
                    todoToUpdate.isComplete = newIsComplete;
                    renderTodoList();
                } else if (target.classList.contains('todo-delete-btn')) {
                    if (confirm('정말 이 일정을 삭제하시겠습니까?')) {
                        await todosCollection.doc(todoId).delete();
                        allTodos = allTodos.filter(t => t.id !== todoId);
                        renderTodoList();
                    }
                }
            }
        });
        if (filterButtons) filterButtons.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                currentTodoFilter = e.target.dataset.filter;
                currentTodoPage = 1;
                document.querySelectorAll('#todo-filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderTodoList();
            }
        });
        if (historyBtn) historyBtn.addEventListener('click', () => { buildHistoryHtml(); historyModal.classList.remove('hidden'); });
        if (closeHistoryModalBtn) closeHistoryModalBtn.addEventListener('click', () => historyModal.classList.add('hidden'));
        if (historyModal) historyModal.addEventListener('click', (e) => { if (e.target === historyModal) historyModal.classList.add('hidden'); });
    }

    // --- 5. 로그인/아웃 상태 변경 감지 ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            authView.classList.add('hidden');
            appContainer.classList.remove('hidden');
            if (!appInitialized) {
                initializeApp();
                setupStaticEventListeners();
                appInitialized = true;
            }
        } else {
            currentUser = null;
            authView.classList.remove('hidden');
            appContainer.classList.add('hidden');
            appInitialized = false;
        }
    });

    // --- 6. 로그인 성공 시 데이터 로딩 및 최초 렌더링 ---
    async function initializeApp() {
        if (!currentUser) return;
        userEmailSpan.textContent = currentUser.email;
        clinicsCollection = db.collection('users').doc(currentUser.uid).collection('clinics');
        todosCollection = db.collection('users').doc(currentUser.uid).collection('todos');

        [allClinics, allTodos] = await Promise.all([
            clinicsCollection.orderBy('updatedAt', 'desc').get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
            todosCollection.orderBy('createdAt', 'desc').get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        ]);
        
        populateFilters();
        setupDashboard();
        updateDashboard(allClinics);
        renderTodoList();
    }
});