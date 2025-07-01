document.addEventListener('DOMContentLoaded', () => {
    // 앱 전역에서 사용되는 변수 및 함수
    const auth = firebase.auth();
    const db = firebase.firestore();
    const authView = document.getElementById('auth-view');
    const appContainer = document.getElementById('app-container');
    let appInitialized = false;
    let toastTimer;

    function showToast(message, duration = 3000) {
        const toast = document.getElementById('toast-notification');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // [수정] 지도 API 로딩 함수의 타이밍 문제를 완전히 해결한 최종 버전
    function loadNaverMapsApi() {
        // 'Service' 모듈이 준비될 때까지 확실히 기다리는 로직
        const checkReady = (resolve) => {
            const interval = setInterval(() => {
                if (window.naver && window.naver.maps && window.naver.maps.Service) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        };

        return new Promise((resolve, reject) => {
            // 이미 완전히 로드된 경우
            if (window.naver && window.naver.maps && window.naver.maps.Service) {
                return resolve();
            }

            const existingScript = document.querySelector('script[src*="ncpKeyId=d7528qc21z"]');

            // 스크립트 태그는 있지만 아직 준비가 안 된 경우 -> 준비될 때까지 기다림
            if (existingScript) {
                return checkReady(resolve);
            }

            // 스크립트 태그가 없는 경우 -> 새로 만들고, 로드 후 준비될 때까지 기다림
            const mapScript = document.createElement('script');
            mapScript.type = 'text/javascript';
            mapScript.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=d7528qc21z&submodules=services`;
            mapScript.onerror = reject;
            
            // onload가 발생하면, 즉시 resolve하지 않고 준비될 때까지 기다리는 checkReady를 호출
            mapScript.onload = () => {
                checkReady(resolve);
            };

            document.head.appendChild(mapScript);
        });
    }

    auth.onAuthStateChanged(user => {
        const isUserLoggedIn = !!user;
        authView.classList.toggle('hidden', isUserLoggedIn);
        appContainer.classList.toggle('hidden', !isUserLoggedIn);

        if (isUserLoggedIn && !appInitialized) {
            initializeApp(user);
            appInitialized = true;
        } else if (!isUserLoggedIn) {
            appInitialized = false;
        }
    });

    function setupLoginEvents() {
        const loginBtn = document.getElementById('login-btn');
        if (!loginBtn) return;
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            if (!email || !password) return showToast('이메일과 비밀번호를 모두 입력해주세요.');
            
            auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
                .then(() => auth.signInWithEmailAndPassword(email, password))
                .catch(error => showToast(`로그인 오류: ${error.code}`));
        });
    }

    setupLoginEvents();

    async function initializeApp(user) {
        const ctx = {
            clinicsCollection: db.collection('users').doc(user.uid).collection('clinics'),
            todosCollection: db.collection('users').doc(user.uid).collection('todos'),
            userEmailSpan: document.getElementById('user-email'),
            logoutBtn: document.getElementById('logout-btn'),
            addClinicBtn: document.getElementById('add-clinic-btn'),
            totalClinicCountSpan: document.getElementById('total-clinic-count'),
            dashboardView: document.getElementById('dashboard-view'),
            listView: document.getElementById('list-view'),
            detailView: document.getElementById('detail-view'),
            modal: document.getElementById('clinic-modal'),
            modalTitle: document.getElementById('modal-title'),
            closeModalBtn: document.querySelector('.modal .close-btn'),
            clinicForm: document.getElementById('clinic-form'),
            searchAddressBtn: document.getElementById('search-address-btn'),
            backToListBtn: document.getElementById('back-to-list-btn'),
            editClinicBtn: document.getElementById('edit-clinic-btn'),
            deleteClinicBtn: document.getElementById('delete-clinic-btn'),
            saveMemoBtn: document.getElementById('save-memo-btn'),
            searchStageSelect: document.getElementById('search-stage'),
            searchDepartmentSelect: document.getElementById('search-department'),
            searchNameInput: document.getElementById('search-name'),
            autocompleteResults: document.getElementById('autocomplete-results'),
            todoListContainer: document.getElementById('todo-list'),
            totalTodoCountSpan: document.getElementById('total-todo-count'),
            filterButtons: document.getElementById('todo-filter-buttons'),
            addTodoBtn: document.getElementById('add-todo-btn'),
            todoPaginationContainer: document.getElementById('todo-pagination'),
            loadMoreBtn: document.getElementById('load-more-clinics-btn'),
            loadMoreContainer: document.getElementById('load-more-container'),
            allClinics: [],
            allTodos: [],
            currentClinicId: null,
            currentTodoFilter: 'all',
            currentTodoPage: 1,
            TODO_PAGE_SIZE: 5,
            lastVisibleClinic: null,
            isLoadingClinics: false,
            CLINIC_PAGE_SIZE: 20,
            totalClinicsInDB: 0,
        };

        ctx.userEmailSpan.textContent = user.email;
        setupEventListeners(ctx);
        setupDashboardUI(ctx);
        populateFilters();
        await fetchInitialData(ctx);
    }

    function setupEventListeners(ctx) {
        ctx.logoutBtn.addEventListener('click', () => auth.signOut());
        ctx.addClinicBtn.addEventListener('click', () => showClinicModal(ctx));
        ctx.searchStageSelect.addEventListener('change', () => filterAndDisplay(ctx));
        ctx.searchDepartmentSelect.addEventListener('change', () => filterAndDisplay(ctx));
        ctx.searchNameInput.addEventListener('input', debounce(() => handleAutocomplete(ctx), 300));
        ctx.loadMoreBtn.addEventListener('click', () => fetchClinics(ctx, false));
        ctx.closeModalBtn.addEventListener('click', () => ctx.modal.classList.add('hidden'));
        ctx.modal.addEventListener('click', (e) => { if (e.target === ctx.modal) e.target.classList.add('hidden'); });
        ctx.clinicForm.addEventListener('submit', (e) => handleClinicFormSubmit(e, ctx));
        ctx.searchAddressBtn.addEventListener('click', execDaumPostcode);
        ctx.backToListBtn.addEventListener('click', () => showListView(ctx));
        ctx.editClinicBtn.addEventListener('click', () => handleEditClinic(ctx));
        ctx.deleteClinicBtn.addEventListener('click', () => handleDeleteClinic(ctx));
        ctx.saveMemoBtn.addEventListener('click', () => handleSaveMemo(ctx));
        ctx.addTodoBtn.addEventListener('click', () => handleAddTodo(ctx));
        ctx.todoListContainer.addEventListener('click', (e) => handleTodoListClick(e, ctx));
        ctx.filterButtons.addEventListener('click', (e) => handleTodoFilterClick(e, ctx));
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-input-wrapper')) ctx.autocompleteResults.classList.add('hidden');
        });
    }

    async function fetchInitialData(ctx) {
        await fetchClinics(ctx, true);
        const todoSnapshot = await ctx.todosCollection.orderBy('createdAt', 'desc').get();
        ctx.allTodos = todoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTodoList(ctx);
    }

    async function fetchClinics(ctx, isInitialLoad = false) {
        if (ctx.isLoadingClinics) return;
        ctx.isLoadingClinics = true;
        ctx.loadMoreBtn.textContent = '불러오는 중...';

        let query = ctx.clinicsCollection.orderBy('updatedAt', 'desc').limit(ctx.CLINIC_PAGE_SIZE);
        if (isInitialLoad) {
            const countSnapshot = await ctx.clinicsCollection.get();
            ctx.totalClinicsInDB = countSnapshot.size;
        } else if (ctx.lastVisibleClinic) {
            query = query.startAfter(ctx.lastVisibleClinic);
        }

        try {
            const snapshot = await query.get();
            const newClinics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            ctx.allClinics = isInitialLoad ? newClinics : [...ctx.allClinics, ...newClinics];
            ctx.lastVisibleClinic = snapshot.docs[snapshot.docs.length - 1];
            
            filterAndDisplay(ctx);

            if (!ctx.lastVisibleClinic || ctx.allClinics.length >= ctx.totalClinicsInDB) {
                ctx.loadMoreContainer.classList.add('hidden');
            } else {
                ctx.loadMoreContainer.classList.remove('hidden');
            }
        } catch (error) {
            console.error("의원 정보 로딩 중 오류:", error);
            showToast('의원 정보를 불러오는 데 실패했습니다.');
        } finally {
            ctx.isLoadingClinics = false;
            ctx.loadMoreBtn.textContent = '더 많은 의원 보기';
        }
    }

    function filterAndDisplay(ctx) {
        const stage = ctx.searchStageSelect.value;
        const department = ctx.searchDepartmentSelect.value;
        const name = ctx.searchNameInput.value.toLowerCase();
        
        let filtered = ctx.allClinics;
        if (stage) filtered = filtered.filter(c => c.stage === stage);
        if (department) filtered = filtered.filter(c => c.department === department);
        if (name) filtered = filtered.filter(c => c.name.toLowerCase().includes(name));
        
        renderDashboard(ctx, filtered);
        
        const isFiltering = name || stage || department;
        const hasMoreData = ctx.lastVisibleClinic && ctx.allClinics.length < ctx.totalClinicsInDB;
        ctx.loadMoreContainer.classList.toggle('hidden', isFiltering || !hasMoreData);

        return filtered;
    }

    function handleAutocomplete(ctx) {
        const name = ctx.searchNameInput.value.toLowerCase();
        ctx.autocompleteResults.innerHTML = '';
        if (name.length === 0) {
            ctx.autocompleteResults.classList.add('hidden');
            filterAndDisplay(ctx);
            return;
        }

        const filtered = filterAndDisplay(ctx);
        if (filtered.length > 0) {
            ctx.autocompleteResults.classList.remove('hidden');
            filtered.slice(0, 7).forEach(clinic => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.innerHTML = `${clinic.name} <small>${clinic.department}, ${clinic.stage}</small>`;
                item.addEventListener('click', () => {
                    showDetailView(ctx, clinic.id);
                    ctx.searchNameInput.value = '';
                    ctx.autocompleteResults.classList.add('hidden');
                });
                ctx.autocompleteResults.appendChild(item);
            });
        } else {
            ctx.autocompleteResults.classList.add('hidden');
        }
    }

    function setupDashboardUI(ctx) {
        ctx.dashboardView.innerHTML = '';
        const stages = [ { name: '인지', id: 'awareness' }, { name: '관심', id: 'interest' }, { name: '고려', id: 'consideration' }, { name: '구매', id: 'purchase' } ];
        stages.forEach(stageInfo => {
            const column = document.createElement('div');
            column.className = `stage-column stage-${stageInfo.id}`;
            column.innerHTML = `
                <h2 data-stage-name="${stageInfo.name}">
                    <span></span>
                    <button class="toggle-expand-btn"></button>
                </h2>
                <div class="clinic-cards-container" data-stage="${stageInfo.name}"></div>
            `;
            ctx.dashboardView.appendChild(column);
            
            column.querySelector('.toggle-expand-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const container = e.target.closest('.stage-column').querySelector('.clinic-cards-container');
                container.classList.toggle('expanded');
                e.target.textContent = container.classList.contains('expanded') ? '간단히 보기 ▲' : '더보기 ▼';
            });

            new Sortable(column.querySelector('.clinic-cards-container'), {
                group: 'shared', animation: 150, ghostClass: 'sortable-ghost',
                onEnd: async (evt) => {
                    await ctx.clinicsCollection.doc(evt.item.dataset.id).update({
                        stage: evt.to.dataset.stage,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    await fetchClinics(ctx, true);
                }
            });
        });
    }

    function renderDashboard(ctx, clinicsToRender) {
        ctx.totalClinicCountSpan.textContent = `(총 ${ctx.totalClinicsInDB}곳)`;
        
        document.querySelectorAll('.stage-column h2').forEach(header => {
            const stageName = header.dataset.stageName;
            const stageClinics = clinicsToRender.filter(c => c.stage === stageName);
            header.querySelector('span').textContent = `${stageName} (${stageClinics.length}곳)`;
            
            const column = header.closest('.stage-column');
            const toggleBtn = column.querySelector('.toggle-expand-btn');
            const cardsContainer = column.querySelector('.clinic-cards-container');
            const shouldShowToggle = stageClinics.length > 5;
            
            toggleBtn.classList.toggle('hidden', !shouldShowToggle);
            if(shouldShowToggle) {
                 toggleBtn.textContent = cardsContainer.classList.contains('expanded') ? '간단히 보기 ▲' : '더보기 ▼';
            }
            cardsContainer.classList.toggle('no-scroll', !shouldShowToggle);
            if(!shouldShowToggle) cardsContainer.classList.remove('expanded');
        });
        
        document.querySelectorAll('.clinic-cards-container').forEach(c => c.innerHTML = '');
        clinicsToRender.forEach(clinic => {
            const container = document.querySelector(`.clinic-cards-container[data-stage="${clinic.stage}"]`);
            if(container) {
                const card = document.createElement('div');
                card.className = 'clinic-card';
                card.dataset.id = clinic.id;
                card.innerHTML = `<h3>${clinic.name}</h3><p>${clinic.address.split(',')[0]}</p>`;
                card.addEventListener('click', () => showDetailView(ctx, clinic.id));
                container.appendChild(card);
            }
        });
        
        renderStatistics(ctx.allClinics);
    }

    function renderStatistics(clinics) {
        const charts = {
            department: { el: document.getElementById('department-chart'), type: 'doughnut', data: {}, options: { responsive: true, maintainAspectRatio: false } },
            scale: { el: document.getElementById('scale-chart'), type: 'bar', data: {}, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } },
            stage: { el: document.getElementById('stage-chart'), type: 'bar', data: {}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, min: 0, ticks: { precision: 0 } } } } }
        };

        Object.values(charts).forEach(chart => {
            if (!chart.el) return;
            const existingChart = Chart.getChart(chart.el);
            if (existingChart) existingChart.destroy();
        });
        
        const departmentData = clinics.reduce((acc, c) => { acc[c.department||'미지정'] = (acc[c.department||'미지정'] || 0) + 1; return acc; }, {});
        charts.department.data = { labels: Object.keys(departmentData), datasets: [{ data: Object.values(departmentData), backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69'] }]};

        const scaleOrder = ['0~5명', '6~10명', '11~15명', '16명이상'];
        const scaleCounts = scaleOrder.map(scale => clinics.filter(c => c.scale === scale).length);
        charts.scale.data = { labels: scaleOrder, datasets: [{ label: '의원 수', data: scaleCounts, backgroundColor: '#4e73df' }]};

        const stageOrder = ['인지', '관심', '고려', '구매'];
        const stageCounts = stageOrder.map(stage => clinics.filter(c => c.stage === stage).length);
        charts.stage.data = { labels: stageOrder, datasets: [{ label: '의원 수', data: stageCounts, backgroundColor: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd'] }]};
        
        Object.values(charts).forEach(c => new Chart(c.el, { type: c.type, data: c.data, options: c.options }));
    }

    async function showDetailView(ctx, id) {
        let clinic = ctx.allClinics.find(c => c.id === id);
        if (!clinic) {
            const doc = await ctx.clinicsCollection.doc(id).get();
            if (!doc.exists) return showToast('해당 의원 정보를 찾을 수 없습니다.');
            clinic = { id: doc.id, ...doc.data() };
        }

        ctx.currentClinicId = id;
        document.getElementById('detail-clinic-name').textContent = clinic.name;
        document.getElementById('detail-address').textContent = clinic.address;
        document.getElementById('detail-manager').textContent = clinic.manager || '-';
        document.getElementById('detail-contact').textContent = clinic.contact || '-';
        document.getElementById('detail-stage').textContent = clinic.stage;
        document.getElementById('detail-department').textContent = clinic.department || '-';
        document.getElementById('detail-scale').textContent = clinic.scale || '-';
        document.getElementById('detail-notes').textContent = clinic.notes || '-';
        document.getElementById('detail-updated').textContent = (clinic.updatedAt?.toDate) ? new Date(clinic.updatedAt.toDate()).toLocaleString() : '정보 없음';
        document.getElementById('memo-history').value = clinic.memo || '';
        
        ctx.listView.classList.add('hidden');
        ctx.detailView.classList.remove('hidden');
        
        try {
            await loadNaverMapsApi();
            drawMap(clinic.address, clinic.name);
        } catch (error) {
            console.error("Naver Maps API 로딩 실패:", error);
            showToast("지도 API 로딩에 실패했습니다.");
        }
    }

    function showListView(ctx) {
        ctx.currentClinicId = null;
        ctx.detailView.classList.add('hidden');
        ctx.listView.classList.remove('hidden');
        filterAndDisplay(ctx);
    }

    function showClinicModal(ctx, clinic = null) {
        ctx.clinicForm.reset();
        if (clinic) {
            ctx.modalTitle.textContent = '의원 정보 수정';
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
        } else {
            ctx.modalTitle.textContent = '의원 정보 입력';
            document.getElementById('clinic-id').value = '';
        }
        ctx.modal.classList.remove('hidden');
    }

    function drawMap(address, name) {
        if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
            console.error("Naver Maps API or its Service module is not loaded.");
            showToast("지도 모듈 로딩에 실패했습니다. 잠시 후 다시 시도해주세요.");
            return;
        }
        const mapElement = document.getElementById('map');
        mapElement.innerHTML = ''; 
        naver.maps.Service.geocode({ query: address }, (status, response) => {
            if (status !== naver.maps.Service.Status.OK || !response.v2.addresses?.length) {
                mapElement.innerHTML = '<div style="text-align:center; padding:20px; color:#dc3545;">주소의 좌표를 찾을 수 없습니다.</div>';
                return;
            }
            const point = new naver.maps.Point(response.v2.addresses[0].x, response.v2.addresses[0].y);
            const map = new naver.maps.Map(mapElement, { center: point, zoom: 16 });
            new naver.maps.Marker({ position: point, map: map, title: name });
        });
    }

    function execDaumPostcode() {
        new daum.Postcode({
            oncomplete: (data) => {
                document.getElementById('clinic-address').value = data.roadAddress;
                document.getElementById("clinic-address-detail").focus();
            }
        }).open();
    }

    function populateFilters() {
        const searchStageSelect = document.getElementById('search-stage');
        const searchDepartmentSelect = document.getElementById('search-department');
        searchStageSelect.innerHTML = '<option value="">-- 단계 전체 --</option>';
        searchDepartmentSelect.innerHTML = '<option value="">-- 진료과 전체 --</option>';
        const stages = ['인지', '관심', '고려', '구매'];
        const departments = ['피부과', '가정의학과', '내과', '정형외과', '치과', '한의원', '정신병원'];
        stages.forEach(stage => {
            searchStageSelect.innerHTML += `<option value="${stage}">${stage}</option>`;
        });
        departments.forEach(dept => {
            searchDepartmentSelect.innerHTML += `<option value="${dept}">${dept}</option>`;
        });
    }

    async function handleClinicFormSubmit(e, ctx) {
        e.preventDefault();
        const clinicId = document.getElementById('clinic-id').value;
        const clinicPayload = {
            name: document.getElementById('clinic-name').value,
            address: `${document.getElementById('clinic-address').value}, ${document.getElementById('clinic-address-detail').value}`,
            manager: document.getElementById('clinic-manager').value,
            contact: document.getElementById('clinic-contact').value,
            department: document.getElementById('clinic-department').value,
            scale: document.getElementById('clinic-scale').value,
            notes: document.getElementById('clinic-notes').value,
            stage: document.getElementById('clinic-stage').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (clinicId) {
            await ctx.clinicsCollection.doc(clinicId).update(clinicPayload);
            showToast('의원 정보가 수정되었습니다.');
        } else {
            await ctx.clinicsCollection.add({ ...clinicPayload, memo: '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            showToast('새로운 의원을 추가했습니다.');
        }
        
        ctx.modal.classList.add('hidden');
        await fetchClinics(ctx, true);
        if(!ctx.detailView.classList.contains('hidden') && clinicId) await showDetailView(ctx, clinicId);
    }
    
    async function handleEditClinic(ctx) {
        if (!ctx.currentClinicId) return;
        const doc = await ctx.clinicsCollection.doc(ctx.currentClinicId).get();
        if (doc.exists) {
            showClinicModal(ctx, { id: doc.id, ...doc.data() });
        }
    }
        
    async function handleDeleteClinic(ctx) {
        if (!ctx.currentClinicId || !confirm('정말 이 의원 정보를 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다.)')) return;
        await ctx.clinicsCollection.doc(ctx.currentClinicId).delete();
        showToast('의원 정보가 삭제되었습니다.');
        await fetchClinics(ctx, true);
        showListView(ctx);
    }
    
    async function handleSaveMemo(ctx) {
        if (!ctx.currentClinicId) return;
        await ctx.clinicsCollection.doc(ctx.currentClinicId).update({ 
            memo: document.getElementById('memo-history').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
        });
        showToast('메모가 저장되었습니다.');
        await fetchClinics(ctx, true);
    }
    
    function renderTodoList(ctx) {
        if (!ctx.todoListContainer) return;
        ctx.todoListContainer.innerHTML = '';
        const filteredTodos = ctx.allTodos.filter(todo => {
            if (ctx.currentTodoFilter === 'all') return true;
            return ctx.currentTodoFilter === 'complete' ? todo.isComplete : !todo.isComplete;
        });
    
        ctx.totalTodoCountSpan.textContent = `(총 ${filteredTodos.length}개)`;
        const totalPages = Math.ceil(filteredTodos.length / ctx.TODO_PAGE_SIZE);
        if (ctx.currentTodoPage > totalPages) ctx.currentTodoPage = totalPages || 1;
        
        const startIndex = (ctx.currentTodoPage - 1) * ctx.TODO_PAGE_SIZE;
        const endIndex = startIndex + ctx.TODO_PAGE_SIZE;
        const todosForCurrentPage = filteredTodos.slice(startIndex, endIndex);
    
        if (todosForCurrentPage.length === 0 && ctx.currentTodoPage === 1) {
            ctx.todoListContainer.innerHTML = '<p style="text-align:center; color:#888; padding: 20px 0;">표시할 일정이 없습니다.</p>';
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            todosForCurrentPage.forEach(todo => {
                const todoItem = document.createElement('div');
                todoItem.className = `todo-item ${todo.isComplete ? 'completed' : ''}`;
                todoItem.dataset.id = todo.id;
                
                let dateText = '', dateClass = '';
                if (todo.isComplete && todo.completedAt) {
                    dateText = `✅ ${new Date(todo.completedAt.toDate()).toLocaleDateString()} 완료`;
                    dateClass = 'completed';
                } else {
                    const dueDate = new Date(todo.dueDate);
                    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) { dateText = `D+${Math.abs(diffDays)}`; dateClass = 'overdue'; }
                    else if (diffDays === 0) { dateText = 'D-Day'; }
                    else { dateText = `D-${diffDays}`; }
                }
    
                todoItem.innerHTML = `
                    <div class="todo-content">${todo.content}</div>
                    <div class="todo-due-date ${dateClass}">${dateText}</div>
                    <div class="todo-actions">
                        <button class="todo-complete-btn" title="완료">${todo.isComplete ? '↩️' : '✔️'}</button>
                        <button class="todo-delete-btn" title="삭제">🗑️</button>
                    </div>`;
                ctx.todoListContainer.appendChild(todoItem);
            });
        }
        renderTodoPagination(ctx, totalPages);
    }

    function renderTodoPagination(ctx, totalPages) {
        ctx.todoPaginationContainer.innerHTML = '';
        if (totalPages <= 1) return;
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'pagination-btn';
            pageBtn.textContent = i;
            if (i === ctx.currentTodoPage) pageBtn.classList.add('active');
            pageBtn.addEventListener('click', () => {
                ctx.currentTodoPage = i;
                renderTodoList(ctx);
            });
            ctx.todoPaginationContainer.appendChild(pageBtn);
        }
    }
    
    function handleAddTodo(ctx) {
        if (document.querySelector('.todo-add-form')) return;
        const formItem = document.createElement('div');
        formItem.className = 'todo-item todo-add-form';
        formItem.innerHTML = `
            <input type="text" id="new-todo-content" placeholder="새로운 할 일 내용 입력" required>
            <input type="date" id="new-todo-due-date" required>
            <div class="todo-actions" style="opacity:1;">
                <button id="save-new-todo-btn">저장</button>
            </div>`;
        ctx.todoListContainer.prepend(formItem);
        document.getElementById('new-todo-content').focus();
    }

    async function handleTodoListClick(e, ctx) {
        const target = e.target;
        if (target.id === 'save-new-todo-btn') {
            await handleSaveNewTodo(ctx);
        } else {
            const todoItem = target.closest('.todo-item');
            if (!todoItem || !todoItem.dataset.id) return;
            const todoId = todoItem.dataset.id;
            if (target.closest('.todo-complete-btn')) {
                await handleToggleTodoComplete(ctx, todoId);
            } else if (target.closest('.todo-delete-btn')) {
                await handleDeleteTodo(ctx, todoId);
            }
        }
    }

    async function handleSaveNewTodo(ctx) {
        const contentInput = document.getElementById('new-todo-content');
        const dueDateInput = document.getElementById('new-todo-due-date');
        const content = contentInput.value;
        const dueDate = dueDateInput.value;
    
        if (!content || !dueDate) return showToast('내용과 완료예정일을 모두 입력해주세요.');
        
        const newTodo = {
            content,
            dueDate,
            isComplete: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const docRef = await ctx.todosCollection.add(newTodo);
        ctx.allTodos.unshift({ id: docRef.id, ...newTodo, createdAt: firebase.firestore.Timestamp.now() });
        renderTodoList(ctx);
        showToast('새로운 일정이 등록되었습니다.');
    }

    async function handleToggleTodoComplete(ctx, todoId) {
        const todo = ctx.allTodos.find(t => t.id === todoId);
        if (!todo) return;
    
        const newIsComplete = !todo.isComplete;
        const updatePayload = { isComplete: newIsComplete };
        if (newIsComplete) {
            updatePayload.completedAt = firebase.firestore.FieldValue.serverTimestamp();
        } else {
            updatePayload.completedAt = firebase.firestore.FieldValue.delete();
        }
    
        await ctx.todosCollection.doc(todoId).update(updatePayload);
        todo.isComplete = newIsComplete;
        if(newIsComplete) todo.completedAt = firebase.firestore.Timestamp.now();
        else delete todo.completedAt;
        
        renderTodoList(ctx);
    }
        
    async function handleDeleteTodo(ctx, todoId) {
        if (confirm('정말 이 일정을 삭제하시겠습니까?')) {
            await ctx.todosCollection.doc(todoId).delete();
            ctx.allTodos = ctx.allTodos.filter(t => t.id !== todoId);
            renderTodoList(ctx);
            showToast('일정이 삭제되었습니다.');
        }
    }

    function handleTodoFilterClick(e, ctx) {
        if (e.target.tagName === 'BUTTON') {
            ctx.currentTodoFilter = e.target.dataset.filter;
            ctx.currentTodoPage = 1;
            ctx.filterButtons.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderTodoList(ctx);
        }
    }
});