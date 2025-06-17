document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- 기본 DOM 요소 ---
    const authView = document.getElementById('auth-view');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');
    
    let appInitialized = false;

    // --- 핵심! 인증 상태 감지 로직 ---
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

    // --- 인증 이벤트 핸들러 ---
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            if (!email || !password) return alert('이메일과 비밀번호를 모두 입력해주세요.');
            auth.signInWithEmailAndPassword(email, password)
                .catch(error => alert(`로그인 실패: ${error.message}`));
        });
    }
    
    // ===============================================================
    //   ▼▼▼ 로그인 후 앱의 모든 기능은 이 함수 안에서 동작 ▼▼▼
    // ===============================================================
    async function initializeApp(user) {
        // --- Firebase 컬렉션 ---
        const clinicsCollection = db.collection('users').doc(user.uid).collection('clinics');
        const todosCollection = db.collection('users').doc(user.uid).collection('todos');

        // --- 전역 DOM 요소 ---
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
        const postcodeModal = document.getElementById('postcode-modal');
        const postcodeCloseBtn = document.getElementById('postcode-close-btn');
        const todoListContainer = document.getElementById('todo-list');
        const totalTodoCountSpan = document.getElementById('total-todo-count');
        const filterButtons = document.getElementById('todo-filter-buttons');
        const addTodoBtn = document.getElementById('add-todo-btn');

        // --- 전역 변수 ---
        let departmentChart, scaleChart, stageChart;
        let currentClinicId = null;
        let currentTodoFilter = 'all';
        let naverMapsApiLoaded = false;

        // --- 사용자 정보 및 로그아웃 ---
        if (userEmailSpan) userEmailSpan.textContent = user.email;
        if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

        // --- 네이버 지도 API 동적 로딩 ---
            function loadNaverMapsApi() {
            return new Promise((resolve, reject) => {
                // 스크립트 태그가 이미 존재하면, 로딩 중이거나 완료된 것으로 간주하고 성공 처리
                if (document.querySelector('script[src*="openapi.map.naver.com"]')) {
                   return resolve();
                }
                const mapScript = document.createElement('script');
                mapScript.type = 'text/javascript';
                mapScript.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=d7528qc21z&submodules=geocoder`;
                mapScript.onload = resolve; // 스크립트 파일 다운로드 완료 시 성공
                mapScript.onerror = reject; // 스크립트 다운로드 실패 시 거부
                document.head.appendChild(mapScript);
            });
        }
        
        // --- 지도 그리기 ---
        function drawMap(address, name) {
            const mapElement = document.getElementById('map');
            if (!mapElement || !address) return;
            mapElement.innerHTML = ''; // 이전 지도/에러 메시지 초기화

            let attempts = 0;
            const intervalId = setInterval(() => {
                // 주소 변환(Service) 기능이 준비되었는지 직접 확인
                if (window.naver && window.naver.maps && window.naver.maps.Service) {
                    clearInterval(intervalId); // 확인 완료, 반복 중단

                    // 이제 안전하게 주소 변환 및 지도 생성 실행
                    naver.maps.Service.geocode({ query: address }, (status, response) => {
                        if (status !== naver.maps.Service.Status.OK || !response.v2.addresses || response.v2.addresses.length === 0) {
                            mapElement.innerHTML = '<div style="text-align:center; padding:20px; color:#dc3545;">주소의 좌표를 찾을 수 없습니다.</div>';
                            console.warn('Geocode failed:', response);
                            return;
                        }
                        const point = new naver.maps.Point(response.v2.addresses[0].x, response.v2.addresses[0].y);
                        const map = new naver.maps.Map(mapElement, { center: point, zoom: 16 });
                        new naver.maps.Marker({ position: point, map: map, title: name });
                    });
                    return;
                }

                attempts++;
                if (attempts > 50) { // 약 5초 동안 로딩이 안되면 실패 처리
                    clearInterval(intervalId);
                    mapElement.innerHTML = '<div style="text-align:center; padding:20px; color:#dc3545;">지도 로딩에 실패했습니다. 네트워크를 확인하거나 페이지를 새로고침하세요.</div>';
                    console.error("Naver Maps Geocoder did not load in time.");
                }
            }, 100); // 0.1초마다 확인
        }
        
        // --- 데이터 렌더링 함수 ---
        async function renderStatistics(clinics) {
            const chartIds = ['department-chart', 'scale-chart', 'stage-chart'];
            chartIds.forEach(id => {
                const canvas = document.getElementById(id);
                if(canvas) {
                    const existingChart = Chart.getChart(canvas);
                    if (existingChart) existingChart.destroy();
                }
            });

            const departmentData = clinics.reduce((acc, clinic) => { const dept = clinic.department || "미지정"; acc[dept] = (acc[dept] || 0) + 1; return acc; }, {});
            new Chart(document.getElementById('department-chart'), { type: 'doughnut', data: { labels: Object.keys(departmentData), datasets: [{ data: Object.values(departmentData), backgroundColor: ['#cce5ff', '#b3d7ff', '#99c9ff', '#80bbff', '#66adff', '#4da0ff', '#3392ff'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: true } });
            
            const scaleOrder = ['0~5명', '6~10명', '11~15명', '16~20명', '21명 이상'];
            const scaleData = { labels: scaleOrder, values: Array(scaleOrder.length).fill(0) };
            clinics.forEach(clinic => { const index = scaleOrder.indexOf(clinic.scale); if (index > -1) scaleData.values[index]++; });
            new Chart(document.getElementById('scale-chart'), { type: 'bar', data: { labels: scaleData.labels, datasets: [{ label: '의원 수', data: scaleData.values, backgroundColor: '#a9c9ff' }] }, options: { responsive: true, maintainAspectRatio: true } });
            
            const stageOrder = ['인지', '관심', '고려', '구매'];
            const stageData = { labels: stageOrder, values: Array(stageOrder.length).fill(0) };
            clinics.forEach(clinic => { const index = stageOrder.indexOf(clinic.stage); if (index > -1) stageData.values[index]++; });
            new Chart(document.getElementById('stage-chart'), { type: 'bar', data: { labels: stageData.labels, datasets: [{ label: '의원 수', data: stageData.values, backgroundColor: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd'], borderColor: '#9ca3af', borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } } });
        }

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
        
        async function renderTodoList() { /* ... */ } // 이 부분은 이전과 같으므로 생략합니다. 필요시 전체를 채워 넣으세요.

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
                alert("지도 API를 불러오는 데 실패했습니다. 페이지를 새로고침 해주세요.");
            }
        }

        function showListView() { currentClinicId = null; detailView.classList.add('hidden'); listView.classList.remove('hidden'); updateDashboard(); }
        
        function execDaumPostcode() {
            new daum.Postcode({
                oncomplete: function(data) {
                    let addr = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress;
                    document.getElementById('clinic-address').value = addr;
                    document.getElementById("clinic-address-detail").focus();
                    postcodeModal.classList.add('hidden');
                },
                width: '100%',
                height: '100%'
            }).embed(document.getElementById('postcode-embed'));
            postcodeModal.classList.remove('hidden');
        }
        
        // --- 모든 이벤트 핸들러 ---
        addClinicBtn.addEventListener('click', () => { clinicForm.reset(); modalTitle.textContent = '의원 정보 입력'; document.getElementById('clinic-id').value = ''; modal.classList.remove('hidden'); });
        closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
        
        searchAddressBtn.addEventListener('click', execDaumPostcode);
        postcodeCloseBtn.addEventListener('click', () => postcodeModal.classList.add('hidden'));
        
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
                await clinicsCollection.add({ ...clinicPayload, memo: '' });
            }
            modal.classList.add('hidden');
            if (detailView.classList.contains('hidden')) {
                await updateDashboard();
            } else {
                await showDetailView(clinicId || currentClinicId);
            }
        });
        
        backToListBtn.addEventListener('click', showListView);
        
        editClinicBtn.addEventListener('click', async () => { /* ... */ }); // 이전 코드와 동일, 생략
        deleteClinicBtn.addEventListener('click', async () => { /* ... */ }); // 이전 코드와 동일, 생략
        saveMemoBtn.addEventListener('click', async () => { /* ... */ }); // 이전 코드와 동일, 생략
        
        addTodoBtn.addEventListener('click', () => { /* ... */ }); // 이전 코드와 동일, 생략
        todoListContainer.addEventListener('click', async (e) => { /* ... */ }); // 이전 코드와 동일, 생략
        filterButtons.addEventListener('click', (e) => { /* ... */ }); // 이전 코드와 동일, 생략

        // --- 앱 초기화 실행 ---
        setupDashboard();
        await updateDashboard();
        // await renderTodoList(); // 필요시 주석 해제
    }
});