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
            auth.signInWithEmailAndPassword(email, password).catch(error => alert(`로그인 실패: ${error.message}`));
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
        const addTodoBtn = document.getElementById('add-todo-btn');
        let departmentChart, scaleChart, stageChart;
        let currentClinicId = null;
        let currentTodoFilter = 'all';
        if (userEmailSpan) userEmailSpan.textContent = user.email;
        if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

        let naverMapsApiLoaded = false;
        function loadNaverMapsApi() {
            return new Promise((resolve, reject) => {
                if (naverMapsApiLoaded) {
                    resolve();
                    return;
                }
                const mapScript = document.createElement('script');
                mapScript.type = 'text/javascript';
                mapScript.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=d7528qc21z&submodules=geocoder`;
                mapScript.onload = () => {
                    naverMapsApiLoaded = true;
                    resolve();
                };
                mapScript.onerror = reject;
                document.head.appendChild(mapScript);
            });
        }
        
        function drawMap(address, name) {
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

        async function renderStatistics(clinics) { /* ... 이전과 동일 ... */ }
        async function updateDashboard() { /* ... 이전과 동일 ... */ }
        function setupDashboard() { /* ... 이전과 동일 ... */ }
        async function renderTodoList() { /* ... 이전과 동일 ... */ }
        
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
            detailView.classList.remove('hidden');
            try {
                await loadNaverMapsApi();
                drawMap(clinic.address, clinic.name);
            } catch (error) {
                console.error("Naver Maps API 로딩 실패:", error);
                alert("지도 API를 불러오는 데 실패했습니다.");
            }
        }

        function showListView() { currentClinicId = null; detailView.classList.add('hidden'); document.getElementById('list-view').classList.remove('hidden'); updateDashboard(); }
        function execDaumPostcode() { new daum.Postcode({ oncomplete: function(data) { let addr = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress; document.getElementById('clinic-address').value = addr; document.getElementById("clinic-address-detail").focus(); postcodeModal.classList.add('hidden'); } , width: '100%', height: '100%' }).embed(document.getElementById('postcode-embed')); postcodeModal.classList.remove('hidden'); }
        
        document.getElementById('add-clinic-btn').addEventListener('click', () => { /* ... 이전과 동일 ... */ });
        // (이하 모든 이벤트 핸들러는 이전과 동일)

        setupDashboard();
        await updateDashboard();
        await renderTodoList();
    }
});