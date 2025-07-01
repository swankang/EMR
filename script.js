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
    
    async function initializeApp(user) {
        const clinicsCollection = db.collection('users').doc(user.uid).collection('clinics');
        const todosCollection = db.collection('users').doc(user.uid).collection('todos');

        // --- DOM 요소 ---
        const userEmailSpan = document.getElementById('user-email');
        const logoutBtn = document.getElementById('logout-btn');
        const addClinicBtn = document.getElementById('add-clinic-btn');
        const totalClinicCountSpan = document.getElementById('total-clinic-count');
        const dashboardView = document.getElementById('dashboard-view');
        const listView = document.getElementById('list-view');
        const detailView = document.getElementById('detail-view');
        const modal = document.getElementById('clinic-modal');
        const modalTitle = document.getElementById('modal-title');
        const closeModalBtn = document.querySelector('.modal .close-btn');
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
        const loadMoreBtn = document.getElementById('load-more-clinics-btn');
        const loadMoreContainer = document.getElementById('load-more-container');

        // --- 전역 변수 ---
        let allClinics = [];
        let allTodos = [];
        let currentClinicId = null;
        let currentTodoFilter = 'all';
        let currentTodoPage = 1;
        const TODO_PAGE_SIZE = 5;
        let lastVisibleClinic = null;
        let isLoadingClinics = false;
        const CLINIC_PAGE_SIZE = 20;
        let totalClinicsInDB = 0;

        // ===============================================================
        //   ▼▼▼ 모든 함수 정의 (Function Definitions) ▼▼▼
        // ===============================================================

        // ⭐ [수정됨] 디바운스 헬퍼 함수 추가
        function debounce(func, delay) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        }

        async function fetchClinics(isInitialLoad = false) {
            if (isLoadingClinics) return;
            isLoadingClinics = true;
            loadMoreBtn.textContent = '불러오는 중...';

            let query = clinicsCollection.orderBy('updatedAt', 'desc').limit(CLINIC_PAGE_SIZE);

            if (isInitialLoad) {
                const countSnapshot = await clinicsCollection.get();
                totalClinicsInDB = countSnapshot.size;
            } else if (lastVisibleClinic) {
                query = query.startAfter(lastVisibleClinic);
            }

            try {
                const snapshot = await query.get();
                const newClinics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                if (isInitialLoad) {
                    allClinics = newClinics;
                } else {
                    allClinics.push(...newClinics);
                }

                lastVisibleClinic = snapshot.docs[snapshot.docs.length - 1];
                filterAndDisplay();

                if (!lastVisibleClinic || allClinics.length >= totalClinicsInDB) {
                    loadMoreContainer.classList.add('hidden');
                } else {
                    loadMoreContainer.classList.remove('hidden');
                }
            } catch (error) {
                console.error("의원 정보 로딩 중 오류 발생:", error);
                alert('의원 정보를 불러오는 데 실패했습니다.');
            } finally {
                isLoadingClinics = false;
                loadMoreBtn.textContent = '더 많은 의원 보기';
            }
        }

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
            
            if (name || stage || department) {
                loadMoreContainer.classList.add('hidden');
            } else if (lastVisibleClinic && allClinics.length < totalClinicsInDB) {
                loadMoreContainer.classList.remove('hidden');
            } else {
                loadMoreContainer.classList.add('hidden');
            }
            
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
                        await fetchClinics(true);
                    }
                });
            });
        }
        
        function updateDashboard(clinicsToRender) {
            const clinics = clinicsToRender;
            totalClinicCountSpan.textContent = `(총 ${totalClinicsInDB}곳)`;
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
            renderStatistics(allClinics);
        }

        async function renderStatistics(clinics) {
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
            let clinic = allClinics.find(c => c.id === id);
            if (!clinic) {
                const doc = await clinicsCollection.doc(id).get();
                if (!doc.exists) return;
                clinic = { id: doc.id, ...doc.data() };
            }

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
        
        // --- 모든 이벤트 리스너 ---
        if (userEmailSpan) userEmailSpan.textContent = user.email;
        if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());
        searchStageSelect.addEventListener('change', filterAndDisplay);
        searchDepartmentSelect.addEventListener('change', filterAndDisplay);

        // ⭐ [수정됨] 검색 입력 이벤트에 디바운스 적용
        searchNameInput.addEventListener('input', debounce(handleAutocomplete, 300));

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-input-wrapper')) {
                autocompleteResults.classList.add('hidden');
            }
        });
        addClinicBtn.addEventListener('click', () => {
            clinicForm.reset();
            modalTitle.textContent = '의원 정보 입력';
            document.getElementById('clinic-id').value = '';
            modal.classList.remove('hidden');
        });
        closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => { if (e.target === modal) e.target.classList.add('hidden'); });
        searchAddressBtn.addEventListener('click', execDaumPostcode);
        clinicForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clinicId = document.getElementById('clinic-id').value;
            const fullAddress = `${document.getElementById('clinic-address').value}, ${document.getElementById('clinic-address-detail').value}`;
            const clinicPayload = { name: document.getElementById('clinic-name').value, address: fullAddress, manager: document.getElementById('clinic-manager').value, contact: document.getElementById('clinic-contact').value, department: document.getElementById('clinic-department').value, scale: document.getElementById('clinic-scale').value, notes: document.getElementById('clinic-notes').value, stage: document.getElementById('clinic-stage').value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
            if (clinicId) {
                await clinicsCollection.doc(clinicId).update(clinicPayload);
            } else {
                await clinicsCollection.add({ ...clinicPayload, memo: '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
            modal.classList.add('hidden');
            await fetchClinics(true);
            if(!detailView.classList.contains('hidden') && clinicId) await showDetailView(clinicId);
        });
        backToListBtn.addEventListener('click', showListView);
        editClinicBtn.addEventListener('click', async () => {
            if (!currentClinicId) return;
            const doc = await clinicsCollection.doc(currentClinicId).get();
            if (doc.exists) {
                const clinic = { id: doc.id, ...doc.data() };
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
                modal.classList.remove('hidden');
            }
        });
        deleteClinicBtn.addEventListener('click', async () => {
            if (!currentClinicId || !confirm('정말 이 의원 정보를 삭제하시겠습니까?')) return;
            await clinicsCollection.doc(currentClinicId).delete();
            await fetchClinics(true);
            showListView();
        });
        saveMemoBtn.addEventListener('click', async () => {
            if (!currentClinicId) return;
            await clinicsCollection.doc(currentClinicId).update({ 
                memo: document.getElementById('memo-history').value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
            });
            alert('메모가 저장되었습니다.');
            await fetchClinics(true);
        });
        addTodoBtn.addEventListener('click', () => {
            if (document.querySelector('.todo-add-form')) return;
            const formItem = document.createElement('div');
            formItem.className = 'todo-item todo-add-form';
            formItem.innerHTML = `<input type="text" id="new-todo-content" placeholder="새로운 할 일 내용 입력" required><input type="date" id="new-todo-due-date" required><div class="todo-actions" style="opacity:1;"><button id="save-new-todo-btn">저장</button></div>`;
            todoListContainer.prepend(formItem);
            document.getElementById('new-todo-content').focus();
        });
        todoListContainer.addEventListener('click', async (e) => {
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
        filterButtons.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                currentTodoFilter = e.target.dataset.filter;
                currentTodoPage = 1;
                document.querySelectorAll('#todo-filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderTodoList();
            }
        });
        loadMoreBtn.addEventListener('click', () => fetchClinics(false));

        // ===============================================================
        //   ▼▼▼ 앱 초기화 (App Initialization) ▼▼▼
        // ===============================================================
        await fetchClinics(true);
        allTodos = await todosCollection.orderBy('createdAt', 'desc').get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        populateFilters();
        setupDashboard();
        updateDashboard(allClinics);
        renderTodoList();
    }
});