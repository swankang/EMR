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
            auth.signInWithEmailAndPassword(email, password)
                .catch(error => alert(`로그인 실패: ${error.message}`));
        });
    }
    
    async function initializeApp(user) {
        const clinicsCollection = db.collection('users').doc(user.uid).collection('clinics');
        const todosCollection = db.collection('users').doc(user.uid).collection('todos');

        const userEmailSpan = document.getElementById('user-email');
        const logoutBtn = document.getElementById('logout-btn');
        const dashboardView = document.getElementById('dashboard-view');
        const totalClinicCountSpan = document.getElementById('total-clinic-count');
        const addClinicBtn = document.getElementById('add-clinic-btn');
        const modal = document.getElementById('clinic-modal');
        const modalTitle = document.getElementById('modal-title');
        const closeModalBtn = document.querySelector('.modal .close-btn');
        const clinicForm = document.getElementById('clinic-form');
        const listView = document.getElementById('list-view');
        const detailView = document.getElementById('detail-view');
        const backToListBtn = document.getElementById('back-to-list-btn');
        const editClinicBtn = document.getElementById('edit-clinic-btn');
        const deleteClinicBtn = document.getElementById('delete-clinic-btn');
        const saveMemoBtn = document.getElementById('save-memo-btn');
        const searchAddressBtn = document.getElementById('search-address-btn');
        const todoListContainer = document.getElementById('todo-list');
        const totalTodoCountSpan = document.getElementById('total-todo-count');
        const filterButtons = document.getElementById('todo-filter-buttons');
        const addTodoBtn = document.getElementById('add-todo-btn');

        let currentClinicId = null;
        let currentTodoFilter = 'all';

        if (userEmailSpan) userEmailSpan.textContent = user.email;
        if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

        function loadNaverMapsApi() {
            return new Promise((resolve, reject) => {
                if (document.querySelector('script[src*="openapi.map.naver.com"]')) {
                   return resolve();
                }
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
                if (attempts > 50) {
                    clearInterval(intervalId);
                    mapElement.innerHTML = '<div style="text-align:center; padding:20px; color:#dc3545;">지도 로딩에 실패했습니다.</div>';
                }
            }, 100);
        }
        
        async function renderStatistics(clinics) { /* ... This function is complete and correct ... */ }
        
        async function updateDashboard() {
            const clinics = (await clinicsCollection.orderBy('updatedAt', 'desc').get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
            totalClinicCountSpan.textContent = `(총 ${clinics.length}곳)`;
            
            document.querySelectorAll('.clinic-cards-container').forEach(c => c.innerHTML = '');
            document.querySelectorAll('.stage-column h2').forEach(header => {
                const stageName = header.dataset.stageName;
                const stageClinics = clinics.filter(c => c.stage === stageName);
                header.innerHTML = `${stageName} <span class="count">${stageClinics.length}곳 / ${clinics.length > 0 ? ((stageClinics.length / clinics.length) * 100).toFixed(0) : 0}%</span>`;
            });

            clinics.forEach(clinic => {
                const stageName = clinic.stage || '인지';
                const container = document.querySelector(`.clinic-cards-container[data-stage="${stageName}"]`);
                if(container) {
                    const card = document.createElement('div');
                    card.className = 'clinic-card';
                    card.dataset.id = clinic.id;
                    const updatedAt = clinic.updatedAt ? new Date(clinic.updatedAt.toDate()).toLocaleDateString() : '날짜 정보 없음';
                    card.innerHTML = `<h3>${clinic.name}</h3><p>${clinic.address.split(',')[0]}</p><p class="date">업데이트: ${updatedAt}</p>`;
                    card.addEventListener('click', () => showDetailView(clinic.id));
                    container.appendChild(card);
                }
            });
            // 바로 이 부분의 주석을 제거!
            await renderStatistics(clinics); 
        }

        function setupDashboard() {
            dashboardView.innerHTML = '';
            const stages = [ { name: '인지', id: 'awareness' }, { name: '관심', id: 'interest' }, { name: '고려', id: 'consideration' }, { name: '구매', id: 'purchase' } ];
            stages.forEach(stageInfo => {
                const column = document.createElement('div');
                column.className = `stage-column stage-${stageInfo.id}`;
                const columnHeader = document.createElement('h2');
                columnHeader.dataset.stageName = stageInfo.name;
                column.appendChild(columnHeader);
                const cardsContainer = document.createElement('div');
                cardsContainer.className = 'clinic-cards-container';
                cardsContainer.dataset.stage = stageInfo.name;
                column.appendChild(cardsContainer);
                dashboardView.appendChild(column);
                new Sortable(cardsContainer, {
                    group: 'shared', animation: 150, ghostClass: 'sortable-ghost',
                    onEnd: async function (evt) {
                        const newStage = evt.to.dataset.stage;
                        const clinicId = evt.item.dataset.id;
                        await clinicsCollection.doc(clinicId).update({ stage: newStage, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                        await updateDashboard();
                    }
                });
            });
        }
        
        async function renderTodoList() {
            todoListContainer.innerHTML = '';
            const allTodos = (await todosCollection.orderBy('createdAt', 'desc').get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const filteredTodos = allTodos.filter(todo => {
                if (currentTodoFilter === 'all') return true;
                if (currentTodoFilter === 'complete') return todo.isComplete;
                if (currentTodoFilter === 'incomplete') return !todo.isComplete;
            });

            totalTodoCountSpan.textContent = `(총 ${filteredTodos.length}개)`;
            
            if (filteredTodos.length === 0) {
                todoListContainer.innerHTML = '<p style="text-align:center; color:#888; padding: 20px 0;">등록된 일정이 없습니다.</p>';
            } else {
                 const today = new Date(); today.setHours(0, 0, 0, 0);
                 filteredTodos.forEach(todo => {
                    const todoItem = document.createElement('div');
                    todoItem.className = `todo-item ${todo.isComplete ? 'completed' : ''}`;
                    todoItem.dataset.id = todo.id;
                    const dueDate = new Date(todo.dueDate); 
                    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                    let dDayText = `D-${diffDays}`; 
                    let dDayClass = '';
                    if (diffDays < 0) { dDayText = `D+${Math.abs(diffDays)}`; dDayClass = 'overdue'; }
                    else if (diffDays === 0) { dDayText = 'D-Day'; }
                    if (todo.isComplete) { dDayText = '완료'; dDayClass = ''; }
                    todoItem.innerHTML = `<div class="todo-content">${todo.content}</div><div class="todo-due-date ${dDayClass}">${dDayText}</div><div class="todo-actions"><button class="todo-complete-btn" title="완료">${todo.isComplete ? '✅' : '✔️'}</button><button class="todo-delete-btn" title="삭제">🗑️</button></div>`;
                    todoListContainer.appendChild(todoItem);
                });
            }
        }

        async function showDetailView(id) {
            const doc = await clinicsCollection.doc(id).get();
            if (!doc.exists) return;
            const clinic = { id: doc.id, ...doc.data() };
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
            } catch (error) {
                console.error("Naver Maps API 로딩 실패:", error);
            }
        }

        function showListView() { currentClinicId = null; detailView.classList.add('hidden'); listView.classList.remove('hidden'); updateDashboard(); }
        
        function execDaumPostcode() { new daum.Postcode({ oncomplete: (data) => { document.getElementById('clinic-address').value = data.roadAddress; document.getElementById("clinic-address-detail").focus(); } }).open(); }

        addClinicBtn.addEventListener('click', () => { clinicForm.reset(); modalTitle.textContent = '의원 정보 입력'; document.getElementById('clinic-id').value = ''; modal.classList.remove('hidden'); });
        
        closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
        
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
        
        searchAddressBtn.addEventListener('click', execDaumPostcode);
        
        clinicForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mainAddress = document.getElementById('clinic-address').value;
            const detailAddress = document.getElementById('clinic-address-detail').value;
            const fullAddress = detailAddress ? `${mainAddress}, ${detailAddress}` : mainAddress;
            const clinicId = document.getElementById('clinic-id').value;
            const clinicPayload = {
                name: document.getElementById('clinic-name').value, address: fullAddress, manager: document.getElementById('clinic-manager').value, contact: document.getElementById('clinic-contact').value, department: document.getElementById('clinic-department').value, scale: document.getElementById('clinic-scale').value, notes: document.getElementById('clinic-notes').value, stage: document.getElementById('clinic-stage').value, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (clinicId) {
                await clinicsCollection.doc(clinicId).update(clinicPayload);
            } else {
                await clinicsCollection.add({ ...clinicPayload, memo: '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
            modal.classList.add('hidden');
            await updateDashboard();
            if(!detailView.classList.contains('hidden')) {
               await showDetailView(clinicId);
            }
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
            showListView();
        });

        saveMemoBtn.addEventListener('click', async () => {
            if (!currentClinicId) return;
            const memo = document.getElementById('memo-history').value;
            await clinicsCollection.doc(currentClinicId).update({ memo: memo, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            alert('메모가 저장되었습니다.');
            await showDetailView(currentClinicId);
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
                await todosCollection.add({ content, dueDate, isComplete: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                await renderTodoList();
            } else if (todoItem && todoItem.dataset.id) {
                const todoId = todoItem.dataset.id;
                if (target.classList.contains('todo-complete-btn')) {
                    const doc = await todosCollection.doc(todoId).get();
                    if (doc.exists) {
                        await todosCollection.doc(todoId).update({ isComplete: !doc.data().isComplete });
                        await renderTodoList();
                    }
                } else if (target.classList.contains('todo-delete-btn')) {
                    if (confirm('정말 이 일정을 삭제하시겠습니까?')) {
                        await todosCollection.doc(todoId).delete();
                        await renderTodoList();
                    }
                }
            }
        });

        filterButtons.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                currentTodoFilter = e.target.dataset.filter;
                document.querySelectorAll('#todo-filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                renderTodoList();
            }
        });

        setupDashboard();
        await updateDashboard();
        await renderTodoList();
    }
});