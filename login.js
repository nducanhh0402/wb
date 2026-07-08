document.addEventListener('DOMContentLoaded', () => {
    // Nếu đã có token, đẩy về trang chủ
    if (localStorage.getItem('token')) {
        window.location.href = 'index.html';
        return;
    }

    const authForm = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-btn');
    const formTitle = document.getElementById('form-title');
    const btnText = document.getElementById('btn-text');
    const toggleDesc = document.getElementById('toggle-desc');

    let isLoginMode = true;

    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            formTitle.textContent = 'Đăng Nhập';
            btnText.textContent = 'Đăng nhập';
            toggleDesc.textContent = 'Chưa có tài khoản?';
            toggleBtn.textContent = 'Đăng ký ngay';
        } else {
            formTitle.textContent = 'Tạo Tài Khoản Mới';
            btnText.textContent = 'Đăng ký';
            toggleDesc.textContent = 'Đã có tài khoản?';
            toggleBtn.textContent = 'Đăng nhập';
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!username || !password) {
            alert('Vui lòng nhập đầy đủ thông tin!');
            return;
        }

        const endpoint = isLoginMode ? '/api/login' : '/api/register';
        
        try {
            const btn = authForm.querySelector('button');
            const originalText = btnText.textContent;
            btnText.textContent = 'Đang xử lý...';
            btn.disabled = true;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok) {
                if (isLoginMode) {
                    // Lưu token và username vào localStorage
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('username', data.username);
                    window.location.href = 'index.html';
                } else {
                    alert('Đăng ký thành công! Vui lòng đăng nhập.');
                    // Chuyển về mode đăng nhập
                    toggleBtn.click();
                    document.getElementById('password').value = '';
                }
            } else {
                alert(data.error || 'Có lỗi xảy ra');
            }

            btnText.textContent = originalText;
            btn.disabled = false;
        } catch (err) {
            console.error(err);
            alert('Không thể kết nối đến server!');
        }
    });
});
