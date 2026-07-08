document.addEventListener('DOMContentLoaded', () => {
    // 1. Kiểm tra đăng nhập
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');

    if (!token || !username) {
        window.location.href = 'login.html';
        return;
    }

    // Hiển thị tên user
    document.getElementById('display-username').textContent = username;

    // Đăng xuất
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    });

    const form = document.getElementById('entry-form');
    const dateInput = document.getElementById('date');
    const historyBody = document.getElementById('history-body');
    const grandTotalEl = document.getElementById('grand-total');
    const studentStatsContainer = document.getElementById('student-stats-container');
    const monthPillsContainer = document.getElementById('month-pills-container');

    const btnSubmitText = document.getElementById('btn-submit-text');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');

    let allEntries = [];
    let currentEditingId = null; // Trạng thái đang sửa
    
    // Mặc định chọn ngày hôm nay
    const today = new Date();
    dateInput.valueAsDate = today;
    
    // Khởi tạo state tháng đang chọn
    let currentSelectedMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

    // Load dữ liệu khi trang vừa mở
    fetchEntries();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const studentName = document.getElementById('studentName').value.trim();
        const date = document.getElementById('date').value;
        const fee = parseFloat(document.getElementById('fee').value);
        const notes = document.getElementById('notes').value.trim();

        if (!studentName || !date || isNaN(fee)) {
            alert('Vui lòng điền đầy đủ thông tin Tên học sinh, Ngày và Mức phí.');
            return;
        }

        const entryData = { studentName, date, fee, notes };
        const isEditing = currentEditingId !== null;
        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `/api/entries?id=${currentEditingId}` : '/api/entries';

        try {
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btnSubmitText.textContent;
            btnSubmitText.textContent = 'Đang lưu...';
            btn.disabled = true;

            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(entryData)
            });

            if (res.status === 401) {
                alert('Phiên đăng nhập hết hạn!');
                document.getElementById('btn-logout').click();
                return;
            }

            if (res.ok) {
                resetFormState();
                
                // Cập nhật lại danh sách tháng và chuyển view về tháng vừa tạo/sửa
                const entryMonth = date.substring(0, 7);
                currentSelectedMonth = entryMonth;
                
                fetchEntries();
            } else {
                alert('Có lỗi xảy ra khi lưu dữ liệu!');
            }

            btnSubmitText.textContent = originalText;
            btn.disabled = false;
        } catch (err) {
            console.error(err);
            alert('Không thể kết nối đến server.');
        }
    });

    btnCancelEdit.addEventListener('click', () => {
        resetFormState();
        filterAndRenderData(); // re-render to remove highlight
    });

    function resetFormState() {
        document.getElementById('studentName').value = '';
        document.getElementById('fee').value = '';
        document.getElementById('notes').value = '';
        
        currentEditingId = null;
        btnSubmitText.textContent = 'Lưu ca dạy';
        btnCancelEdit.style.display = 'none';
    }

    // Cần phải gán các hàm edit/delete vào window để onclick HTML gọi được
    window.editEntry = (id) => {
        const entry = allEntries.find(e => e.id === id);
        if (entry) {
            document.getElementById('studentName').value = entry.studentName;
            document.getElementById('date').value = entry.date;
            document.getElementById('fee').value = entry.fee;
            document.getElementById('notes').value = entry.notes || '';
            
            currentEditingId = id;
            btnSubmitText.textContent = 'Cập nhật';
            btnCancelEdit.style.display = 'block';
            
            // Re-render bảng để highlight dòng đang sửa
            filterAndRenderData();
            
            // Cuộn lên form
            document.querySelector('.sidebar').scrollIntoView({ behavior: 'smooth' });
        }
    };

    window.deleteEntry = async (id) => {
        if (!confirm('Bạn có chắc chắn muốn xóa ca dạy này? Hành động này không thể hoàn tác.')) {
            return;
        }

        try {
            const res = await fetch(`/api/entries?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                document.getElementById('btn-logout').click();
                return;
            }

            if (res.ok) {
                if (currentEditingId === id) {
                    resetFormState();
                }
                fetchEntries();
            } else {
                alert('Có lỗi xảy ra khi xóa!');
            }
        } catch (err) {
            console.error(err);
            alert('Không thể kết nối đến server.');
        }
    };

    async function fetchEntries() {
        try {
            const res = await fetch('/api/entries', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                document.getElementById('btn-logout').click();
                return;
            }

            if (res.ok) {
                allEntries = await res.json();
                renderMonthPills();
                filterAndRenderData();
            }
        } catch (err) {
            console.error('Lỗi khi tải dữ liệu', err);
        }
    }

    function renderMonthPills() {
        // Thu thập các tháng có dữ liệu
        const monthsSet = new Set();
        allEntries.forEach(entry => {
            if (entry.date) {
                monthsSet.add(entry.date.substring(0, 7));
            }
        });
        
        // Đảm bảo tháng hiện tại luôn có để user dễ bấm
        const todayMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        monthsSet.add(todayMonth);

        // Chuyển sang mảng và sắp xếp giảm dần (tháng mới nhất bên trái)
        const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

        monthPillsContainer.innerHTML = '';

        // Tạo nút "Tất cả"
        const allPill = document.createElement('button');
        allPill.className = `month-pill ${currentSelectedMonth === '' ? 'active' : ''}`;
        allPill.textContent = 'Tất cả';
        allPill.onclick = () => {
            currentSelectedMonth = '';
            renderMonthPills();
            filterAndRenderData();
        };
        monthPillsContainer.appendChild(allPill);

        // Tạo các nút tháng
        sortedMonths.forEach(m => {
            const parts = m.split('-');
            const label = m === todayMonth ? `Tháng ${parts[1]}/${parts[0]} (Hiện tại)` : `Tháng ${parts[1]}/${parts[0]}`;
            
            const pill = document.createElement('button');
            pill.className = `month-pill ${currentSelectedMonth === m ? 'active' : ''}`;
            pill.textContent = label;
            pill.onclick = () => {
                currentSelectedMonth = m;
                renderMonthPills();
                filterAndRenderData();
            };
            monthPillsContainer.appendChild(pill);
        });
    }

    function filterAndRenderData() {
        let monthLabel = '';
        if (currentSelectedMonth) {
            const parts = currentSelectedMonth.split('-'); // ['YYYY', 'MM']
            monthLabel = `Tháng ${parts[1]}/${parts[0]}`;
        } else {
            monthLabel = 'Tất cả các tháng';
        }

        // Cập nhật tiêu đề hiển thị rõ tháng
        document.getElementById('title-grand-total').textContent = `Thu Nhập ${monthLabel}`;
        document.getElementById('title-stats').textContent = `Thống kê theo học sinh (${monthLabel})`;
        document.getElementById('title-history').textContent = `Lịch sử ca dạy (${monthLabel})`;

        // Lọc dữ liệu theo tháng
        const filteredEntries = currentSelectedMonth 
            ? allEntries.filter(entry => entry.date.startsWith(currentSelectedMonth))
            : allEntries;

        renderData(filteredEntries);
    }

    function renderData(entries) {
        // Sắp xếp giảm dần theo ngày
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        let grandTotal = 0;
        const studentTotals = {};
        
        historyBody.innerHTML = '';

        entries.forEach(entry => {
            grandTotal += entry.fee;
            
            if (!studentTotals[entry.studentName]) {
                studentTotals[entry.studentName] = { totalFee: 0, count: 0, latestFee: entry.fee };
            }
            studentTotals[entry.studentName].totalFee += entry.fee;
            studentTotals[entry.studentName].count += 1;

            const row = document.createElement('tr');
            
            // Xử lý background nhạt nếu đang được edit
            if (currentEditingId === entry.id) {
                row.style.background = 'rgba(59, 130, 246, 0.15)';
            }

            const dateObj = new Date(entry.date);
            const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

            row.innerHTML = `
                <td>${formattedDate}</td>
                <td style="font-weight: 500;">${entry.studentName}</td>
                <td><span class="badge-fee">${formatCurrency(entry.fee)}</span></td>
                <td class="notes-cell" title="${entry.notes}">${entry.notes || '-'}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="editEntry('${entry.id}')" title="Sửa">✏️</button>
                    <button class="action-btn btn-delete" onclick="deleteEntry('${entry.id}')" title="Xóa">🗑️</button>
                </td>
            `;
            historyBody.appendChild(row);
        });

        grandTotalEl.textContent = formatCurrency(grandTotal);

        studentStatsContainer.innerHTML = '';
        const sortedStudents = Object.keys(studentTotals).sort((a, b) => studentTotals[b].totalFee - studentTotals[a].totalFee);
        
        if (sortedStudents.length === 0) {
            studentStatsContainer.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">Chưa có dữ liệu nào trong khoảng thời gian này.</p>';
        } else {
            sortedStudents.forEach(name => {
                const stat = studentTotals[name];
                const card = document.createElement('div');
                card.className = 'student-card';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="student-card-name">${name}</div>
                        <button class="btn-quick-add" onclick="quickAddEntry('${name.replace(/'/g, "\\'")}', ${stat.latestFee})" title="Thêm ca dạy hôm nay">➕</button>
                    </div>
                    <div class="student-card-total">${formatCurrency(stat.totalFee)}</div>
                    <div class="student-card-sessions">${stat.count} ca dạy</div>
                `;
                studentStatsContainer.appendChild(card);
            });
        }
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }

    window.quickAddEntry = async (studentName, fee) => {
        if (!confirm(`Thêm nhanh 1 ca dạy hôm nay cho ${studentName} với mức phí ${formatCurrency(fee)}?`)) {
            return;
        }

        const todayObj = new Date();
        const formattedDate = `${todayObj.getFullYear()}-${(todayObj.getMonth() + 1).toString().padStart(2, '0')}-${todayObj.getDate().toString().padStart(2, '0')}`;
        
        const newEntry = { studentName, date: formattedDate, fee, notes: '' };

        try {
            const res = await fetch('/api/entries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newEntry)
            });

            if (res.status === 401) {
                document.getElementById('btn-logout').click();
                return;
            }

            if (res.ok) {
                const entryMonth = formattedDate.substring(0, 7);
                currentSelectedMonth = entryMonth;
                fetchEntries();
            } else {
                alert('Có lỗi xảy ra khi thêm nhanh!');
            }
        } catch (err) {
            console.error(err);
            alert('Không thể kết nối đến server.');
        }
    };
});
