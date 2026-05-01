import { database, ref, set, get, child, update, remove, onValue, auth, onAuthStateChanged } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            if (document.documentElement.classList.contains('dark')) {
                localStorage.theme = 'dark';
            } else {
                localStorage.theme = 'light';
            }
        });
    }

    const modal = document.getElementById('add-student-modal');
    const addBtn = document.getElementById('add-student-btn');
    const tbody = document.getElementById('students-tbody');
    const tableGroupTitle = document.getElementById('table-group-title');
    
    if (!modal || !addBtn || !tbody) return;

    // === Center Initialization & Persistence ===
    const urlParams = new URLSearchParams(window.location.search);
    const centerName = urlParams.get('center') || 'الدلتا (نظم)';
    
    // Update Header
    const headerTitle = document.getElementById('management-header-title');
    if (headerTitle) {
        headerTitle.textContent = `إدارة مجموعات التدريب "${centerName}"`;
    }

    // Load State from Firebase
    const dataRef = ref(database, 'intelligo_data');
    let allData = {};
    let yearsData = {};
    let currentYear = '';
    let currentGroupName = null;
    let editingStudentId = null;
    let editingGroupName = null;
    let nextStudentId = 1;

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = '../index.html';
            return;
        }

        onValue(dataRef, (snapshot) => {
            allData = snapshot.val() || {};

            if (!allData[centerName]) {
                allData[centerName] = {
                    yearsData: {},
                    currentYear: ''
                };
            }

            yearsData = allData[centerName].yearsData || {};
            currentYear = allData[centerName].currentYear || '';

            // Recalculate nextStudentId
            nextStudentId = 1;
        for (const yData of Object.values(yearsData)) {
            for (const [gName, gData] of Object.entries(yData)) {
                if (gName === '_init' || typeof gData !== 'object') continue;
                if (!gData.students) gData.students = [];
                for (const student of gData.students) {
                        if (student.id >= nextStudentId) {
                            nextStudentId = student.id + 1;
                        }
                    }
                }
            }

            renderYearsList();
            renderGroupsSidebar();
            renderTable();
        });
    });

    function saveData() {
        if (!allData[centerName]) allData[centerName] = {};
        allData[centerName].yearsData = yearsData;
        allData[centerName].currentYear = currentYear;
        set(dataRef, allData);
    }

    // === Element References ===
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-modal-btn');
    const saveBtn = document.getElementById('save-student-btn');

    const nameInput = document.getElementById('new-student-name');
    const phoneInput = document.getElementById('new-student-phone');
    const dateInput = document.getElementById('new-student-date');
    const bookingInput = document.getElementById('new-student-booking');
    const installment1Input = document.getElementById('new-student-installment1');
    const installment2Input = document.getElementById('new-student-installment2');

    const groupsList = document.getElementById('groups-list');
    const groupModal = document.getElementById('add-group-modal');
    const addGroupBtn = document.getElementById('add-group-btn');
    const closeGroupBtn = document.getElementById('close-group-modal-btn');
    const cancelGroupBtn = document.getElementById('cancel-group-modal-btn');
    const saveGroupBtn = document.getElementById('save-group-btn');
    const newGroupNameInput = document.getElementById('new-group-name');
    const newGroupPriceInput = document.getElementById('new-group-price');
    const searchStudentInput = document.getElementById('search-student-input');
    const downloadExcelBtn = document.getElementById('download-excel-btn');
    
    const yearsList = document.getElementById('years-list');
    const currentYearDisplay = document.getElementById('current-year-display');
    const addYearBtn = document.getElementById('add-year-btn');

    if (searchStudentInput) {
        searchStudentInput.addEventListener('input', renderTable);
    }

    // === Render Functions ===
    function renderYearsList() {
        if (!yearsList || !currentYearDisplay) return;
        currentYearDisplay.textContent = currentYear ? `السنة الأكاديمية: ${currentYear}` : 'الرجاء إضافة سنة أكاديمية';
        
        yearsList.innerHTML = '';
        for (const year of Object.keys(yearsData)) {
            const btn = document.createElement('button');
            btn.className = `w-full text-right px-4 py-2 text-body-sm text-on-surface dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors ${year === currentYear ? 'bg-blue-50/50 dark:bg-blue-900/30 font-bold text-primary dark:text-blue-300' : ''}`;
            btn.textContent = `السنة الأكاديمية: ${year}`;
            btn.addEventListener('click', () => {
                currentYear = year;
                // Auto-select first group in this year, or null
                const yearGroups = Object.keys(yearsData[currentYear]).filter(k => k !== '_init');
                currentGroupName = yearGroups.length > 0 ? yearGroups[0] : null;
                
                saveData();
                renderYearsList();
                renderGroupsSidebar();
                renderTable();
            });
            yearsList.appendChild(btn);
        }
    }

    function renderGroupsSidebar() {
        if (!groupsList) return;
        groupsList.innerHTML = '';
        
        const groupsData = yearsData[currentYear] || {};
        const groupNames = Object.keys(groupsData).filter(k => k !== '_init');
        
        if (groupNames.length > 0 && !currentGroupName) {
            currentGroupName = groupNames[0];
        }

        for (const groupName of groupNames) {
            const groupData = groupsData[groupName];
            const isSelected = groupName === currentGroupName;
            const studentsCount = groupData.students ? groupData.students.length : 0;
            const div = document.createElement('div');
            
            const actionsHtml = `
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="p-1 text-primary hover:bg-primary/10 rounded-full" onclick="editGroup(event, '${groupName}')">
                        <span class="material-symbols-outlined text-[16px]" data-icon="edit">edit</span>
                    </button>
                    <button class="p-1 text-error hover:bg-error/10 rounded-full" onclick="deleteGroup(event, '${groupName}')">
                        <span class="material-symbols-outlined text-[16px]" data-icon="delete">delete</span>
                    </button>
                </div>
            `;

            if (isSelected) {
                div.className = 'p-sm bg-blue-50 dark:bg-blue-900/30 border-r-4 border-blue-900 dark:border-blue-400 rounded-lg flex justify-between items-center group cursor-pointer transition-colors';
                div.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="font-label-bold text-blue-900 dark:text-blue-200">${groupName}</span>
                        <span class="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full">${studentsCount} طالب</span>
                    </div>
                    ${actionsHtml}
                `;
            } else {
                div.className = 'p-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg flex justify-between items-center group cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all';
                div.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="font-label-bold text-on-surface-variant dark:text-slate-300">${groupName}</span>
                        <span class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">${studentsCount} طلاب</span>
                    </div>
                    ${actionsHtml}
                `;
            }
            
            div.addEventListener('click', () => {
                currentGroupName = groupName;
                renderGroupsSidebar();
                renderTable();
            });
            
            groupsList.appendChild(div);
        }
        
        updateGlobalStats();
    }

    function updateGlobalStats() {
        let totalGroups = 0;
        let totalStudents = 0;
        let globalRevenue = 0;
        let globalUnpaid = 0;

        const groupsData = yearsData[currentYear] || {};

        for (const [groupName, groupData] of Object.entries(groupsData)) {
            if (groupName === '_init') continue;
            
            totalGroups++;
            const students = groupData.students || [];
            totalStudents += students.length;

            const groupPrice = groupData.price;
            students.forEach(student => {
                const paid = student.booking + student.inst1 + student.inst2;
                const remaining = groupPrice - paid;
                
                globalRevenue += paid;
                globalUnpaid += remaining > 0 ? remaining : 0;
            });
        }

        const elGroups = document.getElementById('global-total-groups');
        const elStudents = document.getElementById('global-total-students');
        const elRevenue = document.getElementById('global-total-revenue');
        const elUnpaid = document.getElementById('global-total-unpaid');

        if (elGroups) elGroups.textContent = totalGroups;
        if (elStudents) elStudents.textContent = totalStudents;
        if (elRevenue) elRevenue.textContent = globalRevenue;
        if (elUnpaid) elUnpaid.textContent = globalUnpaid;
    }

    function renderTable() {
        const groupsData = yearsData[currentYear] || {};
        
        if (tableGroupTitle) {
            tableGroupTitle.textContent = currentGroupName ? `قائمة طلاب ${currentGroupName}` : 'الرجاء اختيار أو إضافة مجموعة';
        }
        
        tbody.innerHTML = '';
        const groupData = currentGroupName && groupsData[currentGroupName] ? groupsData[currentGroupName] : null;
        
        if (!groupData) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="9" class="px-6 py-8 text-center text-slate-400">لا توجد بيانات متاحة حالياً. أضف مجموعة وطلاباً للبدء.</td>`;
            tbody.appendChild(tr);
            
            // Clear stats at bottom
            const totalCollectedSpan = document.getElementById('total-collected');
            const totalUnpaidSpan = document.getElementById('total-unpaid');
            if (totalCollectedSpan) totalCollectedSpan.innerHTML = `0 <small class="text-body-sm font-normal">ج.م</small>`;
            if (totalUnpaidSpan) totalUnpaidSpan.innerHTML = `0 <small class="text-body-sm font-normal">ج.م</small>`;
            return;
        }
        
        let students = groupData.students || [];
        if (searchStudentInput && searchStudentInput.value) {
            const searchTerm = searchStudentInput.value.trim().toLowerCase();
            students = students.filter(student => student.name.toLowerCase().includes(searchTerm));
        }
        
        if (students.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="9" class="px-6 py-8 text-center text-slate-400">لا توجد نتائج أو طلاب مسجلين في هذه المجموعة.</td>`;
            tbody.appendChild(tr);
        }

        let sumCollected = 0;
        let sumUnpaid = 0;

        students.forEach(student => {
            const total = groupData.price;
            const paid = student.booking + student.inst1 + student.inst2;
            const remaining = total - paid;
            
            sumCollected += paid;
            sumUnpaid += remaining > 0 ? remaining : 0;
            
            const statusHtml = remaining <= 0 
                ? `<div class="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 text-on-tertiary-container dark:text-green-300 px-3 py-1 rounded-full border border-green-100 dark:border-green-800 text-xs font-bold">
                    <span class="material-symbols-outlined text-[16px]" data-icon="check_circle" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                    مكتمل
                   </div>`
                : `<div class="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-800 text-xs font-bold">
                    <span class="material-symbols-outlined text-[16px]" data-icon="schedule">schedule</span>
                   غير مكتمل
                   </div>`;

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-blue-50/30 dark:hover:bg-slate-800 transition-colors cursor-default';
            tr.innerHTML = `
                <td class="px-6 py-4 font-label-bold text-primary dark:text-blue-300">${student.name}</td>
                <td class="px-6 py-4 text-body-sm text-on-surface-variant dark:text-slate-300">${student.phone || '--'}</td>
                <td class="px-6 py-4 text-body-sm text-on-surface-variant dark:text-slate-300">${student.date}</td>
                <td class="px-6 py-4 text-body-sm dark:text-slate-300">${student.booking ? student.booking + ' ج.م' : '--'}</td>
                <td class="px-6 py-4 text-body-sm dark:text-slate-300">${student.inst1 ? student.inst1 + ' ج.م' : '--'}</td>
                <td class="px-6 py-4 text-body-sm dark:text-slate-300">${student.inst2 ? student.inst2 + ' ج.م' : '--'}</td>
                <td class="px-6 py-4 text-body-sm font-bold ${remaining > 0 ? 'text-error dark:text-red-400' : 'text-on-tertiary-container dark:text-green-300'}">${remaining > 0 ? remaining : 0} ج.م</td>
                <td class="px-6 py-4 text-center">${statusHtml}</td>
                <td class="px-6 py-4">
                    <div class="flex justify-center gap-2">
                        <button class="p-1.5 text-primary dark:text-blue-400 hover:bg-primary-fixed dark:hover:bg-slate-700 rounded-full transition-colors" onclick="editStudent(${student.id})">
                            <span class="material-symbols-outlined" data-icon="edit">edit</span>
                        </button>
                        <button class="p-1.5 text-error dark:text-red-400 hover:bg-error-container dark:hover:bg-slate-700 rounded-full transition-colors" onclick="deleteStudent(${student.id})">
                            <span class="material-symbols-outlined" data-icon="delete">delete</span>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        const totalCollectedSpan = document.getElementById('total-collected');
        const totalUnpaidSpan = document.getElementById('total-unpaid');
        if (totalCollectedSpan) totalCollectedSpan.innerHTML = `${sumCollected} <small class="text-body-sm font-normal">ج.م</small>`;
        if (totalUnpaidSpan) totalUnpaidSpan.innerHTML = `${sumUnpaid} <small class="text-body-sm font-normal">ج.م</small>`;
    }

    // === Student Actions ===
    window.deleteStudent = async function(id) {
        const result = await Swal.fire({
            title: 'تأكيد الحذف',
            html: `سيتم حذف هذا الطالب بشكل نهائي.<br><br>لتأكيد الحذف، يرجى كتابة:<br><b class="text-error">نعم متأكد</b>`,
            icon: 'warning',
            input: 'text',
            inputPlaceholder: 'اكتب نعم متأكد...',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'حذف الطالب',
            cancelButtonText: 'إلغاء',
            inputValidator: (value) => {
                if (!value || value.trim() !== 'نعم متأكد') {
                    return 'يجب كتابة "نعم متأكد" لتأكيد الحذف!';
                }
            }
        });
        
        if(result.isConfirmed) {
            yearsData[currentYear][currentGroupName].students = yearsData[currentYear][currentGroupName].students.filter(s => s.id !== id);
            saveData();
            renderGroupsSidebar(); // To update student count
            renderTable();
            Swal.fire({ title: 'تم الحذف!', text: 'تم مسح بيانات الطالب بنجاح.', icon: 'success', confirmButtonColor: '#002068' });
        }
    };

    window.editStudent = function(id) {
        if (!currentGroupName || !yearsData[currentYear][currentGroupName]) return;
        const student = yearsData[currentYear][currentGroupName].students.find(s => s.id === id);
        if (!student) return;
        
        editingStudentId = id;
        nameInput.value = student.name;
        phoneInput.value = student.phone;
        dateInput.value = student.date.replace(/\//g, '-');
        bookingInput.value = student.booking || '';
        installment1Input.value = student.inst1 || '';
        installment2Input.value = student.inst2 || '';
        
        document.querySelector('#add-student-modal h3').textContent = 'تعديل بيانات الطالب';
        modal.classList.remove('hidden');
    };

    function closeStudentModal() {
        modal.classList.add('hidden');
        editingStudentId = null;
        nameInput.value = '';
        phoneInput.value = '';
        dateInput.value = '';
        bookingInput.value = '';
        installment1Input.value = '';
        installment2Input.value = '';
    }

    addBtn.addEventListener('click', () => {
        if (!currentGroupName || !yearsData[currentYear][currentGroupName]) {
            Swal.fire({ title: 'تنبيه', text: 'يجب إضافة مجموعة أولاً قبل إضافة طلاب.', icon: 'warning', confirmButtonColor: '#002068' });
            return;
        }
        editingStudentId = null;
        document.querySelector('#add-student-modal h3').textContent = 'إضافة طالب جديد';
        modal.classList.remove('hidden');
    });
    
    closeBtn.addEventListener('click', closeStudentModal);
    cancelBtn.addEventListener('click', closeStudentModal);

    saveBtn.addEventListener('click', () => {
        if (!currentGroupName || !yearsData[currentYear][currentGroupName]) return;
        
        const name = nameInput.value.trim();
        if (!name) {
            Swal.fire({ title: 'تنبيه', text: 'الرجاء إدخال اسم الطالب', icon: 'warning', confirmButtonColor: '#002068' });
            return;
        }

        const dateValue = dateInput.value;
        const dateStr = dateValue ? dateValue.replace(/-/g, '/') : (new Date().getFullYear() + '/' + String(new Date().getMonth() + 1).padStart(2, '0') + '/' + String(new Date().getDate()).padStart(2, '0'));

        const newStudentData = {
            name: name,
            phone: phoneInput.value.trim(),
            date: dateStr,
            booking: parseFloat(bookingInput.value) || 0,
            inst1: parseFloat(installment1Input.value) || 0,
            inst2: parseFloat(installment2Input.value) || 0
        };

        if (editingStudentId !== null) {
            // Update existing
            const index = yearsData[currentYear][currentGroupName].students.findIndex(s => s.id === editingStudentId);
            if (index !== -1) {
                yearsData[currentYear][currentGroupName].students[index] = { ...yearsData[currentYear][currentGroupName].students[index], ...newStudentData };
            }
        } else {
            // Add new
            newStudentData.id = nextStudentId++;
            yearsData[currentYear][currentGroupName].students.unshift(newStudentData); // Add to top
        }

        saveData();
        closeStudentModal();
        renderGroupsSidebar(); // To update student count
        renderTable();
    });

    // === Group Actions ===
    window.editGroup = function(event, name) {
        event.stopPropagation();
        editingGroupName = name;
        newGroupNameInput.value = name;
        newGroupPriceInput.value = yearsData[currentYear][name].price;
        document.querySelector('#add-group-modal h3').textContent = 'تعديل بيانات المجموعة';
        if (saveGroupBtn) saveGroupBtn.textContent = 'حفظ التعديلات';
        openGroupModal();
    };

    window.deleteGroup = async function(event, name) {
        event.stopPropagation();
        
        const result = await Swal.fire({
            title: 'تأكيد الحذف',
            html: `سيتم حذف مجموعة "<b>${name}</b>" وجميع طلابها بشكل نهائي.<br><br>لتأكيد الحذف، يرجى كتابة:<br><b class="text-error">نعم متأكد</b>`,
            icon: 'warning',
            input: 'text',
            inputPlaceholder: 'اكتب نعم متأكد...',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'حذف المجموعة',
            cancelButtonText: 'إلغاء',
            inputValidator: (value) => {
                if (!value || value.trim() !== 'نعم متأكد') {
                    return 'يجب كتابة "نعم متأكد" لتأكيد الحذف!';
                }
            }
        });

        if (result.isConfirmed) {
            delete yearsData[currentYear][name];
            if (currentGroupName === name) {
                const remainingGroups = Object.keys(yearsData[currentYear]);
                currentGroupName = remainingGroups.length > 0 ? remainingGroups[0] : null;
            }
            saveData();
            renderGroupsSidebar();
            renderTable();
            Swal.fire({ title: 'تم الحذف!', text: 'تم مسح المجموعة بنجاح.', icon: 'success', confirmButtonColor: '#002068' });
        }
    };

    function openGroupModal() {
        if (groupModal) groupModal.classList.remove('hidden');
    }

    function closeGroupModal() {
        if (groupModal) {
            groupModal.classList.add('hidden');
            newGroupNameInput.value = '';
            if (newGroupPriceInput) newGroupPriceInput.value = '';
            editingGroupName = null;
            document.querySelector('#add-group-modal h3').textContent = 'إضافة مجموعة جديدة';
            if (saveGroupBtn) saveGroupBtn.textContent = 'إضافة المجموعة';
        }
    }

    if (addGroupBtn) addGroupBtn.addEventListener('click', () => {
        if (!currentYear) {
            Swal.fire({ title: 'تنبيه', text: 'يجب إضافة أو اختيار سنة أكاديمية أولاً.', icon: 'warning', confirmButtonColor: '#002068' });
            return;
        }
        editingGroupName = null;
        document.querySelector('#add-group-modal h3').textContent = 'إضافة مجموعة جديدة';
        if (saveGroupBtn) saveGroupBtn.textContent = 'إضافة المجموعة';
        openGroupModal();
    });
    if (closeGroupBtn) closeGroupBtn.addEventListener('click', closeGroupModal);
    if (cancelGroupBtn) cancelGroupBtn.addEventListener('click', closeGroupModal);

    if (saveGroupBtn) {
        saveGroupBtn.addEventListener('click', () => {
            const groupName = newGroupNameInput.value.trim();
            const groupPrice = newGroupPriceInput ? parseFloat(newGroupPriceInput.value) || 0 : 0;
            if (!yearsData[currentYear]) {
                yearsData[currentYear] = {};
            }
            const groupsData = yearsData[currentYear];
            
            if (!groupName) {
                Swal.fire({ title: 'تنبيه', text: 'الرجاء إدخال اسم المجموعة', icon: 'warning', confirmButtonColor: '#002068' });
                return;
            }
            if (!groupPrice || groupPrice <= 0) {
                Swal.fire({ title: 'تنبيه', text: 'الرجاء إدخال السعر الإجمالي للكورس', icon: 'warning', confirmButtonColor: '#002068' });
                return;
            }

            if (editingGroupName) {
                if (groupName !== editingGroupName && groupsData[groupName]) {
                    Swal.fire({ title: 'خطأ', text: 'هذه المجموعة موجودة بالفعل!', icon: 'error', confirmButtonColor: '#002068' });
                    return;
                }
                
                if (groupName !== editingGroupName) {
                    groupsData[groupName] = {
                        price: groupPrice,
                        students: groupsData[editingGroupName].students
                    };
                    delete groupsData[editingGroupName];
                    if (currentGroupName === editingGroupName) {
                        currentGroupName = groupName;
                    }
                } else {
                    groupsData[editingGroupName].price = groupPrice;
                }
            } else {
                if (groupsData[groupName]) {
                    Swal.fire({ title: 'خطأ', text: 'هذه المجموعة موجودة بالفعل!', icon: 'error', confirmButtonColor: '#002068' });
                    return;
                }

                groupsData[groupName] = {
                    price: groupPrice,
                    students: []
                };
                currentGroupName = groupName;
            }
            
            saveData();
            closeGroupModal();
            renderGroupsSidebar();
            renderTable();
        });
    }

    // === Year Actions ===
    if (addYearBtn) {
        addYearBtn.addEventListener('click', async () => {
            const { value: newYear } = await Swal.fire({
                title: 'إضافة سنة أكاديمية',
                input: 'text',
                inputPlaceholder: 'ادخل رقم السنة الدراسية',
                showCancelButton: true,
                confirmButtonText: 'إضافة',
                cancelButtonText: 'إلغاء',
                confirmButtonColor: '#002068',
                inputValidator: (value) => {
                    if (!value || !value.trim()) {
                        return 'الرجاء إدخال السنة!';
                    }
                }
            });
            
            if (newYear && newYear.trim() !== '') {
                const yr = newYear.trim();
                if (yearsData[yr]) {
                    Swal.fire({ title: 'خطأ', text: 'هذه السنة موجودة بالفعل!', icon: 'error', confirmButtonColor: '#002068' });
                    return;
                }
                yearsData[yr] = { _init: true };
                currentYear = yr;
                currentGroupName = null;
                
                saveData();
                renderYearsList();
                renderGroupsSidebar();
                renderTable();
                Swal.fire({ title: 'تم بنجاح!', text: 'تمت إضافة السنة الأكاديمية بنجاح.', icon: 'success', confirmButtonColor: '#002068' });
            }
        });
    }

    if (downloadExcelBtn) {
        downloadExcelBtn.addEventListener('click', () => {
            if (!currentGroupName || !yearsData[currentYear][currentGroupName]) {
                Swal.fire({ title: 'تنبيه', text: 'لا توجد بيانات لتحميلها.', icon: 'info', confirmButtonColor: '#002068' });
                return;
            }
            
            const groupData = yearsData[currentYear][currentGroupName];
            let students = groupData.students;
            
            if (searchStudentInput && searchStudentInput.value) {
                const searchTerm = searchStudentInput.value.trim().toLowerCase();
                students = students.filter(student => student.name.toLowerCase().includes(searchTerm));
            }

            if (students.length === 0) {
                Swal.fire({ title: 'تنبيه', text: 'لا توجد بيانات لتحميلها.', icon: 'info', confirmButtonColor: '#002068' });
                return;
            }

            const headers = ['الاسم', 'الهاتف', 'تاريخ الحجز', 'الحجز', 'قسط 1', 'قسط 2', 'المتبقي', 'الحالة'];
            let csvContent = '\uFEFF' + headers.join(',') + '\n';

            students.forEach(student => {
                const total = groupData.price;
                const paid = student.booking + student.inst1 + student.inst2;
                const remaining = total - paid;
                const finalRemaining = remaining > 0 ? remaining : 0;
                const status = remaining <= 0 ? 'مكتمل' : 'غير مكتمل';

                const row = [
                    `"${student.name}"`,
                    `"${student.phone || '--'}"`,
                    `"${student.date}"`,
                    `"${student.booking || 0}"`,
                    `"${student.inst1 || 0}"`,
                    `"${student.inst2 || 0}"`,
                    `"${finalRemaining}"`,
                    `"${status}"`
                ];
                csvContent += row.join(',') + '\n';
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `طلاب_${currentGroupName}_${currentYear}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    const uploadExcelInput = document.getElementById('upload-excel-input');
    if (uploadExcelInput) {
        uploadExcelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!currentGroupName || !yearsData[currentYear][currentGroupName]) {
                Swal.fire({ title: 'تنبيه', text: 'يجب اختيار مجموعة أولاً.', icon: 'warning', confirmButtonColor: '#002068' });
                uploadExcelInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (json.length < 2) {
                        Swal.fire({ title: 'خطأ', text: 'الشيت فارغ أو لا يحتوي على بيانات صحيحة.', icon: 'error', confirmButtonColor: '#002068' });
                        return;
                    }

                    let addedCount = 0;
                    const groupData = yearsData[currentYear][currentGroupName];
                    
                    // إزالة البيانات السابقة من الجدول
                    groupData.students = [];

                    for (let i = 1; i < json.length; i++) {
                        const row = json[i];
                        if (!row || row.length === 0 || !row[0]) continue;

                        const name = String(row[0]).trim();
                        const phone = row[1] ? String(row[1]).trim() : '';
                        
                        let date = row[2];
                        if (date instanceof Date) {
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            date = `${y}/${m}/${d}`;
                        } else {
                            date = date ? String(date).trim() : (new Date().getFullYear() + '/' + String(new Date().getMonth() + 1).padStart(2, '0') + '/' + String(new Date().getDate()).padStart(2, '0'));
                        }
                        
                        const booking = parseFloat(row[3]) || 0;
                        const inst1 = parseFloat(row[4]) || 0;
                        const inst2 = parseFloat(row[5]) || 0;

                        groupData.students.unshift({
                            id: nextStudentId++,
                            name: name,
                            phone: phone,
                            date: date,
                            booking: booking,
                            inst1: inst1,
                            inst2: inst2
                        });
                        addedCount++;
                    }

                    if (addedCount > 0) {
                        saveData();
                        renderGroupsSidebar();
                        renderTable();
                        Swal.fire({ title: 'تم بنجاح!', text: `تم إزالة البيانات السابقة وإضافة ${addedCount} طالب من الملف الجديد.`, icon: 'success', confirmButtonColor: '#002068' });
                    } else {
                        Swal.fire({ title: 'تنبيه', text: 'لم يتم العثور على بيانات صحيحة في الملف.', icon: 'warning', confirmButtonColor: '#002068' });
                    }

                } catch (err) {
                    console.error(err);
                    Swal.fire({ title: 'خطأ', text: 'حدث خطأ أثناء قراءة الملف، يرجى التأكد من صيغته.', icon: 'error', confirmButtonColor: '#002068' });
                } finally {
                    uploadExcelInput.value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

});
