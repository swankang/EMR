document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const authView = document.getElementById('auth-view');
    const appContainer = document.getElementById('app-container');
    const loginBtn = document.getElementById('login-btn');
    
    let appInitialized = false;

    auth.onAuthStateChanged(user => {
        if (user) {
            if (!appInitialized) {
                initializeApp(user); 
                appInitialized = true;
            }
            authView.classList.add('hidden');
            appContainer.classList.remove('hidden');
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

        // 모든 DOM 요소를 이 안에서 가져옴
        const userEmailSpan = document.getElementById('user-email');
        const logoutBtn = document.getElementById('logout-btn');
        const addClinicBtn = document.getElementById('add-clinic-btn');
        // ... (이하 모든 getElementById 호출)

        let currentClinicId = null;
        let currentTodoFilter = 'all';

        // 모든 렌더링을 책임지는 단 하나의 함수
        async function renderAll() {
            const clinics = await clinicsCollection.orderBy('updatedAt', 'desc').get().then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            const todos = await todosCollection.get().then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            
            renderDashboard(clinics);
            renderStatistics(clinics);
            renderTodoList(todos);
        }

        function renderDashboard(clinics) {
            const dashboardView = document.getElementById('dashboard-view');
            dashboardView.innerHTML = '';
            document.getElementById('total-clinic-count').textContent = `(총 ${clinics.length}곳)`;
            const stages = [ { name: '인지', id: 'awareness' }, { name: '관심', id: 'interest' }, { name: '고려', id: 'consideration' }, { name: '구매', id: 'purchase' } ];
            
            stages.forEach(stageInfo => {
                const column = document.createElement('div');
                // ... (컬럼과 카드 생성 로직은 이전과 동일) ...
                dashboardView.appendChild(column);
                
                const cardsContainer = column.querySelector('.clinic-cards-container');
                new Sortable(cardsContainer, {
                    group: 'shared', animation: 150, ghostClass: 'sortable-ghost',
                    onEnd: async function (evt) {
                        await clinicsCollection.doc(evt.item.dataset.id).update({ stage: evt.to.dataset.stage, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                        await renderAll();
                    }
                });
            });
        }

        function renderStatistics(clinics) {
             const chartIds = ['department-chart', 'scale-chart', 'stage-chart'];
             chartIds.forEach(id => {
                const existingChart = Chart.getChart(id);
                if (existingChart) existingChart.destroy();
             });
             // ... (차트 생성 로직은 이전과 동일) ...
        }

        function renderTodoList(allTodos) {
            // ... (정렬 및 렌더링 로직은 이전과 동일) ...
        }

        // (이하 모든 이벤트 핸들러는 이전에 제공한 최종 코드와 동일하며,
        // 데이터 변경 후에는 `renderAll()` 또는 `renderTodoList()` `renderDashboard()`를 호출하도록 수정)
        
        // --- 초기 렌더링 ---
        await renderAll();
    }
});