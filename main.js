// Todo app with one-screen layout, browser-like category tabs, deadlines, importance, editing, sorting, and progress stats
(function () {
  const TODO_STORAGE_KEY = 'simple_todos_v5'
  const CATEGORY_STORAGE_KEY = 'simple_todo_categories_v1'
  const LEGACY_TODO_KEYS = ['simple_todos_v4', 'simple_todos_v3', 'simple_todos_v2', 'simple_todos_v1']
  const DEFAULT_CATEGORIES = ['授業', '就活', '研究', '私用']
  const DUE_SOON_DAYS = 3
  const MAX_VISIBLE_TASKS = 6
  const MAX_VISIBLE_TIMELINE = 5

  const TAB_ALL = 'all'
  const TAB_DUE_SOON = 'due-soon'
  const CATEGORY_TAB_PREFIX = 'category:'

  // Add form DOM
  const form = document.getElementById('todo-form')
  const input = document.getElementById('todo-input')
  const deadlineInput = document.getElementById('deadline-input')
  const importantInput = document.getElementById('important-input')
  const categorySelect = document.getElementById('category-select')

  // Category tab DOM
  const categoryForm = document.getElementById('category-form')
  const categoryInput = document.getElementById('category-input')
  const categoryList = document.getElementById('category-list')
  const editCategorySelect = document.getElementById('edit-category-select')
  const activeTabLabel = document.getElementById('active-tab-label')

  // List / timeline DOM
  const list = document.getElementById('todo-list')
  const timeline = document.getElementById('deadline-timeline')
  const clearBtn = document.getElementById('clear-completed')

  // Search / filter / sort DOM
  const searchInput = document.getElementById('search-input')
  const statusFilter = document.getElementById('status-filter')
  const sortSelect = document.getElementById('sort-select')
  const resetControlsBtn = document.getElementById('reset-controls')
  const visibleCountText = document.getElementById('visible-count-text')

  // Badge / stat DOM
  const todoCountBadge = document.getElementById('todo-count-badge')
  const deadlineCountBadge = document.getElementById('deadline-count-badge')
  const categoryCountBadge = document.getElementById('category-count-badge')
  const statTotal = document.getElementById('stat-total')
  const statDone = document.getElementById('stat-done')
  const statImportant = document.getElementById('stat-important')
  const statOverdue = document.getElementById('stat-overdue')
  const progressLabel = document.getElementById('progress-label')
  const progressBar = document.getElementById('progress-bar')

  // Edit modal DOM
  const editModalEl = document.getElementById('edit-todo-modal')
  const editForm = document.getElementById('edit-todo-form')
  const editIdInput = document.getElementById('edit-todo-id')
  const editTextInput = document.getElementById('edit-todo-input')
  const editDeadlineInput = document.getElementById('edit-deadline-input')
  const editImportantInput = document.getElementById('edit-important-input')

  // Toast DOM
  const toastEl = document.getElementById('todo-toast')
  const toastBody = document.getElementById('todo-toast-body')

  let todos = []
  let categories = []
  let activeTab = TAB_ALL

  function createId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  function normalizeCategoryName(name) {
    return String(name || '').trim()
  }

  function dedupeCategories(values) {
    const result = []
    values.forEach((value) => {
      const category = normalizeCategoryName(value)
      if (category && !result.includes(category)) {
        result.push(category)
      }
    })
    return result
  }

  function normalizeTodo(todo) {
    return {
      id: todo.id || createId(),
      text: todo.text || '',
      done: !!todo.done,
      deadline: todo.deadline || '',
      important: !!todo.important,
      category: normalizeCategoryName(todo.category),
      createdAt: todo.createdAt || new Date().toISOString(),
      updatedAt: todo.updatedAt || todo.createdAt || new Date().toISOString(),
    }
  }

  function getStoredTodos() {
    const primary = localStorage.getItem(TODO_STORAGE_KEY)
    if (primary) return primary

    for (const key of LEGACY_TODO_KEYS) {
      const value = localStorage.getItem(key)
      if (value) return value
    }

    return null
  }

  function load() {
    try {
      const rawTodos = getStoredTodos()
      const parsedTodos = rawTodos ? JSON.parse(rawTodos) : []
      todos = Array.isArray(parsedTodos) ? parsedTodos.map(normalizeTodo) : []

      const rawCategories = localStorage.getItem(CATEGORY_STORAGE_KEY)
      const parsedCategories = rawCategories ? JSON.parse(rawCategories) : null
      const categoriesFromTodos = todos.map((todo) => todo.category).filter(Boolean)
      const baseCategories = Array.isArray(parsedCategories) ? parsedCategories : DEFAULT_CATEGORIES
      categories = dedupeCategories([...baseCategories, ...categoriesFromTodos])

      save()
    } catch (e) {
      console.error('Failed to load app data', e)
      todos = []
      categories = DEFAULT_CATEGORIES.slice()
    }
  }

  function save() {
    try {
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos))
      localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories))
    } catch (e) {
      console.error('Failed to save app data', e)
    }
  }

  function showToast(message) {
    if (!toastEl || !toastBody || typeof bootstrap === 'undefined') return

    toastBody.textContent = message
    const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 1600 })
    toast.show()
  }

  function parseDeadline(value) {
    if (!value) return null

    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  function formatDeadline(value) {
    const date = parseDeadline(value)
    if (!date) return '締切なし'

    return new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  function formatCreatedAt(value) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '不明'

    return new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  function toDatetimeLocalValue(value) {
    const date = parseDeadline(value)
    if (!date) return ''

    const offsetMs = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
  }

  function getCategoryLabel(todo) {
    return todo.category || '未分類'
  }

  function isOverdue(todo) {
    const deadline = parseDeadline(todo.deadline)
    return !!deadline && !todo.done && deadline < new Date()
  }

  function isDueSoon(todo) {
    const deadline = parseDeadline(todo.deadline)
    if (!deadline || todo.done) return false

    const now = new Date()
    const dueLimit = new Date(now.getTime() + DUE_SOON_DAYS * 86400000)
    return deadline <= dueLimit
  }

  function getDeadlineStatus(todo) {
    const deadline = parseDeadline(todo.deadline)
    if (!deadline) {
      return { label: '締切なし', className: 'text-bg-light border text-secondary', isOverdue: false }
    }

    if (todo.done) {
      return { label: '完了', className: 'text-bg-secondary', isOverdue: false }
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const targetDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate())
    const diffDays = Math.round((targetDay - today) / 86400000)

    if (deadline < now) return { label: '期限切れ', className: 'text-bg-danger', isOverdue: true }
    if (diffDays === 0) return { label: '今日', className: 'text-bg-warning', isOverdue: false }
    if (diffDays === 1) return { label: '明日', className: 'text-bg-info', isOverdue: false }
    if (diffDays <= DUE_SOON_DAYS) return { label: '期限間近', className: 'text-bg-warning', isOverdue: false }

    return { label: '予定', className: 'text-bg-primary', isOverdue: false }
  }

  function getActiveTabText() {
    if (activeTab === TAB_ALL) return 'ALL'
    if (activeTab === TAB_DUE_SOON) return '期限間近'
    if (activeTab.startsWith(CATEGORY_TAB_PREFIX)) return activeTab.slice(CATEGORY_TAB_PREFIX.length)
    return 'ALL'
  }

  function getCategoryFromTab(tabKey) {
    return tabKey.startsWith(CATEGORY_TAB_PREFIX) ? tabKey.slice(CATEGORY_TAB_PREFIX.length) : ''
  }

  function ensureValidActiveTab() {
    if (activeTab === TAB_ALL || activeTab === TAB_DUE_SOON) return

    const category = getCategoryFromTab(activeTab)
    if (!categories.includes(category)) {
      activeTab = TAB_ALL
    }
  }

  function matchesTab(todo) {
    if (activeTab === TAB_ALL) return true
    if (activeTab === TAB_DUE_SOON) return isDueSoon(todo)

    const category = getCategoryFromTab(activeTab)
    return todo.category === category
  }

  function matchesSearch(todo) {
    const keyword = searchInput.value.trim().toLowerCase()
    if (!keyword) return true

    return [todo.text, getCategoryLabel(todo)]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  }

  function matchesStatus(todo) {
    const value = statusFilter.value
    if (value === 'active') return !todo.done
    if (value === 'done') return todo.done
    if (value === 'important') return todo.important
    if (value === 'overdue') return isOverdue(todo)
    return true
  }

  function compareDateValue(a, b, direction = 'asc') {
    const aDate = parseDeadline(a.deadline)
    const bDate = parseDeadline(b.deadline)

    if (aDate && bDate) return direction === 'asc' ? aDate - bDate : bDate - aDate
    if (aDate) return -1
    if (bDate) return 1
    return 0
  }

  function compareCreatedAt(a, b, direction = 'desc') {
    const aTime = new Date(a.createdAt).getTime() || 0
    const bTime = new Date(b.createdAt).getTime() || 0
    return direction === 'asc' ? aTime - bTime : bTime - aTime
  }

  function sortTodos(values) {
    const sortMode = sortSelect.value
    return values.slice().sort((a, b) => {
      if (sortMode === 'deadline') {
        if (a.done !== b.done) return a.done ? 1 : -1
        const byDeadline = compareDateValue(a, b)
        if (byDeadline !== 0) return byDeadline
        if (a.important !== b.important) return a.important ? -1 : 1
        return compareCreatedAt(a, b)
      }

      if (sortMode === 'importance') {
        if (a.done !== b.done) return a.done ? 1 : -1
        if (a.important !== b.important) return a.important ? -1 : 1
        const byDeadline = compareDateValue(a, b)
        if (byDeadline !== 0) return byDeadline
        return compareCreatedAt(a, b)
      }

      if (sortMode === 'createdAsc') return compareCreatedAt(a, b, 'asc')
      if (sortMode === 'createdDesc') return compareCreatedAt(a, b, 'desc')

      if (sortMode === 'done') {
        if (a.done !== b.done) return a.done ? 1 : -1
        const byDeadline = compareDateValue(a, b)
        if (byDeadline !== 0) return byDeadline
        return compareCreatedAt(a, b)
      }

      return 0
    })
  }

  function sortTodosForTimeline(a, b) {
    const aDeadline = parseDeadline(a.deadline)
    const bDeadline = parseDeadline(b.deadline)

    if (a.done !== b.done) return a.done ? 1 : -1
    if (aDeadline && bDeadline) return aDeadline - bDeadline
    if (aDeadline) return -1
    if (bDeadline) return 1
    if (a.important !== b.important) return a.important ? -1 : 1

    return compareCreatedAt(a, b)
  }

  function getFilteredTodos() {
    return todos.filter((todo) => matchesTab(todo) && matchesSearch(todo) && matchesStatus(todo))
  }

  function getVisibleTodos() {
    return sortTodos(getFilteredTodos())
  }

  function updateCountBadges() {
    const totalCount = todos.length
    const doneCount = todos.filter((todo) => todo.done).length
    const activeCount = todos.filter((todo) => !todo.done).length
    const importantCount = todos.filter((todo) => todo.important && !todo.done).length
    const overdueCount = todos.filter(isOverdue).length
    const deadlineCount = todos.filter((todo) => todo.deadline && !todo.done).length
    const progressRate = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

    todoCountBadge.textContent = `未完了 ${activeCount}件`
    deadlineCountBadge.textContent = `締切 ${deadlineCount}件`
    categoryCountBadge.textContent = `カテゴリ ${categories.length}件`

    statTotal.textContent = totalCount
    statDone.textContent = doneCount
    statImportant.textContent = importantCount
    statOverdue.textContent = overdueCount
    progressLabel.textContent = `${doneCount} / ${totalCount} 完了`
    progressBar.style.width = `${progressRate}%`
    progressBar.textContent = `${progressRate}%`
    progressBar.setAttribute('aria-valuenow', String(progressRate))
    progressBar.setAttribute('aria-valuemin', '0')
    progressBar.setAttribute('aria-valuemax', '100')
  }

  function createCategoryOption(value, label) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    return option
  }

  function renderCategoryOptions(selectEl) {
    if (!selectEl) return

    const currentValue = selectEl.value
    selectEl.innerHTML = ''
    selectEl.appendChild(createCategoryOption('', '未分類'))

    categories.forEach((category) => {
      selectEl.appendChild(createCategoryOption(category, category))
    })

    selectEl.value = ['', ...categories].includes(currentValue) ? currentValue : ''
  }

  function createTabButton({ key, label, count, fixed = false }) {
    const tab = document.createElement('div')
    tab.className = `browser-tab ${activeTab === key ? 'active' : ''}`
    tab.setAttribute('role', 'presentation')
    tab.title = `${label}：${count}件`

    const mainButton = document.createElement('button')
    mainButton.type = 'button'
    mainButton.className = 'tab-main-button'
    mainButton.setAttribute('role', 'tab')
    mainButton.setAttribute('aria-selected', activeTab === key ? 'true' : 'false')

    const labelSpan = document.createElement('span')
    labelSpan.className = 'tab-label'
    labelSpan.textContent = label

    const countBadge = document.createElement('span')
    countBadge.className = activeTab === key ? 'badge text-bg-primary rounded-pill' : 'badge text-bg-light border rounded-pill text-secondary'
    countBadge.textContent = count

    mainButton.appendChild(labelSpan)
    mainButton.appendChild(countBadge)
    mainButton.addEventListener('click', () => {
      activeTab = key
      render()
    })
    tab.appendChild(mainButton)

    if (!fixed) {
      const close = document.createElement('button')
      close.type = 'button'
      close.className = 'browser-tab-close'
      close.setAttribute('aria-label', `${label}カテゴリを削除`)
      close.textContent = '×'
      close.addEventListener('click', () => removeCategory(label))
      tab.appendChild(close)
    }

    return tab
  }

  function renderCategoryTabs() {
    ensureValidActiveTab()
    categoryList.innerHTML = ''

    const allCount = todos.length
    const dueSoonCount = todos.filter(isDueSoon).length
    categoryList.appendChild(createTabButton({ key: TAB_ALL, label: 'ALL', count: allCount, fixed: true }))
    categoryList.appendChild(createTabButton({ key: TAB_DUE_SOON, label: '期限間近', count: dueSoonCount, fixed: true }))

    categories.forEach((category) => {
      const count = todos.filter((todo) => todo.category === category).length
      categoryList.appendChild(createTabButton({ key: `${CATEGORY_TAB_PREFIX}${category}`, label: category, count }))
    })
  }

  function renderCategories() {
    renderCategoryOptions(categorySelect)
    renderCategoryOptions(editCategorySelect)
    renderCategoryTabs()
  }

  function renderEmptyList(message) {
    const empty = document.createElement('li')
    empty.className = 'list-group-item text-center text-secondary py-4'
    empty.textContent = message
    list.appendChild(empty)
  }

  function renderRemainingNote(container, remainingCount, targetName) {
    if (remainingCount <= 0) return

    const note = document.createElement('div')
    note.className = 'remaining-note text-secondary text-center pt-2'
    note.textContent = `1画面表示のため、残り${remainingCount}件の${targetName}は検索・タブ・並び替えで絞り込んでください。`
    container.appendChild(note)
  }

  function renderTodoList() {
    list.innerHTML = ''

    const visibleTodos = getVisibleTodos()
    const displayTodos = visibleTodos.slice(0, MAX_VISIBLE_TASKS)
    const remainingCount = visibleTodos.length - displayTodos.length
    visibleCountText.textContent = `${displayTodos.length}件表示 / 条件一致${visibleTodos.length}件 / 全${todos.length}件`
    activeTabLabel.textContent = getActiveTabText()

    if (todos.length === 0) {
      renderEmptyList('まだタスクがありません。')
      return
    }

    if (visibleTodos.length === 0) {
      renderEmptyList('条件に一致するタスクがありません。')
      return
    }

    displayTodos.forEach((todo) => {
      const status = getDeadlineStatus(todo)

      const li = document.createElement('li')
      li.className = 'list-group-item d-flex align-items-center justify-content-between gap-2'
      if (todo.important && !todo.done) li.classList.add('list-group-item-warning')

      const left = document.createElement('div')
      left.className = 'd-flex align-items-start gap-2 flex-grow-1 min-w-0'

      const chk = document.createElement('input')
      chk.type = 'checkbox'
      chk.className = 'form-check-input flex-shrink-0 mt-1'
      chk.checked = !!todo.done
      chk.setAttribute('aria-label', `${todo.text}を完了にする`)
      chk.addEventListener('change', () => toggleDone(todo.id))

      const body = document.createElement('div')
      body.className = 'flex-grow-1 min-w-0'

      const titleRow = document.createElement('div')
      titleRow.className = 'd-flex flex-wrap align-items-center gap-1 mb-1'

      const title = document.createElement('span')
      title.className = 'todo-title fw-semibold text-break'
      title.textContent = todo.text
      if (todo.done) title.classList.add('done', 'text-secondary')
      titleRow.appendChild(title)

      const categoryBadge = document.createElement('span')
      categoryBadge.className = todo.category ? 'badge text-bg-success' : 'badge text-bg-light border text-secondary'
      categoryBadge.textContent = getCategoryLabel(todo)
      titleRow.appendChild(categoryBadge)

      if (todo.important) {
        const importantBadge = document.createElement('span')
        importantBadge.className = 'badge text-bg-warning'
        importantBadge.textContent = '重要'
        titleRow.appendChild(importantBadge)
      }

      const statusBadge = document.createElement('span')
      statusBadge.className = `badge ${status.className}`
      statusBadge.textContent = status.label
      titleRow.appendChild(statusBadge)

      const meta = document.createElement('div')
      meta.className = 'small text-secondary'
      meta.textContent = `締切：${formatDeadline(todo.deadline)} / 作成：${formatCreatedAt(todo.createdAt)}`

      body.appendChild(titleRow)
      body.appendChild(meta)
      left.appendChild(chk)
      left.appendChild(body)

      const actions = document.createElement('div')
      actions.className = 'd-flex gap-1 flex-shrink-0'

      const editBtn = document.createElement('button')
      editBtn.className = 'btn btn-outline-primary btn-sm'
      editBtn.type = 'button'
      editBtn.textContent = '編集'
      editBtn.addEventListener('click', () => openEditModal(todo.id))

      const importantBtn = document.createElement('button')
      importantBtn.className = todo.important ? 'btn btn-warning btn-sm' : 'btn btn-outline-warning btn-sm'
      importantBtn.type = 'button'
      importantBtn.textContent = todo.important ? '★' : '☆'
      importantBtn.setAttribute('aria-label', `${todo.text}の重要度を切り替える`)
      importantBtn.addEventListener('click', () => toggleImportant(todo.id))

      const del = document.createElement('button')
      del.className = 'btn btn-outline-danger btn-sm'
      del.type = 'button'
      del.textContent = '削除'
      del.addEventListener('click', () => removeTodo(todo.id))

      actions.appendChild(editBtn)
      actions.appendChild(importantBtn)
      actions.appendChild(del)
      li.appendChild(left)
      li.appendChild(actions)
      list.appendChild(li)
    })

    renderRemainingNote(list, remainingCount, 'タスク')
  }

  function renderTimelineEmpty(message = '締切が登録されたタスクはありません。') {
    timeline.innerHTML = `
      <div class="text-center text-secondary py-4">
        ${message}
      </div>
    `
  }

  function renderTimeline() {
    if (!timeline) return

    const timelineTodos = getFilteredTodos()
      .filter((todo) => todo.deadline)
      .sort(sortTodosForTimeline)

    timeline.innerHTML = ''

    if (todos.length === 0) {
      renderTimelineEmpty('まだタスクがありません。')
      return
    }

    if (timelineTodos.length === 0) {
      renderTimelineEmpty('この条件で表示できる締切タスクはありません。')
      return
    }

    const displayTodos = timelineTodos.slice(0, MAX_VISIBLE_TIMELINE)
    const remainingCount = timelineTodos.length - displayTodos.length

    displayTodos.forEach((todo) => {
      const status = getDeadlineStatus(todo)

      const item = document.createElement('div')
      item.className = 'timeline-item'
      if (todo.done) item.classList.add('is-done')
      if (status.isOverdue) item.classList.add('is-overdue')

      const dot = document.createElement('span')
      dot.className = 'timeline-dot'

      const card = document.createElement('div')
      card.className = 'card border bg-body'

      const cardBody = document.createElement('div')
      cardBody.className = 'card-body p-2'

      const head = document.createElement('div')
      head.className = 'd-flex flex-wrap align-items-center gap-1 mb-1'

      const deadline = document.createElement('span')
      deadline.className = 'fw-bold small'
      deadline.textContent = formatDeadline(todo.deadline)

      const statusBadge = document.createElement('span')
      statusBadge.className = `badge ${status.className}`
      statusBadge.textContent = status.label

      const categoryBadge = document.createElement('span')
      categoryBadge.className = todo.category ? 'badge text-bg-success' : 'badge text-bg-light border text-secondary'
      categoryBadge.textContent = getCategoryLabel(todo)

      head.appendChild(deadline)
      head.appendChild(statusBadge)
      head.appendChild(categoryBadge)

      if (todo.important) {
        const importantBadge = document.createElement('span')
        importantBadge.className = 'badge text-bg-warning'
        importantBadge.textContent = '重要'
        head.appendChild(importantBadge)
      }

      const title = document.createElement('div')
      title.className = todo.done ? 'small text-secondary text-decoration-line-through' : 'small fw-semibold'
      title.textContent = todo.text

      cardBody.appendChild(head)
      cardBody.appendChild(title)
      card.appendChild(cardBody)
      item.appendChild(dot)
      item.appendChild(card)
      timeline.appendChild(item)
    })

    renderRemainingNote(timeline, remainingCount, '締切タスク')
  }

  function render() {
    ensureValidActiveTab()
    updateCountBadges()
    renderCategories()
    renderTodoList()
    renderTimeline()
  }

  function addTodo(text, deadline, important, category) {
    const trimmedText = text.trim()
    if (!trimmedText) return

    const selectedCategory = categories.includes(category) ? category : ''
    const now = new Date().toISOString()
    const todo = {
      id: createId(),
      text: trimmedText,
      deadline: deadline || '',
      important: !!important,
      category: selectedCategory,
      done: false,
      createdAt: now,
      updatedAt: now,
    }

    todos.unshift(todo)
    save()
    render()
    showToast('追加しました')
  }

  function addCategory(name) {
    const category = normalizeCategoryName(name)
    if (!category) {
      showToast('カテゴリ名を入力してください')
      return
    }

    if (['ALL', '期限間近'].includes(category.toUpperCase()) || category === '期限間近') {
      showToast('そのカテゴリ名は予約されています')
      return
    }

    if (categories.includes(category)) {
      showToast('同じカテゴリが既にあります')
      return
    }

    categories.push(category)
    activeTab = `${CATEGORY_TAB_PREFIX}${category}`
    save()
    render()
    categorySelect.value = category
    showToast('カテゴリを追加しました')
  }

  function removeCategory(category) {
    const target = normalizeCategoryName(category)
    if (!target) return

    categories = categories.filter((item) => item !== target)
    todos = todos.map((todo) => (
      todo.category === target ? { ...todo, category: '', updatedAt: new Date().toISOString() } : todo
    ))

    if (activeTab === `${CATEGORY_TAB_PREFIX}${target}`) {
      activeTab = TAB_ALL
    }

    save()
    render()
    showToast('カテゴリを削除しました')
  }

  function toggleDone(id) {
    todos = todos.map((todo) => (
      todo.id === id ? { ...todo, done: !todo.done, updatedAt: new Date().toISOString() } : todo
    ))
    save()
    render()
  }

  function toggleImportant(id) {
    todos = todos.map((todo) => (
      todo.id === id ? { ...todo, important: !todo.important, updatedAt: new Date().toISOString() } : todo
    ))
    save()
    render()
    showToast('重要度を更新しました')
  }

  function removeTodo(id) {
    todos = todos.filter((todo) => todo.id !== id)
    save()
    render()
    showToast('削除しました')
  }

  function updateTodo(id, values) {
    const trimmedText = values.text.trim()
    if (!trimmedText) {
      showToast('タスク名を入力してください')
      return
    }

    const selectedCategory = categories.includes(values.category) ? values.category : ''
    todos = todos.map((todo) => (
      todo.id === id
        ? {
            ...todo,
            text: trimmedText,
            deadline: values.deadline || '',
            important: !!values.important,
            category: selectedCategory,
            updatedAt: new Date().toISOString(),
          }
        : todo
    ))

    save()
    render()
    showToast('タスクを更新しました')
  }

  function clearCompleted() {
    const beforeCount = todos.length
    todos = todos.filter((todo) => !todo.done)
    save()
    render()

    const removedCount = beforeCount - todos.length
    showToast(removedCount > 0 ? '完了済みタスクを削除しました' : '削除対象がありません')
  }

  function openEditModal(id) {
    const todo = todos.find((item) => item.id === id)
    if (!todo) return

    renderCategoryOptions(editCategorySelect)
    editIdInput.value = todo.id
    editTextInput.value = todo.text
    editDeadlineInput.value = toDatetimeLocalValue(todo.deadline)
    editCategorySelect.value = categories.includes(todo.category) ? todo.category : ''
    editImportantInput.checked = !!todo.important

    if (typeof bootstrap !== 'undefined') {
      bootstrap.Modal.getOrCreateInstance(editModalEl).show()
    }
  }

  function resetControls() {
    searchInput.value = ''
    statusFilter.value = 'all'
    sortSelect.value = 'deadline'
    activeTab = TAB_ALL
    render()
    showToast('表示条件をリセットしました')
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()

    addTodo(input.value, deadlineInput.value, importantInput.checked, categorySelect.value)

    input.value = ''
    deadlineInput.value = ''
    importantInput.checked = false
    categorySelect.value = ''
    input.focus()
  })

  categoryForm.addEventListener('submit', (e) => {
    e.preventDefault()

    addCategory(categoryInput.value)
    categoryInput.value = ''
    categoryInput.focus()
  })

  editForm.addEventListener('submit', (e) => {
    e.preventDefault()

    updateTodo(editIdInput.value, {
      text: editTextInput.value,
      deadline: editDeadlineInput.value,
      category: editCategorySelect.value,
      important: editImportantInput.checked,
    })

    if (typeof bootstrap !== 'undefined') {
      bootstrap.Modal.getOrCreateInstance(editModalEl).hide()
    }
  })

  clearBtn.addEventListener('click', clearCompleted)
  searchInput.addEventListener('input', render)
  statusFilter.addEventListener('change', render)
  sortSelect.addEventListener('change', render)
  resetControlsBtn.addEventListener('click', resetControls)

  // init
  load()
  render()
})()
