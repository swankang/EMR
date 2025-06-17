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
        const dashboardView = document.getElementById('dashboard-view');
        const totalClinicCountSpan = document.getElementById('total-clinic-count');
        const addClinicBtn = document.getElementById('add-clinic-btn');
        const modal = document.getElementById('clinic-modal');
        const clinicForm = document.getElementById('clinic-form');
        const detailView = document.getElementById('detail-view');
        const searchAddressBtn = document.getElementById('search-address-btn');
        const postcodeModal = document.getElementById('postcode-modal');
        const postcodeCloseBtn = document.getElementById('postcode-close-btn');
        const todoListContainer = document.getElementById('todo-list');
        const totalTodoCountSpan = document.getElementById('total-todo-count');
        const filterButtons = document.getElementById('todo-filter-buttons');
        let departmentChart = null, scaleChart = null, stageChart = null;
        let currentClinicId = null;
        let currentTodoFilter = 'all';

        if(userEmailSpan) userEmailSpan.textContent = user.email;
        if(logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

        async function renderDashboard() {
            const clinics = await clinicsCollection.orderBy('updatedAt', 'desc').get().then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            totalClinicCountSpan.textContent = `(총 ${clinics.length}곳)`;
            const stages = [ { name: '인지', id: 'awareness' }, { name: '관심', id: 'interest' }, { name: '고려', id: 'consideration' }, { name: '구매', id: 'purchase' } ];
            dashboardView.innerHTML = '';
            stages.forEach(stageInfo => {
                const stageName = stageInfo.name;
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
                        await clinicsCollection.doc(evt.item.dataset.id).update({ stage: evt.to.dataset.stage, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                        await updateDashboard();
                    }
                });
            });
            await updateDashboard(clinics);
        }

        async function updateDashboard(clinics) {
            if (!clinics) clinics = await clinicsCollection.orderBy('updatedAt', 'desc').get().then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            totalClinicCountSpan.textContent = `(총 ${clinics.length}곳)`;
            document.querySelectorAll('.clinic-cards-container').forEach(c => c.innerHTML = '');
            document.querySelectorAll('.stage-column h2').forEach(header => {
                const stageName = header.dataset.stageName;
                const stageClinics = clinics.filter(c => c.stage === stageName);
                header.innerHTML = `${stageName} <span class="count">${stageClinics.length}곳 / ${clinics.length > 0 ? ((stageClinics.length / clinics.length) * 100).toFixed(1) : 0}%</span>`;
            });
            clinics.forEach(clinic => {
                const stageId = ['인지', '관심', '고려', '구매'].indexOf(clinic.stage);
                const stageClass = ['awareness', 'interest', 'consideration', 'purchase'][stageId] || 'awareness';
                const container = document.querySelector(`.stage-${stageClass} .clinic-cards-container`);
                if(container) {
                    const card = document.createElement('div');
                    card.className = 'clinic-card';
                    card.dataset.id = clinic.id;
                    const updatedAt = clinic.updatedAt ? new Date(clinic.updatedAt.toDate()).toLocaleDateString() : '날짜 정보 없음';
                    card.innerHTML = `<h3>${clinic.name}</h3><p>${clinic.address}</p><p class="date">업데이트: ${updatedAt}</p>`;
                    card.addEventListener('click', () => showDetailView(clinic.id));
                    container.appendChild(card);
                }
            });
            await renderStatistics(clinics);
        }

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
            new Chart(document.getElementById('department-chart'), { type: 'doughnut', data: { labels: Object.keys(departmentData), datasets: [{ data: Object.values(departmentData), backgroundColor: ['#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'], hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: true } });
            const scaleOrder = ['0~5명', '6~10명', '11~15명', '16~20명', '21명 이상'];
            const scaleData = { labels: scaleOrder, values: Array(scaleOrder.length).fill(0) };
            clinics.forEach(clinic => { const index = scaleOrder.indexOf(clinic.scale); if (index > -1) scaleData.values[index]++; });
            new Chart(document.getElementById('scale-chart'), { type: 'bar', data: { labels: scaleData.labels, datasets: [{ label: '의원 수', data: scaleData.values, backgroundColor: '#a9c9ff' }] }, options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
            const stageOrder = ['인지', '관심', '고려', '구매'];
            const stageData = { labels: stageOrder, values: Array(stageOrder.length).fill(0) };
            clinics.forEach(clinic => { const index = stageOrder.indexOf(clinic.stage); if (index > -1) stageData.values[index]++; });
            new Chart(document.getElementById('stage-chart'), { type: 'bar', data: { labels: stageData.labels, datasets: [{ label: '의원 수', data: stageData.values, backgroundColor: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd'], borderColor: '#9ca3af', borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
        }
        
        async function renderTodoList() { /* ... */ }
        async function showDetailView(id) { /* ... */ }
        function showListView() { /* ... */ }

        function loadMap(address, name) {
            const mapElement = document.getElementById('map');
            if (!mapElement) return;
            mapElement.innerHTML = '';
            const map = new naver.maps.Map('map', { center: new naver.maps.LatLng(37.5665, 126.9780), zoom: 15 });
            naver.maps.Service.geocode({ query: address }, (status, response) => {
                if (status !== naver.maps.Service.Status.OK) return console.warn('Geocode failed for address:', address);
                const point = new naver.maps.Point(response.v2.addresses[0].x, response.v2.addresses[0].y);
                map.setCenter(point);
                new naver.maps.Marker({ position: point, map: map, title: name });
            });
        }
        
        function execDaumPostcode() { /* ... */ }
        
        // --- 모든 이벤트 핸들러들 ---
        
        await renderDashboard();
        // await renderTodoList();
    }
});